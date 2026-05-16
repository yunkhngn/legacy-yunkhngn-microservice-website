import { Test } from '@nestjs/testing';
import { RagSyncProcessor } from './rag-sync.processor';
import { AiService } from '../../ai/ai.service';
import { Job } from 'bullmq';

describe('RagSyncProcessor', () => {
  let processor: RagSyncProcessor;
  let aiService: { syncDocument: jest.Mock };

  beforeEach(async () => {
    aiService = { syncDocument: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RagSyncProcessor,
        { provide: AiService, useValue: aiService },
      ],
    }).compile();
    processor = moduleRef.get(RagSyncProcessor);
  });

  it('routes upsert to syncDocument with content + metadata', async () => {
    const job = {
      name: 'sync',
      data: {
        op: 'upsert',
        type: 'blog',
        docId: 'b1',
        content: 'hello',
        metadata: { title: 'Hi' },
      },
    } as unknown as Job;

    await processor.process(job);

    expect(aiService.syncDocument).toHaveBeenCalledWith(
      'blog',
      'b1',
      'hello',
      { title: 'Hi' },
    );
  });

  it('routes delete to syncDocument with op flag', async () => {
    const job = {
      name: 'sync',
      data: { op: 'delete', type: 'project', docId: 'p9' },
    } as unknown as Job;

    await processor.process(job);

    expect(aiService.syncDocument).toHaveBeenCalledWith(
      'project',
      'p9',
      '',
      {},
      'delete',
    );
  });
});
