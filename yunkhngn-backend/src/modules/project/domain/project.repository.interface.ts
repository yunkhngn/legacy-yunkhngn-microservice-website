import { Project } from './project.entity';

export interface IProjectRepository {
  create(data: any): Promise<Project>;
  findAll(limit?: number): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  findBySlug(slug: string): Promise<Project | null>;
  findManyByIds(ids: string[]): Promise<Project[]>;
  findRelated(
    excludeIds: string[],
    tags: string[],
    techStack: string[],
    take: number,
  ): Promise<Project[]>;
  update(id: string, data: any): Promise<Project>;
  delete(id: string): Promise<Project>;
}

export const IProjectRepository = Symbol('IProjectRepository');
