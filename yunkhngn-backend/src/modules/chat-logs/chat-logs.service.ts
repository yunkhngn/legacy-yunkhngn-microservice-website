import { Injectable, Inject, Logger } from '@nestjs/common';
import { IChatLogRepository } from './domain/chat-log.repository.interface';
import { ChatLog } from './domain/chat-log.entity';

@Injectable()
export class ChatLogsService {
  private readonly logger = new Logger(ChatLogsService.name);

  constructor(
    @Inject(IChatLogRepository)
    private readonly chatLogRepository: IChatLogRepository,
  ) {}

  async log(data: {
    userMessage: string;
    aiResponse: string;
    imageUrl?: string;
    language?: string;
    responseTime?: number;
  }): Promise<ChatLog> {
    return this.chatLogRepository.create(data);
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const result = await this.chatLogRepository.findAll({
      skip,
      take: limit,
      search,
    });

    return {
      data: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        lastPage: Math.ceil(result.total / limit),
      },
    };
  }

  async findById(id: string) {
    return this.chatLogRepository.findById(id);
  }

  async remove(id: string) {
    return this.chatLogRepository.delete(id);
  }

  async removeAll() {
    return this.chatLogRepository.deleteAll();
  }
}
