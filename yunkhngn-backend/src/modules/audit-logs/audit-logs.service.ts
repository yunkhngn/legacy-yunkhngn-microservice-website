import { Injectable, Inject, Logger } from '@nestjs/common';
import { IAuditLogRepository } from './domain/audit-log.repository.interface';
import { AuditLogFilter, CreateAuditLogInput } from './domain/audit-log.entity';
import { AuditAction, AuditEntity } from './domain/audit-log.types';
import { getAuditActor } from './audit-context';

const DETAILS_MAX_LENGTH = 8000;
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
]);

export interface AuditLogInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  details?: Record<string, unknown> | string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @Inject(IAuditLogRepository)
    private readonly repo: IAuditLogRepository,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      const actor = getAuditActor();
      const data: CreateAuditLogInput = {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        userId: actor.userId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        details: this.serializeDetails(input.details),
      };
      await this.repo.create(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to write audit log: ${message}`);
    }
  }

  async findAll(filter: AuditLogFilter & { page: number; limit: number }) {
    const { page, limit, ...rest } = filter;
    const skip = (page - 1) * limit;
    const result = await this.repo.findAll({ ...rest, skip, take: limit });
    return {
      data: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        lastPage: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  async findById(id: string) {
    return this.repo.findById(id);
  }

  private serializeDetails(details: AuditLogInput['details']) {
    if (details === undefined) return undefined;
    if (typeof details === 'string') {
      return details.length > DETAILS_MAX_LENGTH
        ? details.slice(0, DETAILS_MAX_LENGTH)
        : details;
    }
    const sanitized = this.redact(details);
    const json = JSON.stringify(sanitized);
    return json.length > DETAILS_MAX_LENGTH
      ? json.slice(0, DETAILS_MAX_LENGTH)
      : json;
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.redact(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : this.redact(v);
      }
      return out;
    }
    return value;
  }
}
