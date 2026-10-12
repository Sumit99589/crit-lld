import type { BandCap, CriterionAssessment, Feedback, Finding } from "../domain/feedback.js";
import { bySeverity } from "../domain/feedback.js";
import type { Band, Rubric } from "../domain/rubric.js";
import { EvidenceVerifier } from "./evidence.js";
import type { EvaluatorReport } from "./evaluator.js";

export interface AssembleInput {
  rubric: Rubric;
  rendered: string;
  rules: EvaluatorReport;
  judge?: EvaluatorReport;
  degradedReason?: string;
}

/**
 * Merge policy, in one place:
 *  1. Per criterion, the judge's assessment wins over the rules' estimate when present.
 *  2. Every evidence quote is checked against the submission. A judge verdict of
 *     Solid or better with no verifiable evidence is downgraded to low confidence.
 *  3. Deterministic caps override any band above them (e.g. extensibility cannot
 *     be Strong if the change scenario was never answered), with the reason shown.
 *  4. Findings from rules are always shown, whatever the judge said.
 */
export class FeedbackAssembler {
  assemble(input: AssembleInput): Feedback {
    const { rubric, rules, judge } = input;
    const verifier = new EvidenceVerifier(input.rendered);
    const caps = [...rules.caps, ...(judge?.caps ?? [])];

    const criteria = rubric.criteria.map((criterion) => {
      const chosen =
        judge?.assessments.find((a) => a.criterion === criterion.id) ??
        rules.assessments.find((a) => a.criterion === criterion.id);
      if (!chosen) throw new Error(`No assessment for criterion ${criterion.id}`);
      return applyCaps(withVerifiedEvidence(chosen, verifier), caps);
    });

    const findings = [...rules.findings, ...(judge?.findings ?? [])].sort(bySeverity);

    return {
      rubricVersion: rubric.version,
      mode: judge ? "full" : "rules_only",
      ...(judge ? {} : { degradedReason: input.degradedReason ?? "AI review was not available." }),
      headline: judge?.headline || rulesHeadline(findings),
      strengths: judge?.strengths ?? [],
      nextSteps: judge?.nextSteps?.length ? judge.nextSteps : rulesNextSteps(findings),
      criteria,
      findings,
      coverage: rules.coverage ?? [],
      ...(judge?.usage ? { usage: judge.usage } : {}),
    };
  }
}

function withVerifiedEvidence(a: CriterionAssessment, verifier: EvidenceVerifier): CriterionAssessment {
  const evidence = verifier.verifyAll(a.evidence);
  const grounded = evidence.some((e) => e.verified);
  const confidence = a.source === "ai" && a.band >= 3 && !grounded ? "low" : a.confidence;
  return { ...a, evidence, confidence };
}

function applyCaps(a: CriterionAssessment, caps: BandCap[]): CriterionAssessment {
  const relevant = caps.filter((c) => c.criterion === a.criterion);
  if (relevant.length === 0) return a;
  const tightest = relevant.reduce((min, c) => (c.maxBand < min.maxBand ? c : min));
  if (a.band <= tightest.maxBand) return a;
  return { ...a, band: tightest.maxBand as Band, cappedFrom: a.band, capReason: tightest.reason };
}

function rulesHeadline(findings: Finding[]): string {
  const majors = findings.filter((f) => f.severity === "major").length;
  const minors = findings.filter((f) => f.severity === "minor").length;
  if (majors + minors === 0)
    return "No structural problems found. An AI review would judge the quality of your reasoning.";
  const parts = [
    majors && `${majors} major issue${majors > 1 ? "s" : ""}`,
    minors && `${minors} smaller one${minors > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return `Rule-based review found ${parts.join(" and ")} to look at.`;
}

function rulesNextSteps(findings: Finding[]): string[] {
  return findings
    .filter((f) => f.suggestion && f.severity !== "note")
    .slice(0, 3)
    .map((f) => f.suggestion!);
}
