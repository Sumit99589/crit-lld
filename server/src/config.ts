import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// server/src or server/dist -> repo root -> web/dist
const BUILT_WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

export interface Config {
  port: number;
  databasePath: string;
  anthropicApiKey: string | null;
  llmModel: string;
  llmTimeoutMs: number;
  llmDailyCalls: number;
  llmPerLearnerHourly: number;
  evalConcurrency: number;
  staticDir: string | null;
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: int(env.PORT, 4000),
    databasePath: env.DATABASE_PATH ?? "./data/crit.db",
    anthropicApiKey: env.AI_REVIEW === "off" ? null : env.ANTHROPIC_API_KEY || null,
    // The cheapest current model is plenty for rubric-guided review.
    llmModel: env.LLM_MODEL ?? "claude-haiku-5-5",
    llmTimeoutMs: int(env.LLM_TIMEOUT_MS, 45_000),
    llmDailyCalls: int(env.LLM_DAILY_CALLS, 200),
    llmPerLearnerHourly: int(env.LLM_PER_LEARNER_HOURLY, 10),
    evalConcurrency: int(env.EVAL_CONCURRENCY, 2),
    staticDir: env.STATIC_DIR ?? (existsSync(BUILT_WEB) ? BUILT_WEB : null),
  };
}
