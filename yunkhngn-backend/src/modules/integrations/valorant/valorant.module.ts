import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ValorantService } from './valorant.service';
import { ValorantController } from './valorant.controller';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [SettingsModule, ConfigModule],
  controllers: [ValorantController],
  providers: [ValorantService],
  exports: [ValorantService],
})
export class ValorantModule {}
