import { Comment, CommentVote, CommentReport } from './comment.entity';

export interface ICommentRepository {
    create(data: any): Promise<Comment>;
    findAll(options: {
        where?: any;
        skip?: number;
        take?: number;
        orderBy?: any;
        include?: any;
    }): Promise<{ data: Comment[]; total: number }>;
    findById(id: string): Promise<Comment | null>;
    update(id: string, data: any): Promise<Comment>;
    softDelete(id: string): Promise<void>;

    // Voting
    findVote(commentId: string, uid: string): Promise<CommentVote | null>;
    findVotesByCommentIds(commentIds: string[], uid: string): Promise<CommentVote[]>;
    createVote(data: any): Promise<void>;
    updateVote(id: string, value: number): Promise<void>;
    deleteVote(id: string): Promise<void>;

    // Reporting
    createReport(data: any): Promise<CommentReport>;
    findReport(commentId: string, reporterUid: string): Promise<CommentReport | null>;
    findReports(options: {
        where?: any;
        skip?: number;
        take?: number;
        include?: any;
    }): Promise<{ data: any[]; total: number }>;
    updateReport(id: string, data: any): Promise<CommentReport>;
    deleteReport(id: string): Promise<void>;
    resolveReportsForComment(commentId: string): Promise<void>;

    // Utils
    attachUserDetails(uids: string[]): Promise<any[]>;
}

export const ICommentRepository = Symbol('ICommentRepository');
