import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MonitorGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MonitorGateway');
  // Track backend-to-agent native WebSocket connections per Socket.io client id
  private connections = new Map<string, any>();
  private agentUrl: string;

  constructor(private configService: ConfigService) {
    // Replace http:// with ws:// for WebSocket protocol
    const httpUrl =
      this.configService.get<string>('MONITOR_AGENT_URL') ||
      'http://monitor-agent:9100';
    this.agentUrl = httpUrl.replace(/^http/, 'ws');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from monitor: ${client.id}`);
    this.cleanupConnection(client.id);
  }

  @SubscribeMessage('monitor:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string },
  ) {
    if (!data || !data.containerId) {
      client.emit('monitor:error', { message: 'Missing containerId' });
      return;
    }

    this.logger.log(
      `Client ${client.id} subscribing to logs for ${data.containerId}`,
    );

    // Cleanup previous connection if any
    this.cleanupConnection(client.id);

    try {
      // Connect to sidecar agent using global native WebSocket (Node 22+)
      const agentWsUrl = `${this.agentUrl}/logs?containerId=${data.containerId}`;
      this.logger.log(`Connecting to agent WebSocket: ${agentWsUrl}`);

      const ws = new WebSocket(agentWsUrl);

      ws.onopen = () => {
        this.logger.log(`Connected to agent logs for ${data.containerId}`);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data.toString());
          client.emit('monitor:log', parsed);
        } catch {
          // Fallback if not JSON
          client.emit('monitor:log', {
            type: 'log',
            message: event.data.toString(),
          });
        }
      };

      ws.onerror = (err) => {
        this.logger.error(
          `Agent WebSocket error for ${data.containerId}:`,
          err,
        );
        client.emit('monitor:error', { message: 'Agent WebSocket error' });
      };

      ws.onclose = () => {
        this.logger.log(`Agent WebSocket closed for ${data.containerId}`);
        client.emit('monitor:closed', { containerId: data.containerId });
        this.connections.delete(client.id);
      };

      this.connections.set(client.id, ws);
    } catch (error) {
      this.logger.error('Failed to create agent WebSocket connection', error);
      client.emit('monitor:error', { message: 'Internal gateway error' });
    }
  }

  @SubscribeMessage('monitor:unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribing from logs`);
    this.cleanupConnection(client.id);
  }

  private cleanupConnection(clientId: string) {
    const ws = this.connections.get(clientId);
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
      this.connections.delete(clientId);
    }
  }
}
