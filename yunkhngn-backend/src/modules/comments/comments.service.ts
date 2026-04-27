import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ICommentRepository } from './domain/comment.repository.interface';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { VoteDto } from './dto/vote.dto';
import { ReportCommentDto } from './dto/report-comment.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import * as sanitizeHtml from 'sanitize-html';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Comment } from './domain/comment.entity';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);
  private readonly rateLimitMap = new Map<string, number>();

  constructor(
    @Inject(ICommentRepository)
    private readonly commentRepository: ICommentRepository,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private checkRateLimit(uid: string): void {
    const now = Date.now();
    const lastComment = this.rateLimitMap.get(uid);

    if (lastComment && now - lastComment < 10000) {
      throw new BadRequestException(
        'You can only post one comment every 10 seconds',
      );
    }

    this.rateLimitMap.set(uid, now);
  }

  private async attachUserDetails(comments: any[]) {
    if (comments.length === 0) return [];

    const uids = [...new Set(comments.map((c) => c.uid))];
    const users = await this.commentRepository.attachUserDetails(uids);

    const userMap = new Map(users.map((u) => [u.uid, u]));

    return comments.map((comment) => ({
      ...comment,
      user: userMap.get(comment.uid) || null,
    }));
  }

  async create(createCommentDto: CreateCommentDto, uid: string) {
    this.checkRateLimit(uid);

    if (!createCommentDto.blogId && !createCommentDto.projectId) {
      throw new BadRequestException(
        'Either blogId or projectId must be provided',
      );
    }

    // 1. Sanitize XSS
    const cleanContent = sanitizeHtml(createCommentDto.content, {
      allowedTags: [],
      allowedAttributes: {},
    });

    if (cleanContent.trim().length === 0) {
      throw new BadRequestException('Comment cannot be empty');
    }

    // 2. Check repetition
    if (/([.?!])\1{3,}/.test(cleanContent)) {
      throw new BadRequestException('Too many repeated punctuation marks');
    }
    if (/(.)\1{9,}/.test(cleanContent)) {
      throw new BadRequestException('Too many repeated characters');
    }

    // 3. Check forbidden keywords
    const settings = await this.settingsService.getSettings();
    const forbiddenSetting = settings.find(
      (s) => s.settingTitle === 'comment_forbidden_keywords',
    );
    if (forbiddenSetting && forbiddenSetting.content) {
      const keywords = forbiddenSetting.content
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k);
      const lowerContent = cleanContent.toLowerCase();
      for (const keyword of keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          throw new BadRequestException('Comment contains forbidden keywords');
        }
      }
    }

    this.logger.log(`Creating new comment from user: ${uid}`);

    const comment = await this.commentRepository.create({
      ...createCommentDto,
      content: cleanContent,
      uid,
    });

    // Handle notifications (non-blocking)
    this.triggerNotification(comment, createCommentDto, cleanContent).catch(
      (err) => this.logger.error('Failed to trigger notification', err.stack),
    );

    const [commentWithUser] = await this.attachUserDetails([comment]);
    return commentWithUser;
  }

  private async triggerNotification(
    comment: any,
    dto: CreateCommentDto,
    cleanContent: string,
  ) {
    let notificationLink = '/admin/comments';
    if (dto.blogId) {
      // Ideally this should be in Repository or Service depending on how we handle it
      // For now keeping it simple as it needs to access another table
      // In a full DDD we might want to pass the slug or have a common service
      notificationLink = `/admin/comments`; // Simplified for now
    } else if (dto.projectId) {
      notificationLink = `/project/${dto.projectId}#comment-${comment.id}`;
    }

    await this.notificationsService.create(
      'COMMENT',
      `New comment from ${dto.displayName}: ${cleanContent.substring(0, 50)}...`,
      notificationLink,
    );
  }

  async findAll(
    blogId?: string,
    projectId?: string,
    page: number = 1,
    limit: number = 100,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { hidden: false, deleted: false };
    if (blogId) where.blogId = blogId;
    if (projectId) where.projectId = projectId;

    const { data, total } = await this.commentRepository.findAll({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const dataWithUsers = await this.attachUserDetails(data);

    return {
      data: dataWithUsers,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findAllIncludingHidden(
    blogId?: string,
    projectId?: string,
    page: number = 1,
    limit: number = 100,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { deleted: false };
    if (blogId) where.blogId = blogId;
    if (projectId) where.projectId = projectId;

    const { data, total } = await this.commentRepository.findAll({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        blog: { select: { title: true, slug: true } },
        project: { select: { title: true, slug: true } },
      },
    });

    const dataWithUsers = await this.attachUserDetails(data);

    return {
      data: dataWithUsers,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Comment> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    uid: string,
    isAdmin: boolean,
  ) {
    const comment = await this.findOne(id);

    if (comment.uid !== uid && !isAdmin) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    this.logger.log(`Updating comment ID: ${id}`);
    return this.commentRepository.update(id, updateCommentDto);
  }

  async remove(id: string, uid: string, isAdmin: boolean) {
    const comment = await this.findOne(id);

    if (comment.uid !== uid && !isAdmin) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    this.logger.log(`Deleting comment ID: ${id}`);
    await this.commentRepository.softDelete(id);

    if (isAdmin) {
      await this.commentRepository.resolveReportsForComment(id);
    }
  }

  async hide(id: string) {
    return this.commentRepository.update(id, { hidden: true });
  }

  async unhide(id: string) {
    return this.commentRepository.update(id, { hidden: false });
  }

  async vote(commentId: string, voteDto: VoteDto, uid: string) {
    await this.findOne(commentId);
    const existingVote = await this.commentRepository.findVote(commentId, uid);

    if (existingVote) {
      if (existingVote.value === voteDto.value) {
        await this.commentRepository.deleteVote(existingVote.id);
        const updateData =
          voteDto.value === 1
            ? { upvoteCount: { decrement: 1 } }
            : { downvoteCount: { decrement: 1 } };
        const updatedComment = await this.commentRepository.update(
          commentId,
          updateData,
        );
        const [commentWithUser] = await this.attachUserDetails([
          updatedComment,
        ]);
        return commentWithUser;
      } else {
        await this.commentRepository.updateVote(existingVote.id, voteDto.value);
        const updateData =
          existingVote.value === 1
            ? { upvoteCount: { decrement: 1 }, downvoteCount: { increment: 1 } }
            : {
                downvoteCount: { decrement: 1 },
                upvoteCount: { increment: 1 },
              };
        const updatedComment = await this.commentRepository.update(
          commentId,
          updateData,
        );
        const [commentWithUser] = await this.attachUserDetails([
          updatedComment,
        ]);
        return commentWithUser;
      }
    } else {
      await this.commentRepository.createVote({
        commentId,
        uid,
        value: voteDto.value,
      });
      const updateData =
        voteDto.value === 1
          ? { upvoteCount: { increment: 1 } }
          : { downvoteCount: { increment: 1 } };
      const updatedComment = await this.commentRepository.update(
        commentId,
        updateData,
      );
      const [commentWithUser] = await this.attachUserDetails([updatedComment]);
      return commentWithUser;
    }
  }

  async getUserVote(commentId: string, uid: string) {
    return this.commentRepository.findVote(commentId, uid);
  }

  async getUserVotes(commentIds: string[], uid: string) {
    if (commentIds.length === 0) return [];
    return this.commentRepository.findVotesByCommentIds(commentIds, uid);
  }

  async report(
    commentId: string,
    reportDto: ReportCommentDto,
    reporterUid: string,
  ) {
    await this.findOne(commentId);
    const existingReport = await this.commentRepository.findReport(
      commentId,
      reporterUid,
    );

    if (existingReport) {
      throw new BadRequestException('You have already reported this comment');
    }

    return this.commentRepository.createReport({
      commentId,
      reporterUid,
      reason: reportDto.reason,
    });
  }

  async getReports(status?: string, page: number = 1, limit: number = 100) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const { data, total } = await this.commentRepository.findReports({
      where,
      skip,
      take: limit,
      include: {
        comment: {
          select: {
            id: true,
            content: true,
            displayName: true,
            blogId: true,
            projectId: true,
            blog: { select: { title: true, slug: true } },
            project: { select: { title: true, slug: true } },
          },
        },
      },
    });

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async updateReportStatus(id: string, updateReportDto: UpdateReportDto) {
    return this.commentRepository.updateReport(id, {
      status: updateReportDto.status,
    });
  }

  async deleteReport(id: string) {
    return this.commentRepository.deleteReport(id);
  }
}
