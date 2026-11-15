import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MonitorService {
  private agentUrl: string;

  constructor(private configService: ConfigService) {
    this.agentUrl =
      this.configService.get<string>('MONITOR_AGENT_URL') ||
      'http://monitor-agent:9100';
  }

  async getContainers() {
    try {
      const res = await fetch(`${this.agentUrl}/containers`);
      if (!res.ok) {
        throw new Error(`Agent returned ${res.status}`);
      }
      return await res.json();
    } catch (error) {
      console.error('Failed to fetch containers from monitor agent:', error);
      throw error;
    }
  }
}
