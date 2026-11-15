import { ShortLink } from './shortlink.entity';

export interface IShortLinkRepository {
  create(data: any): Promise<ShortLink>;
  findAll(): Promise<ShortLink[]>;
  findById(id: string): Promise<ShortLink | null>;
  findByCode(code: string): Promise<ShortLink | null>;
  update(id: string, data: any): Promise<ShortLink>;
  delete(id: string): Promise<ShortLink>;
  deleteMany(ids: string[]): Promise<number>;
  updateManyStatus(ids: string[], isActive: boolean): Promise<number>;
  incrementClicks(id: string): Promise<void>;
}

export const IShortLinkRepository = Symbol('IShortLinkRepository');
