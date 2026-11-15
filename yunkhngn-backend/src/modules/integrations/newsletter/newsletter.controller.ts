import { Controller, Post, Body, Get, Query, UseGuards, Delete, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { FirebaseAuthGuard } from '../../../common/guards';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to the newsletter' })
  @ApiBody({
    schema: { type: 'object', properties: { email: { type: 'string' } } },
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async subscribe(@Body('email') email: string) {
    return this.newsletterService.subscribe(email);
  }

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from the newsletter' })
  @ApiQuery({ name: 'token', required: true })
  async unsubscribe(@Query('token') token: string) {
    return this.newsletterService.unsubscribe(token);
  }

  @Post('send')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a newsletter to all subscribers' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { subject: { type: 'string' }, content: { type: 'string' } },
    },
  })
  @UseGuards(FirebaseAuthGuard)
  async send(@Body() body: { subject: string; content: string }) {
    return this.newsletterService.sendToAll(body.subject, body.content);
  }

  @Get('subscribers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all subscribers' })
  @UseGuards(FirebaseAuthGuard)
  async getSubscribers() {
    return this.newsletterService.findAllSubscribers();
  }

  @Delete('subscribers/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a subscriber' })
  @UseGuards(FirebaseAuthGuard)
  async deleteSubscriber(@Param('id') id: string) {
    return this.newsletterService.deleteSubscriber(id);
  }
}
