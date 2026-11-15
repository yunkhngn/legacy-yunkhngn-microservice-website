import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CacheInterceptor } from '@nestjs/cache-manager';

@ApiTags('Project')
@Controller('projects')
@UseInterceptors(CacheInterceptor)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new project' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  findAll(@Query('limit') limit?: number) {
    return this.projectService.findAll(limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findOne(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a project' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a project' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.projectService.remove(id);
  }
}
