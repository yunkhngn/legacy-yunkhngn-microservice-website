import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { IBlogRepository } from './domain/blog.repository.interface';
import { AiService } from '../ai/ai.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/domain/audit-log.types';
import { Blog } from './domain/blog.entity';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { extractImagesFromJsonContent } from '../../common/utils/image-extractor.util';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RagSyncQueue } from '../queue/rag-sync/rag-sync.queue';
import { NewsletterQueue } from '../queue/newsletter/newsletter.queue';

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    @Inject(IBlogRepository) private readonly blogRepository: IBlogRepository,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditLogsService: AuditLogsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly ragSyncQueue: RagSyncQueue,
    private readonly newsletterQueue: NewsletterQueue,
  ) {}

  async create(createBlogDto: CreateBlogDto): Promise<Blog> {
    const existing = await this.blogRepository.findBySlug(createBlogDto.slug);
    if (existing) {
      throw new ConflictException('Slug already exists');
    }

    const { content, excerpt, ...rest } = createBlogDto as any;
    const data = {
      ...rest,
      contentJSON: rest.contentJSON || content,
      seoDescription: rest.seoDescription || excerpt,
    };

    this.logger.log(`Creating blog with title: ${data.title}`);

    const newBlog = await this.blogRepository.create(data);
    await this.cacheManager.del('admin_dashboard_stats');

    // Sync to RAG if published
    if (newBlog.status === 'PUBLISHED') {
      await this.ragSyncQueue.enqueue({
        op: 'upsert',
        type: 'blog',
        docId: newBlog.id,
        content: newBlog.contentJSON || '',
        metadata: {
          title: newBlog.title,
          slug: newBlog.slug,
          tags: newBlog.tags,
        },
      });

      this.logger.log(
        `New blog published: ${newBlog.title}. Sending newsletter...`,
      );
      await this.newsletterQueue.announce(newBlog.id);
    }

    await this.auditLogsService.log({
      action: AuditAction.CREATE_BLOG,
      entity: AuditEntity.BLOG,
      entityId: newBlog.id,
      details: { title: newBlog.title, slug: newBlog.slug },
    });

    return newBlog;
  }

  async findAll(limit?: number): Promise<Blog[]> {
    return this.blogRepository.findAll(limit);
  }

  async findOne(slugOrId: string): Promise<any> {
    const blog = await this.blogRepository.findBySlugOrId(slugOrId);
    if (!blog) return null;

    const relatedPosts = await this.findRelatedPosts(blog.id, blog.tags || '');

    return {
      ...blog,
      relatedPosts,
    };
  }

  async findRelatedPosts(currentId: string, tags: string): Promise<Blog[]> {
    const TARGET = 2;

    // Try RAG-based semantic search first
    const ragBlogs: Blog[] = [];
    try {
      const ragResults = await this.aiService.findSimilar(
        'blog',
        currentId,
        TARGET,
      );
      for (const result of ragResults) {
        const blog = await this.blogRepository.findById(result.doc_id);
        if (blog && blog.status === 'PUBLISHED') {
          ragBlogs.push(blog);
        }
      }
      if (ragBlogs.length >= TARGET) {
        return ragBlogs.slice(0, TARGET);
      }
    } catch (error) {
      this.logger.warn(
        `RAG search failed, falling back to tag-based: ${error.message}`,
      );
    }

    // Fallback: rank by tag-overlap count (descending), tiebreak by recency.
    // Avoids the old behaviour of "any blog sharing one common tag, newest first",
    // which collapsed to "latest WRITING posts" when the current post had a generic tag.
    const tagList = tags
      ? tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const excludeIds = [currentId, ...ragBlogs.map((b) => b.id)];
    const need = TARGET - ragBlogs.length;

    let fillers: Blog[] = [];
    if (tagList.length > 0) {
      const candidates = await this.blogRepository.findRelated(
        excludeIds,
        tagList,
        Math.max(need * 5, 10),
      );
      fillers = candidates
        .map((b) => {
          const cand = (b.tags || '')
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
          const overlap = cand.filter((t) => tagList.includes(t)).length;
          return { blog: b, overlap };
        })
        .sort((a, b) => {
          if (b.overlap !== a.overlap) return b.overlap - a.overlap;
          return (
            new Date(b.blog.createdAt as any).getTime() -
            new Date(a.blog.createdAt as any).getTime()
          );
        })
        .slice(0, need)
        .map((x) => x.blog);
    }

    return [...ragBlogs, ...fillers].slice(0, TARGET);
  }

  async update(id: string, updateBlogDto: UpdateBlogDto): Promise<Blog> {
    if (updateBlogDto.slug) {
      const existing = await this.blogRepository.findBySlug(updateBlogDto.slug);
      if (existing && existing.id !== id) {
        throw new ConflictException('Slug already exists');
      }
    }

    const currentBlog = await this.blogRepository.findById(id);
    if (!currentBlog) {
      throw new ConflictException('Blog not found');
    }

    const data = { ...updateBlogDto } as any;
    if (data.content) {
      data.contentJSON = data.contentJSON || data.content;
      delete data.content;
    }
    if (data.excerpt) {
      data.seoDescription = data.seoDescription || data.excerpt;
      delete data.excerpt;
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.comments;

    this.logger.log(`Updating blog post ID: ${id}`);

    // --- NEW: Collect old images to delete ---
    const imagesToDelete: string[] = [];
    if (
      data.thumbnail !== undefined &&
      data.thumbnail !== currentBlog.thumbnail
    ) {
      if (currentBlog.thumbnail) imagesToDelete.push(currentBlog.thumbnail);
    }
    if (data.seoImage !== undefined && data.seoImage !== currentBlog.seoImage) {
      if (currentBlog.seoImage) imagesToDelete.push(currentBlog.seoImage);
    }
    if (data.contentJSON !== undefined) {
      const oldImages = extractImagesFromJsonContent(currentBlog.contentJSON);
      const newImages = extractImagesFromJsonContent(data.contentJSON);
      imagesToDelete.push(
        ...oldImages.filter((img) => !newImages.includes(img)),
      );
    }

    const updatedBlog = await this.blogRepository.update(id, data);
    await this.cacheManager.del('admin_dashboard_stats');

    // Sync to RAG if published
    if (updatedBlog.status === 'PUBLISHED') {
      await this.ragSyncQueue.enqueue({
        op: 'upsert',
        type: 'blog',
        docId: updatedBlog.id,
        content: updatedBlog.contentJSON || '',
        metadata: {
          title: updatedBlog.title,
          slug: updatedBlog.slug,
          tags: updatedBlog.tags,
        },
      });
    }

    const wasPublished = currentBlog.status === 'PUBLISHED';
    const isNowPublished = updatedBlog.status === 'PUBLISHED';

    if (!wasPublished && isNowPublished) {
      this.logger.log(
        `Blog ${updatedBlog.title} just got PUBLISHED! Sending newsletter...`,
      );
      await this.newsletterQueue.announce(updatedBlog.id);
    }

    // --- NEW: Trigger async deletion ---
    if (imagesToDelete.length > 0) {
      void this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_BLOG,
      entity: AuditEntity.BLOG,
      entityId: id,
      details: { title: updatedBlog.title, slug: updatedBlog.slug },
    });

    return updatedBlog;
  }

  async remove(id: string): Promise<Blog> {
    const blog = await this.blogRepository.delete(id);
    await this.cacheManager.del('admin_dashboard_stats');
    if (!blog) {
      return blog;
    }

    await this.ragSyncQueue.enqueue({ op: 'delete', type: 'blog', docId: id });

    const imagesToDelete = [
      blog.thumbnail,
      blog.seoImage,
      ...extractImagesFromJsonContent(blog.contentJSON),
    ];
    void this.cloudinaryService.deleteImagesSafely(imagesToDelete);

    await this.auditLogsService.log({
      action: AuditAction.DELETE_BLOG,
      entity: AuditEntity.BLOG,
      entityId: id,
      details: { title: blog.title, slug: blog.slug },
    });

    return blog;
  }

  async incrementViews(slugOrId: string): Promise<Blog | null> {
    const blog = await this.blogRepository.findBySlugOrId(slugOrId);
    if (!blog) return null;

    return this.blogRepository.incrementViews(blog.id);
  }

}
