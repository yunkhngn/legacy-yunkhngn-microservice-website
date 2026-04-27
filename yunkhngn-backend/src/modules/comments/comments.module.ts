import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ICommentRepository } from './domain/comment.repository.interface';
import { PrismaCommentRepository } from './infrastructure/comment.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, SettingsModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [
    CommentsService,
    {
      provide: ICommentRepository,
      useClass: PrismaCommentRepository,
    },
  ],
  exports: [CommentsService],
})
export class CommentsModule { }
