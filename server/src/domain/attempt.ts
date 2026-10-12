import { NotFoundError } from "./errors.js";

export interface AttemptSnapshot {
  id: string;
  learnerId: string;
  problemSlug: string;
  formatId: string;
  draft: unknown;
  revisionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One learner working on one problem. The attempt owns a mutable draft; every
 * submit freezes the draft into an immutable, numbered Submission (a revision),
 * so "try again" is a new revision of the same attempt and progress between
 * revisions can be compared.
 */
export class Attempt {
  private constructor(private state: AttemptSnapshot) {}

  static start(input: {
    id: string;
    learnerId: string;
    problemSlug: string;
    formatId: string;
    draft: unknown;
    now: Date;
  }): Attempt {
    return new Attempt({
      id: input.id,
      learnerId: input.learnerId,
      problemSlug: input.problemSlug,
      formatId: input.formatId,
      draft: input.draft,
      revisionCount: 0,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(snapshot: AttemptSnapshot): Attempt {
    return new Attempt({ ...snapshot });
  }

  get id() {
    return this.state.id;
  }
  get learnerId() {
    return this.state.learnerId;
  }
  get problemSlug() {
    return this.state.problemSlug;
  }
  get formatId() {
    return this.state.formatId;
  }
  get draft() {
    return this.state.draft;
  }
  get revisionCount() {
    return this.state.revisionCount;
  }

  /** Someone else's attempt is reported as missing rather than forbidden. */
  assertOwnedBy(learnerId: string): void {
    if (this.state.learnerId !== learnerId) throw new NotFoundError("Attempt", this.state.id);
  }

  saveDraft(draft: unknown, now: Date): void {
    this.state.draft = draft;
    this.state.updatedAt = now;
  }

  /** Reserves the next revision number for a submission of the current draft. */
  nextRevision(now: Date): number {
    this.state.revisionCount += 1;
    this.state.updatedAt = now;
    return this.state.revisionCount;
  }

  toSnapshot(): AttemptSnapshot {
    return { ...this.state };
  }
}
