import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IGalleryRepository } from '../domain/gallery.repository.interface';
import { Gallery } from '../domain/gallery.entity';

@Injectable()
export class PrismaGalleryRepository implements IGalleryRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: any): Promise<Gallery> {
        return this.prisma.gallery.create({
            data,
        }) as any;
    }

    async findAll(options: {
        where?: any;
        skip?: number;
        take?: number;
        orderBy?: any;
    }): Promise<{ data: Gallery[]; total: number }> {
        const [data, total] = await Promise.all([
            this.prisma.gallery.findMany({
                where: options.where,
                skip: options.skip,
                take: options.take,
                orderBy: options.orderBy,
                include: { album: { select: { id: true, name: true, slug: true } } },
            }),
            this.prisma.gallery.count({ where: options.where }),
        ]);

        return {
            data: data as any[],
            total,
        };
    }

    async findById(id: string): Promise<Gallery | null> {
        return this.prisma.gallery.findUnique({
            where: { id },
            include: { album: { select: { id: true, name: true, slug: true } } },
        }) as any;
    }

    async update(id: string, data: any): Promise<Gallery> {
        return this.prisma.gallery.update({
            where: { id },
            data,
        }) as any;
    }

    async delete(id: string): Promise<Gallery> {
        return this.prisma.gallery.delete({
            where: { id },
        }) as any;
    }

    async reorder(items: { id: string; sortOrder: number }[]): Promise<void> {
        const updates = items.map((item) =>
            this.prisma.gallery.update({
                where: { id: item.id },
                data: { sortOrder: item.sortOrder },
            }),
        );
        await this.prisma.$transaction(updates);
    }

    async bulkUpdate(ids: string[], data: any): Promise<number> {
        const result = await this.prisma.gallery.updateMany({
            where: { id: { in: ids } },
            data,
        });
        return result.count;
    }

    async incrementViews(id: string): Promise<void> {
        const photo = await this.prisma.gallery.findUnique({
            where: { id },
            select: { id: true },
        });
        if (photo) {
            await this.prisma.gallery.update({
                where: { id },
                data: { views: { increment: 1 } },
            });
        }
    }

    async getAllTags(): Promise<string[]> {
        const photos = await this.prisma.gallery.findMany({
            where: { tags: { not: null } },
            select: { tags: true },
        });

        const tagSet = new Set<string>();
        photos.forEach((p) => {
            if (p.tags) {
                p.tags.split(',').forEach((t) => {
                    const trimmed = t.trim();
                    if (trimmed) tagSet.add(trimmed);
                });
            }
        });

        return [...tagSet].sort();
    }
}
