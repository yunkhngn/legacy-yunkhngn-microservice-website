import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Post('internal')
  @ApiOperation({ summary: 'Internal endpoint for service-to-service notifications' })
  async createInternal(
    @Body() body: { type: string; message: string; link?: string },
  ) {
    return this.notificationsService.create(body.type, body.message, body.link);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get paginated notifications (Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return this.notificationsService.findAll(+page || 1, +limit || 20);
  }

  @Patch('read-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read (Admin only)' })
  markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }

  @Patch(':id/read')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark a specific notification as read (Admin only)',
  })
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a notification (Admin only)' })
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
