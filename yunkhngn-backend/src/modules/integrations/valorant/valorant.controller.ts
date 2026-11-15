import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ValorantService } from './valorant.service';

@ApiTags('Valorant')
@Controller('valorant')
export class ValorantController {
  constructor(private readonly valorantService: ValorantService) {}

  @Get('recent')
  @ApiOperation({ summary: 'Get most recent Valorant match activity' })
  getRecentActivity() {
    return this.valorantService.getRecentActivity();
  }
}
