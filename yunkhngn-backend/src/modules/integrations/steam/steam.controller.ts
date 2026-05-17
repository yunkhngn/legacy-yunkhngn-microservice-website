import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SteamService } from './steam.service';

@ApiTags('Steam')
@Controller('steam')
export class SteamController {
  constructor(private readonly steamService: SteamService) {}

  @Get('now-playing')
  @ApiOperation({ summary: 'Get currently playing Steam game' })
  getNowPlaying() {
    return this.steamService.getNowPlaying();
  }
}
