export type FeedbackKind = 'felt_heard';

export interface PendingFeedbackRepository {
  setPending(userId: string, kind: FeedbackKind): Promise<void>;
  getPending(userId: string): Promise<FeedbackKind | null>;
  clearPending(userId: string): Promise<void>;
}
