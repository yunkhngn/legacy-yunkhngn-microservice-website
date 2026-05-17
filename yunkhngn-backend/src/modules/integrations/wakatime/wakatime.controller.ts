import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WakaTimeService } from './wakatime.service';

@ApiTags('WakaTime')
@Controller('wakatime')
export class WakaTimeController {
  constructor(private readonly wakaTimeService: WakaTimeService) {}

  @Get('today')
  @ApiOperation({ summary: "Get today's coding summary" })
  getToday() {
    return this.wakaTimeService.getToday();
  }
}
