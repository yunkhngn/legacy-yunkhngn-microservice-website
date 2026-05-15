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
