import { Letter, LetterPage } from './letter.entity';

export interface ILetterRepository {
    create(data: any): Promise<Letter>;
    findAll(): Promise<Letter[]>;
    findById(id: string): Promise<Letter | null>;
    findByCode(code: string): Promise<Letter | null>;
    update(id: string, data: any): Promise<Letter>;
    delete(id: string): Promise<Letter>;
    deleteMany(ids: string[]): Promise<number>;
    updateManyStatus(ids: string[], isActive: boolean): Promise<number>;
    incrementViews(id: string): Promise<void>;
    updatePage(id: string, data: { revealMapUrl: string }): Promise<void>;
    clearPages(letterId: string): Promise<void>;
}

export const ILetterRepository = Symbol('ILetterRepository');
