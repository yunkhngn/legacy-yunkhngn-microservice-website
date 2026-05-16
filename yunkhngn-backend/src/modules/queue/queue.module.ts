import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { RagSyncQueue } from './rag-sync/rag-sync.queue';
import { RagSyncProcessor } from './rag-sync/rag-sync.processor';

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
  ],
  providers: [RagSyncQueue, RagSyncProcessor],
  exports: [BullModule, RagSyncQueue],
})
export class QueueModule {}
