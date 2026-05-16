import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { IBlogRepository } from '../blog/domain/blog.repository.interface';
import { PrismaBlogRepository } from '../blog/infrastructure/blog.repository';
import { IProjectRepository } from '../project/domain/project.repository.interface';
import { PrismaProjectRepository } from '../project/infrastructure/project.repository';
import { NewsletterModule } from '../integrations/newsletter/newsletter.module';
import { RagSyncQueue } from './rag-sync/rag-sync.queue';
import { RagSyncProcessor } from './rag-sync/rag-sync.processor';
import { RagSyncController } from './rag-sync/rag-sync.controller';
import { RagSyncReindexService } from './rag-sync/rag-sync.reindex.service';
import { NewsletterQueue } from './newsletter/newsletter.queue';
import { NewsletterProcessor } from './newsletter/newsletter.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: parseInt(config.get<string>('REDIS_PORT') || '6379', 10),
        },
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
    }),
    BullModule.registerQueue({ name: 'newsletter' }),
    BullModule.registerQueue({ name: 'rag-sync' }),
    PrismaModule,
    AiModule,
    NewsletterModule,
  ],
  controllers: [RagSyncController],
  providers: [
    {
      provide: IBlogRepository,
      useClass: PrismaBlogRepository,
    },
    {
      provide: IProjectRepository,
      useClass: PrismaProjectRepository,
    },
    RagSyncQueue,
    RagSyncProcessor,
    RagSyncReindexService,
    NewsletterQueue,
    NewsletterProcessor,
  ],
  exports: [BullModule, RagSyncQueue, NewsletterQueue],
})
export class QueueModule {}

import { getQueueToken } from '@nestjs/bullmq';

export const QUEUE_TOKENS = {
  newsletter: getQueueToken('newsletter'),
  ragSync: getQueueToken('rag-sync'),
};
