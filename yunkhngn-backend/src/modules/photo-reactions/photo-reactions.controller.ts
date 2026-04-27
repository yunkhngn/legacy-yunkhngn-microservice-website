import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PhotoReactionsService } from './photo-reactions.service';
import { FirebaseAuthGuard } from '../../common/guards';
import { PhotoReaction } from '@prisma/client';
import { CreateReactionDto } from './dto/create-reaction.dto';

interface RequestWithUser extends Request {
  user?: {
    uid: string;
  };
}

@ApiTags('Photo Reactions')
@Controller('photo-reactions')
export class PhotoReactionsController {
  constructor(private readonly photoReactionsService: PhotoReactionsService) { }

  @Post(':photoId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add or update a reaction to a photo' })
  @UseGuards(FirebaseAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  async addReaction(
    @Param('photoId') photoId: string,
    @Body() data: CreateReactionDto,
    @Req() req: RequestWithUser,
  ) {
    const reactionType = data.reactionType;
    const uid = req.user?.uid;
    if (!uid) throw new Error('User not authenticated');

    // Validate reaction type
    const validTypes = ['like', 'heart', 'cat', 'fire', 'laugh'];
    if (!validTypes.includes(reactionType)) {
      throw new Error('Invalid reaction type');
    }

    const reaction = await this.photoReactionsService.addOrUpdateReaction(
      photoId,
      uid,
      reactionType,
    );
    const stats = await this.photoReactionsService.getPhotoReactions(photoId);

    return {
      reaction,
      stats,
    };
  }

  @Delete(':photoId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a reaction from a photo' })
  @UseGuards(FirebaseAuthGuard)
  async removeReaction(
    @Param('photoId') photoId: string,
    @Req() req: RequestWithUser,
  ) {
    const uid = req.user?.uid;
    if (!uid) throw new Error('User not authenticated');

    await this.photoReactionsService.removeReaction(photoId, uid);
    const stats = await this.photoReactionsService.getPhotoReactions(photoId);

    return { stats };
  }

  @Get(':photoId')
  @ApiOperation({ summary: 'Get all reaction stats for a photo' })
  async getReactions(
    @Param('photoId') photoId: string,
    @Req() req: RequestWithUser,
  ) {
    const stats = await this.photoReactionsService.getPhotoReactions(photoId);

    // Get user's reaction if authenticated
    let userReaction: PhotoReaction | null = null;
    if (req.user?.uid) {
      userReaction = await this.photoReactionsService.getUserReaction(
        photoId,
        req.user.uid,
      );
    }

    return {
      stats,
      userReaction: userReaction?.reactionType || null,
    };
  }
}
