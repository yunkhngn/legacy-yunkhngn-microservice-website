import { User } from './user.entity';

export interface IUserRepository {
  findByUid(uid: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(data: Partial<User>): Promise<User>;
  update(uid: string, data: Partial<User>): Promise<User>;
  delete(uid: string): Promise<User>;
  upsert(uid: string, data: Partial<User>): Promise<User>;
}

export const IUserRepository = Symbol('IUserRepository');
