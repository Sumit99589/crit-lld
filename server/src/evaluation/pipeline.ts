import type { Feedback } from "../domain/feedback.js";
import {
  EvaluatorUnavailableError,
  type EvaluationContext,
  type Evaluator,
  type EvaluatorReport,
} from "./evaluator.js";
import type { FeedbackAssembler } from "./feedbackAssembler.js";

export interface PipelineLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Runs the deterministic pass first (it cannot fail on learner input), then the
 * optional judge with the rule findings as verified facts. If the judge is
 * unavailable for any reason, the learner still gets complete rule-based
 * feedback right away and can ask for the AI review again later.
 */
export class EvaluationPipeline {
  constructor(
    private readonly rules: Evaluator,
    private readonly judge: Evaluator | null,
    private readonly assembler: FeedbackAssembler,
    private readonly logger: PipelineLogger,
  ) {}

  async run(ctx: EvaluationContext): Promise<Feedback> {
    const rules = await this.rules.evaluate(ctx);

    let judge: EvaluatorReport | undefined;
    let degradedReason: string | undefined;
    if (this.judge) {
      try {
        judge = await this.judge.evaluate({ ...ctx, facts: rules });
      } catch (error) {
        degradedReason =
          error instanceof EvaluatorUnavailableError ? error.message : "The AI review failed unexpectedly.";
        this.logger.warn("judge unavailable, falling back to rules", {
          reason: error instanceof EvaluatorUnavailableError ? error.reason : String(error),
        });
      }
    } else {
      degradedReason = "AI review isn't configured on this server.";
    }

    return this.assembler.assemble({ rubric: ctx.rubric, rendered: ctx.rendered, rules, judge, degradedReason });
  }
}
