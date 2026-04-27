import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IPhotoReactionRepository } from '../domain/photo-reaction.repository.interface';
import { PhotoReaction } from '../domain/photo-reaction.entity';

@Injectable()
export class PrismaPhotoReactionRepository implements IPhotoReactionRepository {
    constructor(private prisma: PrismaService) { }

    async upsert(photoId: string, uid: string, reactionType: string): Promise<PhotoReaction> {
        return this.prisma.photoReaction.upsert({
            where: {
                photoId_uid: { photoId, uid },
            },
            update: {
                reactionType,
            },
            create: {
                photoId,
                uid,
                reactionType,
            },
        });
    }

    async delete(photoId: string, uid: string): Promise<PhotoReaction | null> {
        try {
            return await this.prisma.photoReaction.delete({
                where: {
                    photoId_uid: { photoId, uid },
                },
            });
        } catch {
            return null;
        }
    }

    async findByPhotoId(photoId: string): Promise<PhotoReaction[]> {
        return this.prisma.photoReaction.findMany({
            where: { photoId },
        });
    }

    async findByPhotoAndUser(photoId: string, uid: string): Promise<PhotoReaction | null> {
        return this.prisma.photoReaction.findUnique({
            where: {
                photoId_uid: { photoId, uid },
            },
        });
    }
}
