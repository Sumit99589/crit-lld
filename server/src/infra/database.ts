import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { UnitOfWork } from "../application/ports.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS attempts (
  id             TEXT PRIMARY KEY,
  learner_id     TEXT NOT NULL,
  problem_slug   TEXT NOT NULL,
  format_id      TEXT NOT NULL,
  draft          TEXT NOT NULL,
  revision_count INTEGER NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_by_learner ON attempts (learner_id, updated_at);

CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY,
  attempt_id      TEXT NOT NULL REFERENCES attempts (id),
  learner_id      TEXT NOT NULL,
  problem_slug    TEXT NOT NULL,
  revision        INTEGER NOT NULL,
  format_id       TEXT NOT NULL,
  content         TEXT NOT NULL,
  content_hash    TEXT NOT NULL,
  idempotency_key TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (attempt_id, revision),
  UNIQUE (attempt_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id            TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE REFERENCES submissions (id),
  status        TEXT NOT NULL,
  tries         INTEGER NOT NULL,
  feedback      TEXT,
  last_error    TEXT,
  lease_until   TEXT,
  version       INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  completed_at  TEXT
);
CREATE INDEX IF NOT EXISTS evaluations_by_status ON evaluations (status);

CREATE TABLE IF NOT EXISTS llm_usage (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id    TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS llm_usage_by_time ON llm_usage (at);

CREATE TABLE IF NOT EXISTS report_cache (
  key        TEXT PRIMARY KEY,
  report     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  db.exec(SCHEMA);
  return db;
}

export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: DatabaseSync) {}

  run<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export type Row = Record<string, unknown>;

export const toDate = (value: unknown): Date => new Date(String(value));
export const toDateOrNull = (value: unknown): Date | null => (value == null ? null : new Date(String(value)));
