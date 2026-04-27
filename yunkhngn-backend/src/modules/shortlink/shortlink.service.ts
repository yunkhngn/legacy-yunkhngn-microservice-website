import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { IShortLinkRepository } from './domain/shortlink.repository.interface';
import { CreateShortlinkDto } from './dto/create-shortlink.dto';
import { UpdateShortlinkDto } from './dto/update-shortlink.dto';
import { ShortLink } from './domain/shortlink.entity';

@Injectable()
export class ShortlinkService {
  private readonly logger = new Logger(ShortlinkService.name);

  constructor(
    @Inject(IShortLinkRepository) private readonly shortLinkRepository: IShortLinkRepository,
  ) { }

  private generateCode(length = 6): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async create(dto: CreateShortlinkDto): Promise<ShortLink> {
    let code = dto.code;

    if (!code) {
      // Auto-generate a unique code
      let attempts = 0;
      do {
        code = this.generateCode();
        const existing = await this.shortLinkRepository.findByCode(code);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new ConflictException(
          'Failed to generate a unique code. Please provide one manually.',
        );
      }
    } else {
      const existing = await this.shortLinkRepository.findByCode(code);
      if (existing) {
        throw new ConflictException('This code is already in use');
      }
    }

    this.logger.log(`Creating shortlink: ${code} -> ${dto.targetUrl}`);
    return this.shortLinkRepository.create({
      code,
      targetUrl: dto.targetUrl,
      title: dto.title,
      isActive: dto.isActive ?? true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
  }

  async findAll(): Promise<ShortLink[]> {
    return this.shortLinkRepository.findAll();
  }

  async resolve(code: string) {
    const link = await this.shortLinkRepository.findByCode(code);

    if (!link) {
      throw new NotFoundException('Shortlink not found');
    }

    if (!link.isActive) {
      throw new NotFoundException('This shortlink is no longer active');
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new NotFoundException('This shortlink has expired');
    }

    // Increment clicks asynchronously
    this.shortLinkRepository.incrementClicks(link.id).catch((err) =>
      this.logger.error(`Failed to increment clicks for shortlink: ${link.id}`, err.stack)
    );

    return { targetUrl: link.targetUrl };
  }

  async update(id: string, dto: UpdateShortlinkDto): Promise<ShortLink> {
    const existing = await this.shortLinkRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Shortlink not found');
    }

    if (dto.code && dto.code !== existing.code) {
      const codeInUse = await this.shortLinkRepository.findByCode(dto.code);
      if (codeInUse) {
        throw new ConflictException('This code is already in use');
      }
    }

    const data: any = { ...dto };
    if (data.expiresAt) {
      data.expiresAt = new Date(data.expiresAt);
    }

    this.logger.log(`Updating shortlink ID: ${id}`);
    return this.shortLinkRepository.update(id, data);
  }

  async remove(id: string): Promise<ShortLink> {
    const existing = await this.shortLinkRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Shortlink not found');
    }

    this.logger.log(`Removing shortlink ID: ${id}`);
    return this.shortLinkRepository.delete(id);
  }

  async bulkDelete(ids: string[]) {
    this.logger.log(`Bulk deleting ${ids.length} shortlinks`);
    const count = await this.shortLinkRepository.deleteMany(ids);
    return { deleted: count };
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean) {
    this.logger.log(`Bulk updating status for ${ids.length} shortlinks to ${isActive}`);
    const count = await this.shortLinkRepository.updateManyStatus(ids, isActive);
    return { updated: count };
  }
}
