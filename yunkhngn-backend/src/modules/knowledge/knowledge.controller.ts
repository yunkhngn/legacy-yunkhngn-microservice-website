import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { FirebaseAuthGuard } from '../../common/guards';

@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all knowledge entries' })
  @UseGuards(FirebaseAuthGuard)
  findAll() {
    return this.knowledgeService.findAll();
  }

  @Get('categories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all knowledge categories' })
  @UseGuards(FirebaseAuthGuard)
  getCategories() {
    return this.knowledgeService.getCategories();
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a knowledge entry by ID' })
  @UseGuards(FirebaseAuthGuard)
  findOne(@Param('id') id: string) {
    return this.knowledgeService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a knowledge entry' })
  @UseGuards(FirebaseAuthGuard)
  create(@Body() dto: CreateKnowledgeDto) {
    return this.knowledgeService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a knowledge entry' })
  @UseGuards(FirebaseAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeDto) {
    return this.knowledgeService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a knowledge entry' })
  @UseGuards(FirebaseAuthGuard)
  remove(@Param('id') id: string) {
    return this.knowledgeService.delete(id);
  }

  @Post('sync-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync all knowledge entries to vector DB' })
  @UseGuards(FirebaseAuthGuard)
  syncAll() {
    return this.knowledgeService.syncAll();
  }
}
