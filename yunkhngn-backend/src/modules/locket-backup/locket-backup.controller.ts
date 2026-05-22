import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { LocketBackupService } from './locket-backup.service';

@ApiTags('Locket Backup')
@Controller('locket-backup')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LocketBackupController {
  private readonly logger = new Logger(LocketBackupController.name);

  constructor(private readonly locketBackupService: LocketBackupService) {}

  @Post('run')
  @HttpCode(202)
  @ApiOperation({ summary: 'Trigger manual Locket backup (async, poll /status for result)' })
  run() {
    const { isRunning } = this.locketBackupService.getStatus();
    if (isRunning) {
      throw new ConflictException('Backup đang chạy, kiểm tra /locket-backup/status');
    }
    // Fire and forget — long-running operation, client polls /status
    void this.locketBackupService.runBackup().catch((error) => {
      this.logger.error(
        `Manual Locket backup failed: ${error?.message ?? error}`,
        error?.stack,
      );
    });
    return { message: 'Backup started', status: 'running' };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current backup status and last result' })
  status() {
    return this.locketBackupService.getStatus();
  }
}
