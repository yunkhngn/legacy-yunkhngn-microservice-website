import { ChatLog } from './chat-log.entity';

export interface IChatLogRepository {
  create(data: {
    userMessage: string;
    aiResponse: string;
    imageUrl?: string;
    language?: string;
    responseTime?: number;
  }): Promise<ChatLog>;

  findAll(options: {
    skip?: number;
    take?: number;
    search?: string;
  }): Promise<{ data: ChatLog[]; total: number }>;

  findById(id: string): Promise<ChatLog | null>;

  delete(id: string): Promise<ChatLog>;

  deleteAll(): Promise<number>;
}

export const IChatLogRepository = Symbol('IChatLogRepository');
