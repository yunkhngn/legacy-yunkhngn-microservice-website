import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SettingsModule } from '../settings/settings.module';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';

@Module({
  imports: [SettingsModule, ChatLogsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
