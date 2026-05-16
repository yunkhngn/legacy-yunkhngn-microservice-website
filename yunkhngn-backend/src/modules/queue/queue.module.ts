import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { BlogModule } from '../blog/blog.module';
import { NewsletterModule } from '../integrations/newsletter/newsletter.module';
import { RagSyncQueue } from './rag-sync/rag-sync.queue';
import { RagSyncProcessor } from './rag-sync/rag-sync.processor';
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
    AiModule,
    BlogModule,
    NewsletterModule,
  ],
  providers: [
    RagSyncQueue,
    RagSyncProcessor,
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
