// Mirrors the server's response shapes. Kept as an explicit contract instead of
// importing server code, so the two sides can only drift through a visible change.

export type Difficulty = "easy" | "medium" | "hard";
export type Band = 1 | 2 | 3 | 4;
export type CriterionId =
  "requirements" | "responsibilities" | "abstraction" | "relationships" | "extensibility" | "behaviour";
export type Severity = "major" | "minor" | "note";
export type EvaluationStatus = "queued" | "running" | "completed" | "failed";

export const ELEMENT_KINDS = ["class", "abstract", "interface", "enum"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export const RELATION_TYPES = ["inherits", "implements", "composes", "aggregates", "associates", "depends"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface ProblemSummary {
  slug: string;
  title: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  tagline: string;
  requirementCount: number;
  changeTitle: string;
  progress: {
    attempts: number;
    latestAttemptId: string | null;
    latestBands: Partial<Record<CriterionId, Band>> | null;
  };
}

export interface Problem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  tagline: string;
  context: string;
  requirements: { id: string; text: string }[];
  constraints: string[];
  outOfScope: string[];
  changeScenario: { title: string; prompt: string };
  hints: string[];
}

export interface Criterion {
  id: CriterionId;
  name: string;
  question: string;
  levels: Record<Band, string>;
}

export interface Rubric {
  version: string;
  criteria: Criterion[];
}

export interface CanvasEntity {
  id: string;
  name: string;
  kind: ElementKind;
  responsibility: string;
  attributes: string;
  methods: string;
}

export interface CanvasRelationship {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  label: string;
}

export interface DesignCanvas {
  assumptions: string;
  entities: CanvasEntity[];
  relationships: CanvasRelationship[];
  requirementMap: Record<string, string[]>;
  keyFlow: string;
  decisions: string;
  changeResponse: string;
}

export interface Attempt {
  id: string;
  problemSlug: string;
  formatId: string;
  draft: DesignCanvas;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RevisionSummary {
  submissionId: string;
  revision: number;
  submittedAt: string;
  status: EvaluationStatus;
  mode: "full" | "rules_only" | null;
  bands: Partial<Record<CriterionId, Band>>;
  headline: string | null;
}

export interface Finding {
  code: string;
  criterion: CriterionId;
  severity: Severity;
  subject?: string;
  message: string;
  suggestion?: string;
}

export interface CriterionAssessment {
  criterion: CriterionId;
  band: Band;
  evidence: { text: string; verified: boolean }[];
  concern: string;
  suggestion: string;
  confidence: "low" | "medium" | "high";
  source: "ai" | "rules";
  cappedFrom?: Band;
  capReason?: string;
}

export interface RequirementCoverage {
  requirementId: string;
  text: string;
  mappedTo: string[];
  status: "covered" | "unmapped" | "broken";
}

export interface Feedback {
  rubricVersion: string;
  mode: "full" | "rules_only";
  degradedReason?: string;
  headline: string;
  strengths: string[];
  nextSteps: string[];
  criteria: CriterionAssessment[];
  findings: Finding[];
  coverage: RequirementCoverage[];
  comparison?: {
    previousRevision: number;
    bandChanges: { criterion: CriterionId; from: Band; to: Band }[];
    resolved: Finding[];
    persisting: Finding[];
    introduced: Finding[];
  };
  usage?: { model: string; inputTokens: number; outputTokens: number; cached: boolean };
}

export interface EvaluationView {
  id: string;
  status: EvaluationStatus;
  tries: number;
  lastError: string | null;
  feedback: Feedback | null;
  retryable: boolean;
  updatedAt: string;
  completedAt: string | null;
}

export interface SubmissionView {
  id: string;
  attemptId: string;
  problemSlug: string;
  revision: number;
  content: DesignCanvas;
  createdAt: string;
}

export interface Precheck {
  readiness: { path: string; message: string }[];
  findings: Finding[];
  coverage: RequirementCoverage[];
}

export interface AttemptHistory {
  attemptId: string;
  problemSlug: string;
  problemTitle: string;
  startedAt: string;
  revisions: RevisionSummary[];
}

export interface Insights {
  completedReviews: number;
  trends: { criterion: CriterionId; name: string; latest: Band | null; series: Band[] }[];
  focusAreas: { criterion: CriterionId; name: string; reason: string }[];
  recurringIssues: { code: string; attempts: number; example: string }[];
}

export interface Health {
  ok: boolean;
  ai: { enabled: boolean; model: string | null };
}
