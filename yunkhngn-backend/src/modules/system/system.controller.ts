import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { FirebaseAuthGuard } from '../../common/guards';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get system-wide statistics' })
  @UseGuards(FirebaseAuthGuard)
  getStats() {
    return this.systemService.getStats();
  }

  @Get('dashboard-stats')
  @ApiBearerAuth()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('admin_dashboard_stats')
  @CacheTTL(60)
  @ApiOperation({
    summary: 'Get consolidated data metrics for admin dashboard',
  })
  @UseGuards(FirebaseAuthGuard)
  async getDashboardStats() {
    return this.systemService.getDashboardStats();
  }
}
