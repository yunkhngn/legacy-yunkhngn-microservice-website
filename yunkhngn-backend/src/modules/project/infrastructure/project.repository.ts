import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IProjectRepository } from '../domain/project.repository.interface';
import { Project } from '../domain/project.entity';

@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<Project> {
    return this.prisma.project.create({
      data,
    });
  }

  async findAll(limit?: number): Promise<Project[]> {
    return this.prisma.project.findMany({
      take: limit ? Number(limit) : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { slug },
    });
  }

  async findManyByIds(ids: string[]): Promise<Project[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.project.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(rows.map((r) => [r.id, r as Project]));
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is Project => Boolean(p));
  }

  async findRelated(
    excludeIds: string[],
    tags: string[],
    techStack: string[],
    take: number,
  ): Promise<Project[]> {
    const ors: any[] = [];
    for (const tag of tags) ors.push({ tags: { contains: tag } });
    for (const tech of techStack) ors.push({ techStack: { contains: tech } });

    if (ors.length === 0) {
      return this.prisma.project.findMany({
        where: { id: { notIn: excludeIds } },
        take,
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.project.findMany({
      where: {
        id: { notIn: excludeIds },
        OR: ors,
      },
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: any): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Project> {
    return this.prisma.project.delete({
      where: { id },
    });
  }
}
