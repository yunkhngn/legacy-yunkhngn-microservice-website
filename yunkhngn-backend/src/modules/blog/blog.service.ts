import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { IBlogRepository } from './domain/blog.repository.interface';
import { NewsletterService } from '../integrations/newsletter/newsletter.service';
import { AiService } from '../ai/ai.service';
import { Blog } from './domain/blog.entity';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { extractImagesFromJsonContent } from '../../common/utils/image-extractor.util';

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    @Inject(IBlogRepository) private readonly blogRepository: IBlogRepository,
    private readonly newsletterService: NewsletterService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly cloudinaryService: CloudinaryService,
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

    // Sync to RAG if published
    if (newBlog.status === 'PUBLISHED') {
      await this.aiService.syncDocument(
        'blog',
        newBlog.id,
        newBlog.contentJSON || '',
        {
          title: newBlog.title,
          slug: newBlog.slug,
          tags: newBlog.tags,
        },
      );

      this.logger.log(
        `New blog published: ${newBlog.title}. Sending newsletter...`,
      );
      await this.sendNewsletterForBlog(newBlog);
    }

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
    let related: Blog[] = [];
    const tagList = tags ? tags.split(',').map((t) => t.trim()) : [];

    if (tagList.length > 0) {
      related = await this.blogRepository.findRelated([currentId], tagList, 2);
    }

    if (related.length < 2) {
      const excludeIds = [currentId, ...related.map((b) => b.id)];
      // Note: This logic could be moved to repository if it gets complex
      // For now, we'll just use what we have or add findRecent to repository
      const recent = await this.blogRepository.findRelated(
        excludeIds,
        [],
        2 - related.length,
      );
      related = [...related, ...recent];
    }

    return related;
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
    if (
      data.seoImage !== undefined &&
      data.seoImage !== currentBlog.seoImage
    ) {
      if (currentBlog.seoImage) imagesToDelete.push(currentBlog.seoImage);
    }
    if (data.contentJSON !== undefined) {
      const oldImages = extractImagesFromJsonContent(currentBlog.contentJSON);
      const newImages = extractImagesFromJsonContent(data.contentJSON);
      imagesToDelete.push(...oldImages.filter((img) => !newImages.includes(img)));
    }

    const updatedBlog = await this.blogRepository.update(id, data);

    // Sync to RAG if published
    if (updatedBlog.status === 'PUBLISHED') {
      await this.aiService.syncDocument(
        'blog',
        updatedBlog.id,
        updatedBlog.contentJSON || '',
        {
          title: updatedBlog.title,
          slug: updatedBlog.slug,
          tags: updatedBlog.tags,
        },
      );
    }

    const wasPublished = currentBlog.status === 'PUBLISHED';
    const isNowPublished = updatedBlog.status === 'PUBLISHED';

    if (!wasPublished && isNowPublished) {
      this.logger.log(
        `Blog ${updatedBlog.title} just got PUBLISHED! Sending newsletter...`,
      );
      await this.sendNewsletterForBlog(updatedBlog);
    }

    // --- NEW: Trigger async deletion ---
    if (imagesToDelete.length > 0) {
      this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }

    return updatedBlog;
  }

  async remove(id: string): Promise<Blog> {
    const blog = await this.blogRepository.delete(id);
    if (blog) {
      await this.aiService.syncDocument('blog', id, '', {}, 'delete');

      // Cleanup all associated Cloudinary images
      const imagesToDelete = [
        blog.thumbnail,
        blog.seoImage,
        ...extractImagesFromJsonContent(blog.contentJSON),
      ];
      this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }
    return blog;
  }

  async incrementViews(slugOrId: string): Promise<Blog | null> {
    const blog = await this.blogRepository.findBySlugOrId(slugOrId);
    if (!blog) return null;

    return this.blogRepository.incrementViews(blog.id);
  }

  private async sendNewsletterForBlog(blog: Blog) {
    try {
      const subject = `New Post: ${blog.title}`;
      const frontendUrl =
        this.configService.get<string>('app.frontendUrl') ||
        'http://localhost:3000';
      const blogUrl = `${frontendUrl.replace(/\/$/, '')}/blog/${blog.slug}`;
      const description = blog.seoDescription || 'Click to read full post...';
      const truncatedDescription =
        description.length > 200
          ? `${description.substring(0, 197)}...`
          : description;

      const content = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            ${
              blog.thumbnail
                ? `<div style="width: 100%; height: 200px; background-image: url('${blog.thumbnail}'); background-size: cover; background-position: center;"></div>`
                : ''
            }
            <div style="padding: 30px;">
              <h2 style="color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">New Blog Post</h2>
              <h1 style="font-size: 24px; font-weight: 700; margin: 10px 0 15px; line-height: 1.3;">
                <a href="${blogUrl}" style="text-decoration: none; color: #1a1a1a;">${blog.title}</a>
              </h1>
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                ${truncatedDescription}
              </p>
              <div style="text-align: center;">
                <a href="${blogUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Read Full Story</a>
              </div>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
              <p style="margin: 0;">You received this email because you subscribed to yunkhngn.dev.</p>
            </div>
          </div>
      `;

      await this.newsletterService.sendToAll(subject, content);
      this.logger.log(`Newsletter sent for blog: ${blog.title}`);
    } catch (error) {
      this.logger.error(
        `Failed to send newsletter for blog: ${blog.title}`,
        error.stack,
      );
    }
  }
}
