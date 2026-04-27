import { Album } from './album.entity';

export interface IAlbumRepository {
  create(data: any): Promise<Album>;
  findAll(): Promise<Album[]>;
  findById(id: string): Promise<Album | null>;
  findBySlug(slug: string): Promise<Album | null>;
  update(id: string, data: any): Promise<Album>;
  delete(id: string): Promise<Album>;
  unassignPhotos(albumId: string): Promise<void>;
}

export const IAlbumRepository = Symbol('IAlbumRepository');
