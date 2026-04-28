import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { FirebaseAuthGuard } from '../../common/guards';

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get system-wide statistics' })
  @UseGuards(FirebaseAuthGuard)
  async getStats() {
    return this.systemService.getStats();
  }

  @Get('dashboard-stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get consolidated data metrics for admin dashboard' })
  @UseGuards(FirebaseAuthGuard)
  async getDashboardStats() {
    return this.systemService.getDashboardStats();
  }
}
