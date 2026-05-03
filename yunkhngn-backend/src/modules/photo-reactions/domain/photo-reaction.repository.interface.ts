import { PhotoReaction } from './photo-reaction.entity';

export interface IPhotoReactionRepository {
  upsert(
    photoId: string,
    uid: string,
    reactionType: string,
  ): Promise<PhotoReaction>;
  delete(photoId: string, uid: string): Promise<PhotoReaction | null>;
  findByPhotoId(photoId: string): Promise<PhotoReaction[]>;
  findByPhotoAndUser(
    photoId: string,
    uid: string,
  ): Promise<PhotoReaction | null>;
}

export const IPhotoReactionRepository = Symbol('IPhotoReactionRepository');
