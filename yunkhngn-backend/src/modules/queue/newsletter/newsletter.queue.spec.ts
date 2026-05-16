import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NewsletterQueue } from './newsletter.queue';
import {
  NEWSLETTER_QUEUE,
  NEWSLETTER_JOB_ANNOUNCE,
  NEWSLETTER_JOB_SEND,
} from './newsletter.types';

describe('NewsletterQueue', () => {
  let queue: NewsletterQueue;
  let add: jest.Mock;

  beforeEach(async () => {
    add = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsletterQueue,
        { provide: getQueueToken(NEWSLETTER_QUEUE), useValue: { add } },
      ],
    }).compile();
    queue = moduleRef.get(NewsletterQueue);
  });

  it('announce uses blogId as the jobId for idempotency', async () => {
    await queue.announce('b1');
    expect(add).toHaveBeenCalledWith(
      NEWSLETTER_JOB_ANNOUNCE,
      { blogId: 'b1' },
      expect.objectContaining({ jobId: 'announce:b1', attempts: 3 }),
    );
  });

  it('send uses blogId:subscriberId as the jobId for idempotency', async () => {
    await queue.send({
      blogId: 'b1',
      subscriberId: 's1',
      email: 'a@b.com',
      token: 'tok',
    });
    expect(add).toHaveBeenCalledWith(
      NEWSLETTER_JOB_SEND,
      { blogId: 'b1', subscriberId: 's1', email: 'a@b.com', token: 'tok' },
      expect.objectContaining({ jobId: 'send:b1:s1', attempts: 3 }),
    );
  });
});
