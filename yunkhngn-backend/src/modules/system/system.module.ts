import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { SystemCronService } from './system.cron.service';

@Module({
  providers: [SystemService, SystemCronService],
  controllers: [SystemController],
})
export class SystemModule {}
