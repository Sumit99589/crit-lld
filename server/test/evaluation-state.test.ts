import { describe, expect, it } from "vitest";
import { InvalidTransitionError } from "../src/domain/errors.js";
import { Evaluation } from "../src/domain/evaluation.js";
import type { Feedback } from "../src/domain/feedback.js";

const now = new Date("2026-10-12T10:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);

function feedback(mode: Feedback["mode"]): Feedback {
  return { rubricVersion: "x", mode, headline: "", strengths: [], nextSteps: [], criteria: [], findings: [], coverage: [] };
}

describe("Evaluation lifecycle", () => {
  it("moves queued -> running -> completed and records the attempt", () => {
    const e = Evaluation.queue({ id: "e1", submissionId: "s1", now });
    e.start(now, 1000);
    expect(e.status).toBe("running");
    expect(e.tries).toBe(1);
    e.complete(feedback("full"), later(10));
    expect(e.status).toBe("completed");
    expect(e.feedback?.mode).toBe("full");
  });

  it("refuses to complete something that never started", () => {
    const e = Evaluation.queue({ id: "e1", submissionId: "s1", now });
    expect(() => e.complete(feedback("full"), now)).toThrow(InvalidTransitionError);
  });

  it("cannot be claimed twice", () => {
    const e = Evaluation.queue({ id: "e1", submissionId: "s1", now });
    e.start(now, 1000);
    expect(() => e.start(now, 1000)).toThrow(InvalidTransitionError);
  });

  it("lets the learner retry after a failure and resets the try counter", () => {
    const e = Evaluation.queue({ id: "e1", submissionId: "s1", now });
    e.start(now, 1000);
    e.fail("boom", now);
    e.requestRetry(later(1));
    expect(e.status).toBe("queued");
    expect(e.tries).toBe(0);
  });

  it("allows asking for the AI review again only when the result was rules-only", () => {
    const degraded = Evaluation.queue({ id: "e1", submissionId: "s1", now });
    degraded.start(now, 1000);
    degraded.complete(feedback("rules_only"), now);
    expect(() => degraded.requestRetry(now)).not.toThrow();

    const full = Evaluation.queue({ id: "e2", submissionId: "s2", now });
    full.start(now, 1000);
    full.complete(feedback("full"), now);
    expect(() => full.requestRetry(now)).toThrow(InvalidTransitionError);
  });

  it("does not allow retrying while still running", () => {
    const e = Evaluation.queue({ id: "e1", submissionId: "s1", now });
    e.start(now, 1000);
    expect(() => e.requestRetry(now)).toThrow(InvalidTransitionError);
  });

  it("reports an expired lease only for running evaluations past their deadline", () => {
    const e = Evaluation.queue({ id: "e1", submissionId: "s1", now });
    expect(e.isLeaseExpired(later(10_000))).toBe(false);
    e.start(now, 1000);
    expect(e.isLeaseExpired(later(999))).toBe(false);
    expect(e.isLeaseExpired(later(1000))).toBe(true);
  });
});
