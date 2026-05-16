import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { IGalleryRepository } from './domain/gallery.repository.interface';
import { Gallery } from './domain/gallery.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/domain/audit-log.types';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    @Inject(IGalleryRepository)
    private readonly galleryRepository: IGalleryRepository,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(createGalleryDto: CreateGalleryDto): Promise<Gallery> {
    this.logger.log('Adding new photo to gallery');
    const result = await this.galleryRepository.create(createGalleryDto);
    await this.cacheManager.del('admin_dashboard_stats');
    await this.cacheManager.del('gallery_tags');
    
    void this.auditLogsService.log({
      action: AuditAction.CREATE_PHOTO,
      entity: AuditEntity.PHOTO,
      entityId: result.id,
      details: { caption: result.caption, albumId: result.albumId },
    });
    
    return result;
  }

  async findAll(query?: {
    albumId?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.albumId) {
      where.albumId = query.albumId;
    }
    if (query?.tag) {
      where.tags = { contains: query.tag };
    }

    const { data, total } = await this.galleryRepository.findAll({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Gallery> {
    const photo = await this.galleryRepository.findById(id);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }
    return photo;
  }

  incrementViews(id: string): Promise<{ success: boolean }> {
    void this.galleryRepository
      .incrementViews(id)
      .catch((err) =>
        this.logger.error(
          `Failed to increment views for photo: ${id}`,
          err.stack,
        ),
      );
    return Promise.resolve({ success: true });
  }

  async update(
    id: string,
    data: {
      caption?: string;
      albumId?: string;
      tags?: string;
      exifData?: string;
      blurHash?: string;
      sortOrder?: number;
      width?: number;
      height?: number;
    },
  ): Promise<Gallery> {
    this.logger.log(`Updating photo ID: ${id}`);
    const result = await this.galleryRepository.update(id, data);
    await this.cacheManager.del('admin_dashboard_stats');
    await this.cacheManager.del('gallery_tags');

    void this.auditLogsService.log({
      action: AuditAction.UPDATE_PHOTO,
      entity: AuditEntity.PHOTO,
      entityId: id,
      details: data,
    });

    return result;
  }

  async remove(id: string): Promise<Gallery> {
    this.logger.log(`Removing photo ID: ${id}`);
    const photo = await this.galleryRepository.delete(id);

    if (photo && photo.imageUrl) {
      // Note: Gallery entity has thumbnailUrl but Prisma schema does not — only delete imageUrl
      void this.cloudinaryService.deleteImagesSafely([photo.imageUrl]);
    }

    await this.cacheManager.del('admin_dashboard_stats');
    await this.cacheManager.del('gallery_tags');

    void this.auditLogsService.log({
      action: AuditAction.DELETE_PHOTO,
      entity: AuditEntity.PHOTO,
      entityId: id,
      details: { id },
    });

    return photo;
  }

  async reorder(items: { id: string; sortOrder: number }[]) {
    this.logger.log(`Reordering ${items.length} photos`);
    await this.galleryRepository.reorder(items);
    await this.cacheManager.del('admin_dashboard_stats');
    return { updated: items.length };
  }

  async bulkUpdate(
    ids: string[],
    data: {
      caption?: string;
      albumId?: string;
      tags?: string;
    },
  ) {
    this.logger.log(`Bulk updating ${ids.length} photos`);
    const count = await this.galleryRepository.bulkUpdate(ids, data);
    await this.cacheManager.del('admin_dashboard_stats');
    await this.cacheManager.del('gallery_tags');
    return { updated: count };
  }

  async getAllTags(): Promise<string[]> {
    return this.galleryRepository.getAllTags();
  }

  getUploadSignature(query?: Record<string, string>) {
    const { folder, ...rest } = query || {};
    return this.cloudinaryService.generateUploadSignature({
      folder: folder || 'blog-portfolio/gallery',
      ...rest,
    });
  }
}
