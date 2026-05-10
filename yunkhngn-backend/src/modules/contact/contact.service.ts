import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { IContactRepository } from './domain/contact.repository.interface';
import { EmailService } from '../integrations/email/email.service';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Contact } from './domain/contact.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @Inject(IContactRepository)
    private readonly contactRepository: IContactRepository,
    private readonly emailService: EmailService,
    private readonly aiService: AiService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createContact(data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    subject: string;
    message: string;
    category?: string;
  }): Promise<Contact> {
    this.logger.log(`New contact message from: ${data.email}`);

    const contact = await this.contactRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      subject: data.subject,
      message: data.message,
      category: data.category || 'general',
      status: 'new',
    });

    // Send notification email to admin (non-blocking)
    this.emailService
      .sendContactNotification(contact)
      .catch((err) =>
        this.logger.error('Failed to send notification email', err.stack),
      );

    // Send real-time notification
    this.notificationsService
      .create(
        'CONTACT',
        `New contact message from ${contact.name}: ${contact.subject}`,
        `/admin/contact`,
      )
      .catch((err) =>
        this.logger.error('Failed to send real-time notification', err.stack),
      );

    await this.cacheManager.del('admin_dashboard_stats');

    return contact;
  }

  async getAllContacts(): Promise<Contact[]> {
    return this.contactRepository.findAll();
  }

  async getContactById(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(id);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async updateContactStatus(id: string, status: string): Promise<Contact> {
    this.logger.log(`Updating contact status: ${id} to ${status}`);
    const result = await this.contactRepository.update(id, { status });
    await this.cacheManager.del('admin_dashboard_stats');
    return result;
  }

  async respondToContact(id: string, response: string): Promise<Contact> {
    const contact = await this.getContactById(id);

    this.logger.log(`Sending response to contact: ${contact.email}`);

    // Send response email to customer
    await this.emailService.sendContactResponse(contact, response);

    // Update contact with response
    const result = await this.contactRepository.update(id, {
      adminResponse: response,
      status: 'responded',
      respondedAt: new Date(),
    });
    await this.cacheManager.del('admin_dashboard_stats');
    return result;
  }

  async generateAiResponse(
    id: string,
    language?: string,
    existingText?: string,
  ) {
    const contact = await this.getContactById(id);

    const lang = language === 'vi' ? 'Vietnamese' : 'English';
    this.logger.log(`Generating AI response for contact: ${id} in ${lang}`);

    let prompt = '';

    if (existingText) {
      // Expand/improve existing text
      prompt = `You are a professional assistant helping to improve a response to a contact form message.

Contact Details:
- Name: ${contact.name}
- Email: ${contact.email}
${contact.company ? `- Company: ${contact.company}` : ''}
${contact.phone ? `- Phone: ${contact.phone}` : ''}
- Category: ${contact.category}

Original Message:
${contact.message}

Current Draft Response:
${existingText}

Task: Expand and improve the current draft response. Make it more professional, friendly, and thorough while keeping the same tone and intent. Address any missing points from the original message.

IMPORTANT: Respond in ${lang}. Keep the response concise but complete. Do not include a subject line.`;
    } else {
      // Generate new response
      prompt = `You are a professional assistant helping to respond to a contact form message.

Contact Details:
- Name: ${contact.name}
- Email: ${contact.email}
${contact.company ? `- Company: ${contact.company}` : ''}
${contact.phone ? `- Phone: ${contact.phone}` : ''}
- Category: ${contact.category}

Message:
${contact.message}

Task: Generate a professional, friendly, and helpful response. Be concise but thorough. Address their concerns directly.

IMPORTANT: Respond in ${lang}. Do not include a subject line.`;
    }

    const aiResponse = await this.aiService.generateText(prompt);
    return { suggestion: aiResponse };
  }

  async remove(id: string): Promise<Contact> {
    this.logger.log(`Removing contact ID: ${id}`);
    const result = await this.contactRepository.delete(id);
    await this.cacheManager.del('admin_dashboard_stats');
    return result;
  }

  async sendCustomEmail(data: {
    to: string;
    name: string;
    subject: string;
    content: string;
    salutation?: string;
  }) {
    this.logger.log(`Sending custom email to: ${data.to}`);
    const result = await this.emailService.sendCustomMail(
      data.to,
      data.name,
      data.subject,
      data.content,
      data.salutation,
    );

    if (result) {
      await this.contactRepository.create({
        name: data.name,
        email: data.to,
        subject: data.subject,
        message: data.content,
        category: 'sent_mail',
        status: 'sent',
      });
    }

    return result;
  }

  async generateAiEmail(
    topic: string,
    recipientName: string,
    language: string = 'en',
  ) {
    const lang = language === 'vi' ? 'Vietnamese' : 'English';
    this.logger.log(`Generating AI email for topic: ${topic} in ${lang}`);

    const prompt = `You are a professional assistant helping to draft a new email.

Recipient: ${recipientName}
Topic/Purpose: ${topic}

Task: Generate a professional, friendly, and clear email body.
IMPORTANT: Respond in ${lang}. Do NOT include a subject line, just the body content.`;

    const aiResponse = await this.aiService.generateText(prompt);
    return { suggestion: aiResponse };
  }
}
