import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { NewsletterService } from '../../integrations/newsletter/newsletter.service';
import { NewsletterQueue } from './newsletter.queue';
import { IBlogRepository } from '../../blog/domain/blog.repository.interface';
import { IProjectRepository } from '../../project/domain/project.repository.interface';
import { SettingsService } from '../../settings/settings.service';
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
    @Inject(IProjectRepository) private readonly projectRepository: IProjectRepository,
    private readonly newsletterService: NewsletterService,
    private readonly newsletterQueue: NewsletterQueue,
    private readonly settingsService: SettingsService,
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
    const entityId = payload.entityId || payload.blogId;
    const entityType = payload.entityType || 'blog';

    // Check if auto-send is enabled for this entity type
    const settingKey = entityType === 'blog' ? 'newsletter_auto_blog' : 'newsletter_auto_project';
    const autoSendSetting = await this.settingsService.getDecryptedSetting(settingKey);
    if (autoSendSetting === 'false') {
      this.logger.log(
        `[${job.id}] announce skipped — auto-send disabled for ${entityType} (${settingKey}=false)`,
      );
      return;
    }

    if (entityType === 'blog') {
      const blog = await this.blogRepository.findById(entityId);
      if (!blog || blog.status !== 'PUBLISHED') {
        this.logger.warn(
          `[${job.id}] announce skipped — blog ${entityId} missing or not PUBLISHED`,
        );
        return;
      }
    } else if (entityType === 'project') {
      const project = await this.projectRepository.findById(entityId);
      if (!project) {
        this.logger.warn(
          `[${job.id}] announce skipped — project ${entityId} missing`,
        );
        return;
      }
    }

    const subscribers = await this.newsletterService.findAllSubscribers();
    this.logger.log(
      `[${job.id}] fanning out ${subscribers.length} send jobs for ${entityType} ${entityId}`,
    );
    for (const sub of subscribers) {
      await this.newsletterQueue.send({
        entityId,
        entityType,
        subscriberId: sub.id,
        email: sub.email,
        token: sub.token,
        blogId: entityId, // for backwards compatibility
      });
    }
  }

  private async handleSend(payload: SendPayload, job: Job) {
    const entityId = payload.entityId || payload.blogId;
    const entityType = payload.entityType || 'blog';

    if (entityType === 'blog') {
      const blog = await this.blogRepository.findById(entityId);
      if (!blog) {
        throw new UnrecoverableError(`Blog ${entityId} not found when sending newsletter`);
      }
      if (blog.status !== 'PUBLISHED') {
        this.logger.warn(`[${job.id}] send skipped — blog ${entityId} is not PUBLISHED`);
        return;
      }
      await this.newsletterService.sendOneBlog(blog as any, { email: payload.email, token: payload.token });
    } else if (entityType === 'project') {
      const project = await this.projectRepository.findById(entityId);
      if (!project) {
        throw new UnrecoverableError(`Project ${entityId} not found when sending newsletter`);
      }
      await this.newsletterService.sendOneProject(project as any, { email: payload.email, token: payload.token });
    }

    this.logger.log(
      `[${job.id}] sent newsletter for ${entityType} ${entityId} to ${payload.email}`,
    );
  }
}
