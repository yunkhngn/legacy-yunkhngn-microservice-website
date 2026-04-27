import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterService } from './newsletter.service';
import { ISubscriberRepository } from './domain/subscriber.repository.interface';
import { EmailService } from '../email/email.service';

describe('NewsletterService', () => {
  let service: NewsletterService;
  let repository: ISubscriberRepository;

  const mockSubscriberRepository = {
    findUnique: jest.fn(),
    findByEmail: jest.fn(),
    findByToken: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findAll: jest.fn(),
  };

  const mockEmailService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendNewsletter: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        { provide: ISubscriberRepository, useValue: mockSubscriberRepository },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<NewsletterService>(NewsletterService);
    repository = module.get<ISubscriberRepository>(ISubscriberRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
