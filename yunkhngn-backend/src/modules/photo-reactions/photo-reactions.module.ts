import { Module } from '@nestjs/common';
import { PhotoReactionsService } from './photo-reactions.service';
import { PhotoReactionsController } from './photo-reactions.controller';
import { IPhotoReactionRepository } from './domain/photo-reaction.repository.interface';
import { PrismaPhotoReactionRepository } from './infrastructure/photo-reaction.repository';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PhotoReactionsController],
  providers: [
    PhotoReactionsService,
    {
      provide: IPhotoReactionRepository,
      useClass: PrismaPhotoReactionRepository,
    },
  ],
  exports: [PhotoReactionsService],
})
export class PhotoReactionsModule {}
