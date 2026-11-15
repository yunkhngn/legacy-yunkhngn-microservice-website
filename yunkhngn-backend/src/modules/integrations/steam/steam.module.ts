import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SteamService } from './steam.service';
import { SteamController } from './steam.controller';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [SettingsModule, ConfigModule],
  controllers: [SteamController],
  providers: [SteamService],
  exports: [SteamService],
})
export class SteamModule {}
