import {
  Controller,
  Get,
  Delete,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@Controller('media')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MediaController {
  constructor(private readonly cloudinaryService: CloudinaryService) { }

  @Get('signature')
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
  async getImages(@Query('cursor') cursor?: string) {
    return this.cloudinaryService.getImages(cursor);
  }

  @Delete()
  async deleteImage(@Query('publicId') publicId: string) {
    if (!publicId) {
      throw new HttpException('publicId is required', HttpStatus.BAD_REQUEST);
    }
    return this.cloudinaryService.deleteImage(publicId);
  }
}
