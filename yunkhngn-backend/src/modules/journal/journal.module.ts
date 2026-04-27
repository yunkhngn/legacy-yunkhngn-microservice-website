import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { IJournalRepository } from './domain/journal.repository.interface';
import { PrismaJournalRepository } from './infrastructure/journal.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
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
export class JournalModule {}
