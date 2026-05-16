import { AsyncLocalStorage } from 'async_hooks';

export interface AuditActor {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const auditContext = new AsyncLocalStorage<AuditActor>();

export function getAuditActor(): AuditActor {
  return auditContext.getStore() ?? {};
}
