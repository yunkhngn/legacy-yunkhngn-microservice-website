export class ChatLog {
  id: string;
  userMessage: string;
  aiResponse: string;
  imageUrl?: string;
  language: string;
  responseTime?: number;
  createdAt: Date;
}
