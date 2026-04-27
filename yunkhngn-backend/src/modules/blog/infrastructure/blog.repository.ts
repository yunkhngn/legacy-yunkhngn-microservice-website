import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IBlogRepository } from '../domain/blog.repository.interface';
import { Blog } from '../domain/blog.entity';

@Injectable()
export class PrismaBlogRepository implements IBlogRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: any): Promise<Blog> {
        return this.prisma.blog.create({
            data,
        });
    }

    async findAll(): Promise<Blog[]> {
        return this.prisma.blog.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async findBySlugOrId(slugOrId: string): Promise<Blog | null> {
        return this.prisma.blog.findFirst({
            where: {
                OR: [{ slug: slugOrId }, { id: slugOrId }],
            },
            include: { comments: true },
        }) as any;
    }

    async findBySlug(slug: string): Promise<Blog | null> {
        return this.prisma.blog.findUnique({
            where: { slug },
        });
    }

    async findById(id: string): Promise<Blog | null> {
        return this.prisma.blog.findUnique({
            where: { id },
        });
    }

    async findRelated(excludeIds: string[], tags: string[], take: number): Promise<Blog[]> {
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

    async update(id: string, data: any): Promise<Blog> {
        return this.prisma.blog.update({
            where: { id },
            data,
        });
    }

    async delete(id: string): Promise<Blog> {
        return this.prisma.blog.delete({
            where: { id },
        });
    }

    async incrementViews(id: string): Promise<Blog> {
        return this.prisma.blog.update({
            where: { id },
            data: {
                views: { increment: 1 },
            },
        });
    }
}
