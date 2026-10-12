import type { Attempt } from "../domain/attempt.js";
import type { Evaluation } from "../domain/evaluation.js";
import type { Submission } from "../domain/submission.js";

export interface AttemptRepository {
  save(attempt: Attempt): void;
  find(id: string): Attempt | undefined;
  listByLearner(learnerId: string): Attempt[];
}

export interface SubmissionRepository {
  save(submission: Submission): void;
  find(id: string): Submission | undefined;
  findByIdempotencyKey(attemptId: string, key: string): Submission | undefined;
  findByRevision(attemptId: string, revision: number): Submission | undefined;
  latestForAttempt(attemptId: string): Submission | undefined;
  listByAttempts(attemptIds: string[]): Submission[];
}

export interface EvaluationRepository {
  insert(evaluation: Evaluation): void;
  /** Writes only if nobody else changed the row since it was read; throws ConcurrencyError otherwise. */
  update(evaluation: Evaluation): void;
  find(id: string): Evaluation | undefined;
  findBySubmission(submissionId: string): Evaluation | undefined;
  listBySubmissions(submissionIds: string[]): Evaluation[];
  listUnfinished(): Evaluation[];
}

export interface UnitOfWork {
  run<T>(work: () => T): T;
}

export interface JobQueue {
  enqueue(evaluationId: string, delayMs?: number): void;
}
