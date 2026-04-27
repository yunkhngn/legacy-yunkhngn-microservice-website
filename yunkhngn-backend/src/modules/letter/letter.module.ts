import { Module } from '@nestjs/common';
import { LetterController } from './letter.controller';
import { LetterService } from './letter.service';
import { ILetterRepository } from './domain/letter.repository.interface';
import { PrismaLetterRepository } from './infrastructure/letter.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LetterController],
  providers: [
    LetterService,
    {
      provide: ILetterRepository,
      useClass: PrismaLetterRepository,
    },
  ],
  exports: [LetterService],
})
export class LetterModule { }
