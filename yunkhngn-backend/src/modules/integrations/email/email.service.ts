import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { SettingsService } from '../../settings/settings.service';
import {
  getNotificationTemplate,
  getResponseTemplate,
  getCustomMailTemplate,
  getWelcomeTemplate,
  getNewsletterTemplate,
} from './templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getResendClient(): Promise<Resend> {
    const apiKey =
      (await this.settingsService.getDecryptedSetting('resend_api_key')) ||
      process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Resend API key is not configured. Please configure resend_api_key in Settings.',
      );
    }

    return new Resend(apiKey);
  }

  async sendContactNotification(contact: any) {
    try {
      const resend = await this.getResendClient();

      const adminEmail =
        (await this.settingsService.getDecryptedSetting('admin_email')) ||
        process.env.ADMIN_EMAIL ||
        'admin@example.com';
      const resendDomain =
        (await this.settingsService.getDecryptedSetting('resend_domain')) ||
        process.env.RESEND_DOMAIN;

      const html = getNotificationTemplate({
        name: contact.name,
        email: contact.email,
        phone: contact.phone || '',
        company: contact.company || '',
        subject: contact.subject,
        message: contact.message.replace(/\n/g, '<br>'),
        category: contact.category?.toUpperCase() || 'GENERAL',
        timestamp: new Date(contact.createdAt).toLocaleString(),
        adminUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/contact`,
      });

      const { data, error } = await resend.emails.send({
        from: `Website Contact <noreply@${resendDomain}>`,
        to: adminEmail,
        subject: `New Contact: ${contact.subject}`,
        html,
      });

      if (error) {
        this.logger.error('Failed to send notification email:', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Error sending notification email:', error.stack || error.message);
      return null;
    }
  }

  async sendContactResponse(contact: any, response: string) {
    try {
      const resend = await this.getResendClient();

      const adminEmail =
        (await this.settingsService.getDecryptedSetting('admin_email')) ||
        process.env.ADMIN_EMAIL ||
        'admin@example.com';
      const resendDomain =
        (await this.settingsService.getDecryptedSetting('resend_domain')) ||
        process.env.RESEND_DOMAIN;

      const html = getResponseTemplate({
        name: contact.name,
        subject: contact.subject,
        response: response.replace(/\n/g, '<br>'),
        originalMessage: contact.message.replace(/\n/g, '<br>'),
      });

      const { data, error } = await resend.emails.send({
        from: `Khoa Nguyen <noreply@${resendDomain}>`,
        to: contact.email,
        replyTo: adminEmail,
        subject: `Re: ${contact.subject}`,
        html,
      });

      if (error) {
        this.logger.error('Failed to send response email:', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Error sending response email:', error.stack || error.message);
      return null;
    }
  }

  async sendCustomMail(
    to: string,
    name: string,
    subject: string,
    content: string,
    salutation: string = 'Hi',
  ) {
    try {
      const resend = await this.getResendClient();

      const adminEmail =
        (await this.settingsService.getDecryptedSetting('admin_email')) ||
        process.env.ADMIN_EMAIL ||
        'admin@example.com';
      const resendDomain =
        (await this.settingsService.getDecryptedSetting('resend_domain')) ||
        process.env.RESEND_DOMAIN;

      const html = getCustomMailTemplate({
        name,
        subject,
        content,
        salutation,
      });

      const { data, error } = await resend.emails.send({
        from: `Khoa Nguyen <noreply@${resendDomain}>`,
        to,
        bcc: adminEmail,
        replyTo: adminEmail,
        subject,
        html,
      });

      if (error) {
        this.logger.error('Failed to send custom email:', error);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Error sending custom email:', error.stack || error.message);
      return null;
    }
  }

  async sendWelcomeEmail(to: string, unsubscribeLink: string) {
    try {
      const resend = await this.getResendClient();

      const resendDomain =
        (await this.settingsService.getDecryptedSetting('resend_domain')) ||
        process.env.RESEND_DOMAIN;

      if (!resendDomain) {
        throw new Error('Resend domain is not configured. Please configure resend_domain in Settings.');
      }

      const html = getWelcomeTemplate(unsubscribeLink);

      const { data, error } = await resend.emails.send({
        from: `Khoa Nguyen <noreply@${resendDomain}>`,
        to,
        subject: 'Welcome to my Newsletter!',
        html,
      });

      if (error) {
        throw new Error(`Resend API error: ${JSON.stringify(error)}`);
      }
      return data;
    } catch (error) {
      this.logger.error('Error sending welcome email:', error.stack || error.message);
      throw error;
    }
  }

  async sendNewsletter(
    to: string,
    subject: string,
    content: string,
    unsubscribeLink: string,
  ) {
    try {
      const resend = await this.getResendClient();

      const resendDomain =
        (await this.settingsService.getDecryptedSetting('resend_domain')) ||
        process.env.RESEND_DOMAIN;

      if (!resendDomain) {
        throw new Error('Resend domain is not configured. Please configure resend_domain in Settings.');
      }

      const html = getNewsletterTemplate(content, unsubscribeLink);

      const { data, error } = await resend.emails.send({
        from: `Khoa Nguyen <noreply@${resendDomain}>`,
        to,
        subject,
        html,
      });

      if (error) {
        throw new Error(`Resend API error: ${JSON.stringify(error)}`);
      }
      return data;
    } catch (error) {
      this.logger.error('Error sending newsletter email:', error.stack || error.message);
      throw error;
    }
  }
}
