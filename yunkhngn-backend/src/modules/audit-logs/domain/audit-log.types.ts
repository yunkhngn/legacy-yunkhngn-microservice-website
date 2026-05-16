export const AuditEntity = {
  BLOG: 'Blog',
  PROJECT: 'Project',
} as const;
export type AuditEntity = (typeof AuditEntity)[keyof typeof AuditEntity];

export const AuditAction = {
  CREATE_BLOG: 'CREATE_BLOG',
  UPDATE_BLOG: 'UPDATE_BLOG',
  DELETE_BLOG: 'DELETE_BLOG',
  CREATE_PROJECT: 'CREATE_PROJECT',
  UPDATE_PROJECT: 'UPDATE_PROJECT',
  DELETE_PROJECT: 'DELETE_PROJECT',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ENTITIES = Object.values(AuditEntity);
export const AUDIT_ACTIONS = Object.values(AuditAction);
