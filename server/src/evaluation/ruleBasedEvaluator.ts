import type { BandCap, CriterionAssessment, Finding } from "../domain/feedback.js";
import { bySeverity } from "../domain/feedback.js";
import type { Band, Criterion } from "../domain/rubric.js";
import type { DesignCheck } from "./checks/check.js";
import type { EvaluationContext, Evaluator, EvaluatorReport } from "./evaluator.js";

// Rules can prove that something is missing or malformed; they cannot tell
// whether a responsibility split is *good*. So rule-based bands never go above
// Solid and are always marked low confidence. They are a floor and a fallback,
// not a verdict.
const RULES_CEILING: Band = 3;

export class RuleBasedEvaluator implements Evaluator {
  readonly id = "rules";

  constructor(private readonly checks: DesignCheck[]) {}

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorReport> {
    return this.evaluateSync(ctx);
  }

  /** Synchronous variant used for the live pre-flight while the learner is still editing. */
  evaluateSync(ctx: Pick<EvaluationContext, "problem" | "model" | "rubric">): EvaluatorReport {
    const findings: Finding[] = [];
    const caps: BandCap[] = [];
    let coverage: EvaluatorReport["coverage"] = [];

    for (const check of this.checks) {
      const result = check.run({ problem: ctx.problem, model: ctx.model });
      findings.push(...result.findings);
      caps.push(...(result.caps ?? []));
      if (result.coverage) coverage = result.coverage;
    }
    findings.sort(bySeverity);

    const assessments = ctx.rubric.criteria.map((c) =>
      this.assess(
        c,
        findings.filter((f) => f.criterion === c.id),
      ),
    );

    return { evaluatorId: this.id, assessments, findings, caps, coverage };
  }

  private assess(criterion: Criterion, findings: Finding[]): CriterionAssessment {
    const majors = findings.filter((f) => f.severity === "major").length;
    const minors = findings.filter((f) => f.severity === "minor").length;

    let band: Band = RULES_CEILING;
    if (majors >= 2) band = 1;
    else if (majors === 1 || minors >= 2) band = 2;

    const top = findings[0];
    return {
      criterion: criterion.id,
      band,
      evidence: [...new Set(findings.map((f) => f.subject).filter((s): s is string => !!s && !s.includes("->")))]
        .slice(0, 3)
        .map((text) => ({ text, verified: false })),
      concern: top?.message ?? "No structural problems found. The quality of your reasoning here needs a reviewer.",
      suggestion: top?.suggestion ?? `To reach Strong: ${criterion.levels[4]}`,
      confidence: "low",
      source: "rules",
    };
  }
}
