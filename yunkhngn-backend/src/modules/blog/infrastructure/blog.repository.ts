import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IBlogRepository } from '../domain/blog.repository.interface';
import { Blog } from '../domain/blog.entity';

@Injectable()
export class PrismaBlogRepository implements IBlogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: any): Promise<Blog> {
    return this.prisma.blog.create({
      data,
    });
  }

  findAll(limit?: number, status?: string): Promise<Blog[]> {
    return this.prisma.blog.findMany({
      where: status ? { status } : undefined,
      take: limit ? Number(limit) : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  findBySlugOrId(slugOrId: string): Promise<Blog | null> {
    return this.prisma.blog.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
    });
  }

  findBySlug(slug: string): Promise<Blog | null> {
    return this.prisma.blog.findUnique({
      where: { slug },
    });
  }

  findById(id: string): Promise<Blog | null> {
    return this.prisma.blog.findUnique({
      where: { id },
    });
  }

  async findManyByIds(ids: string[]): Promise<Blog[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.blog.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(rows.map((r) => [r.id, r as Blog]));
    return ids
      .map((id) => byId.get(id))
      .filter((b): b is Blog => Boolean(b));
  }

  findRelated(
    excludeIds: string[],
    tags: string[],
    take: number,
  ): Promise<Blog[]> {
    return this.prisma.blog.findMany({
      where: {
        id: { notIn: excludeIds },
        status: 'PUBLISHED',
        OR: tags.map((tag) => ({
          tags: { contains: tag },
        })),
      },
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: any): Promise<Blog> {
    return this.prisma.blog.update({
      where: { id },
      data,
    });
  }

  delete(id: string): Promise<Blog> {
    return this.prisma.blog.delete({
      where: { id },
    });
  }

  incrementViews(id: string): Promise<Blog> {
    return this.prisma.blog.update({
      where: { id },
      data: {
        views: { increment: 1 },
      },
    });
  }
}
