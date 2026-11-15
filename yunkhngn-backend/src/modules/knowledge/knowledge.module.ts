import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { IKnowledgeRepository } from './domain/knowledge.repository.interface';
import { PrismaKnowledgeRepository } from './infrastructure/knowledge.prisma-repository';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    {
      provide: IKnowledgeRepository,
      useClass: PrismaKnowledgeRepository,
    },
  ],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
