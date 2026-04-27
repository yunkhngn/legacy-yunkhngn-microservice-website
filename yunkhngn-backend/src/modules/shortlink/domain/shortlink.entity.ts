export class ShortLink {
  id: string;
  code: string;
  targetUrl: string;
  title?: string;
  clicks: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
