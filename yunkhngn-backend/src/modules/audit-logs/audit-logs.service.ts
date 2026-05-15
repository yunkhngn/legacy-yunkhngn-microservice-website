import { Injectable, Inject, Logger } from '@nestjs/common';
import { IAuditLogRepository } from './domain/audit-log.repository.interface';
import { AuditLog } from './domain/audit-log.entity';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @Inject(IAuditLogRepository)
    private readonly repo: IAuditLogRepository,
  ) {}

  async log(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      await this.repo.create(data);
    } catch (error) {
      // Never let audit logging break the main flow
      this.logger.error(`Failed to write audit log: ${error.message}`);
    }
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    entity?: string,
    action?: string,
  ) {
    const skip = (page - 1) * limit;
    const result = await this.repo.findAll({
      skip,
      take: limit,
      search,
      entity,
      action,
    });
    return {
      data: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        lastPage: Math.ceil(result.total / limit),
      },
    };
  }

  async findById(id: string) {
    return this.repo.findById(id);
  }
}
