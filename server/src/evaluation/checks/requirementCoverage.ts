import { findElement } from "../../domain/design.js";
import type { BandCap, Finding, RequirementCoverage } from "../../domain/feedback.js";
import type { CheckContext, CheckResult, DesignCheck } from "./check.js";

/**
 * Uses the learner's own requirement -> class mapping. This is the one place a
 * deterministic check can say something firm about requirements, because the
 * learner declared the mapping themselves.
 */
export class RequirementCoverageCheck implements DesignCheck {
  readonly id = "requirement-coverage";

  run({ problem, model }: CheckContext): CheckResult {
    const findings: Finding[] = [];
    const caps: BandCap[] = [];
    const coverage: RequirementCoverage[] = problem.requirements.map((req) => {
      const mapped = model.traceability[req.id] ?? [];
      const valid = mapped.filter((name) => findElement(model, name));
      const status = valid.length > 0 ? "covered" : mapped.length > 0 ? "broken" : "unmapped";
      return { requirementId: req.id, text: req.text, mappedTo: valid, status };
    });

    const uncovered = coverage.filter((c) => c.status !== "covered");
    const total = problem.requirements.length;

    if (uncovered.length === total && total > 0) {
      findings.push({
        code: "REQ_MAP_EMPTY",
        criterion: "requirements",
        severity: "major",
        message:
          "No requirement is mapped to a class yet, so there is no way to tell which part of the design satisfies what.",
        suggestion: "Fill in the requirement map: for each requirement, pick the classes that make it happen.",
      });
      caps.push({ criterion: "requirements", maxBand: 2, reason: "No requirement is mapped to the design." });
    } else {
      for (const c of uncovered) {
        findings.push({
          code: "REQ_UNMAPPED",
          criterion: "requirements",
          severity: "major",
          subject: c.requirementId,
          message: `${c.requirementId} ("${c.text}") isn't mapped to any class.`,
          suggestion: `Decide which class owns ${c.requirementId}. If none does, that's a missing responsibility.`,
        });
      }
      const ratio = total === 0 ? 1 : (total - uncovered.length) / total;
      if (ratio < 0.6) {
        caps.push({
          criterion: "requirements",
          maxBand: 2,
          reason: `Only ${total - uncovered.length} of ${total} requirements are mapped.`,
        });
      } else if (uncovered.length > 0) {
        caps.push({
          criterion: "requirements",
          maxBand: 3,
          reason: `${uncovered.length} requirement(s) are not mapped to any class.`,
        });
      }
    }

    // One class carrying most requirements is a cohesion smell worth surfacing.
    if (total >= 4) {
      const load = new Map<string, number>();
      for (const c of coverage) for (const name of c.mappedTo) load.set(name, (load.get(name) ?? 0) + 1);
      for (const [name, count] of load) {
        if (count > total / 2 && count >= 3) {
          findings.push({
            code: "REQ_CONCENTRATED",
            criterion: "responsibilities",
            severity: "minor",
            subject: name,
            message: `${name} is mapped to ${count} of ${total} requirements, which suggests it is doing several jobs.`,
            suggestion: `Check whether some of ${name}'s requirements belong to a smaller, dedicated class.`,
          });
        }
      }
    }

    return { findings, caps, coverage };
  }
}
