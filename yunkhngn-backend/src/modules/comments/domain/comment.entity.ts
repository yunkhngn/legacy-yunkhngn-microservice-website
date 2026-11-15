export class Comment {
  id: string;
  content: string;
  displayName: string;
  uid: string;
  blogId?: string;
  projectId?: string;
  parentId?: string;
  hidden: boolean;
  deleted: boolean;
  upvoteCount: number;
  downvoteCount: number;
  createdAt: Date;
  updatedAt: Date;
  user?: any;
  blog?: any;
  project?: any;
}

export class CommentVote {
  id: string;
  commentId: string;
  uid: string;
  value: number; // 1 or -1
  createdAt: Date;
}

export class CommentReport {
  id: string;
  commentId: string;
  reporterUid: string;
  reason: string;
  status: string; // new, resolved, ignored
  createdAt: Date;
  comment?: any;
}
