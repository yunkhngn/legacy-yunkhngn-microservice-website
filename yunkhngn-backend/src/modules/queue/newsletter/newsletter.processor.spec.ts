import { Test } from '@nestjs/testing';
import { NewsletterProcessor } from './newsletter.processor';
import { NewsletterService } from '../../integrations/newsletter/newsletter.service';
import { NewsletterQueue } from './newsletter.queue';
import { IBlogRepository } from '../../blog/domain/blog.repository.interface';
import { Job, UnrecoverableError } from 'bullmq';
import {
  NEWSLETTER_JOB_ANNOUNCE,
  NEWSLETTER_JOB_SEND,
} from './newsletter.types';

describe('NewsletterProcessor', () => {
  let processor: NewsletterProcessor;
  let blogRepository: any;
  let newsletterService: any;
  let newsletterQueue: { send: jest.Mock };

  beforeEach(async () => {
    blogRepository = { findById: jest.fn() };
    newsletterService = {
      sendOne: jest.fn().mockResolvedValue(undefined),
      findAllSubscribers: jest.fn(),
    };
    newsletterQueue = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsletterProcessor,
        { provide: IBlogRepository, useValue: blogRepository },
        { provide: NewsletterService, useValue: newsletterService },
        { provide: NewsletterQueue, useValue: newsletterQueue },
      ],
    }).compile();
    processor = moduleRef.get(NewsletterProcessor);
  });

  it('announce: skips when blog is not PUBLISHED', async () => {
    blogRepository.findById.mockResolvedValue({ id: 'b1', status: 'DRAFT' });
    await processor.process({
      name: NEWSLETTER_JOB_ANNOUNCE,
      data: { blogId: 'b1' },
    } as unknown as Job);
    expect(newsletterQueue.send).not.toHaveBeenCalled();
  });

  it('announce: fans out one send per subscriber when PUBLISHED', async () => {
    blogRepository.findById.mockResolvedValue({ id: 'b1', status: 'PUBLISHED' });
    newsletterService.findAllSubscribers.mockResolvedValue([
      { id: 's1', email: 'a@b.com', token: 't1' },
      { id: 's2', email: 'c@d.com', token: 't2' },
    ]);
    await processor.process({
      name: NEWSLETTER_JOB_ANNOUNCE,
      data: { blogId: 'b1' },
    } as unknown as Job);
    expect(newsletterQueue.send).toHaveBeenCalledTimes(2);
    expect(newsletterQueue.send).toHaveBeenCalledWith({
      blogId: 'b1',
      subscriberId: 's1',
      email: 'a@b.com',
      token: 't1',
    });
  });

  it('send: calls newsletterService.sendOne with loaded blog + payload', async () => {
    blogRepository.findById.mockResolvedValue({
      id: 'b1',
      status: 'PUBLISHED',
      title: 'Hi',
      slug: 'hi',
      seoDescription: '',
      thumbnail: null,
    });
    await processor.process({
      name: NEWSLETTER_JOB_SEND,
      data: { blogId: 'b1', subscriberId: 's1', email: 'a@b.com', token: 't1' },
    } as unknown as Job);
    expect(newsletterService.sendOne).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hi', slug: 'hi' }),
      { email: 'a@b.com', token: 't1' },
    );
  });

  it('send: skips when blog is no longer PUBLISHED', async () => {
    blogRepository.findById.mockResolvedValue({
      id: 'b1',
      status: 'DRAFT',
      title: 'Hi',
      slug: 'hi',
    });
    await processor.process({
      name: NEWSLETTER_JOB_SEND,
      data: { blogId: 'b1', subscriberId: 's1', email: 'a@b.com', token: 't1' },
    } as unknown as Job);
    expect(newsletterService.sendOne).not.toHaveBeenCalled();
  });

  it('send: throws unrecoverable error if blog disappeared', async () => {
    blogRepository.findById.mockResolvedValue(null);
    await expect(
      processor.process({
        name: NEWSLETTER_JOB_SEND,
        data: { blogId: 'b1', subscriberId: 's1', email: 'a@b.com', token: 't1' },
      } as unknown as Job),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(newsletterService.sendOne).not.toHaveBeenCalled();
  });
});
