import type { DesignModel } from "../domain/design.js";
import type {
  BandCap,
  CriterionAssessment,
  Finding,
  JudgeUsage,
  RequirementCoverage,
} from "../domain/feedback.js";
import type { Problem } from "../domain/problem.js";
import type { Rubric } from "../domain/rubric.js";

export interface EvaluationContext {
  learnerId: string;
  problem: Problem;
  rubric: Rubric;
  model: DesignModel;
  /** Canonical text of the submission (see SubmissionFormat.render). */
  rendered: string;
  /** Report of the deterministic pass, available to evaluators that run after it. */
  facts?: EvaluatorReport;
  signal?: AbortSignal;
}

export interface EvaluatorReport {
  evaluatorId: string;
  assessments: CriterionAssessment[];
  findings: Finding[];
  caps: BandCap[];
  coverage?: RequirementCoverage[];
  headline?: string;
  strengths?: string[];
  nextSteps?: string[];
  usage?: JudgeUsage;
}

/**
 * One way of judging a design. The rule engine and the LLM judge implement it
 * today; a human-review or code-execution evaluator would implement it too.
 */
export interface Evaluator {
  readonly id: string;
  evaluate(ctx: EvaluationContext): Promise<EvaluatorReport>;
}

export type UnavailableReason =
  | "not_configured"
  | "budget_exhausted"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "invalid_output";

/** Thrown by optional evaluators when they cannot produce a result right now. */
export class EvaluatorUnavailableError extends Error {
  constructor(
    readonly reason: UnavailableReason,
    message: string,
  ) {
    super(message);
    this.name = "EvaluatorUnavailableError";
  }
}
