import type { DatabaseSync } from "node:sqlite";
import type { AttemptRepository, EvaluationRepository, SubmissionRepository } from "../application/ports.js";
import { Attempt } from "../domain/attempt.js";
import { ConcurrencyError } from "../domain/errors.js";
import { Evaluation, type EvaluationStatus } from "../domain/evaluation.js";
import type { Submission } from "../domain/submission.js";
import type { EvaluatorReport } from "../evaluation/evaluator.js";
import type { ReportCache } from "../evaluation/judge/cachingEvaluator.js";
import type { UsageEntry, UsageLedger } from "../evaluation/judge/usageBudget.js";
import { toDate, toDateOrNull, type Row } from "./database.js";

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export class SqliteAttemptRepository implements AttemptRepository {
  constructor(private readonly db: DatabaseSync) {}

  save(attempt: Attempt): void {
    const s = attempt.toSnapshot();
    this.db
      .prepare(
        `INSERT INTO attempts (id, learner_id, problem_slug, format_id, draft, revision_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET draft = excluded.draft, revision_count = excluded.revision_count, updated_at = excluded.updated_at`,
      )
      .run(
        s.id,
        s.learnerId,
        s.problemSlug,
        s.formatId,
        JSON.stringify(s.draft),
        s.revisionCount,
        s.createdAt.toISOString(),
        s.updatedAt.toISOString(),
      );
  }

  find(id: string): Attempt | undefined {
    const row = this.db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as Row | undefined;
    return row && toAttempt(row);
  }

  listByLearner(learnerId: string): Attempt[] {
    const rows = this.db
      .prepare("SELECT * FROM attempts WHERE learner_id = ? ORDER BY updated_at DESC")
      .all(learnerId) as Row[];
    return rows.map(toAttempt);
  }
}

function toAttempt(row: Row): Attempt {
  return Attempt.restore({
    id: String(row.id),
    learnerId: String(row.learner_id),
    problemSlug: String(row.problem_slug),
    formatId: String(row.format_id),
    draft: JSON.parse(String(row.draft)),
    revisionCount: Number(row.revision_count),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  });
}

export class SqliteSubmissionRepository implements SubmissionRepository {
  constructor(private readonly db: DatabaseSync) {}

