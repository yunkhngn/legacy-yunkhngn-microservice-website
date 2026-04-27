import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { IAlbumRepository } from './domain/album.repository.interface';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { Album } from './domain/album.entity';

@Injectable()
export class AlbumService {
  private readonly logger = new Logger(AlbumService.name);

  constructor(
    @Inject(IAlbumRepository)
    private readonly albumRepository: IAlbumRepository,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async create(dto: CreateAlbumDto): Promise<Album> {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.albumRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException('An album with this slug already exists');
    }

    this.logger.log(`Creating new album: ${dto.name}`);
    return this.albumRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      coverPhotoId: dto.coverPhotoId,
    });
  }

  async findAll(): Promise<Album[]> {
    return this.albumRepository.findAll();
  }

  async findBySlug(slug: string): Promise<Album> {
    const album = await this.albumRepository.findBySlug(slug);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return album;
  }

  async update(id: string, dto: UpdateAlbumDto): Promise<Album> {
    const existing = await this.albumRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Album not found');
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugInUse = await this.albumRepository.findBySlug(dto.slug);
      if (slugInUse) {
        throw new ConflictException('This slug is already in use');
      }
    }

    this.logger.log(`Updating album ID: ${id}`);
    return this.albumRepository.update(id, {
      ...dto,
      slug: dto.slug || (dto.name ? this.generateSlug(dto.name) : undefined),
    });
  }

  async remove(id: string): Promise<Album> {
    const existing = await this.albumRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Album not found');
    }

    this.logger.log(`Removing album ID: ${id}`);
    // Unassign photos from this album first
    await this.albumRepository.unassignPhotos(id);

    return this.albumRepository.delete(id);
  }
}
