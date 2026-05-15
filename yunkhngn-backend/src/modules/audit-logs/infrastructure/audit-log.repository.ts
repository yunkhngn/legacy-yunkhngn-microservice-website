import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IAuditLogRepository } from '../domain/audit-log.repository.interface';
import { AuditLog } from '../domain/audit-log.entity';

@Injectable()
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Omit<AuditLog, 'id' | 'createdAt'>,
  ): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  async findAll(options: {
    skip?: number;
    take?: number;
    search?: string;
    entity?: string;
    action?: string;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: any = {};
    if (options.search) {
      where.OR = [
        { action: { contains: options.search } },
        { entity: { contains: options.search } },
        { details: { contains: options.search } },
      ];
    }
    if (options.entity) {
      where.entity = options.entity;
    }
    if (options.action) {
      where.action = options.action;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.skip,
        take: options.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({ where: { id } });
  }
}
