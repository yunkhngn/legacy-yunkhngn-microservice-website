import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IAlbumRepository } from '../domain/album.repository.interface';
import { Album } from '../domain/album.entity';

@Injectable()
export class PrismaAlbumRepository implements IAlbumRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: any): Promise<Album> {
    return this.prisma.album.create({
      data,
    }) as any;
  }

  async findAll(): Promise<Album[]> {
    const albums = await this.prisma.album.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { photos: true } },
      },
    });

    return albums.map((album) => ({
      ...album,
      photoCount: album._count.photos,
    })) as any;
  }

  findById(id: string): Promise<Album | null> {
    return this.prisma.album.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    }) as any;
  }

  findBySlug(slug: string): Promise<Album | null> {
    return this.prisma.album.findUnique({
      where: { slug },
      include: {
        photos: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    }) as any;
  }

  update(id: string, data: any): Promise<Album> {
    return this.prisma.album.update({
      where: { id },
      data,
    }) as any;
  }

  delete(id: string): Promise<Album> {
    return this.prisma.album.delete({
      where: { id },
    }) as any;
  }

  async unassignPhotos(albumId: string): Promise<void> {
    await this.prisma.gallery.updateMany({
      where: { albumId },
      data: { albumId: null },
    });
  }
}
