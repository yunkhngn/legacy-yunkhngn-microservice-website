import { Module } from '@nestjs/common';
import { ChatLogsController } from './chat-logs.controller';
import { ChatLogsService } from './chat-logs.service';
import { IChatLogRepository } from './domain/chat-log.repository.interface';
import { PrismaChatLogRepository } from './infrastructure/chat-log.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChatLogsController],
  providers: [
    ChatLogsService,
    {
      provide: IChatLogRepository,
      useClass: PrismaChatLogRepository,
    },
  ],
  exports: [ChatLogsService],
})
export class ChatLogsModule {}
