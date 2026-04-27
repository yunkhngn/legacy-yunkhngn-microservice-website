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
import { AlbumService } from './album.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('Album')
@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) { }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new album' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateAlbumDto) {
    return this.albumService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all albums' })
  findAll() {
    return this.albumService.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get album by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.albumService.findBySlug(slug);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an album' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateAlbumDto) {
    return this.albumService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an album' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.albumService.remove(id);
  }
}
