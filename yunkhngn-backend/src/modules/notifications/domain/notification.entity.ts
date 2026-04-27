export class Notification {
  id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}
