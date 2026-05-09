import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ISettingsRepository } from '../domain/settings.repository.interface';
import { Setting } from '../domain/setting.entity';

@Injectable()
export class PrismaSettingsRepository implements ISettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    title: string,
    content: string,
    group: string = 'Uncategorized',
    sortOrder: number = 0,
  ): Promise<Setting> {
    return this.prisma.settings.upsert({
      where: { settingTitle: title },
      update: { content, group, sortOrder },
      create: { settingTitle: title, content, group, sortOrder },
    });
  }

  async create(
    title: string,
    content: string,
    group: string,
    sortOrder: number,
  ): Promise<Setting> {
    return this.prisma.settings.create({
      data: { settingTitle: title, content, group, sortOrder },
    });
  }

  async updateGroup(
    id: number,
    group: string,
    sortOrder: number,
  ): Promise<Setting> {
    return this.prisma.settings.update({
      where: { id },
      data: { group, sortOrder },
    });
  }

  async findAll(): Promise<Setting[]> {
    return this.prisma.settings.findMany({
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async findByTitle(title: string): Promise<Setting | null> {
    return this.prisma.settings.findUnique({
      where: { settingTitle: title },
    });
  }

  async findById(id: number): Promise<Setting | null> {
    return this.prisma.settings.findUnique({
      where: { id },
    });
  }

  async findByTitles(titles: string[]): Promise<Setting[]> {
    return this.prisma.settings.findMany({
      where: {
        settingTitle: { in: titles },
      },
      orderBy: { id: 'asc' },
    });
  }

  async delete(id: number): Promise<Setting> {
    return this.prisma.settings.delete({
      where: { id },
    });
  }
}
