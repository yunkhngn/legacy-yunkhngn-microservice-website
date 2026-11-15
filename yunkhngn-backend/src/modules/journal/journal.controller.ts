import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JournalService } from './journal.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { User } from '../auth/user.decorator';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Journal')
@Controller('journals')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new journal entry' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createJournalDto: CreateJournalDto) {
    return this.journalService.create(createJournalDto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get all journal entries' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.journalService.findAll(
      page ? parseInt(page, 10) || 1 : 1,
      limit ? parseInt(limit, 10) || 20 : 20,
    );
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get journal entry by ID' })
  findOne(@Param('id') id: string) {
    return this.journalService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a journal entry' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() updateJournalDto: UpdateJournalDto) {
    return this.journalService.update(id, updateJournalDto);
  }

  @Post(':id/reactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle reaction on a journal entry' })
  @UseGuards(FirebaseAuthGuard)
  toggleReaction(
    @Param('id') id: string,
    @Body('type') type: string,
    @User() user,
  ) {
    if (!user) throw new Error('User not found in request');
    return this.journalService.toggleReaction(id, user.uid, type);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a journal entry' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.journalService.remove(id);
  }
}
