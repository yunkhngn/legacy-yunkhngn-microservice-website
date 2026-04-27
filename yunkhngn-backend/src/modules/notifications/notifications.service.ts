import { Injectable, Inject, Logger } from '@nestjs/common';
import { INotificationRepository } from './domain/notification.repository.interface';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from './domain/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(INotificationRepository)
    private readonly notificationRepository: INotificationRepository,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    type: string,
    message: string,
    link?: string,
  ): Promise<Notification> {
    this.logger.log(
      `Creating notification: ${type} - ${message.substring(0, 50)}...`,
    );
    const notification = await this.notificationRepository.create({
      type,
      message,
      link,
    });

    this.notificationsGateway.sendNotification(notification);
    return notification;
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const { data: notifications, total } =
      await this.notificationRepository.findAll({
        skip,
        take: limit,
      });

    const unreadCount = await this.notificationRepository.countUnread();

    return {
      data: notifications,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async markAsRead(id: string): Promise<Notification> {
    this.logger.log(`Marking notification as read: ${id}`);
    return this.notificationRepository.markAsRead(id);
  }

  async markAllAsRead() {
    this.logger.log('Marking all notifications as read');
    const count = await this.notificationRepository.markAllAsRead();
    return { updated: count };
  }

  async remove(id: string): Promise<Notification> {
    this.logger.log(`Removing notification: ${id}`);
    return this.notificationRepository.delete(id);
  }
}
