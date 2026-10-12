import type { DatabaseSync } from "node:sqlite";
import { EvaluationWorker } from "./application/evaluationWorker.js";
import { PracticeService } from "./application/practiceService.js";
import { ProgressService } from "./application/progressService.js";
import type { Config } from "./config.js";
import { StaticProblemCatalog } from "./content/problems.js";
import { FormatRegistry } from "./domain/format.js";
import type { ProblemCatalog } from "./domain/problem.js";
import { LLD_RUBRIC } from "./domain/rubric.js";
import { CoreConceptCheck } from "./evaluation/checks/coreConcepts.js";
import { NarrativeCheck } from "./evaluation/checks/narrative.js";
import { RequirementCoverageCheck } from "./evaluation/checks/requirementCoverage.js";
import { ResponsibilityCheck } from "./evaluation/checks/responsibilities.js";
import { StructureCheck } from "./evaluation/checks/structure.js";
import type { Evaluator } from "./evaluation/evaluator.js";
import { FeedbackAssembler } from "./evaluation/feedbackAssembler.js";
import { AnthropicLlm } from "./evaluation/judge/anthropicLlm.js";
import { CachingEvaluator } from "./evaluation/judge/cachingEvaluator.js";
import type { StructuredLlm } from "./evaluation/judge/llm.js";
import { LlmJudgeEvaluator } from "./evaluation/judge/llmJudgeEvaluator.js";
import { PROMPT_VERSION } from "./evaluation/judge/prompt.js";
import { UsageBudget } from "./evaluation/judge/usageBudget.js";
import { EvaluationPipeline } from "./evaluation/pipeline.js";
import { RuleBasedEvaluator } from "./evaluation/ruleBasedEvaluator.js";
import { DesignCanvasFormat } from "./formats/designCanvas.js";
import { SqliteUnitOfWork } from "./infra/database.js";
import { InProcessQueue } from "./infra/inProcessQueue.js";
import type { Logger } from "./infra/logger.js";
import {
  SqliteAttemptRepository,
  SqliteEvaluationRepository,
  SqliteReportCache,
  SqliteSubmissionRepository,
  SqliteUsageLedger,
} from "./infra/repositories.js";
import { systemClock, type Clock } from "./lib/clock.js";
import { uuid } from "./lib/ids.js";

export interface ContainerOptions {
  db: DatabaseSync;
  config: Config;
  logger: Logger;
  /** Overrides the model client; tests pass a fake, `null` disables AI review. */
  llm?: StructuredLlm | null;
  clock?: Clock;
  problems?: ProblemCatalog;
  retryDelayMs?: number;
}

export type Container = ReturnType<typeof createContainer>;

/** The one place that knows about concrete classes. Everything else depends on interfaces. */
export function createContainer(options: ContainerOptions) {
  const { db, config, logger } = options;
  const clock = options.clock ?? systemClock;
  const rubric = LLD_RUBRIC;
  const problems = options.problems ?? new StaticProblemCatalog();
  const formats = new FormatRegistry([new DesignCanvasFormat()], "design-canvas@1");

  const attempts = new SqliteAttemptRepository(db);
  const submissions = new SqliteSubmissionRepository(db);
  const evaluations = new SqliteEvaluationRepository(db);

  const rules = new RuleBasedEvaluator([
    new RequirementCoverageCheck(),
    new CoreConceptCheck(),
    new ResponsibilityCheck(),
    new StructureCheck(),
    new NarrativeCheck(),
  ]);

  const llm =
    options.llm !== undefined
      ? options.llm
      : config.anthropicApiKey
        ? new AnthropicLlm({ apiKey: config.anthropicApiKey, model: config.llmModel, timeoutMs: config.llmTimeoutMs })
        : null;

  const budget = new UsageBudget(
    new SqliteUsageLedger(db),
    {
      totalCalls: config.llmTotalCalls,
      dailyCalls: config.llmDailyCalls,
      perLearnerHourly: config.llmPerLearnerHourly,
    },
    clock,
  );
  const judge: Evaluator | null = llm
    ? new CachingEvaluator(new LlmJudgeEvaluator(llm, budget), new SqliteReportCache(db), PROMPT_VERSION)
    : null;

  const pipeline = new EvaluationPipeline(rules, judge, new FeedbackAssembler(), logger);

  const queue = new InProcessQueue(config.evalConcurrency, (error) =>
    logger.error("evaluation job crashed", { error: String(error) }),
  );

  const worker = new EvaluationWorker({
    evaluations,
    submissions,
    problems,
    formats,
    rubric,
    pipeline,
    queue,
    clock,
    logger,
    leaseMs: config.llmTimeoutMs * 2,
    maxTries: 3,
    retryDelayMs: options.retryDelayMs ?? 2000,
  });

  const practice = new PracticeService({
    problems,
    formats,
    rubric,
    attempts,
    submissions,
    evaluations,
    uow: new SqliteUnitOfWork(db),
    queue,
    rules,
    clock,
    newId: uuid,
  });

  const progress = new ProgressService({ attempts, submissions, evaluations, problems, rubric });

  return {
    problems,
    rubric,
    practice,
    progress,
    worker,
    queue,
    aiEnabled: llm !== null,
    aiModel: llm?.model ?? null,
    start() {
      queue.start((id) => worker.process(id));
      const recovered = worker.recover();
      if (recovered > 0) logger.info("re-queued unfinished evaluations", { count: recovered });
    },
    stop() {
      queue.stop();
    },
  };
}
