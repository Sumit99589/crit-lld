import { describe, expect, it } from "vitest";
import { ConcurrencyError } from "../src/domain/errors.js";
import { LlmError } from "../src/evaluation/judge/llm.js";
import { SqliteEvaluationRepository } from "../src/infra/repositories.js";
import { FakeLlm, harness, judgeOutput, parkingCanvas } from "./helpers.js";

const LEARNER = "learner-0001";

async function submitAndSettle(h: ReturnType<typeof harness>, canvas = parkingCanvas(), attemptId?: string) {
  const id = attemptId ?? h.container.practice.startAttempt(LEARNER, "parking-lot").id;
  const result = h.container.practice.submit(LEARNER, id, canvas);
  await h.container.queue.onIdle();
  return { attemptId: id, ...h.container.practice.getSubmission(LEARNER, result.submission.id) };
}

describe("evaluation flow", () => {
  it("persists the submission, then completes with AI and rule feedback merged", async () => {
    const llm = new FakeLlm();
    const h = harness({ llm });
    const { submission, evaluation } = await submitAndSettle(h);

    expect(submission.revision).toBe(1);
    expect(evaluation.status).toBe("completed");
    expect(evaluation.feedback).toMatchObject({ mode: "full", usage: { model: "fake-model", cached: false } });
    expect(evaluation.feedback!.criteria.find((c) => c.criterion === "behaviour")!.evidence[0]!.verified).toBe(true);
    expect(llm.calls[0]).toContain("<verified_facts>");
  });

  it("falls back to rules-only feedback when the model is rate limited, and upgrades on retry", async () => {
    const llm = new FakeLlm([new LlmError("rate_limited", "slow down"), judgeOutput()]);
    const h = harness({ llm });
    const { submission, evaluation } = await submitAndSettle(h);

    expect(evaluation.status).toBe("completed");
    expect(evaluation.feedback).toMatchObject({ mode: "rules_only", degradedReason: "slow down" });
    expect(evaluation.feedback!.criteria.every((c) => c.source === "rules" && c.band <= 3)).toBe(true);

    h.container.practice.retryEvaluation(LEARNER, submission.id);
    await h.container.queue.onIdle();
    expect(h.container.practice.getSubmission(LEARNER, submission.id).evaluation.feedback?.mode).toBe("full");
  });

  it("works with AI switched off entirely", async () => {
    const h = harness({ llm: null });
    const { evaluation } = await submitAndSettle(h);
    expect(evaluation.feedback).toMatchObject({
      mode: "rules_only",
      degradedReason: expect.stringContaining("isn't configured"),
    });
  });

  it("degrades instead of failing when the model returns nothing usable", async () => {
    const h = harness({ llm: new FakeLlm([{ criteria: [], strengths: [], next_steps: [], headline: "" }]) });
    const { evaluation } = await submitAndSettle(h);
    expect(evaluation.feedback?.mode).toBe("rules_only");
  });

  it("does not pay twice for the same design", async () => {
    const llm = new FakeLlm();
    const h = harness({ llm });
    await submitAndSettle(h);
    const second = await submitAndSettle(h);
    expect(llm.calls).toHaveLength(1);
    expect(second.evaluation.feedback?.usage?.cached).toBe(true);
  });

  it("stops calling the model once a learner's hourly budget is used", async () => {
    const llm = new FakeLlm();
    const h = harness({ llm, config: { llmPerLearnerHourly: 1 } });
    await submitAndSettle(h);
    const changed = parkingCanvas();
    changed.assumptions += " Vans never use compact spots.";
    const second = await submitAndSettle(h, changed);
    expect(llm.calls).toHaveLength(1);
    expect(second.evaluation.feedback).toMatchObject({
      mode: "rules_only",
      degradedReason: expect.stringContaining("this hour"),
    });
  });

  it("compares a revision with the one before it", async () => {
    const h = harness({ llm: new FakeLlm([judgeOutput({ extensibility: 2 }), judgeOutput({ extensibility: 3 })]) });
    const weaker = parkingCanvas();
    weaker.assumptions = "";
    const first = await submitAndSettle(h, weaker);
    const second = await submitAndSettle(h, parkingCanvas(), first.attemptId);

    expect(second.submission.revision).toBe(2);
    const comparison = second.evaluation.feedback!.comparison!;
    expect(comparison.previousRevision).toBe(1);
    expect(comparison.resolved.map((f) => f.code)).toContain("NO_ASSUMPTIONS");
    expect(comparison.bandChanges).toContainEqual({ criterion: "extensibility", from: 2, to: 3 });
  });

  it("retries an evaluation that crashes, then fails it while keeping the submission", async () => {
    const h = harness({ start: false });
    const attempt = h.container.practice.startAttempt(LEARNER, "parking-lot");
    const { submission } = h.container.practice.submit(LEARNER, attempt.id, parkingCanvas());
    // Corrupt the stored design so every evaluation attempt throws.
    h.db
      .prepare("UPDATE submissions SET content = ? WHERE id = ?")
      .run(JSON.stringify({ entities: "nope" }), submission.id);

    h.container.start();
    await waitFor(() => h.container.practice.getSubmission(LEARNER, submission.id).evaluation.status === "failed");
    const { evaluation } = h.container.practice.getSubmission(LEARNER, submission.id);
    expect(evaluation.tries).toBe(3);
    expect(evaluation.lastError).toContain("Your design is saved");
  });

  it("re-queues an evaluation whose worker died mid-run", async () => {
    const h = harness({ start: false });
    const attempt = h.container.practice.startAttempt(LEARNER, "parking-lot");
    const { evaluation } = h.container.practice.submit(LEARNER, attempt.id, parkingCanvas());

    const repo = new SqliteEvaluationRepository(h.db);
    const stuck = repo.find(evaluation.id)!;
    stuck.start(h.clock.now(), 1000);
    repo.update(stuck);
    h.clock.advance(5000);

    h.container.start();
    await h.container.queue.onIdle();
    expect(repo.find(evaluation.id)!.status).toBe("completed");
  });

  it("lets only one of two concurrent claims win", () => {
    const h = harness({ start: false });
    const attempt = h.container.practice.startAttempt(LEARNER, "parking-lot");
    const { evaluation } = h.container.practice.submit(LEARNER, attempt.id, parkingCanvas());

    const repo = new SqliteEvaluationRepository(h.db);
    const a = repo.find(evaluation.id)!;
    const b = repo.find(evaluation.id)!;
    a.start(h.clock.now(), 1000);
    b.start(h.clock.now(), 1000);
    repo.update(a);
    expect(() => repo.update(b)).toThrow(ConcurrencyError);
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 5));
  }
}
