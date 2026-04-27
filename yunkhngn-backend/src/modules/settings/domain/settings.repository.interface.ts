import { Setting } from './setting.entity';

export interface ISettingsRepository {
  upsert(title: string, content: string): Promise<Setting>;
  findAll(): Promise<Setting[]>;
  findByTitle(title: string): Promise<Setting | null>;
  findById(id: number): Promise<Setting | null>;
  findByTitles(titles: string[]): Promise<Setting[]>;
  delete(id: number): Promise<Setting>;
}

export const ISettingsRepository = Symbol('ISettingsRepository');
