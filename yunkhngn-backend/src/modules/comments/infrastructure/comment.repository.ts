import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ICommentRepository } from '../domain/comment.repository.interface';
import { Comment, CommentVote, CommentReport } from '../domain/comment.entity';

@Injectable()
export class PrismaCommentRepository implements ICommentRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: any): Promise<Comment> {
        return this.prisma.comment.create({
            data,
        }) as any;
    }

    async findAll(options: {
        where?: any;
        skip?: number;
        take?: number;
        orderBy?: any;
        include?: any;
    }): Promise<{ data: Comment[]; total: number }> {
        const [data, total] = await Promise.all([
            this.prisma.comment.findMany({
                where: options.where,
                skip: options.skip,
                take: options.take,
                orderBy: options.orderBy,
                include: options.include,
            }),
            this.prisma.comment.count({ where: options.where }),
        ]);

        return {
            data: data as any[],
            total,
        };
    }

    async findById(id: string): Promise<Comment | null> {
        return this.prisma.comment.findUnique({
            where: { id },
        }) as any;
    }

    async update(id: string, data: any): Promise<Comment> {
        return this.prisma.comment.update({
            where: { id },
            data,
        }) as any;
    }

    async softDelete(id: string): Promise<void> {
        await this.prisma.comment.update({
            where: { id },
            data: { deleted: true },
        });
    }

    async findVote(commentId: string, uid: string): Promise<CommentVote | null> {
        return this.prisma.commentVote.findUnique({
            where: { commentId_uid: { commentId, uid } },
        }) as any;
    }

    async findVotesByCommentIds(commentIds: string[], uid: string): Promise<CommentVote[]> {
        return this.prisma.commentVote.findMany({
            where: {
                commentId: { in: commentIds },
                uid,
            },
        }) as any;
    }

    async createVote(data: any): Promise<void> {
        await this.prisma.commentVote.create({
            data,
        });
    }

    async updateVote(id: string, value: number): Promise<void> {
        await this.prisma.commentVote.update({
            where: { id },
            data: { value },
        });
    }

    async deleteVote(id: string): Promise<void> {
        await this.prisma.commentVote.delete({
            where: { id },
        });
    }

    async createReport(data: any): Promise<CommentReport> {
        return this.prisma.commentReport.create({
            data,
        }) as any;
    }

    async findReport(commentId: string, reporterUid: string): Promise<CommentReport | null> {
        return this.prisma.commentReport.findUnique({
            where: { commentId_reporterUid: { commentId, reporterUid } },
        }) as any;
    }

    async findReports(options: {
        where?: any;
        skip?: number;
        take?: number;
        include?: any;
    }): Promise<{ data: any[]; total: number }> {
        const [data, total] = await Promise.all([
            this.prisma.commentReport.findMany({
                where: options.where,
                skip: options.skip,
                take: options.take,
                include: options.include,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.commentReport.count({ where: options.where }),
        ]);

        return {
            data,
            total,
        };
    }

    async updateReport(id: string, data: any): Promise<CommentReport> {
        return this.prisma.commentReport.update({
            where: { id },
            data,
        }) as any;
    }

    async deleteReport(id: string): Promise<void> {
        await this.prisma.commentReport.delete({
            where: { id },
        });
    }

    async resolveReportsForComment(commentId: string): Promise<void> {
        await this.prisma.commentReport.updateMany({
            where: { commentId },
            data: { status: 'resolved' },
        });
    }

    async attachUserDetails(uids: string[]): Promise<any[]> {
        return this.prisma.user.findMany({
            where: { uid: { in: uids } },
            select: { uid: true, role: true, avatarUrl: true, name: true },
        });
    }
}
