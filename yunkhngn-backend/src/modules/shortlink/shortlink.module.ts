import { Module } from '@nestjs/common';
import { ShortlinkController } from './shortlink.controller';
import { ShortlinkService } from './shortlink.service';
import { IShortLinkRepository } from './domain/shortlink.repository.interface';
import { PrismaShortlinkRepository } from './infrastructure/shortlink.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShortlinkController],
  providers: [
    ShortlinkService,
    {
      provide: IShortLinkRepository,
      useClass: PrismaShortlinkRepository,
    },
  ],
  exports: [ShortlinkService],
})
export class ShortlinkModule { }
