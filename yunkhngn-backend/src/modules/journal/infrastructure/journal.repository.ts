import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IJournalRepository } from '../domain/journal.repository.interface';
import { Journal, JournalReaction } from '../domain/journal.entity';

@Injectable()
export class PrismaJournalRepository implements IJournalRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: any): Promise<Journal> {
    return this.prisma.journal.create({
      data,
    }) as any;
  }

  async findAll(options: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<{ data: Journal[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.journal.findMany({
        where: options.where,
        skip: options.skip,
        take: options.take,
        orderBy: { createdAt: 'desc' },
        include: {
          reactions: true,
          replies: {
            orderBy: { createdAt: 'asc' },
            include: { reactions: true },
          },
        },
      }),
      this.prisma.journal.count({ where: options.where }),
    ]);

    return {
      data: data as any[],
      total,
    };
  }

  findById(id: string): Promise<Journal | null> {
    return this.prisma.journal.findUnique({
      where: { id },
      include: {
        reactions: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { reactions: true },
        },
      },
    }) as any;
  }

  update(id: string, data: any): Promise<Journal> {
    return this.prisma.journal.update({
      where: { id },
      data,
      include: {
        reactions: true,
        replies: { include: { reactions: true } },
      },
    }) as any;
  }

  delete(id: string): Promise<Journal> {
    return this.prisma.journal.delete({
      where: { id },
    }) as any;
  }

  findChildren(parentId: string): Promise<Journal[]> {
    return this.prisma.journal.findMany({
      where: { parentId },
    }) as any;
  }

  findReaction(
    journalId: string,
    uid: string,
  ): Promise<JournalReaction | null> {
    return this.prisma.journalReaction.findUnique({
      where: { journalId_uid: { journalId, uid } },
    }) as any;
  }

  async createReaction(data: any): Promise<void> {
    await this.prisma.journalReaction.create({
      data,
    });
  }

  async updateReaction(id: string, type: string): Promise<void> {
    await this.prisma.journalReaction.update({
      where: { id },
      data: { type },
    });
  }

  async deleteReaction(id: string): Promise<void> {
    await this.prisma.journalReaction.delete({
      where: { id },
    });
  }
}
