import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NewsletterService } from '../../integrations/newsletter/newsletter.service';
import { NewsletterQueue } from './newsletter.queue';
import { IBlogRepository } from '../../blog/domain/blog.repository.interface';
import {
  NEWSLETTER_QUEUE,
  NEWSLETTER_JOB_ANNOUNCE,
  NEWSLETTER_JOB_SEND,
  AnnouncePayload,
  SendPayload,
} from './newsletter.types';

@Processor(NEWSLETTER_QUEUE, { concurrency: 5 })
export class NewsletterProcessor extends WorkerHost {
  private readonly logger = new Logger(NewsletterProcessor.name);

  constructor(
    @Inject(IBlogRepository) private readonly blogRepository: IBlogRepository,
    private readonly newsletterService: NewsletterService,
    private readonly newsletterQueue: NewsletterQueue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === NEWSLETTER_JOB_ANNOUNCE) {
      return this.handleAnnounce(job.data as AnnouncePayload, job);
    }
    if (job.name === NEWSLETTER_JOB_SEND) {
      return this.handleSend(job.data as SendPayload, job);
    }
    this.logger.warn(`[${job.id}] unknown job name: ${job.name}`);
  }

  private async handleAnnounce(payload: AnnouncePayload, job: Job) {
    const blog = await this.blogRepository.findById(payload.blogId);
    if (!blog || blog.status !== 'PUBLISHED') {
      this.logger.warn(
        `[${job.id}] announce skipped — blog ${payload.blogId} missing or not PUBLISHED`,
      );
      return;
    }
    const subscribers: Array<{ id: string; email: string; token: string }> =
      await (this.newsletterService as any).findAllSubscribers();
    this.logger.log(
      `[${job.id}] fanning out ${subscribers.length} send jobs for blog ${blog.id}`,
    );
    for (const sub of subscribers) {
      await this.newsletterQueue.send({
        blogId: blog.id,
        subscriberId: sub.id,
        email: sub.email,
        token: sub.token,
      });
    }
  }

  private async handleSend(payload: SendPayload, job: Job) {
    const blog = await this.blogRepository.findById(payload.blogId);
    if (!blog) {
      throw new Error(
        `Blog ${payload.blogId} not found when sending newsletter`,
      );
    }
    await (this.newsletterService as any).sendOne(blog, {
      email: payload.email,
      token: payload.token,
    });
    this.logger.log(
      `[${job.id}] sent newsletter for blog ${blog.id} to ${payload.email}`,
    );
  }
}
