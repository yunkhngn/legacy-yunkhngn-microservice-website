import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatLogsService } from './chat-logs.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('Chat Logs')
@Controller('chat-logs')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ChatLogsController {
  constructor(private readonly chatLogsService: ChatLogsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated chat logs (Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
  ) {
    return this.chatLogsService.findAll(+page || 1, +limit || 20, search);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single chat log by ID' })
  findOne(@Param('id') id: string) {
    return this.chatLogsService.findById(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a chat log' })
  remove(@Param('id') id: string) {
    return this.chatLogsService.remove(id);
  }

  @Delete()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete all chat logs' })
  removeAll() {
    return this.chatLogsService.removeAll();
  }
}
