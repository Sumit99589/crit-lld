import type { DesignModel } from "./design.js";
import type { ValidationIssue } from "./errors.js";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

/**
 * Everything the platform needs to know about one way of expressing a design.
 * Adding a class-diagram or code format means adding one implementation of this
 * interface; attempts, submissions and evaluators stay as they are because they
 * only see `content: unknown` and the DesignModel produced here.
 */
export interface SubmissionFormat<T = unknown> {
  readonly id: string;

  /** Shape check, lenient enough for half-finished drafts. */
  parse(raw: unknown): ParseResult<T>;

  /** The minimum a design needs before it is worth evaluating. */
  submissionIssues(content: T): ValidationIssue[];

  toModel(content: T): DesignModel;

  /**
   * Canonical plain-text rendering. It is what the LLM reads, what evidence
   * quotes are checked against, and what the dedupe hash is computed from.
   */
  render(content: T, context: { requirementIds: string[]; changeTitle: string }): string;

  empty(): T;
}

export class FormatRegistry {
  private readonly formats = new Map<string, SubmissionFormat>();

  constructor(formats: SubmissionFormat[], readonly defaultFormatId: string) {
    for (const f of formats) this.formats.set(f.id, f);
    if (!this.formats.has(defaultFormatId)) throw new Error(`Unknown default format ${defaultFormatId}`);
  }

  get(id: string): SubmissionFormat {
    const format = this.formats.get(id);
    if (!format) throw new Error(`Unknown submission format "${id}"`);
    return format;
  }
}
