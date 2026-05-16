import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterService } from './newsletter.service';
import { ISubscriberRepository } from './domain/subscriber.repository.interface';
import { EmailService } from '../email/email.service';

describe('NewsletterService', () => {
  let service: NewsletterService;

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('NewsletterService - rendering & sendOne', () => {
  let service: NewsletterService;
  let emailService: { sendNewsletter: jest.Mock };
  let repository: any;

  beforeEach(async () => {
    emailService = { sendNewsletter: jest.fn().mockResolvedValue({ id: 'x' }) };
    repository = {
      findAll: jest.fn().mockResolvedValue([]),
      findByEmail: jest.fn(),
      findByToken: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    process.env.FRONTEND_URL = 'https://yunkhngn.dev';
    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsletterService,
        { provide: ISubscriberRepository, useValue: repository },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();
    service = moduleRef.get(NewsletterService);
  });

  it('renderBlogEmail returns subject + html body containing blog title and url', () => {
    const result = service.renderBlogEmail({
      title: 'Hello World',
      slug: 'hello-world',
      seoDescription: 'A post.',
      thumbnail: null,
    } as any);

    expect(result.subject).toBe('New Post: Hello World');
    expect(result.content).toContain('Hello World');
    expect(result.content).toContain('https://yunkhngn.dev/blog/hello-world');
  });

  it('sendOne calls emailService.sendNewsletter with subscriber-specific unsubscribe link', async () => {
    await service.sendOne(
      {
        title: 'Hi',
        slug: 'hi',
        seoDescription: '',
        thumbnail: null,
      } as any,
      { email: 'a@b.com', token: 'tok-1' },
    );
    expect(emailService.sendNewsletter).toHaveBeenCalledWith(
      'a@b.com',
      'New Post: Hi',
      expect.stringContaining('Hi'),
      'https://yunkhngn.dev/newsletter/unsubscribe?token=tok-1',
    );
  });
});
