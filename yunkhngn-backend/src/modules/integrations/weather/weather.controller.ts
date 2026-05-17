import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WeatherService } from './weather.service';

@ApiTags('Weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('hanoi')
  @ApiOperation({ summary: 'Get current Hanoi weather' })
  getHanoi() {
    return this.weatherService.getHanoi();
  }
}
