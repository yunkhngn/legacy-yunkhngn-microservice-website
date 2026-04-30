import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IKnowledgeRepository } from '../domain/knowledge.repository.interface';
import { KnowledgeEntry } from '../domain/knowledge.entity';

@Injectable()
export class PrismaKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
    return this.prisma.knowledgeEntry.create({ data: data as any });
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    return this.prisma.knowledgeEntry.findMany({
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string): Promise<KnowledgeEntry | null> {
    return this.prisma.knowledgeEntry.findUnique({ where: { id } });
  }

  async findByCategory(category: string): Promise<KnowledgeEntry[]> {
    return this.prisma.knowledgeEntry.findMany({
      where: { category },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCategories(): Promise<string[]> {
    const result = await this.prisma.knowledgeEntry.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return result.map((r) => r.category);
  }

  async update(id: string, data: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
    return this.prisma.knowledgeEntry.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(id: string): Promise<KnowledgeEntry> {
    return this.prisma.knowledgeEntry.delete({ where: { id } });
  }
}
