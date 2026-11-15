import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MonitorService } from './monitor.service';
import { FirebaseAuthGuard } from '../../common/guards';

@ApiTags('Monitor')
@Controller('monitor')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get('containers')
  @ApiOperation({ summary: 'Get list of containers from agent' })
  async getContainers() {
    return this.monitorService.getContainers();
  }
}
