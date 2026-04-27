import { Module } from '@nestjs/common';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { IGalleryRepository } from './domain/gallery.repository.interface';
import { PrismaGalleryRepository } from './infrastructure/gallery.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [GalleryController],
  providers: [
    GalleryService,
    {
      provide: IGalleryRepository,
      useClass: PrismaGalleryRepository,
    },
  ],
  exports: [GalleryService],
})
export class GalleryModule { }
