export const NEWSLETTER_QUEUE = 'newsletter';

export const NEWSLETTER_JOB_ANNOUNCE = 'announce';
export const NEWSLETTER_JOB_SEND = 'send';

export interface AnnouncePayload {
  blogId: string;
}

export interface SendPayload {
  blogId: string;
  subscriberId: string;
  email: string;
  token: string;
}
