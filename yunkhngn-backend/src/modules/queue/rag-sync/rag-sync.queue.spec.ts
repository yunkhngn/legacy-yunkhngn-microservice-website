import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { RagSyncQueue } from './rag-sync.queue';
import { RAG_SYNC_QUEUE, RAG_SYNC_JOB } from './rag-sync.types';

describe('RagSyncQueue', () => {
  let queue: RagSyncQueue;
  let add: jest.Mock;

  beforeEach(async () => {
    add = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        RagSyncQueue,
        { provide: getQueueToken(RAG_SYNC_QUEUE), useValue: { add } },
      ],
    }).compile();
    queue = moduleRef.get(RagSyncQueue);
  });

  it('enqueues upsert with op:upsert and a jobId scoped to op/type/docId/timestamp', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T00:00:00Z'));
    await queue.enqueue({
      op: 'upsert',
      type: 'blog',
      docId: 'b1',
      content: 'hello',
      metadata: { title: 'Hi' },
    });
    expect(add).toHaveBeenCalledWith(
      RAG_SYNC_JOB,
      expect.objectContaining({ op: 'upsert', type: 'blog', docId: 'b1' }),
      expect.objectContaining({
        jobId: `upsert-blog-b1-${new Date('2026-05-16T00:00:00Z').getTime()}`,
        attempts: 5,
      }),
    );
    jest.useRealTimers();
  });

  it('enqueues delete with op:delete and matching jobId', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T00:00:00Z'));
    await queue.enqueue({ op: 'delete', type: 'project', docId: 'p9' });
    expect(add).toHaveBeenCalledWith(
      RAG_SYNC_JOB,
      { op: 'delete', type: 'project', docId: 'p9' },
      expect.objectContaining({
        jobId: `delete-project-p9-${new Date('2026-05-16T00:00:00Z').getTime()}`,
      }),
    );
    jest.useRealTimers();
  });
});
