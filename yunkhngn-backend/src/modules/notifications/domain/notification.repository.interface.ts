import { Notification } from './notification.entity';

export interface INotificationRepository {
  create(data: any): Promise<Notification>;
  findAll(options: {
    skip?: number;
    take?: number;
  }): Promise<{ data: Notification[]; total: number }>;
  countUnread(): Promise<number>;
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(): Promise<number>;
  delete(id: string): Promise<Notification>;
}

export const INotificationRepository = Symbol('INotificationRepository');
