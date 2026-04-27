import { Subscriber } from './subscriber.entity';

export interface ISubscriberRepository {
    create(email: string, token: string): Promise<Subscriber>;
    findByEmail(email: string): Promise<Subscriber | null>;
    findByToken(token: string): Promise<Subscriber | null>;
    delete(id: string): Promise<Subscriber>;
    findAll(): Promise<Subscriber[]>;
}

export const ISubscriberRepository = Symbol('ISubscriberRepository');
