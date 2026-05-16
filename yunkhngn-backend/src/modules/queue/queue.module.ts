import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
  ],
  exports: [BullModule],
})
export class QueueModule {}
