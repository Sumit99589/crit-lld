import { InvalidTransitionError } from "./errors.js";
import type { Feedback } from "./feedback.js";

export type EvaluationStatus = "queued" | "running" | "completed" | "failed";

// running -> queued exists for two cases: a transient failure we retry, and a
// worker that died mid-run (its lease expired and recovery puts it back).
const ALLOWED: Record<EvaluationStatus, readonly EvaluationStatus[]> = {
  queued: ["running"],
  running: ["completed", "failed", "queued"],
  completed: ["queued"],
  failed: ["queued"],
};

export interface EvaluationSnapshot {
  id: string;
  submissionId: string;
  status: EvaluationStatus;
  tries: number;
  feedback: Feedback | null;
  lastError: string | null;
  leaseUntil: Date | null;
  /** Optimistic-concurrency token; bumped on every persisted change. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export class Evaluation {
  private constructor(private state: EvaluationSnapshot) {}

  static queue(input: { id: string; submissionId: string; now: Date }): Evaluation {
    return new Evaluation({
      id: input.id,
      submissionId: input.submissionId,
      status: "queued",
      tries: 0,
      feedback: null,
      lastError: null,
      leaseUntil: null,
      version: 0,
      createdAt: input.now,
      updatedAt: input.now,
      completedAt: null,
    });
  }

  static restore(snapshot: EvaluationSnapshot): Evaluation {
    return new Evaluation({ ...snapshot });
  }

  get id() {
    return this.state.id;
  }
  get submissionId() {
    return this.state.submissionId;
  }
  get status() {
    return this.state.status;
  }
  get tries() {
    return this.state.tries;
  }
  get feedback() {
    return this.state.feedback;
  }
  get lastError() {
    return this.state.lastError;
  }
  get version() {
    return this.state.version;
  }

  /** A worker claims the evaluation for `leaseMs`; if it dies, the lease lets someone else take over. */
  start(now: Date, leaseMs: number): void {
    this.transition("running", now);
    this.state.tries += 1;
    this.state.leaseUntil = new Date(now.getTime() + leaseMs);
  }

  complete(feedback: Feedback, now: Date): void {
    this.transition("completed", now);
    this.state.feedback = feedback;
    this.state.lastError = null;
    this.state.leaseUntil = null;
    this.state.completedAt = now;
  }

  fail(reason: string, now: Date): void {
    this.transition("failed", now);
    this.state.lastError = reason;
    this.state.leaseUntil = null;
  }

  /** Put a running evaluation back in the queue after a transient error. */
  retryLater(reason: string, now: Date): void {
    this.transition("queued", now);
    this.state.lastError = reason;
    this.state.leaseUntil = null;
  }

  /**
   * Learner-initiated retry. Allowed after a failure, or after a rules-only
   * result so they can ask for the AI review once it is available again.
   */
  requestRetry(now: Date): void {
    // running -> queued is a legal internal transition, but not one a learner may trigger.
    if (this.state.status === "running" || this.state.status === "queued") {
      throw new InvalidTransitionError("This evaluation is already in progress");
    }
    if (this.state.status === "completed" && this.state.feedback?.mode !== "rules_only") {
      throw new InvalidTransitionError("This evaluation already has full feedback");
    }
    this.transition("queued", now);
    this.state.tries = 0;
    this.state.leaseUntil = null;
  }

  isLeaseExpired(now: Date): boolean {
    return this.state.status === "running" && !!this.state.leaseUntil && this.state.leaseUntil <= now;
  }

  /** Called by the repository after a successful write. */
  markPersisted(): void {
    this.state.version += 1;
  }

  toSnapshot(): EvaluationSnapshot {
    return { ...this.state };
  }

  private transition(to: EvaluationStatus, now: Date): void {
    if (!ALLOWED[this.state.status].includes(to)) {
      throw new InvalidTransitionError(`Cannot move evaluation from ${this.state.status} to ${to}`);
    }
    this.state.status = to;
    this.state.updatedAt = now;
  }
}
