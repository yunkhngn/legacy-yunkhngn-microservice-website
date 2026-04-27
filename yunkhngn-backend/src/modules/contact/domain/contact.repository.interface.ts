import { Contact } from './contact.entity';

export interface IContactRepository {
  create(data: any): Promise<Contact>;
  findAll(): Promise<Contact[]>;
  findById(id: string): Promise<Contact | null>;
  update(id: string, data: any): Promise<Contact>;
  delete(id: string): Promise<Contact>;
}

export const IContactRepository = Symbol('IContactRepository');
