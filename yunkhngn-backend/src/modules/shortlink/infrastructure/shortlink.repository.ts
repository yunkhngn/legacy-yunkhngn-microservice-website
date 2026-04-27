import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IShortLinkRepository } from '../domain/shortlink.repository.interface';
import { ShortLink } from '../domain/shortlink.entity';

@Injectable()
export class PrismaShortlinkRepository implements IShortLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<ShortLink> {
    return this.prisma.shortLink.create({
      data,
    });
  }

  async findAll(): Promise<ShortLink[]> {
    return this.prisma.shortLink.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<ShortLink | null> {
    return this.prisma.shortLink.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string): Promise<ShortLink | null> {
    return this.prisma.shortLink.findUnique({
      where: { code },
    });
  }

  async update(id: string, data: any): Promise<ShortLink> {
    return this.prisma.shortLink.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<ShortLink> {
    return this.prisma.shortLink.delete({
      where: { id },
    });
  }

  async deleteMany(ids: string[]): Promise<number> {
    const result = await this.prisma.shortLink.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }

  async updateManyStatus(ids: string[], isActive: boolean): Promise<number> {
    const result = await this.prisma.shortLink.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });
    return result.count;
  }

  async incrementClicks(id: string): Promise<void> {
    await this.prisma.shortLink.update({
      where: { id },
      data: { clicks: { increment: 1 } },
    });
  }
}
