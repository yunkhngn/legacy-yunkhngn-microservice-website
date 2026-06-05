import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ILetterRepository } from './domain/letter.repository.interface';
import { CreateLetterDto } from './dto/create-letter.dto';
import { UpdateLetterDto } from './dto/update-letter.dto';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { Letter } from './domain/letter.entity';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/domain/audit-log.types';

@Injectable()
export class LetterService {
  private readonly logger = new Logger(LetterService.name);

  constructor(
    @Inject(ILetterRepository)
    private readonly letterRepository: ILetterRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private stripSensitive(letter: Letter) {
    const { password, ...rest } = letter;
    return { ...rest, hasPassword: !!password };
  }

  private generateCode(length = 8): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async create(dto: CreateLetterDto) {
    let code = dto.code;
    if (!code) {
      let attempts = 0;
      do {
        code = this.generateCode();
        const existing = await this.letterRepository.findByCode(code);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);
      if (attempts >= 10)
        throw new ConflictException('Failed to generate unique code.');
    } else {
      const existing = await this.letterRepository.findByCode(code);
      if (existing) throw new ConflictException('This code is already in use');
    }

    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const kind = dto.kind === 'text' ? 'text' : 'scan';

    if (kind === 'text' && !dto.contentJSON) {
      throw new BadRequestException('A text letter requires content');
    }
    if (kind === 'scan' && (!dto.pages || dto.pages.length === 0)) {
      throw new BadRequestException('A scan letter requires at least one page');
    }

    this.logger.log(`Creating ${kind} letter with code: ${code}`);

    // Text letters need no AI processing; they are ready immediately.
    const status =
      kind === 'text' || dto.enableAnimation === false ? 'ready' : 'processing';

    const letter = await this.letterRepository.create({
      code,
      title: dto.title,
      password: hashedPassword,
      kind,
      font: kind === 'text' ? dto.font || 'fz' : null,
      contentJSON: kind === 'text' ? dto.contentJSON : null,
      status,
      isActive: dto.isActive ?? true,
      enableAnimation: dto.enableAnimation ?? true,
      pages:
        kind === 'scan'
          ? {
              create: dto.pages.map((p, i) => ({
                imageUrl: p.imageUrl,
                width: p.width,
                height: p.height,
                sortOrder: p.sortOrder ?? i,
              })),
            }
          : undefined,
    });

    if (
      kind === 'scan' &&
      letter.enableAnimation &&
      letter.pages &&
      letter.pages.length > 0
    ) {
      this.triggerProcessing(letter.id, letter.pages).catch((err) =>
        this.logger.error('Letter processing trigger failed', err.stack),
      );
    }

    void this.auditLogsService.log({
      action: AuditAction.CREATE_LETTER,
      entity: AuditEntity.LETTER,
      entityId: letter.id,
      details: { code: letter.code, title: letter.title, kind },
    });

    return this.stripSensitive(letter);
  }

  private async triggerProcessing(
    letterId: string,
    pages: { id: string; imageUrl: string }[],
  ) {
    const aiUrl = process.env.LETTER_AI_URL || 'http://localhost:8000';
    const selfUrl = process.env.SELF_URL || 'http://localhost:3001';
    try {
      this.logger.log(`Triggering AI processing for letter: ${letterId}`);
      await axios.post(`${aiUrl}/api/v1/letter/process`, {
        letterId,
        pages: pages.map((p) => ({ id: p.id, imageUrl: p.imageUrl })),
        callbackUrl: `${selfUrl}/letters/processing-callback`,
      });
    } catch (err) {
      this.logger.error('Letter AI request failed', err.stack);
      await this.letterRepository.update(letterId, { status: 'failed' });
    }
  }

  async handleProcessingCallback(data: {
    letterId: string;
    pages: { id: string; revealMapUrl: string }[];
    success: boolean;
  }) {
    this.logger.log(
      `Processing callback received for letter: ${data.letterId}, success: ${data.success}`,
    );
    if (!data.success) {
      await this.letterRepository.update(data.letterId, { status: 'failed' });
      return { ok: true };
    }
    for (const page of data.pages) {
      await this.letterRepository.updatePage(page.id, {
        revealMapUrl: page.revealMapUrl,
      });
    }
    await this.letterRepository.update(data.letterId, { status: 'ready' });
    return { ok: true };
  }

  async findAll() {
    const letters = await this.letterRepository.findAll();
    return letters.map((l) => this.stripSensitive(l));
  }

  async resolve(code: string) {
    const letter = await this.letterRepository.findByCode(code);
    if (!letter) throw new NotFoundException('Letter not found');
    if (!letter.isActive)
      throw new NotFoundException('This letter is no longer available');
    if (letter.status === 'processing')
      throw new NotFoundException('Letter is still being processed');
    if (letter.status === 'failed')
      throw new NotFoundException('Letter processing failed');

    this.letterRepository
      .incrementViews(letter.id)
      .catch((err) =>
        this.logger.error(
          `Failed to increment views for letter: ${letter.id}`,
          err.stack,
        ),
      );

    return {
      id: letter.id,
      title: letter.title,
      hasPassword: !!letter.password,
      enableAnimation: letter.enableAnimation,
      kind: letter.kind,
      font: letter.font ?? null,
      contentJSON: letter.password ? null : (letter.contentJSON ?? null),
      pages: letter.password ? [] : letter.pages || [],
      createdAt: letter.createdAt,
    };
  }

  async verifyPassword(code: string, password: string) {
    const letter = await this.letterRepository.findByCode(code);
    if (!letter) throw new NotFoundException('Letter not found');
    if (!letter.isActive)
      throw new NotFoundException('This letter is no longer available');
    if (letter.status === 'processing')
      throw new NotFoundException('Letter is still being processed');
    if (letter.status === 'failed')
      throw new NotFoundException('Letter processing failed');

    const payload = {
      pages: letter.pages || [],
      title: letter.title,
      kind: letter.kind,
      font: letter.font ?? null,
      contentJSON: letter.contentJSON ?? null,
    };

    if (!letter.password) return payload;

    const isValid = await bcrypt.compare(password, letter.password);
    if (!isValid) throw new ForbiddenException('Incorrect password');
    return payload;
  }

  async update(id: string, dto: UpdateLetterDto) {
    const existing = await this.letterRepository.findById(id);
    if (!existing) throw new NotFoundException('Letter not found');

    if (dto.code && dto.code !== existing.code) {
      const codeInUse = await this.letterRepository.findByCode(dto.code);
      if (codeInUse) throw new ConflictException('This code is already in use');
    }

    const data: any = {};
    if (dto.code) data.code = dto.code;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.removePassword) {
      data.password = null;
    } else if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.enableAnimation !== undefined)
      data.enableAnimation = dto.enableAnimation;
    const isAnimEnabled = dto.enableAnimation ?? existing.enableAnimation;

    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.font !== undefined) data.font = dto.font;
    if (dto.contentJSON !== undefined) data.contentJSON = dto.contentJSON;

    // A text letter never needs AI processing — it is always ready.
    if (dto.kind === 'text') {
      data.status = 'ready';
    }

    let shouldReprocess = false;

    let imagesToDelete: string[] = [];

    // If pages change, process if animation is enabled
    if (dto.pages && dto.kind !== 'text') {
      // Find old pages to diff
      const oldPages = existing.pages || [];
      const newUrls = dto.pages.map((p) => p.imageUrl);

      imagesToDelete = oldPages
        .filter((op) => !newUrls.includes(op.imageUrl))
        .reduce((acc, curr) => {
          if (curr.imageUrl) acc.push(curr.imageUrl);
          if (curr.revealMapUrl) acc.push(curr.revealMapUrl);
          return acc;
        }, [] as string[]);

      await this.letterRepository.clearPages(id);
      data.pages = {
        create: dto.pages.map((p, i) => ({
          imageUrl: p.imageUrl,
          width: p.width,
          height: p.height,
          sortOrder: p.sortOrder ?? i,
        })),
      };
      if (isAnimEnabled) {
        shouldReprocess = true;
        data.status = 'processing';
      } else {
        data.status = 'ready';
      }
    } else if (dto.enableAnimation === true && !existing.enableAnimation) {
      // If no new pages were uploaded but animation was just enabled, we need to process existing pages
      shouldReprocess = true;
      data.status = 'processing';
    } else if (dto.enableAnimation === false) {
      data.status = 'ready';
    }

    this.logger.log(`Updating letter ID: ${id}`);

    const letter = await this.letterRepository.update(id, data);

    if (shouldReprocess && letter.pages) {
      void this.triggerProcessing(letter.id, letter.pages).catch((err) =>
        this.logger.error('Letter processing trigger failed', err.stack),
      );
    }

    if (imagesToDelete.length > 0) {
      void this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }

    void this.auditLogsService.log({
      action: AuditAction.UPDATE_LETTER,
      entity: AuditEntity.LETTER,
      entityId: id,
      details: dto as Record<string, unknown>,
    });

    return this.stripSensitive(letter);
  }

  async remove(id: string) {
    const existing = await this.letterRepository.findById(id);
    if (!existing) throw new NotFoundException('Letter not found');
    this.logger.log(`Removing letter ID: ${id}`);

    const imagesToDelete = (existing.pages || []).reduce((acc, curr) => {
      if (curr.imageUrl) acc.push(curr.imageUrl);
      if (curr.revealMapUrl) acc.push(curr.revealMapUrl);
      return acc;
    }, [] as string[]);

    const deleted = await this.letterRepository.delete(id);

    if (imagesToDelete.length > 0) {
      void this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }

    void this.auditLogsService.log({
      action: AuditAction.DELETE_LETTER,
      entity: AuditEntity.LETTER,
      entityId: id,
      details: { id },
    });

    return deleted;
  }

  async bulkDelete(ids: string[]) {
    this.logger.log(`Bulk deleting ${ids.length} letters`);

    // Fetch all before delete to get image URLs
    const letters = await Promise.all(
      ids.map((id) => this.letterRepository.findById(id)),
    );
    const imagesToDelete: string[] = [];
    letters.forEach((l) => {
      if (l && l.pages) {
        l.pages.forEach((p) => {
          if (p.imageUrl) imagesToDelete.push(p.imageUrl);
          if (p.revealMapUrl) imagesToDelete.push(p.revealMapUrl);
        });
      }
    });

    const count = await this.letterRepository.deleteMany(ids);

    if (imagesToDelete.length > 0) {
      void this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }

    return { deleted: count };
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean) {
    this.logger.log(
      `Bulk updating status for ${ids.length} letters to ${isActive}`,
    );
    const count = await this.letterRepository.updateManyStatus(ids, isActive);
    return { updated: count };
  }
}
