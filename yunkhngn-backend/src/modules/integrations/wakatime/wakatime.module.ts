import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WakaTimeService } from './wakatime.service';
import { WakaTimeController } from './wakatime.controller';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [SettingsModule, ConfigModule],
  controllers: [WakaTimeController],
  providers: [WakaTimeService],
  exports: [WakaTimeService],
})
export class WakaTimeModule {}
