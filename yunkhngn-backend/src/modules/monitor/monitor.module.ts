import { Module } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { MonitorController } from './monitor.controller';
import { MonitorGateway } from './monitor.gateway';

@Module({
  providers: [MonitorService, MonitorGateway],
  controllers: [MonitorController],
  exports: [MonitorService],
})
export class MonitorModule {}
