import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { RAG_SYNC_QUEUE, RagSyncJob } from './rag-sync.types';

@Processor(RAG_SYNC_QUEUE)
export class RagSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(RagSyncProcessor.name);

  constructor(private readonly aiService: AiService) {
    super();
  }

  async process(job: Job<RagSyncJob>): Promise<void> {
    const { op, type, docId } = job.data;
    this.logger.log(
      `[${job.id}] ${op} ${type}/${docId} (attempt ${job.attemptsMade + 1})`,
    );

    if (op === 'delete') {
      await this.aiService.syncDocument(type, docId, '', {}, 'delete');
      return;
    }

    await this.aiService.syncDocument(
      type,
      docId,
      job.data.content,
      job.data.metadata,
    );
  }
}
