import { Test } from '@nestjs/testing';
import { IBlogRepository } from '../../blog/domain/blog.repository.interface';
import { IProjectRepository } from '../../project/domain/project.repository.interface';
import { RagSyncQueue } from './rag-sync.queue';
import { RagSyncReindexService } from './rag-sync.reindex.service';

describe('RagSyncReindexService', () => {
  it('enqueues published blogs and all projects', async () => {
    const ragSyncQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RagSyncReindexService,
        {
          provide: IBlogRepository,
          useValue: {
            findAll: jest.fn().mockResolvedValue([
              {
                id: 'b1',
                status: 'PUBLISHED',
                title: 'Published',
                slug: 'published',
                tags: 'nestjs',
                contentJSON: 'content',
              },
              {
                id: 'b2',
                status: 'DRAFT',
                title: 'Draft',
                slug: 'draft',
                tags: '',
                contentJSON: 'draft',
              },
            ]),
          },
        },
        {
          provide: IProjectRepository,
          useValue: {
            findAll: jest.fn().mockResolvedValue([
              {
                id: 'p1',
                title: 'Project',
                slug: 'project',
                description: 'desc',
                contentJSON: '',
                techStack: 'Next.js',
              },
            ]),
          },
        },
        { provide: RagSyncQueue, useValue: ragSyncQueue },
      ],
    }).compile();

    const service = moduleRef.get(RagSyncReindexService);
    const result = await service.enqueueAll();

    expect(result).toEqual({ blogs: 1, projects: 1, total: 2 });
    expect(ragSyncQueue.enqueue).toHaveBeenCalledTimes(2);
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'blog', docId: 'b1' }),
    );
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'project', docId: 'p1' }),
    );
  });
});
