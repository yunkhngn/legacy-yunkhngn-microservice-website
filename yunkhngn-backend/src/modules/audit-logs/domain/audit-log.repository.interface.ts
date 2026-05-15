import { AuditLog } from './audit-log.entity';

export interface IAuditLogRepository {
  create(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog>;
  findAll(options: {
    skip?: number;
    take?: number;
    search?: string;
    entity?: string;
    action?: string;
  }): Promise<{ data: AuditLog[]; total: number }>;
  findById(id: string): Promise<AuditLog | null>;
}

export const IAuditLogRepository = Symbol('IAuditLogRepository');
