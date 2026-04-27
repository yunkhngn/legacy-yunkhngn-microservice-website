import { Project } from './project.entity';

export interface IProjectRepository {
    create(data: any): Promise<Project>;
    findAll(): Promise<Project[]>;
    findById(id: string): Promise<Project | null>;
    findBySlug(slug: string): Promise<Project | null>;
    update(id: string, data: any): Promise<Project>;
    delete(id: string): Promise<Project>;
}

export const IProjectRepository = Symbol('IProjectRepository');
