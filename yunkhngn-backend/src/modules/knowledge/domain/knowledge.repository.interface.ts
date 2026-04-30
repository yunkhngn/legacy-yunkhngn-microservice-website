import { KnowledgeEntry } from './knowledge.entity';

export interface IKnowledgeRepository {
  create(data: Partial<KnowledgeEntry>): Promise<KnowledgeEntry>;
  findAll(): Promise<KnowledgeEntry[]>;
  findById(id: string): Promise<KnowledgeEntry | null>;
  findByCategory(category: string): Promise<KnowledgeEntry[]>;
  getCategories(): Promise<string[]>;
  update(id: string, data: Partial<KnowledgeEntry>): Promise<KnowledgeEntry>;
  delete(id: string): Promise<KnowledgeEntry>;
}

export const IKnowledgeRepository = Symbol('IKnowledgeRepository');
