import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ILetterRepository } from '../domain/letter.repository.interface';
import { Letter } from '../domain/letter.entity';

@Injectable()
export class PrismaLetterRepository implements ILetterRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: any): Promise<Letter> {
        return this.prisma.letter.create({
            data,
            include: { pages: { orderBy: { sortOrder: 'asc' } } },
        }) as any;
    }

    async findAll(): Promise<Letter[]> {
        return this.prisma.letter.findMany({
            orderBy: { createdAt: 'desc' },
            include: { pages: { orderBy: { sortOrder: 'asc' } } },
        }) as any;
    }

    async findById(id: string): Promise<Letter | null> {
        return this.prisma.letter.findUnique({
            where: { id },
            include: { pages: { orderBy: { sortOrder: 'asc' } } },
        }) as any;
    }

    async findByCode(code: string): Promise<Letter | null> {
        return this.prisma.letter.findUnique({
            where: { code },
            include: { pages: { orderBy: { sortOrder: 'asc' } } },
        }) as any;
    }

    async update(id: string, data: any): Promise<Letter> {
        return this.prisma.letter.update({
            where: { id },
            data,
            include: { pages: { orderBy: { sortOrder: 'asc' } } },
        }) as any;
    }

    async delete(id: string): Promise<Letter> {
        return this.prisma.letter.delete({
            where: { id },
        }) as any;
    }

    async deleteMany(ids: string[]): Promise<number> {
        const result = await this.prisma.letter.deleteMany({
            where: { id: { in: ids } },
        });
        return result.count;
    }

    async updateManyStatus(ids: string[], isActive: boolean): Promise<number> {
        const result = await this.prisma.letter.updateMany({
            where: { id: { in: ids } },
            data: { isActive },
        });
        return result.count;
    }

    async incrementViews(id: string): Promise<void> {
        await this.prisma.letter.update({
            where: { id },
            data: { views: { increment: 1 } },
        });
    }

    async updatePage(id: string, data: { revealMapUrl: string }): Promise<void> {
        await this.prisma.letterPage.update({
            where: { id },
            data,
        });
    }

    async clearPages(letterId: string): Promise<void> {
        await this.prisma.letterPage.deleteMany({
            where: { letterId },
        });
    }
}
