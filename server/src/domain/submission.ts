/**
 * An immutable snapshot of what the learner handed in. It is persisted before
 * any evaluation starts, so an evaluator crash can never lose the learner's work.
 */
export interface Submission {
  readonly id: string;
  readonly attemptId: string;
  readonly learnerId: string;
  readonly problemSlug: string;
  readonly revision: number;
  readonly formatId: string;
  readonly content: unknown;
  /** Hash of the canonical rendering; identical resubmissions are deduplicated on it. */
  readonly contentHash: string;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
}
