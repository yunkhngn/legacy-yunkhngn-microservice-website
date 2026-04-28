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
import * as WebSocket from 'ws';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class MonitorGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MonitorGateway');
  // Store connections per client: Map<socketId, { logs?: WS, stats?: WS }>
  private connections = new Map<string, { logs?: any; stats?: any }>();
  private agentUrl: string;

  constructor(private configService: ConfigService) {
    const httpUrl = this.configService.get<string>('MONITOR_AGENT_URL') || 'http://monitor-agent:9100';
    this.agentUrl = httpUrl.replace(/^http/, 'ws');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from monitor: ${client.id}`);
    this.cleanupClient(client.id);
  }

  @SubscribeMessage('monitor:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string },
  ) {
    this.setupAgentConnection(client, data.containerId, 'logs');
  }

  @SubscribeMessage('monitor:subscribeStats')
  handleSubscribeStats(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string },
  ) {
    this.setupAgentConnection(client, data.containerId, 'stats');
  }

  @SubscribeMessage('monitor:unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    this.cleanupClient(client.id, 'logs');
  }

  @SubscribeMessage('monitor:unsubscribeStats')
  handleUnsubscribeStats(@ConnectedSocket() client: Socket) {
    this.cleanupClient(client.id, 'stats');
  }

  private setupAgentConnection(client: Socket, containerId: string, type: 'logs' | 'stats') {
    if (!containerId) return;

    this.logger.log(`Client ${client.id} subscribing to ${type} for ${containerId}`);
    this.cleanupClient(client.id, type);

    try {
      const agentWsUrl = `${this.agentUrl}/${type}?containerId=${containerId}`;
      const ws = new WebSocket(agentWsUrl);

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data.toString());
          client.emit(type === 'logs' ? 'monitor:log' : 'monitor:stats', parsed);
        } catch {}
      };

      ws.onerror = (err) => {
        this.logger.error(`Agent WS error (${type}) for ${containerId}:`, err);
        client.emit('monitor:error', { message: `Agent WebSocket error (${type})` });
      };

      ws.onclose = () => {
        this.logger.log(`Agent WS closed (${type}) for ${containerId}`);
        const clientConns = this.connections.get(client.id);
        if (clientConns) {
          delete clientConns[type];
          if (!clientConns.logs && !clientConns.stats) this.connections.delete(client.id);
        }
      };

      const clientConns = this.connections.get(client.id) || {};
      clientConns[type] = ws;
      this.connections.set(client.id, clientConns);
    } catch (error) {
      this.logger.error(`Failed to create agent WS (${type}) connection`, error);
    }
  }

  private cleanupClient(clientId: string, type?: 'logs' | 'stats') {
    const conns = this.connections.get(clientId);
    if (!conns) return;

    if (type) {
      if (conns[type]) {
        try { conns[type].close(); } catch {}
        delete conns[type];
      }
    } else {
      try { conns.logs?.close(); } catch {}
      try { conns.stats?.close(); } catch {}
      this.connections.delete(clientId);
      return;
    }

    if (!conns.logs && !conns.stats) this.connections.delete(clientId);
  }
}