  save(s: Submission): void {
    this.db
      .prepare(
        `INSERT INTO submissions (id, attempt_id, learner_id, problem_slug, revision, format_id, content, content_hash, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        s.id,
        s.attemptId,
        s.learnerId,
        s.problemSlug,
        s.revision,
        s.formatId,
        JSON.stringify(s.content),
        s.contentHash,
        s.idempotencyKey,
        s.createdAt.toISOString(),
      );
  }

  find(id: string): Submission | undefined {
    return this.one("SELECT * FROM submissions WHERE id = ?", id);
  }

  findByIdempotencyKey(attemptId: string, key: string): Submission | undefined {
    return this.one("SELECT * FROM submissions WHERE attempt_id = ? AND idempotency_key = ?", attemptId, key);
  }

  findByRevision(attemptId: string, revision: number): Submission | undefined {
    return this.one("SELECT * FROM submissions WHERE attempt_id = ? AND revision = ?", attemptId, revision);
  }

  latestForAttempt(attemptId: string): Submission | undefined {
    return this.one("SELECT * FROM submissions WHERE attempt_id = ? ORDER BY revision DESC LIMIT 1", attemptId);
  }

  listByAttempts(attemptIds: string[]): Submission[] {
    if (attemptIds.length === 0) return [];
    const rows = this.db
      .prepare(`SELECT * FROM submissions WHERE attempt_id IN (${placeholders(attemptIds.length)}) ORDER BY created_at`)
      .all(...attemptIds) as Row[];
    return rows.map(toSubmission);
  }

  private one(sql: string, ...params: (string | number)[]): Submission | undefined {
    const row = this.db.prepare(sql).get(...params) as Row | undefined;
    return row && toSubmission(row);
  }
}

function toSubmission(row: Row): Submission {
  return {
    id: String(row.id),
    attemptId: String(row.attempt_id),
    learnerId: String(row.learner_id),
    problemSlug: String(row.problem_slug),
    revision: Number(row.revision),
    formatId: String(row.format_id),
    content: JSON.parse(String(row.content)),
    contentHash: String(row.content_hash),
    idempotencyKey: row.idempotency_key == null ? null : String(row.idempotency_key),
    createdAt: toDate(row.created_at),
  };
}

export class SqliteEvaluationRepository implements EvaluationRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(evaluation: Evaluation): void {
    const s = evaluation.toSnapshot();
    this.db
      .prepare(
        `INSERT INTO evaluations (id, submission_id, status, tries, feedback, last_error, lease_until, version, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        s.id,
        s.submissionId,
        s.status,
        s.tries,
        s.feedback && JSON.stringify(s.feedback),
        s.lastError,
        s.leaseUntil?.toISOString() ?? null,
        s.version,
        s.createdAt.toISOString(),
        s.updatedAt.toISOString(),
        s.completedAt?.toISOString() ?? null,
      );
  }

  update(evaluation: Evaluation): void {
    const s = evaluation.toSnapshot();
    const result = this.db
      .prepare(
        `UPDATE evaluations
            SET status = ?, tries = ?, feedback = ?, last_error = ?, lease_until = ?, updated_at = ?, completed_at = ?, version = version + 1
          WHERE id = ? AND version = ?`,
      )
      .run(
        s.status,
        s.tries,
        s.feedback && JSON.stringify(s.feedback),
        s.lastError,
        s.leaseUntil?.toISOString() ?? null,
        s.updatedAt.toISOString(),
        s.completedAt?.toISOString() ?? null,
        s.id,
        s.version,
      );
    if (Number(result.changes) === 0) {
      throw new ConcurrencyError(`Evaluation ${s.id} was changed by someone else`);
    }
    evaluation.markPersisted();
  }

  find(id: string): Evaluation | undefined {
    const row = this.db.prepare("SELECT * FROM evaluations WHERE id = ?").get(id) as Row | undefined;
    return row && toEvaluation(row);
  }

  findBySubmission(submissionId: string): Evaluation | undefined {
    const row = this.db.prepare("SELECT * FROM evaluations WHERE submission_id = ?").get(submissionId) as
      Row | undefined;
    return row && toEvaluation(row);
  }

  listBySubmissions(submissionIds: string[]): Evaluation[] {
    if (submissionIds.length === 0) return [];
    const rows = this.db
      .prepare(`SELECT * FROM evaluations WHERE submission_id IN (${placeholders(submissionIds.length)})`)
      .all(...submissionIds) as Row[];
    return rows.map(toEvaluation);
  }

  listUnfinished(): Evaluation[] {
    const rows = this.db
      .prepare("SELECT * FROM evaluations WHERE status IN ('queued', 'running') ORDER BY created_at")
      .all() as Row[];
    return rows.map(toEvaluation);
  }
}

function toEvaluation(row: Row): Evaluation {
  return Evaluation.restore({
    id: String(row.id),
    submissionId: String(row.submission_id),
    status: String(row.status) as EvaluationStatus,
    tries: Number(row.tries),
    feedback: row.feedback == null ? null : JSON.parse(String(row.feedback)),
    lastError: row.last_error == null ? null : String(row.last_error),
    leaseUntil: toDateOrNull(row.lease_until),
    version: Number(row.version),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    completedAt: toDateOrNull(row.completed_at),
  });
}

export class SqliteUsageLedger implements UsageLedger {
  constructor(private readonly db: DatabaseSync) {}

  record(entry: UsageEntry): void {
    this.db
      .prepare("INSERT INTO llm_usage (learner_id, model, input_tokens, output_tokens, at) VALUES (?, ?, ?, ?, ?)")
      .run(entry.learnerId, entry.model, entry.inputTokens, entry.outputTokens, entry.at.toISOString());
  }

  countSince(since: Date, learnerId?: string): number {
    const row = learnerId
      ? this.db
          .prepare("SELECT COUNT(*) AS n FROM llm_usage WHERE at >= ? AND learner_id = ?")
          .get(since.toISOString(), learnerId)
      : this.db.prepare("SELECT COUNT(*) AS n FROM llm_usage WHERE at >= ?").get(since.toISOString());
    return Number((row as Row).n);
  }
}

export class SqliteReportCache implements ReportCache {
  constructor(private readonly db: DatabaseSync) {}

  get(key: string): EvaluatorReport | undefined {
    const row = this.db.prepare("SELECT report FROM report_cache WHERE key = ?").get(key) as Row | undefined;
    return row ? (JSON.parse(String(row.report)) as EvaluatorReport) : undefined;
  }

  put(key: string, report: EvaluatorReport): void {
    this.db
      .prepare("INSERT OR REPLACE INTO report_cache (key, report, created_at) VALUES (?, ?, ?)")
      .run(key, JSON.stringify(report), new Date().toISOString());
  }
}
