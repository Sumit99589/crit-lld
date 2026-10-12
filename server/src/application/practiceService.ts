import { Attempt } from "../domain/attempt.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { Evaluation } from "../domain/evaluation.js";
import type { FormatRegistry, SubmissionFormat } from "../domain/format.js";
import type { Problem, ProblemCatalog } from "../domain/problem.js";
import type { Rubric } from "../domain/rubric.js";
import type { Submission } from "../domain/submission.js";
import type { EvaluatorReport } from "../evaluation/evaluator.js";
import type { RuleBasedEvaluator } from "../evaluation/ruleBasedEvaluator.js";
import type { Clock } from "../lib/clock.js";
import { sha256, type IdGenerator } from "../lib/ids.js";
import type { AttemptRepository, EvaluationRepository, JobQueue, SubmissionRepository, UnitOfWork } from "./ports.js";

export interface PracticeDeps {
  problems: ProblemCatalog;
  formats: FormatRegistry;
  rubric: Rubric;
  attempts: AttemptRepository;
  submissions: SubmissionRepository;
  evaluations: EvaluationRepository;
  uow: UnitOfWork;
  queue: JobQueue;
  rules: RuleBasedEvaluator;
  clock: Clock;
  newId: IdGenerator;
}

export interface SubmitResult {
  submission: Submission;
  evaluation: Evaluation;
  /** False when this call matched an earlier submission (same idempotency key or identical content). */
  created: boolean;
}

export function renderContext(problem: Problem) {
  return { requirementIds: problem.requirements.map((r) => r.id), changeTitle: problem.changeScenario.title };
}

/** The practice loop's use cases: start, draft, pre-check, submit, retry. */
export class PracticeService {
  constructor(private readonly deps: PracticeDeps) {}

  problem(slug: string): Problem {
    const problem = this.deps.problems.find(slug);
    if (!problem) throw new NotFoundError("Problem", slug);
    return problem;
  }

  startAttempt(learnerId: string, problemSlug: string): Attempt {
    this.problem(problemSlug);
    const format = this.deps.formats.get(this.deps.formats.defaultFormatId);
    const attempt = Attempt.start({
      id: this.deps.newId(),
      learnerId,
      problemSlug,
      formatId: format.id,
      draft: format.empty(),
      now: this.deps.clock.now(),
    });
    this.deps.attempts.save(attempt);
    return attempt;
  }

  getAttempt(learnerId: string, attemptId: string): Attempt {
    const attempt = this.deps.attempts.find(attemptId);
    if (!attempt) throw new NotFoundError("Attempt", attemptId);
    attempt.assertOwnedBy(learnerId);
    return attempt;
  }

  saveDraft(learnerId: string, attemptId: string, raw: unknown): Attempt {
    const attempt = this.getAttempt(learnerId, attemptId);
    const parsed = this.formatOf(attempt).parse(raw);
    if (!parsed.ok) throw new ValidationError("The draft is not in the expected shape", parsed.issues);
    attempt.saveDraft(parsed.value, this.deps.clock.now());
    this.deps.attempts.save(attempt);
    return attempt;
  }

  /**
   * Runs only the deterministic checks against an unsaved draft so the learner
   * sees structural problems while still editing. Free, instant, and never
   * touches the LLM.
   */
  precheck(learnerId: string, attemptId: string, raw: unknown) {
    const attempt = this.getAttempt(learnerId, attemptId);
    const format = this.formatOf(attempt);
    const parsed = format.parse(raw);
    if (!parsed.ok) throw new ValidationError("The draft is not in the expected shape", parsed.issues);
    const report: EvaluatorReport = this.deps.rules.evaluateSync({
      problem: this.problem(attempt.problemSlug),
      model: format.toModel(parsed.value),
      rubric: this.deps.rubric,
    });
    return { readiness: format.submissionIssues(parsed.value), findings: report.findings, coverage: report.coverage ?? [] };
  }

  /**
   * Synchronous on purpose: SQLite calls are synchronous, so the duplicate
   * checks and the inserts below can't interleave with another request in this
   * process. The slow part (evaluation) happens later, off the request.
   */
  submit(learnerId: string, attemptId: string, raw: unknown, idempotencyKey?: string): SubmitResult {
    const { attempts, submissions, evaluations, uow, queue, clock, newId } = this.deps;
    const attempt = this.getAttempt(learnerId, attemptId);

    if (idempotencyKey) {
      const replay = submissions.findByIdempotencyKey(attempt.id, idempotencyKey);
      if (replay) return this.existing(replay);
    }

    const format = this.formatOf(attempt);
    const parsed = format.parse(raw);
    if (!parsed.ok) throw new ValidationError("The design is not in the expected shape", parsed.issues);
    const issues = format.submissionIssues(parsed.value);
    if (issues.length > 0) throw new ValidationError("Your design isn't ready to submit yet", issues);

    const problem = this.problem(attempt.problemSlug);
    const contentHash = sha256(format.id, format.render(parsed.value, renderContext(problem)));
    const latest = submissions.latestForAttempt(attempt.id);
    if (latest && latest.contentHash === contentHash) return this.existing(latest);

    const now = clock.now();
    const result = uow.run(() => {
      attempt.saveDraft(parsed.value, now);
      const submission: Submission = {
        id: newId(),
        attemptId: attempt.id,
        learnerId,
        problemSlug: attempt.problemSlug,
        revision: attempt.nextRevision(now),
        formatId: format.id,
        content: parsed.value,
        contentHash,
        idempotencyKey: idempotencyKey ?? null,
        createdAt: now,
      };
      const evaluation = Evaluation.queue({ id: newId(), submissionId: submission.id, now });
      attempts.save(attempt);
      submissions.save(submission);
      evaluations.insert(evaluation);
      return { submission, evaluation, created: true };
    });

    // Enqueued only after the transaction commits, so a worker never sees a half-written submission.
    queue.enqueue(result.evaluation.id);
    return result;
  }

  getSubmission(learnerId: string, submissionId: string): { submission: Submission; evaluation: Evaluation } {
    const submission = this.deps.submissions.find(submissionId);
    if (!submission || submission.learnerId !== learnerId) throw new NotFoundError("Submission", submissionId);
    const evaluation = this.deps.evaluations.findBySubmission(submission.id);
    if (!evaluation) throw new NotFoundError("Evaluation for submission", submissionId);
    return { submission, evaluation };
  }

  retryEvaluation(learnerId: string, submissionId: string): Evaluation {
    const { evaluation } = this.getSubmission(learnerId, submissionId);
    evaluation.requestRetry(this.deps.clock.now());
    this.deps.evaluations.update(evaluation);
    this.deps.queue.enqueue(evaluation.id);
    return evaluation;
  }

  private existing(submission: Submission): SubmitResult {
    const evaluation = this.deps.evaluations.findBySubmission(submission.id);
    if (!evaluation) throw new NotFoundError("Evaluation for submission", submission.id);
    return { submission, evaluation, created: false };
  }

  private formatOf(attempt: Attempt): SubmissionFormat {
    return this.deps.formats.get(attempt.formatId);
  }
}
