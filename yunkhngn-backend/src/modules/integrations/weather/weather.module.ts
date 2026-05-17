import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [SettingsModule, ConfigModule],
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
