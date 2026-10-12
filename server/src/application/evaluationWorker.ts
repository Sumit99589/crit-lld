import { ConcurrencyError } from "../domain/errors.js";
import type { Evaluation } from "../domain/evaluation.js";
import type { FormatRegistry } from "../domain/format.js";
import type { ProblemCatalog } from "../domain/problem.js";
import type { Rubric } from "../domain/rubric.js";
import type { EvaluationPipeline } from "../evaluation/pipeline.js";
import { compareRevisions } from "../evaluation/revisionComparer.js";
import type { Clock } from "../lib/clock.js";
import type { EvaluationRepository, JobQueue, SubmissionRepository } from "./ports.js";
import { renderContext } from "./practiceService.js";

export interface WorkerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface WorkerDeps {
  evaluations: EvaluationRepository;
  submissions: SubmissionRepository;
  problems: ProblemCatalog;
  formats: FormatRegistry;
  rubric: Rubric;
  pipeline: EvaluationPipeline;
  queue: JobQueue;
  clock: Clock;
  logger: WorkerLogger;
  /** How long a claimed evaluation stays ours before recovery may take it back. */
  leaseMs: number;
  maxTries: number;
  retryDelayMs: number;
}

/**
 * Turns a queued evaluation into feedback. Safe to call twice for the same id:
 * claiming is a versioned write, so only one caller moves it to running.
 */
export class EvaluationWorker {
  constructor(private readonly deps: WorkerDeps) {}

  async process(evaluationId: string): Promise<void> {
    const { evaluations, clock, leaseMs } = this.deps;
    const evaluation = evaluations.find(evaluationId);
    if (!evaluation || evaluation.status !== "queued") return;

    evaluation.start(clock.now(), leaseMs);
    try {
      evaluations.update(evaluation);
    } catch (error) {
      if (error instanceof ConcurrencyError) return; // another worker claimed it first
      throw error;
    }

    try {
      const feedback = await this.evaluate(evaluation);
      evaluation.complete(feedback, clock.now());
      evaluations.update(evaluation);
      this.deps.logger.info("evaluation completed", { evaluationId, mode: feedback.mode });
    } catch (error) {
      if (error instanceof ConcurrencyError) return;
      this.handleFailure(evaluation, error);
    }
  }

  /** Re-queues work left behind by a previous process: queued jobs and runs whose lease expired. */
  recover(): number {
    const now = this.deps.clock.now();
    let count = 0;
    for (const evaluation of this.deps.evaluations.listUnfinished()) {
      if (evaluation.status === "running") {
        if (!evaluation.isLeaseExpired(now)) continue;
        evaluation.retryLater("The evaluation was interrupted and has been restarted.", now);
        this.deps.evaluations.update(evaluation);
      }
      this.deps.queue.enqueue(evaluation.id);
      count += 1;
    }
    return count;
  }

  private async evaluate(evaluation: Evaluation) {
    const { submissions, problems, formats, rubric, evaluations, pipeline, leaseMs } = this.deps;
    const submission = submissions.find(evaluation.submissionId);
    if (!submission) throw new Error(`Submission ${evaluation.submissionId} is missing`);
    const problem = problems.find(submission.problemSlug);
    if (!problem) throw new Error(`Problem ${submission.problemSlug} is missing`);

    const format = formats.get(submission.formatId);
    const parsed = format.parse(submission.content);
    if (!parsed.ok) throw new Error("Stored submission no longer parses");

    const feedback = await pipeline.run({
      learnerId: submission.learnerId,
      problem,
      rubric,
      model: format.toModel(parsed.value),
      rendered: format.render(parsed.value, renderContext(problem)),
      // Leave a margin so we time out before the lease does.
      signal: AbortSignal.timeout(Math.max(1000, leaseMs - 5000)),
    });

    if (submission.revision > 1) {
      const previous = submissions.findByRevision(submission.attemptId, submission.revision - 1);
      const previousFeedback = previous && evaluations.findBySubmission(previous.id)?.feedback;
      if (previousFeedback) feedback.comparison = compareRevisions(previousFeedback, submission.revision - 1, feedback);
    }
    return feedback;
  }

  private handleFailure(evaluation: Evaluation, error: unknown): void {
    const { evaluations, queue, clock, logger, maxTries, retryDelayMs } = this.deps;
    const reason = error instanceof Error ? error.message : String(error);
    logger.error("evaluation attempt failed", { evaluationId: evaluation.id, tries: evaluation.tries, reason });

    if (evaluation.tries < maxTries) {
      evaluation.retryLater(reason, clock.now());
      evaluations.update(evaluation);
      queue.enqueue(evaluation.id, retryDelayMs * evaluation.tries);
    } else {
      evaluation.fail("We couldn't evaluate this submission. Your design is saved, so you can retry.", clock.now());
      evaluations.update(evaluation);
    }
  }
}
