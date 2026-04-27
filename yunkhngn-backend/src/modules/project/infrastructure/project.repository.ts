import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IProjectRepository } from '../domain/project.repository.interface';
import { Project } from '../domain/project.entity';

@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: any): Promise<Project> {
        return this.prisma.project.create({
            data,
        });
    }

    async findAll(): Promise<Project[]> {
        return this.prisma.project.findMany({
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
