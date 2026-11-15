import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
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
import { GalleryService } from './gallery.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { CacheInterceptor, CacheTTL, CacheKey } from '@nestjs/cache-manager';

@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new photo to the gallery' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createGalleryDto: CreateGalleryDto) {
    return this.galleryService.create(createGalleryDto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get all photos from gallery' })
  @ApiQuery({ name: 'albumId', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('albumId') albumId?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.galleryService.findAll({
      albumId,
      tag,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('tags')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('gallery_tags')
  @CacheTTL(600) // 10 minutes
  @ApiOperation({ summary: 'Get all unique tags from gallery' })
  getAllTags() {
    return this.galleryService.getAllTags();
  }

  @Get('signature')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Cloudinary upload signature' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getSignature(@Query() query: Record<string, string>) {
    return this.galleryService.getUploadSignature(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(600) // 10 minutes
  @ApiOperation({ summary: 'Get photo by ID' })
  findById(@Param('id') id: string) {
    return this.galleryService.findById(id);
  }

  @Post('views/:id')
  @ApiOperation({ summary: 'Increment photo views' })
  incrementViews(@Param('id') id: string) {
    return this.galleryService.incrementViews(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update photo details' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      caption?: string;
      albumId?: string;
      tags?: string;
      exifData?: string;
      blurHash?: string;
      sortOrder?: number;
      width?: number;
      height?: number;
    },
  ) {
    return this.galleryService.update(id, body);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete photo from gallery' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.galleryService.remove(id);
  }

  @Post('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder photos in gallery' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  reorder(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.galleryService.reorder(body.items);
  }

  @Post('bulk-update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update photo details' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  bulkUpdate(
    @Body()
    body: {
      ids: string[];
      data: { caption?: string; albumId?: string; tags?: string };
    },
  ) {
    return this.galleryService.bulkUpdate(body.ids, body.data);
  }
}
