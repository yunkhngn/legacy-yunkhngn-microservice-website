import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { IContactRepository } from './domain/contact.repository.interface';
import { PrismaContactRepository } from './infrastructure/contact.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { EmailModule } from '../integrations/email/email.module';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, EmailModule, AiModule, NotificationsModule],
  controllers: [ContactController],
  providers: [
    ContactService,
    {
      provide: IContactRepository,
      useClass: PrismaContactRepository,
    },
  ],
  exports: [ContactService],
})
export class ContactModule { }
