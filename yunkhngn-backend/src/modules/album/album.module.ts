import { Module } from '@nestjs/common';
import { AlbumController } from './album.controller';
import { AlbumService } from './album.service';
import { IAlbumRepository } from './domain/album.repository.interface';
import { PrismaAlbumRepository } from './infrastructure/album.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AlbumController],
  providers: [
    AlbumService,
    {
      provide: IAlbumRepository,
      useClass: PrismaAlbumRepository,
    },
  ],
  exports: [AlbumService],
})
export class AlbumModule {}
