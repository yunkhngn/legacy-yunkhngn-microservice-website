import { Module } from '@nestjs/common';
import { VercelController } from './vercel.controller';
import { VercelService } from './vercel.service';

@Module({
  controllers: [VercelController],
  providers: [VercelService],
  exports: [VercelService],
})
export class VercelModule {}
