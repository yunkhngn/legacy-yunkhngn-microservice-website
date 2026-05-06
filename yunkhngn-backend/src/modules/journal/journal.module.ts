import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { IJournalRepository } from './domain/journal.repository.interface';
import { PrismaJournalRepository } from './infrastructure/journal.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, NotificationsModule, CloudinaryModule],
  controllers: [JournalController],
  providers: [
    JournalService,
    {
      provide: IJournalRepository,
      useClass: PrismaJournalRepository,
    },
  ],
  exports: [JournalService],
})
export class JournalModule { }
