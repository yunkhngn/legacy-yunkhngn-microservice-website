import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { CreateJournalDto } from './dto/create-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { IJournalRepository } from './domain/journal.repository.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(
    @Inject(IJournalRepository)
    private readonly journalRepository: IJournalRepository,
    private readonly notificationsService: NotificationsService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  async create(createJournalDto: CreateJournalDto) {
    const { tags, ...rest } = createJournalDto;

    const data = {
      ...rest,
      tags: tags ? JSON.stringify(tags) : null,
      images: rest.images ? JSON.stringify(rest.images) : null,
    };

    this.logger.log('Creating new journal entry');
    const journal = await this.journalRepository.create(data);
    return this.formatEntry(journal);
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const { data: entries, total } = await this.journalRepository.findAll({
      where: { parentId: null },
      skip,
      take: limit,
    });

    return {
      data: entries.map((entry) => this.formatEntry(entry)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const entry = await this.journalRepository.findById(id);
    if (!entry) throw new NotFoundException('Journal entry not found');
    return this.formatEntry(entry);
  }

  async update(id: string, updateJournalDto: UpdateJournalDto) {
    const { tags, ...rest } = updateJournalDto;

    const data: any = { ...rest };
    const currentEntry = await this.journalRepository.findById(id);
    if (!currentEntry) throw new NotFoundException('Journal entry not found');

    if (tags !== undefined) {
      data.tags = tags ? JSON.stringify(tags) : null;
    }

    const imagesToDelete: string[] = [];
    if (rest.images !== undefined) {
      data.images = rest.images ? JSON.stringify(rest.images) : null;

      const oldImages = currentEntry.images
        ? JSON.parse(currentEntry.images)
        : [];
      const newImages = rest.images || [];
      imagesToDelete.push(
        ...oldImages.filter((img: string) => !newImages.includes(img)),
      );
    }

    this.logger.log(`Updating journal entry ID: ${id}`);
    const entry = await this.journalRepository.update(id, data);

    if (imagesToDelete.length > 0) {
      this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }

    return this.formatEntry(entry);
  }

  async remove(id: string) {
    const currentEntry = await this.journalRepository.findById(id);
    if (!currentEntry) return null;

    this.logger.log(`Removing journal entry ID: ${id} and its children`);

    // Recursive delete children
    const children = await this.journalRepository.findChildren(id);
    for (const child of children) {
      await this.remove(child.id);
    }

    const deleted = await this.journalRepository.delete(id);
    if (deleted && deleted.images) {
      try {
        const images = JSON.parse(deleted.images);
        this.cloudinaryService.deleteImagesSafely(images);
      } catch (e) {
        this.logger.error(`Failed to parse images for deletion in journal ${id}`);
      }
    }
    return deleted;
  }

  async toggleReaction(journalId: string, uid: string, type: string) {
    const existing = await this.journalRepository.findReaction(journalId, uid);

    if (existing) {
      if (existing.type === type) {
        // Remove reaction
        await this.journalRepository.deleteReaction(existing.id);
        return { action: 'removed', type };
      } else {
        // Update reaction
        await this.journalRepository.updateReaction(existing.id, type);

        // Send notification
        this.notificationsService
          .create(
            'LIKE',
            `New ${type} reaction on journal entry`,
            `/journal#journal-${journalId}`,
          )
          .catch((err) =>
            this.logger.error('Failed to send real-time notification', err),
          );

        return { action: 'updated', type };
      }
    } else {
      // Create reaction
      await this.journalRepository.createReaction({ journalId, uid, type });

      // Send notification
      this.notificationsService
        .create(
          'LIKE',
          `New ${type} reaction on journal entry`,
          `/journal#journal-${journalId}`,
        )
        .catch((err) =>
          this.logger.error('Failed to send real-time notification', err),
        );

      return { action: 'created', type };
    }
  }

  private formatEntry(entry: any) {
    const formatted = {
      ...entry,
      tags: entry.tags ? JSON.parse(entry.tags) : [],
      images: entry.images ? JSON.parse(entry.images) : [],
    };

    if (entry.replies) {
      formatted.replies = entry.replies.map((r) => this.formatEntry(r));
    }

    return formatted;
  }
}
