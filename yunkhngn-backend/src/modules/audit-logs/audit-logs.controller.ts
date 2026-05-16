import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { FindAuditLogsDto } from './dto/find-audit-logs.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { AUDIT_ENTITIES, AUDIT_ACTIONS } from './domain/audit-log.types';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated audit logs (Admin only)' })
  findAll(@Query() query: FindAuditLogsDto) {
    return this.service.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      entity: query.entity,
      action: query.action,
      userId: query.userId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('metadata')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get known audit entity/action values (Admin only)',
  })
  metadata() {
    return { entities: AUDIT_ENTITIES, actions: AUDIT_ACTIONS };
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit log by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
