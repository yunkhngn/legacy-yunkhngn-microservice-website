import {
  AuditLog,
  AuditLogFilter,
  CreateAuditLogInput,
} from './audit-log.entity';

export interface IAuditLogRepository {
  create(data: CreateAuditLogInput): Promise<AuditLog>;
  findAll(
    options: AuditLogFilter,
  ): Promise<{ data: AuditLog[]; total: number }>;
  findById(id: string): Promise<AuditLog | null>;
}

export const IAuditLogRepository = Symbol('IAuditLogRepository');
