import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { INotificationRepository } from '../domain/notification.repository.interface';
import { Notification } from '../domain/notification.entity';

@Injectable()
export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<Notification> {
    return this.prisma.notification.create({
      data,
    });
  }

  async findAll(options: {
    skip?: number;
    take?: number;
  }): Promise<{ data: Notification[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip: options.skip,
        take: options.take,
      }),
      this.prisma.notification.count(),
    ]);

    return {
      data,
      total,
    };
  }

  async countUnread(): Promise<number> {
    return this.prisma.notification.count({
      where: { read: false },
    });
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return result.count;
  }

  async delete(id: string): Promise<Notification> {
    return this.prisma.notification.delete({
      where: { id },
    });
  }
}
