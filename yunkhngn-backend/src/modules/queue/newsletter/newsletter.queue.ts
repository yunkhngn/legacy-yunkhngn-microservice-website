import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NEWSLETTER_QUEUE,
  NEWSLETTER_JOB_ANNOUNCE,
  NEWSLETTER_JOB_SEND,
  AnnouncePayload,
  SendPayload,
} from './newsletter.types';

const DEFAULT_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 30_000 },
};

@Injectable()
export class NewsletterQueue {
  constructor(@InjectQueue(NEWSLETTER_QUEUE) private readonly queue: Queue) {}

  async announce(blogId: string): Promise<void> {
    const payload: AnnouncePayload = { blogId };
    await this.queue.add(NEWSLETTER_JOB_ANNOUNCE, payload, {
      jobId: `announce-${blogId}`,
      ...DEFAULT_OPTS,
    });
  }

  async send(payload: SendPayload): Promise<void> {
    await this.queue.add(NEWSLETTER_JOB_SEND, payload, {
      jobId: `send-${payload.blogId}-${payload.subscriberId}`,
      ...DEFAULT_OPTS,
    });
  }
}
