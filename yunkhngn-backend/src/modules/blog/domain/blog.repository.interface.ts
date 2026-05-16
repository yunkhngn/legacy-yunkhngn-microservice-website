import { Blog } from './blog.entity';

export interface IBlogRepository {
  create(data: Partial<Blog>): Promise<Blog>;
  findAll(limit?: number, status?: string): Promise<Blog[]>;
  findBySlugOrId(slugOrId: string): Promise<Blog | null>;
  findBySlug(slug: string): Promise<Blog | null>;
  findById(id: string): Promise<Blog | null>;
  findManyByIds(ids: string[]): Promise<Blog[]>;
  findRelated(
    excludeIds: string[],
    tags: string[],
    take: number,
  ): Promise<Blog[]>;
  update(id: string, data: Partial<Blog>): Promise<Blog>;
  delete(id: string): Promise<Blog>;
  incrementViews(id: string): Promise<Blog>;
}

export const IBlogRepository = Symbol('IBlogRepository');
