export const NEWSLETTER_QUEUE = 'newsletter';

export const NEWSLETTER_JOB_ANNOUNCE = 'announce';
export const NEWSLETTER_JOB_SEND = 'send';

export interface AnnouncePayload {
  entityId: string;
  entityType: 'blog' | 'project';
  blogId?: string; // Kept for backwards compatibility if needed
}

export interface SendPayload {
  entityId: string;
  entityType: 'blog' | 'project';
  subscriberId: string;
  email: string;
  token: string;
  blogId?: string; // Kept for backwards compatibility
}

export type NewsletterJob = AnnouncePayload | SendPayload;
