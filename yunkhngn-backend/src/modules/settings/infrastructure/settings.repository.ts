import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ISettingsRepository } from '../domain/settings.repository.interface';
import { Setting } from '../domain/setting.entity';

@Injectable()
export class PrismaSettingsRepository implements ISettingsRepository {
    constructor(private readonly prisma: PrismaService) { }

    async upsert(title: string, content: string): Promise<Setting> {
        return this.prisma.settings.upsert({
            where: { settingTitle: title },
            update: { content },
            create: { settingTitle: title, content },
        });
    }

    async findAll(): Promise<Setting[]> {
        return this.prisma.settings.findMany({
            orderBy: { id: 'asc' },
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
