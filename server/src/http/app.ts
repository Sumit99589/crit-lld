import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { Container } from "../container.js";
import { ConcurrencyError, DomainError, InvalidTransitionError, NotFoundError, ValidationError } from "../domain/errors.js";
import type { Logger } from "../infra/logger.js";
import { attemptDto, evaluationDto, problemSummary, submissionDto } from "./presenters.js";

const LEARNER_ID = /^[A-Za-z0-9_-]{8,64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,80}$/;

declare module "express-serve-static-core" {
  interface Request {
    learnerId: string;
  }
}

const startAttemptBody = z.object({ problemSlug: z.string().min(1).max(80) });
const draftBody = z.object({ draft: z.unknown() });

export function createApp(container: Container, logger: Logger, staticDir: string | null = null) {
  const { practice, progress, problems, rubric } = container;
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "200kb" }));

  const api = express.Router();

  api.get("/health", (_req, res) => {
    res.json({ ok: true, ai: { enabled: container.aiEnabled, model: container.aiModel } });
  });

  api.get("/rubric", (_req, res) => res.json(rubric));

  // There is no login in this prototype: the browser generates an anonymous id
  // and sends it on every request. Enough to keep one learner's history apart.
  api.use((req, res, next) => {
    const id = req.header("x-learner-id");
    if (!id || !LEARNER_ID.test(id)) {
      res.status(400).json({ error: "Missing or malformed X-Learner-Id header" });
      return;
    }
    req.learnerId = id;
    next();
  });

  api.get("/problems", (req, res) => {
    const history = progress.history(req.learnerId);
    res.json(
      problems.list().map((p) => {
        const mine = history.filter((h) => h.problemSlug === p.slug);
        const latest = mine[0];
        return {
          ...problemSummary(p),
          progress: {
            attempts: mine.length,
            latestAttemptId: latest?.attemptId ?? null,
            latestBands: latest?.revisions.at(-1)?.bands ?? null,
          },
        };
      }),
    );
  });

  api.get("/problems/:slug", (req, res) => {
    res.json(practice.problem(String(req.params.slug)));
  });

  api.post("/attempts", (req, res) => {
    const { problemSlug } = parse(startAttemptBody, req.body);
    res.status(201).json(attemptDto(practice.startAttempt(req.learnerId, problemSlug)));
  });

  api.get("/attempts/:id", (req, res) => {
    const attempt = practice.getAttempt(req.learnerId, String(req.params.id));
    const summary = progress.history(req.learnerId).find((h) => h.attemptId === attempt.id);
    res.json({ attempt: attemptDto(attempt), revisions: summary?.revisions ?? [] });
  });

  api.put("/attempts/:id/draft", (req, res) => {
    const { draft } = parse(draftBody, req.body);
    const attempt = practice.saveDraft(req.learnerId, String(req.params.id), draft);
    res.json({ savedAt: attempt.toSnapshot().updatedAt });
  });

  api.post("/attempts/:id/precheck", (req, res) => {
    const { draft } = parse(draftBody, req.body);
    res.json(practice.precheck(req.learnerId, String(req.params.id), draft));
  });

  api.post("/attempts/:id/submissions", (req, res) => {
    const { draft } = parse(draftBody, req.body);
    const key = req.header("idempotency-key");
    if (key !== undefined && !IDEMPOTENCY_KEY.test(key)) throw new ValidationError("Malformed Idempotency-Key", []);
    const result = practice.submit(req.learnerId, String(req.params.id), draft, key);
    // 202: stored and queued, feedback arrives later. 200: this exact submission already exists.
    res.status(result.created ? 202 : 200).json({
      submission: submissionDto(result.submission),
      evaluation: evaluationDto(result.evaluation),
      duplicate: !result.created,
    });
  });

  api.get("/submissions/:id", (req, res) => {
    const { submission, evaluation } = practice.getSubmission(req.learnerId, String(req.params.id));
    res.json({ submission: submissionDto(submission), evaluation: evaluationDto(evaluation) });
  });

  api.post("/submissions/:id/retry", (req, res) => {
    res.status(202).json(evaluationDto(practice.retryEvaluation(req.learnerId, String(req.params.id))));
  });

  api.get("/history", (req, res) => res.json(progress.history(req.learnerId)));
  api.get("/insights", (req, res) => res.json(progress.insights(req.learnerId)));

  app.use("/api", api);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  if (staticDir && existsSync(staticDir)) {
    const root = resolve(staticDir);
    app.use(express.static(root, { index: false, maxAge: "1h" }));
    app.use((req, res, next) => (req.method === "GET" ? res.sendFile(join(root, "index.html")) : next()));
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ValidationError) {
      res.status(422).json({ error: error.message, issues: error.issues });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else if (error instanceof InvalidTransitionError || error instanceof ConcurrencyError) {
      res.status(409).json({ error: error.message });
    } else if (error instanceof DomainError) {
      res.status(400).json({ error: error.message });
    } else if (isBodyParserError(error)) {
      res.status(error.status).json({ error: "Request body could not be read" });
    } else {
      logger.error("unhandled error", { error: error instanceof Error ? error.stack : String(error) });
      res.status(500).json({ error: "Something went wrong on our side" });
    }
  });

  return app;
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(
      "Invalid request body",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

function isBodyParserError(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "type" in error && typeof (error as { status?: unknown }).status === "number";
}
