import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CreateContactDto } from './dto/create-contact.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a contact form message' })
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  async createContact(@Body() data: CreateContactDto) {
    return this.contactService.createContact(data);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all contact messages' })
  @UseGuards(FirebaseAuthGuard)
  async getAllContacts() {
    return this.contactService.getAllContacts();
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get contact message by ID' })
  @UseGuards(FirebaseAuthGuard)
  async getContactById(@Param('id') id: string) {
    return this.contactService.getContactById(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update contact message status' })
  @ApiBody({
    schema: { type: 'object', properties: { status: { type: 'string' } } },
  })
  @UseGuards(FirebaseAuthGuard)
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.contactService.updateContactStatus(id, status);
  }

  @Post(':id/respond')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to a contact message via email' })
  @ApiBody({
    schema: { type: 'object', properties: { response: { type: 'string' } } },
  })
  @UseGuards(FirebaseAuthGuard)
  async respondToContact(
    @Param('id') id: string,
    @Body('response') response: string,
  ) {
    return this.contactService.respondToContact(id, response);
  }

  @Post(':id/ai-suggest')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate AI suggestion for responding to a contact message',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        language: { type: 'string', default: 'vi' },
        existingText: { type: 'string' },
      },
    },
  })
  @UseGuards(FirebaseAuthGuard)
  async generateAiSuggestion(
    @Param('id') id: string,
    @Body('language') language?: string,
    @Body('existingText') existingText?: string,
  ) {
    return this.contactService.generateAiResponse(id, language, existingText);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a contact message' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    return this.contactService.remove(id);
  }

  @Post('send-mail')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a custom email to anyone' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async sendCustomEmail(
    @Body()
    data: {
      to: string;
      name: string;
      subject: string;
      content: string;
      salutation?: string;
    },
  ) {
    return this.contactService.sendCustomEmail(data);
  }

  @Post('ai-compose')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Compose a custom email using AI' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        recipientName: { type: 'string' },
        language: { type: 'string', default: 'vi' },
      },
    },
  })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async composeAiEmail(
    @Body('topic') topic: string,
    @Body('recipientName') recipientName: string,
    @Body('language') language?: string,
  ) {
    return this.contactService.generateAiEmail(topic, recipientName, language);
  }
}
