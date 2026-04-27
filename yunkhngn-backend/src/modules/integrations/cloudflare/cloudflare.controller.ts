import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CloudflareService } from './cloudflare.service';
import { FirebaseAuthGuard, RolesGuard } from '../../../common/guards';
import { Roles } from '../../../common/decorators';

@Controller('admin/analytics')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CloudflareController {
  constructor(private readonly cloudflareService: CloudflareService) { }

  @Get()
  async getAnalytics(@Query('period') period: '24h' | '7d' | '30d') {
    return this.cloudflareService.getAnalytics(period);
  }
}
