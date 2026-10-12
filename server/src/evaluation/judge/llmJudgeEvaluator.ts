import type { CriterionAssessment } from "../../domain/feedback.js";
import type { Band } from "../../domain/rubric.js";
import {
  EvaluatorUnavailableError,
  type EvaluationContext,
  type Evaluator,
  type EvaluatorReport,
} from "../evaluator.js";
import { LlmError, type StructuredLlm } from "./llm.js";
import { JUDGE_SYSTEM, buildJudgePrompt, judgeOutputSchema, type JudgeOutput } from "./prompt.js";
import type { UsageBudget } from "./usageBudget.js";

const MAX_TOKENS = 6000;

/** Judgement-heavy criteria: responsibilities, trade-offs, quality of reasoning. */
export class LlmJudgeEvaluator implements Evaluator {
  readonly id = "llm-judge";

  constructor(
    private readonly llm: StructuredLlm | null,
    private readonly budget: UsageBudget,
  ) {}

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorReport> {
    if (!this.llm) {
      throw new EvaluatorUnavailableError("not_configured", "AI review isn't configured on this server.");
    }
    this.budget.assertAvailable(ctx.learnerId);

    let response;
    try {
      response = await this.llm.generate({
        system: JUDGE_SYSTEM,
        prompt: buildJudgePrompt(ctx),
        schema: judgeOutputSchema,
        maxTokens: MAX_TOKENS,
        signal: ctx.signal,
      });
    } catch (error) {
      if (error instanceof LlmError) {
        throw new EvaluatorUnavailableError(error.kind === "auth" ? "not_configured" : error.kind, error.message);
      }
      throw error;
    }

    this.budget.record({
      learnerId: ctx.learnerId,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    const assessments = toAssessments(response.output);
    if (assessments.length === 0) {
      throw new EvaluatorUnavailableError("invalid_output", "The AI review didn't assess any rubric criterion.");
    }

    return {
      evaluatorId: this.id,
      assessments,
      findings: [],
      caps: [],
      headline: clip(response.output.headline, 300),
      strengths: response.output.strengths.slice(0, 3).map((s) => clip(s, 300)),
      nextSteps: response.output.next_steps.slice(0, 3).map((s) => clip(s, 300)),
      usage: {
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cached: false,
      },
    };
  }
}

function toAssessments(output: JudgeOutput): CriterionAssessment[] {
  const seen = new Set<string>();
  const result: CriterionAssessment[] = [];
  for (const c of output.criteria) {
    if (seen.has(c.criterion)) continue; // keep the first verdict if the model repeats a criterion
    seen.add(c.criterion);
    result.push({
      criterion: c.criterion,
      band: toBand(c.band),
      evidence: c.evidence
        .filter((q) => q.trim().length > 0)
        .slice(0, 3)
        .map((text) => ({ text: clip(text, 400), verified: false })),
      concern: clip(c.concern, 600),
      suggestion: clip(c.suggestion, 600),
      confidence: c.confidence,
      source: "ai",
    });
  }
  return result;
}

function toBand(value: number): Band {
  const rounded = Math.round(Number.isFinite(value) ? value : 1);
  return Math.min(4, Math.max(1, rounded)) as Band;
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
