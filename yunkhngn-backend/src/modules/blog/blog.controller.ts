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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CacheInterceptor } from '@nestjs/cache-manager';

@ApiTags('Blog')
@Controller('blogs')
@UseInterceptors(CacheInterceptor)
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new blog post' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createBlogDto: CreateBlogDto) {
    return this.blogService.create(createBlogDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all blog posts' })
  findAll() {
    return this.blogService.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get blog post by slug' })
  findOne(@Param('slug') slug: string) {
    return this.blogService.findOne(slug);
  }

  @Post(':slug/view')
  @ApiOperation({ summary: 'Increment blog post views' })
  incrementViews(@Param('slug') slug: string) {
    return this.blogService.incrementViews(slug);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a blog post' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() updateBlogDto: UpdateBlogDto) {
    return this.blogService.update(id, updateBlogDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a blog post' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
