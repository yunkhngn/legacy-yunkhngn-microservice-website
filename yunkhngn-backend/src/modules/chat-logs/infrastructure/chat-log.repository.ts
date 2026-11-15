import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IChatLogRepository } from '../domain/chat-log.repository.interface';
import { ChatLog } from '../domain/chat-log.entity';

@Injectable()
export class PrismaChatLogRepository implements IChatLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userMessage: string;
    aiResponse: string;
    imageUrl?: string;
    language?: string;
    responseTime?: number;
  }): Promise<ChatLog> {
    return this.prisma.chatLog.create({ data });
  }

  async findAll(options: {
    skip?: number;
    take?: number;
    search?: string;
  }): Promise<{ data: ChatLog[]; total: number }> {
    const where = options.search
      ? {
          OR: [
            { userMessage: { contains: options.search } },
            { aiResponse: { contains: options.search } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.chatLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.skip,
        take: options.take,
      }),
      this.prisma.chatLog.count({ where }),
    ]);

    return {
      data,
      total,
    };
  }

  async findById(id: string): Promise<ChatLog | null> {
    return this.prisma.chatLog.findUnique({ where: { id } });
  }

  async delete(id: string): Promise<ChatLog> {
    return this.prisma.chatLog.delete({ where: { id } });
  }

  async deleteAll(): Promise<number> {
    const result = await this.prisma.chatLog.deleteMany();
    return result.count;
  }
}
