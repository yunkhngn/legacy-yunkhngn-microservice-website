import { Injectable, Inject, Logger } from '@nestjs/common';
import { ISubscriberRepository } from './domain/subscriber.repository.interface';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../../audit-logs/domain/audit-log.types';

export interface NewsletterBlog {
  title: string;
  slug: string;
  seoDescription?: string | null;
  thumbnail?: string | null;
}

export interface NewsletterProject {
  title: string;
  slug: string;
  description?: string | null;
  cover?: string | null;
}

export interface NewsletterSubscriber {
  email: string;
  token: string;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @Inject(ISubscriberRepository)
    private readonly repository: ISubscriberRepository,
    private readonly emailService: EmailService,
    private readonly auditLogsService: AuditLogsService,
  ) { }

  async subscribe(email: string) {
    const existing = await this.repository.findByEmail(email);
    if (existing) {
      return { message: 'Already subscribed' };
    }
    const token = uuidv4();
    const subscriber = await this.repository.create(email, token);
    const unsubscribeLink = this.unsubscribeUrl(token);
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

  renderBlogEmail(blog: NewsletterBlog): { subject: string; content: string } {
    const frontendUrl = this.frontendUrl();
    const blogUrl = `${frontendUrl}/blog/${blog.slug}`;
    const description = blog.seoDescription || 'Click to read full post...';
    const truncatedDescription =
      description.length > 200
        ? `${description.substring(0, 197)}...`
        : description;

    const content = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${blog.thumbnail
        ? `<div style="width: 100%; height: 200px; background-image: url('${blog.thumbnail}'); background-size: cover; background-position: center;"></div>`
        : ''
      }
        <div style="padding: 30px;">
          <h2 style="color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">New Blog Post</h2>
          <h1 style="font-size: 24px; font-weight: 700; margin: 10px 0 15px; line-height: 1.3;">
            <a href="${blogUrl}" style="text-decoration: none; color: #1a1a1a;">${blog.title}</a>
          </h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ${truncatedDescription}
          </p>
          <div style="text-align: center;">
            <a href="${blogUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Read Full Story</a>
          </div>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
          <p style="margin: 0;">You received this email because you subscribed to yunkhngn.dev.</p>
        </div>
      </div>
    `;
    return { subject: `New Post: ${blog.title}`, content };
  }

  async sendOneBlog(blog: NewsletterBlog, subscriber: NewsletterSubscriber) {
    const { subject, content } = this.renderBlogEmail(blog);
    const unsubscribeLink = this.unsubscribeUrl(subscriber.token);
    return this.emailService.sendNewsletter(
      subscriber.email,
      subject,
      content,
      unsubscribeLink,
    );
  }

  renderProjectEmail(project: NewsletterProject): { subject: string; content: string } {
    const frontendUrl = this.frontendUrl();
    const projectUrl = `${frontendUrl}/project/${project.slug}`;
    const description = project.description || 'Check out my new project...';
    const truncatedDescription =
      description.length > 200
        ? `${description.substring(0, 197)}...`
        : description;

    const content = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${project.cover
        ? `<div style="width: 100%; height: 200px; background-image: url('${project.cover}'); background-size: cover; background-position: center;"></div>`
        : ''
      }
        <div style="padding: 30px;">
          <h2 style="color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">New Project</h2>
          <h1 style="font-size: 24px; font-weight: 700; margin: 10px 0 15px; line-height: 1.3;">
            <a href="${projectUrl}" style="text-decoration: none; color: #1a1a1a;">${project.title}</a>
          </h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ${truncatedDescription}
          </p>
          <div style="text-align: center;">
            <a href="${projectUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">View Project Details</a>
          </div>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
          <p style="margin: 0;">You received this email because you subscribed to yunkhngn.dev.</p>
        </div>
      </div>
    `;
    return { subject: `New Project: ${project.title}`, content };
  }

  async sendOneProject(project: NewsletterProject, subscriber: NewsletterSubscriber) {
    const { subject, content } = this.renderProjectEmail(project);
    const unsubscribeLink = this.unsubscribeUrl(subscriber.token);
    return this.emailService.sendNewsletter(
      subscriber.email,
      subject,
      content,
      unsubscribeLink,
    );
  }

  async findAllSubscribers() {
    return this.repository.findAll();
  }

  // Kept for backwards compatibility with blog.service.ts until Task 12 replaces it.
  async sendToAll(subject: string, content: string) {
    const subscribers = await this.repository.findAll();
    if (subscribers.length === 0) return { sent: 0 };
    for (const subscriber of subscribers) {
      const unsubscribeLink = this.unsubscribeUrl(subscriber.token ?? '');
      this.emailService
        .sendNewsletter(subscriber.email, subject, content, unsubscribeLink)
        .catch((err) =>
          this.logger.error(
            `Failed to send newsletter to ${subscriber.email}`,
            err,
          ),
        );
    }

    void this.auditLogsService.log({
      action: AuditAction.SEND_NEWSLETTER,
      entity: AuditEntity.NEWSLETTER,
      details: { subject, sentCount: subscribers.length },
    });

    return { sent: subscribers.length };
  }

  private frontendUrl(): string {
    return (process.env.FRONTEND_URL || 'https://yunkhngn.com').replace(
      /\/$/,
      '',
    );
  }

  private unsubscribeUrl(token: string): string {
    return `${this.frontendUrl()}/newsletter/unsubscribe?token=${token}`;
  }
}
