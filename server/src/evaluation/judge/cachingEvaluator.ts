import { sha256 } from "../../lib/ids.js";
import type { EvaluationContext, Evaluator, EvaluatorReport } from "../evaluator.js";

export interface ReportCache {
  get(key: string): EvaluatorReport | undefined;
  put(key: string, report: EvaluatorReport): void;
}

/**
 * Identical input, identical review: a resubmission of the same text (or a
 * "retry AI review" after it already succeeded once) costs nothing. Wraps any
 * evaluator, which keeps caching out of the judge itself.
 */
export class CachingEvaluator implements Evaluator {
  readonly id: string;

  constructor(
    private readonly inner: Evaluator,
    private readonly cache: ReportCache,
    private readonly version: string,
  ) {
    this.id = inner.id;
  }

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorReport> {
    const key = sha256(
      this.inner.id,
      this.version,
      ctx.rubric.version,
      ctx.problem.slug,
      ctx.rendered,
      (ctx.facts?.findings ?? []).map((f) => `${f.code}:${f.subject ?? ""}`).join("|"),
    );

    const hit = this.cache.get(key);
    if (hit) return { ...hit, usage: hit.usage && { ...hit.usage, cached: true } };

    const report = await this.inner.evaluate(ctx);
    this.cache.put(key, report);
    return report;
  }
}
