import { Injectable, Inject, Logger } from '@nestjs/common';
import { ISubscriberRepository } from './domain/subscriber.repository.interface';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @Inject(ISubscriberRepository)
    private readonly repository: ISubscriberRepository,
    private readonly emailService: EmailService,
  ) {}

  async subscribe(email: string) {
    const existing = await this.repository.findByEmail(email);
    if (existing) {
      return { message: 'Already subscribed' };
    }

    const token = uuidv4();
    const subscriber = await this.repository.create(email, token);

    const frontendUrl = process.env.FRONTEND_URL || 'https://yunkhngn.com';
    const unsubscribeLink = `${frontendUrl}/newsletter/unsubscribe?token=${token}`;

    this.emailService
      .sendWelcomeEmail(email, unsubscribeLink)
      .catch((err) =>
        this.logger.error(`Failed to send welcome email to ${email}`, err),
      );

    return { message: 'Successfully subscribed', id: subscriber.id };
  }

  async unsubscribe(token: string) {
    const subscriber = await this.repository.findByToken(token);
    if (!subscriber) {
      return { message: 'Subscriber not found' };
    }

    await this.repository.delete(subscriber.id);
    return { message: 'Successfully unsubscribed' };
  }

  async sendToAll(subject: string, content: string) {
    const subscribers = await this.repository.findAll();
    if (subscribers.length === 0) return { sent: 0 };

    const frontendUrl = process.env.FRONTEND_URL || 'https://yunkhngn.com';

    // Loop and send individually for unique unsubscribe links
    for (const subscriber of subscribers) {
      const unsubscribeLink = `${frontendUrl}/newsletter/unsubscribe?token=${subscriber.token}`;
      this.emailService
        .sendNewsletter(subscriber.email, subject, content, unsubscribeLink)
        .catch((err) =>
          this.logger.error(
            `Failed to send newsletter to ${subscriber.email}`,
            err,
          ),
        );
    }

    return { sent: subscribers.length };
  }
}
