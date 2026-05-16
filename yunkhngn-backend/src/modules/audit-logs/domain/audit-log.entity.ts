export class AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type CreateAuditLogInput = Omit<AuditLog, 'id' | 'createdAt'>;

export interface AuditLogFilter {
  skip?: number;
  take?: number;
  search?: string;
  entity?: string;
  action?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}
