import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async chat(@Body() body: ChatMessageDto) {
    let history = [];
    try {
      if (body.history) {
        history = JSON.parse(body.history);
      }
    } catch {
      // ignore invalid history
    }

    const result = await this.chatService.generateResponse(
      body.message,
      history,
    );
    return { response: result.text, imageUrl: result.imageUrl };
  }

  @Post('external')
  @UseGuards(ApiKeyGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async externalChat(@Body() body: ChatMessageDto) {
    let history = [];
    try {
      if (body.history) {
        history = JSON.parse(body.history);
      }
    } catch {
      // ignore invalid history
    }

    const result = await this.chatService.generateResponse(
      body.message,
      history,
    );
    return { response: result.text, imageUrl: result.imageUrl };
  }
}
