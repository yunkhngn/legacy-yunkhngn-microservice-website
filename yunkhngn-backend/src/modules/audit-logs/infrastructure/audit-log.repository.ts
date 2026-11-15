import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IAuditLogRepository } from '../domain/audit-log.repository.interface';
import {
  AuditLog,
  AuditLogFilter,
  CreateAuditLogInput,
} from '../domain/audit-log.entity';

@Injectable()
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAuditLogInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  async findAll(
    options: AuditLogFilter,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (options.search) {
      where.OR = [
        { action: { contains: options.search } },
        { entity: { contains: options.search } },
        { details: { contains: options.search } },
        { userId: { contains: options.search } },
      ];
    }
    if (options.entity) where.entity = options.entity;
    if (options.action) where.action = options.action;
    if (options.userId) where.userId = options.userId;
    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) where.createdAt.gte = options.from;
      if (options.to) where.createdAt.lte = options.to;
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
