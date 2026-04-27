import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LetterService } from './letter.service';
import { CreateLetterDto } from './dto/create-letter.dto';
import { UpdateLetterDto } from './dto/update-letter.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('Letter')
@Controller('letters')
export class LetterController {
  constructor(private readonly letterService: LetterService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new handwritten letter' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateLetterDto) {
    return this.letterService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all letters (Admin only)' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.letterService.findAll();
  }

  @Get('resolve/:code')
  @ApiOperation({ summary: 'Get letter content and pages by access code' })
  resolve(@Param('code') code: string) {
    return this.letterService.resolve(code);
  }

  @Post('verify/:code')
  @ApiOperation({ summary: 'Verify password for a password-protected letter' })
  verifyPassword(
    @Param('code') code: string,
    @Body() body: { password: string },
  ) {
    return this.letterService.verifyPassword(code, body.password);
  }

  @Post('processing-callback')
  @ApiOperation({
    summary: 'Callback for AI processing service to return timing maps',
  })
  processingCallback(
    @Body()
    body: {
      letterId: string;
      pages: { id: string; revealMapUrl: string }[];
      success: boolean;
    },
  ) {
    return this.letterService.handleProcessingCallback(body);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a letter details' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateLetterDto) {
    return this.letterService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a letter' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.letterService.remove(id);
  }

  @Post('bulk/delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk delete letters' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  bulkDelete(@Body() body: { ids: string[] }) {
    return this.letterService.bulkDelete(body.ids);
  }

  @Post('bulk/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update letters active status' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  bulkUpdateStatus(@Body() body: { ids: string[]; isActive: boolean }) {
    return this.letterService.bulkUpdateStatus(body.ids, body.isActive);
  }
}
