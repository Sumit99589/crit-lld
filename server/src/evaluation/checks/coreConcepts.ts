import type { Finding } from "../../domain/feedback.js";
import { mentions, type CheckContext, type CheckResult, type DesignCheck } from "./check.js";

/**
 * Soft check: does anything in the design represent the problem's core
 * concepts? Reported as a note and phrased as a question, because a valid
 * design may fold a concept into an attribute or name it differently.
 */
export class CoreConceptCheck implements DesignCheck {
  readonly id = "core-concepts";

  run({ problem, model }: CheckContext): CheckResult {
    const corpus = model.elements
      .map((e) => [e.name, e.responsibility, ...e.attributes, ...e.methods].join(" "))
      .join("\n");

    const findings: Finding[] = problem.coreConcepts
      .filter((concept) => ![concept.name, ...concept.aliases].some((alias) => mentions(corpus, alias)))
      .map((concept) => ({
        code: "CONCEPT_NOT_FOUND",
        criterion: "requirements",
        severity: "note",
        subject: concept.name,
        message: `We couldn't find anything that represents "${concept.name}". ${concept.whyItMatters}`,
        suggestion: `If you handle ${concept.name.toLowerCase()} under another name or inside another class, say so in your assumptions. Otherwise consider modelling it.`,
      }));

    return { findings };
  }
}
