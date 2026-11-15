import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  RAG_SYNC_QUEUE,
  RAG_SYNC_JOB,
  RagSyncJob,
} from './rag-sync.types';

@Injectable()
export class RagSyncQueue {
  constructor(@InjectQueue(RAG_SYNC_QUEUE) private readonly queue: Queue) {}

  async enqueue(job: RagSyncJob): Promise<void> {
    const jobId = `${job.op}-${job.type}-${job.docId}-${Date.now()}`;
    await this.queue.add(RAG_SYNC_JOB, job, {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
    });
  }
}
