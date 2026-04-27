import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CloudflareService } from './cloudflare.service';
import { FirebaseAuthGuard, RolesGuard } from '../../../common/guards';
import { Roles } from '../../../common/decorators';

@ApiTags('Cloudflare')
@Controller('admin/analytics')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CloudflareController {
  constructor(private readonly cloudflareService: CloudflareService) { }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get website analytics from Cloudflare' })
  @ApiQuery({ name: 'period', enum: ['24h', '7d', '30d'], default: '7d' })
  async getAnalytics(@Query('period') period: '24h' | '7d' | '30d') {
    return this.cloudflareService.getAnalytics(period || '7d');
  }
}
