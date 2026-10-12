import type { Band, CriterionId } from "./rubric.js";

export type Severity = "major" | "minor" | "note";
export type Confidence = "low" | "medium" | "high";
export type AssessmentSource = "ai" | "rules";

/**
 * A deterministic observation about the design. `code` + `subject` identify the
 * same issue across revisions, which is how we tell a learner what they fixed.
 */
export interface Finding {
  code: string;
  criterion: CriterionId;
  severity: Severity;
  subject?: string;
  message: string;
  suggestion?: string;
}

export interface EvidenceQuote {
  text: string;
  /** True when the quote really appears in the submission. */
  verified: boolean;
}

export interface CriterionAssessment {
  criterion: CriterionId;
  band: Band;
  evidence: EvidenceQuote[];
  concern: string;
  suggestion: string;
  confidence: Confidence;
  source: AssessmentSource;
  /** Set when a deterministic fact lowered the band an evaluator proposed. */
  cappedFrom?: Band;
  capReason?: string;
}

export interface BandCap {
  criterion: CriterionId;
  maxBand: Band;
  reason: string;
}

export interface RequirementCoverage {
  requirementId: string;
  text: string;
  mappedTo: string[];
  status: "covered" | "unmapped" | "broken";
}

export type FeedbackMode = "full" | "rules_only";

export interface BandChange {
  criterion: CriterionId;
  from: Band;
  to: Band;
}

export interface RevisionComparison {
  previousRevision: number;
  bandChanges: BandChange[];
  resolved: Finding[];
  persisting: Finding[];
  introduced: Finding[];
}

export interface JudgeUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

export interface Feedback {
  rubricVersion: string;
  mode: FeedbackMode;
  /** Why the AI review is missing when mode is rules_only. */
  degradedReason?: string;
  headline: string;
  strengths: string[];
  nextSteps: string[];
  criteria: CriterionAssessment[];
  findings: Finding[];
  coverage: RequirementCoverage[];
  comparison?: RevisionComparison;
  usage?: JudgeUsage;
}

export function findingKey(f: Pick<Finding, "code" | "subject">): string {
  return `${f.code}:${(f.subject ?? "").toLowerCase()}`;
}

const SEVERITY_ORDER: Record<Severity, number> = { major: 0, minor: 1, note: 2 };

export function bySeverity(a: Finding, b: Finding): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
}
