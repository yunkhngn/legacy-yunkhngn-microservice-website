import { Setting } from './setting.entity';

export interface ISettingsRepository {
  upsert(
    title: string,
    content: string,
    group: string,
    sortOrder: number,
    isSensitive?: boolean,
  ): Promise<Setting>;
  create(
    title: string,
    content: string,
    group: string,
    sortOrder: number,
    isSensitive?: boolean,
  ): Promise<Setting>;
  updateGroup(id: number, group: string, sortOrder: number): Promise<Setting>;
  findAll(): Promise<Setting[]>;
  findByTitle(title: string): Promise<Setting | null>;
  findById(id: number): Promise<Setting | null>;
  findByTitles(titles: string[]): Promise<Setting[]>;
  delete(id: number): Promise<Setting>;
}

export const ISettingsRepository = Symbol('ISettingsRepository');
