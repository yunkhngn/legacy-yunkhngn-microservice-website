import { Module, Global } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { IAuditLogRepository } from './domain/audit-log.repository.interface';
import { PrismaAuditLogRepository } from './infrastructure/audit-log.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogsController],
  providers: [
    AuditLogsService,
    { provide: IAuditLogRepository, useClass: PrismaAuditLogRepository },
  ],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
