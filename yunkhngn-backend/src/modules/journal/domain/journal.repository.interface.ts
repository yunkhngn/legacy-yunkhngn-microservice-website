import { Journal, JournalReaction } from './journal.entity';

export interface IJournalRepository {
  create(data: any): Promise<Journal>;
  findAll(options: {
    skip?: number;
    take?: number;
    where?: any;
  }): Promise<{ data: Journal[]; total: number }>;
  findById(id: string): Promise<Journal | null>;
  update(id: string, data: any): Promise<Journal>;
  delete(id: string): Promise<Journal>;
  findChildren(parentId: string): Promise<Journal[]>;

  // Reactions
  findReaction(journalId: string, uid: string): Promise<JournalReaction | null>;
  createReaction(data: any): Promise<void>;
  updateReaction(id: string, type: string): Promise<void>;
  deleteReaction(id: string): Promise<void>;
}

export const IJournalRepository = Symbol('IJournalRepository');
