import { Module } from '@nestjs/common';
import { LocketBackupController } from './locket-backup.controller';
import { LocketBackupService } from './locket-backup.service';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { GalleryModule } from '../gallery/gallery.module';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    GalleryModule,
    CloudinaryModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [LocketBackupController],
  providers: [LocketBackupService],
})
export class LocketBackupModule {}
