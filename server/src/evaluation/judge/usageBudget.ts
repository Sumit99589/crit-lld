import type { Clock } from "../../lib/clock.js";
import { EvaluatorUnavailableError } from "../evaluator.js";

export interface UsageEntry {
  learnerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  at: Date;
}

export interface UsageLedger {
  record(entry: UsageEntry): void;
  countSince(since: Date, learnerId?: string): number;
}

export interface BudgetLimits {
  /** Lifetime cap for the whole deployment; Infinity for none. */
  totalCalls: number;
  dailyCalls: number;
  perLearnerHourly: number;
}

const HOUR = 60 * 60 * 1000;

/**
 * Hard ceiling on paid model calls. When it trips, evaluation still completes
 * with rule-based feedback, so a public demo can never run up an open-ended bill.
 */
export class UsageBudget {
  constructor(
    private readonly ledger: UsageLedger,
    private readonly limits: BudgetLimits,
    private readonly clock: Clock,
  ) {}

  assertAvailable(learnerId: string): void {
    const now = this.clock.now().getTime();
    if (Number.isFinite(this.limits.totalCalls) && this.ledger.countSince(new Date(0)) >= this.limits.totalCalls) {
      throw new EvaluatorUnavailableError("budget_exhausted", "This demo's AI review budget is used up.");
    }
    if (this.ledger.countSince(new Date(now - 24 * HOUR)) >= this.limits.dailyCalls) {
      throw new EvaluatorUnavailableError("budget_exhausted", "The daily AI review budget for this demo is used up.");
    }
    if (this.ledger.countSince(new Date(now - HOUR), learnerId) >= this.limits.perLearnerHourly) {
      throw new EvaluatorUnavailableError("rate_limited", "You've used your AI reviews for this hour.");
    }
  }

  record(entry: Omit<UsageEntry, "at">): void {
    this.ledger.record({ ...entry, at: this.clock.now() });
  }
}
