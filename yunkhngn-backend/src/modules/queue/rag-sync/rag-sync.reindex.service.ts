import { Inject, Injectable } from '@nestjs/common';
import { IBlogRepository } from '../../blog/domain/blog.repository.interface';
import { IProjectRepository } from '../../project/domain/project.repository.interface';
import { RagSyncQueue } from './rag-sync.queue';

@Injectable()
export class RagSyncReindexService {
  constructor(
    @Inject(IBlogRepository) private readonly blogRepository: IBlogRepository,
    @Inject(IProjectRepository)
    private readonly projectRepository: IProjectRepository,
    private readonly ragSyncQueue: RagSyncQueue,
  ) {}

  async enqueueAll(): Promise<{ blogs: number; projects: number; total: number }> {
    const [blogs, projects] = await Promise.all([
      this.blogRepository.findAll(),
      this.projectRepository.findAll(),
    ]);

    let blogCount = 0;
    let projectCount = 0;

    for (const blog of blogs) {
      if (blog.status !== 'PUBLISHED') continue;
      await this.ragSyncQueue.enqueue({
        op: 'upsert',
        type: 'blog',
        docId: blog.id,
        content: blog.contentJSON || '',
        metadata: {
          title: blog.title,
          slug: blog.slug,
          tags: blog.tags,
        },
      });
      blogCount++;
    }

    for (const project of projects) {
      await this.ragSyncQueue.enqueue({
        op: 'upsert',
        type: 'project',
        docId: project.id,
        content: project.contentJSON || project.description || '',
        metadata: {
          title: project.title,
          slug: project.slug,
          techStack: project.techStack,
        },
      });
      projectCount++;
    }

    return {
      blogs: blogCount,
      projects: projectCount,
      total: blogCount + projectCount,
    };
  }
}
