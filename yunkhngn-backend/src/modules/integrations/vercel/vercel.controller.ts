import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { VercelService } from './vercel.service';
import { FirebaseAuthGuard, RolesGuard } from '../../../common/guards';
import { Roles } from '../../../common/decorators';

@ApiTags('Vercel')
@Controller('admin/vercel')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class VercelController {
  constructor(private readonly vercelService: VercelService) {}

  @Get('analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get web analytics from Vercel' })
  @ApiQuery({ name: 'period', enum: ['24h', '7d', '30d'], required: false })
  async getAnalytics(@Query('period') period: '24h' | '7d' | '30d') {
    return this.vercelService.getAnalytics(period || '7d');
  }

  @Get('speed-insights')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get speed insights from Vercel' })
  @ApiQuery({ name: 'period', enum: ['24h', '7d', '30d'], required: false })
  async getSpeedInsights(@Query('period') period: '24h' | '7d' | '30d') {
    return this.vercelService.getSpeedInsights(period || '7d');
  }
}
