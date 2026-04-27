import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { ISubscriberRepository } from './domain/subscriber.repository.interface';
import { PrismaSubscriberRepository } from './infrastructure/subscriber.repository';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [NewsletterController],
  providers: [
    NewsletterService,
    {
      provide: ISubscriberRepository,
      useClass: PrismaSubscriberRepository,
    },
  ],
  exports: [NewsletterService],
})
export class NewsletterModule { }
