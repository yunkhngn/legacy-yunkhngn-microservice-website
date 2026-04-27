import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { IContactRepository } from './domain/contact.repository.interface';
import { EmailService } from '../integrations/email/email.service';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('ContactService', () => {
  let service: ContactService;
  let emailService: EmailService;
  let aiService: AiService;

  const mockContactRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockEmailService = {
    sendContactNotification: jest.fn().mockResolvedValue(true),
    sendContactResponse: jest.fn().mockResolvedValue(true),
    sendCustomMail: jest.fn().mockResolvedValue({ id: '123' }),
  };

  const mockAiService = {
    generateText: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: IContactRepository, useValue: mockContactRepository },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AiService, useValue: mockAiService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
    emailService = module.get<EmailService>(EmailService);
    aiService = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createContact', () => {
    it('should create a contact and send notification', async () => {
      const dto = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test',
        message: 'Hello',
      };

      const expectedContact = {
        id: '1',
        ...dto,
        status: 'new',
        category: 'general',
      };
      mockContactRepository.create.mockResolvedValue(expectedContact);

      const result = await service.createContact(dto);

      expect(mockContactRepository.create).toHaveBeenCalledWith({
        ...dto,
        category: 'general',
        status: 'new',
      });
      expect(emailService.sendContactNotification).toHaveBeenCalledWith(
        expectedContact,
      );
      expect(result).toEqual(expectedContact);
    });
  });

  describe('respondToContact', () => {
    it('should send email and update contact status', async () => {
      const id = '1';
      const response = 'Thank you';
      const contact = { id, email: 'john@example.com', name: 'John' };

      mockContactRepository.findById.mockResolvedValue(contact);
      mockContactRepository.update.mockResolvedValue({
        ...contact,
        status: 'responded',
      });

      await service.respondToContact(id, response);

      expect(emailService.sendContactResponse).toHaveBeenCalledWith(
        contact,
        response,
      );
      expect(mockContactRepository.update).toHaveBeenCalledWith(
        id,
        expect.objectContaining({
          adminResponse: response,
          status: 'responded',
        }),
      );
    });
  });

  describe('generateAiResponse', () => {
    it('should call AI service with correct prompt', async () => {
      const id = '1';
      const contact = {
        id,
        name: 'John',
        message: 'Help me',
        category: 'Support',
      };
      mockContactRepository.findById.mockResolvedValue(contact);
      mockAiService.generateText.mockResolvedValue('AI Suggestion');

      const result = await service.generateAiResponse(id, 'en');

      expect(aiService.generateText).toHaveBeenCalled();
      expect(result).toEqual({ suggestion: 'AI Suggestion' });
    });
  });

  describe('sendCustomEmail', () => {
    it('should send custom email with salutation', async () => {
      const dto = {
        to: 'test@example.com',
        name: 'Test User',
        subject: 'Custom Subject',
        content: 'Custom Content',
        salutation: 'Greetings',
      };

      mockEmailService.sendCustomMail = jest
        .fn()
        .mockResolvedValue({ id: '123' });
      mockContactRepository.create.mockResolvedValue({ id: '1', ...dto });

      await service.sendCustomEmail(dto);

      expect(emailService.sendCustomMail).toHaveBeenCalledWith(
        dto.to,
        dto.name,
        dto.subject,
        dto.content,
        dto.salutation,
      );
      // Verify DB record creation (without salutation)
      expect(mockContactRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.to,
          subject: dto.subject,
          category: 'sent_mail',
        }),
      );
    });
  });
});
