import { Gallery } from './gallery.entity';

export interface IGalleryRepository {
    create(data: any): Promise<Gallery>;
    findAll(options: {
        where?: any;
        skip?: number;
        take?: number;
        orderBy?: any;
    }): Promise<{ data: Gallery[]; total: number }>;
    findById(id: string): Promise<Gallery | null>;
    update(id: string, data: any): Promise<Gallery>;
    delete(id: string): Promise<Gallery>;
    reorder(items: { id: string; sortOrder: number }[]): Promise<void>;
    bulkUpdate(ids: string[], data: any): Promise<number>;
    incrementViews(id: string): Promise<void>;
    getAllTags(): Promise<string[]>;
}

export const IGalleryRepository = Symbol('IGalleryRepository');
