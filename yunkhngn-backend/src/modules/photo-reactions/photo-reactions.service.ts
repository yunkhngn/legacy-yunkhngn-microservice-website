import { Injectable, Inject, Logger } from '@nestjs/common';
import { IPhotoReactionRepository } from './domain/photo-reaction.repository.interface';
import { PhotoReaction } from './domain/photo-reaction.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PhotoReactionsService {
  private readonly logger = new Logger(PhotoReactionsService.name);

  constructor(
    @Inject(IPhotoReactionRepository)
    private readonly repository: IPhotoReactionRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async addOrUpdateReaction(
    photoId: string,
    uid: string,
    reactionType: string,
  ): Promise<PhotoReaction> {
    const result = await this.repository.upsert(photoId, uid, reactionType);

    // Send notification
    this.notificationsService
      .create(
        'LIKE',
        `New ${reactionType} reaction on photo`,
        `/photo#photo-${photoId}`,
      )
      .catch((err) =>
        this.logger.error('Failed to send real-time notification', err),
      );

    return result;
  }

  async removeReaction(
    photoId: string,
    uid: string,
  ): Promise<PhotoReaction | null> {
    return this.repository.delete(photoId, uid);
  }

  async getPhotoReactions(photoId: string) {
    const reactions = await this.repository.findByPhotoId(photoId);

    // Count reactions by type
    const counts: Record<string, number> = {
      like: 0,
      heart: 0,
      cat: 0,
      fire: 0,
      laugh: 0,
    };

    reactions.forEach((reaction) => {
      if (counts[reaction.reactionType] !== undefined) {
        counts[reaction.reactionType]++;
      }
    });

    return {
      counts,
      total: reactions.length,
    };
  }

  async getUserReaction(
    photoId: string,
    uid: string,
  ): Promise<PhotoReaction | null> {
    return this.repository.findByPhotoAndUser(photoId, uid);
  }
}
