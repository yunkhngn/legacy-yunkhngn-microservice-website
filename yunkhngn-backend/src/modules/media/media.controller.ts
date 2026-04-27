import {
  Controller,
  Get,
  Delete,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('Media')
@Controller('media')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MediaController {
  constructor(private readonly cloudinaryService: CloudinaryService) { }

  @Get('signature')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Cloudinary upload signature (Admin only)' })
  @ApiQuery({ name: 'folder', required: false })
  @ApiQuery({ name: 'format', required: false })
  @ApiQuery({ name: 'public_id', required: false })
  getSignature(
    @Query('folder') folder?: string,
    @Query('format') format?: string,
    @Query('public_id') publicId?: string,
  ) {
    const params: Record<string, string> = {
      folder: folder || 'blog-portfolio',
    };
    if (format) {
      params.format = format;
    }
    if (publicId) {
      params.public_id = publicId;
    }
    return this.cloudinaryService.generateUploadSignature(params);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List images from Cloudinary (Admin only)' })
  @ApiQuery({ name: 'cursor', required: false })
  async getImages(@Query('cursor') cursor?: string) {
    return this.cloudinaryService.getImages(cursor);
  }

  @Delete()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete image from Cloudinary (Admin only)' })
  @ApiQuery({ name: 'publicId', required: true })
  async deleteImage(@Query('publicId') publicId: string) {
    if (!publicId) {
      throw new HttpException('publicId is required', HttpStatus.BAD_REQUEST);
    }
    return this.cloudinaryService.deleteImage(publicId);
  }
}
