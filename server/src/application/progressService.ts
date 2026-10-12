import type { Evaluation, EvaluationStatus } from "../domain/evaluation.js";
import type { Feedback, FeedbackMode } from "../domain/feedback.js";
import type { ProblemCatalog } from "../domain/problem.js";
import type { Band, CriterionId, Rubric } from "../domain/rubric.js";
import type { AttemptRepository, EvaluationRepository, SubmissionRepository } from "./ports.js";

export interface RevisionSummary {
  submissionId: string;
  revision: number;
  submittedAt: Date;
  status: EvaluationStatus;
  mode: FeedbackMode | null;
  bands: Partial<Record<CriterionId, Band>>;
  headline: string | null;
}

export interface AttemptSummary {
  attemptId: string;
  problemSlug: string;
  problemTitle: string;
  startedAt: Date;
  revisions: RevisionSummary[];
}

export interface CriterionTrend {
  criterion: CriterionId;
  name: string;
  latest: Band | null;
  series: Band[];
}

export interface FocusArea {
  criterion: CriterionId;
  name: string;
  reason: string;
}

export interface RecurringIssue {
  code: string;
  attempts: number;
  example: string;
}

export interface Insights {
  completedReviews: number;
  trends: CriterionTrend[];
  focusAreas: FocusArea[];
  recurringIssues: RecurringIssue[];
}

const WINDOW = 3;

/**
 * Turns attempt history into something a learner can act on: which rubric
 * criteria keep coming up weak, and which structural mistakes recur across
 * different problems.
 */
export class ProgressService {
  constructor(
    private readonly deps: {
      attempts: AttemptRepository;
      submissions: SubmissionRepository;
      evaluations: EvaluationRepository;
      problems: ProblemCatalog;
      rubric: Rubric;
    },
  ) {}

  history(learnerId: string): AttemptSummary[] {
    const attempts = this.deps.attempts.listByLearner(learnerId);
    const submissions = this.deps.submissions.listByAttempts(attempts.map((a) => a.id));
    const evaluations = new Map(
      this.deps.evaluations.listBySubmissions(submissions.map((s) => s.id)).map((e) => [e.submissionId, e]),
    );

    return attempts.map((attempt) => ({
      attemptId: attempt.id,
      problemSlug: attempt.problemSlug,
      problemTitle: this.deps.problems.find(attempt.problemSlug)?.title ?? attempt.problemSlug,
      startedAt: attempt.toSnapshot().createdAt,
      revisions: submissions
        .filter((s) => s.attemptId === attempt.id)
        .sort((a, b) => a.revision - b.revision)
        .map((s) => summarise(s.id, s.revision, s.createdAt, evaluations.get(s.id))),
    }));
  }

  insights(learnerId: string): Insights {
    const history = this.history(learnerId);
    const completed = this.completedFeedback(learnerId, history);

    const trends = this.deps.rubric.criteria.map((c) => {
      const series = completed
        .map(({ feedback }) => feedback.criteria.find((a) => a.criterion === c.id)?.band)
        .filter(isBand);
      return { criterion: c.id, name: c.name, latest: series.at(-1) ?? null, series: series.slice(-8) };
    });

    const focusAreas: FocusArea[] = [];
    for (const t of trends) {
      const recent = t.series.slice(-WINDOW);
      const weak = recent.filter((b) => b <= 2).length;
      if (recent.length >= 2 && weak >= 2) {
        focusAreas.push({
          criterion: t.criterion,
          name: t.name,
          reason: `Below Solid in ${weak} of your last ${recent.length} reviews.`,
        });
      }
    }

    // Count each issue once per attempt, using only the latest reviewed revision,
    // so fixing something in a later revision takes it off the list.
    const latestPerAttempt = new Map<string, Feedback>();
    for (const { attemptId, feedback } of completed) latestPerAttempt.set(attemptId, feedback);
    const issueCounts = new Map<string, { attempts: number; example: string }>();
    for (const feedback of latestPerAttempt.values()) {
      const codes = new Map(feedback.findings.filter((f) => f.severity !== "note").map((f) => [f.code, f.message]));
      for (const [code, example] of codes) {
        const entry = issueCounts.get(code) ?? { attempts: 0, example };
        entry.attempts += 1;
        issueCounts.set(code, entry);
      }
    }
    const recurringIssues = [...issueCounts]
      .filter(([, v]) => v.attempts >= 2)
      .sort((a, b) => b[1].attempts - a[1].attempts)
      .map(([code, v]) => ({ code, ...v }));

    return { completedReviews: completed.length, trends, focusAreas, recurringIssues };
  }

  private completedFeedback(learnerId: string, history: AttemptSummary[]) {
    const submissions = this.deps.submissions
      .listByAttempts(history.map((h) => h.attemptId))
      .filter((s) => s.learnerId === learnerId);
    // Feedback across all attempts in submission order, oldest first.
    const evaluations = new Map(
      this.deps.evaluations.listBySubmissions(submissions.map((s) => s.id)).map((e) => [e.submissionId, e]),
    );
    return submissions
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .flatMap((s) => {
        const feedback = evaluations.get(s.id)?.feedback;
        return feedback ? [{ attemptId: s.attemptId, feedback }] : [];
      });
  }
}

function summarise(
  submissionId: string,
  revision: number,
  submittedAt: Date,
  evaluation: Evaluation | undefined,
): RevisionSummary {
  const feedback = evaluation?.feedback ?? null;
  return {
    submissionId,
    revision,
    submittedAt,
    status: evaluation?.status ?? "queued",
    mode: feedback?.mode ?? null,
    bands: Object.fromEntries(feedback?.criteria.map((c) => [c.criterion, c.band]) ?? []),
    headline: feedback?.headline ?? null,
  };
}

function isBand(value: Band | undefined): value is Band {
  return value !== undefined;
}
