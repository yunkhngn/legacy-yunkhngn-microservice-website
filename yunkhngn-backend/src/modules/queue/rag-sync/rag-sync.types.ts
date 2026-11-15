export const RAG_SYNC_QUEUE = 'rag-sync';
export const RAG_SYNC_JOB = 'sync';

export type RagSyncDocType = 'blog' | 'project';

export interface RagSyncUpsertJob {
  op: 'upsert';
  type: RagSyncDocType;
  docId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RagSyncDeleteJob {
  op: 'delete';
  type: RagSyncDocType;
  docId: string;
}

export type RagSyncJob = RagSyncUpsertJob | RagSyncDeleteJob;
