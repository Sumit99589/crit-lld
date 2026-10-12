import { describe, expect, it } from "vitest";
import type { CriterionAssessment } from "../src/domain/feedback.js";
import { LLD_RUBRIC, type CriterionId } from "../src/domain/rubric.js";
import { EvidenceVerifier } from "../src/evaluation/evidence.js";
import type { EvaluatorReport } from "../src/evaluation/evaluator.js";
import { FeedbackAssembler } from "../src/evaluation/feedbackAssembler.js";
import { compareRevisions } from "../src/evaluation/revisionComparer.js";

const rendered = `## Key flow
SpotAllocator scans each Floor for a free spot and calls occupy() under a lock, so a concurrent request gets a different spot.`;

function assessment(criterion: CriterionId, band: 1 | 2 | 3 | 4, source: "ai" | "rules", evidence: string[] = []): CriterionAssessment {
  return { criterion, band, source, evidence: evidence.map((text) => ({ text, verified: false })), concern: "c", suggestion: "s", confidence: "high" };
}

function report(source: "ai" | "rules", band: 1 | 2 | 3 | 4, evidence: string[] = []): EvaluatorReport {
  return {
    evaluatorId: source,
    assessments: LLD_RUBRIC.criteria.map((c) => assessment(c.id, band, source, evidence)),
    findings: [],
    caps: [],
  };
}

describe("EvidenceVerifier", () => {
  const verifier = new EvidenceVerifier(rendered);

  it("matches exact quotes regardless of case, quotes and whitespace", () => {
    expect(verifier.verify("calls  OCCUPY() under a lock")).toBe(true);
    expect(verifier.verify("“so a concurrent request gets a different spot”")).toBe(true);
  });

  it("matches elided quotes piece by piece, in order", () => {
    expect(verifier.verify("SpotAllocator scans ... under a lock")).toBe(true);
    expect(verifier.verify("under a lock ... SpotAllocator scans")).toBe(false);
  });

  it("rejects paraphrases and empty quotes", () => {
    expect(verifier.verify("the allocator locks the spot")).toBe(false);
    expect(verifier.verify(" ... ")).toBe(false);
  });
});

describe("FeedbackAssembler", () => {
  const assembler = new FeedbackAssembler();

  it("prefers the judge's verdict and keeps rule findings", () => {
    const rules = report("rules", 2);
    rules.findings.push({ code: "ORPHAN_ELEMENT", criterion: "relationships", severity: "minor", message: "m" });
    const feedback = assembler.assemble({ rubric: LLD_RUBRIC, rendered, rules, judge: report("ai", 3, ["under a lock"]) });
    expect(feedback.mode).toBe("full");
    expect(feedback.criteria.every((c) => c.source === "ai" && c.band === 3)).toBe(true);
    expect(feedback.findings).toHaveLength(1);
  });

  it("lets a deterministic cap override an optimistic judge and says why", () => {
    const rules = report("rules", 2);
    rules.caps.push({ criterion: "extensibility", maxBand: 1, reason: "Change scenario not answered." });
    const feedback = assembler.assemble({ rubric: LLD_RUBRIC, rendered, rules, judge: report("ai", 4, ["under a lock"]) });
    const ext = feedback.criteria.find((c) => c.criterion === "extensibility")!;
    expect(ext).toMatchObject({ band: 1, cappedFrom: 4, capReason: "Change scenario not answered." });
  });

  it("drops confidence when a high band cites nothing that is really in the submission", () => {
    const feedback = assembler.assemble({ rubric: LLD_RUBRIC, rendered, rules: report("rules", 2), judge: report("ai", 4, ["an invented quote"]) });
    expect(feedback.criteria[0]).toMatchObject({ band: 4, confidence: "low" });
    expect(feedback.criteria[0]!.evidence[0]!.verified).toBe(false);
  });

  it("falls back to rule assessments for criteria the judge skipped", () => {
    const judge = report("ai", 3, ["under a lock"]);
    judge.assessments = judge.assessments.filter((a) => a.criterion !== "behaviour");
    const feedback = assembler.assemble({ rubric: LLD_RUBRIC, rendered, rules: report("rules", 2), judge });
    expect(feedback.criteria.find((c) => c.criterion === "behaviour")?.source).toBe("rules");
  });

  it("produces complete rules-only feedback with the reason when there is no judge", () => {
    const rules = report("rules", 2);
    rules.findings.push({ code: "NO_FAILURE_CASES", criterion: "behaviour", severity: "minor", message: "m", suggestion: "Add a failure case." });
    const feedback = assembler.assemble({ rubric: LLD_RUBRIC, rendered, rules, degradedReason: "Budget used up." });
    expect(feedback).toMatchObject({ mode: "rules_only", degradedReason: "Budget used up.", nextSteps: ["Add a failure case."] });
    expect(feedback.criteria).toHaveLength(LLD_RUBRIC.criteria.length);
  });
});

describe("compareRevisions", () => {
  it("reports band changes and which findings were fixed, kept or introduced", () => {
    const assembler = new FeedbackAssembler();
    const before = report("rules", 2);
    before.findings.push(
      { code: "ORPHAN_ELEMENT", criterion: "relationships", severity: "minor", subject: "Board", message: "a" },
      { code: "NO_ASSUMPTIONS", criterion: "requirements", severity: "minor", message: "b" },
    );
    const after = report("rules", 3);
    after.findings.push(
      { code: "NO_ASSUMPTIONS", criterion: "requirements", severity: "minor", message: "b" },
      { code: "HIGH_FAN_OUT", criterion: "relationships", severity: "minor", subject: "Lot", message: "c" },
    );
    const diff = compareRevisions(
      assembler.assemble({ rubric: LLD_RUBRIC, rendered, rules: before }),
      1,
      assembler.assemble({ rubric: LLD_RUBRIC, rendered, rules: after }),
    );
    expect(diff.bandChanges).toHaveLength(LLD_RUBRIC.criteria.length);
    expect(diff.resolved.map((f) => f.code)).toEqual(["ORPHAN_ELEMENT"]);
    expect(diff.persisting.map((f) => f.code)).toEqual(["NO_ASSUMPTIONS"]);
    expect(diff.introduced.map((f) => f.code)).toEqual(["HIGH_FAN_OUT"]);
  });
});
