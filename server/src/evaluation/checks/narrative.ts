import type { BandCap, Finding } from "../../domain/feedback.js";
import { mentionedElements, type CheckContext, type CheckResult, type DesignCheck } from "./check.js";

const FAILURE_WORDS =
  /\b(fail\w*|error\w*|invalid|reject\w*|full|empty|unavailable|insufficient|timeout|time out|retry|cancel\w*|refund\w*|concurren\w*|race|lock\w*|exception\w*|out of|not enough|edge case\w*|overflow|duplicate\w*|expired?|already|missing|denied|declined|no change)\b/i;

const PATTERNS = [
  "strategy",
  "state pattern",
  "observer",
  "factory",
  "singleton",
  "decorator",
  "builder",
  "command pattern",
  "chain of responsibility",
  "adapter",
  "facade",
  "template method",
  "visitor",
];

const JUSTIFICATION =
  /\b(because|so that|since|trade-?off|instead of|otherwise|at the cost|downside|lets? (us|me)|allows?|avoids?|without (changing|touching|modifying))\b/i;

function label(pattern: string): string {
  return pattern.endsWith("pattern") ? `the ${pattern}` : `the ${pattern} pattern`;
}

/** Checks on the written parts: assumptions, key flow, decisions, response to change. */
export class NarrativeCheck implements DesignCheck {
  readonly id = "narrative";

  run({ problem, model }: CheckContext): CheckResult {
    const findings: Finding[] = [];
    const caps: BandCap[] = [];
    const { assumptions, keyFlow, decisions, changeResponse } = model.narrative;

    if (!assumptions) {
      findings.push({
        code: "NO_ASSUMPTIONS",
        criterion: "requirements",
        severity: "minor",
        message: "You didn't state any assumptions.",
        suggestion: "Every brief leaves something open. Write down the 2-3 decisions you made about scope.",
      });
    }

    if (changeResponse.length < 40) {
      findings.push({
        code: "CHANGE_NOT_ADDRESSED",
        criterion: "extensibility",
        severity: "major",
        message: `The change scenario ("${problem.changeScenario.title}") isn't really addressed.`,
        suggestion: "Explain which classes you would add, which existing ones would change, and why.",
      });
      caps.push({
        criterion: "extensibility",
        maxBand: changeResponse.length === 0 ? 1 : 2,
        reason: "The response to the change scenario is missing or very short.",
      });
    } else if (mentionedElements(changeResponse, model).length === 0) {
      findings.push({
        code: "CHANGE_NOT_GROUNDED",
        criterion: "extensibility",
        severity: "minor",
        message: "Your response to the change doesn't name any of your classes.",
        suggestion: "Ground it in the design: which of your classes absorb the change, and what new ones appear?",
      });
    }

    const flowActors = mentionedElements(keyFlow, model);
    if (keyFlow && flowActors.length < 2) {
      findings.push({
        code: "FLOW_NOT_GROUNDED",
        criterion: "behaviour",
        severity: "minor",
        message: "The key flow barely uses the classes you defined.",
        suggestion: 'Describe the flow as calls between your objects, e.g. "Gate asks SpotAllocator for a spot".',
      });
    }

    if (!FAILURE_WORDS.test(`${keyFlow}\n${decisions}\n${assumptions}`)) {
      findings.push({
        code: "NO_FAILURE_CASES",
        criterion: "behaviour",
        severity: "minor",
        message: "Nothing in the design mentions what happens when something goes wrong.",
        suggestion: "Pick the most likely failure for this problem and show which object detects it and what it does.",
      });
      caps.push({ criterion: "behaviour", maxBand: 2, reason: "No failure or edge case is described." });
    }

    if (!decisions) {
      findings.push({
        code: "NO_DECISIONS",
        criterion: "abstraction",
        severity: "minor",
        message: "You didn't explain any design decision or trade-off.",
        suggestion: "Name one choice you made, the alternative you rejected, and why.",
      });
    } else {
      const sentences = decisions.split(/(?<=[.!?])\s+|\n+/);
      for (const pattern of PATTERNS) {
        const re = new RegExp(`\\b${pattern}\\b`, "i");
        const hits = sentences.filter((s) => re.test(s));
        if (hits.length > 0 && !hits.some((s) => JUSTIFICATION.test(s))) {
          findings.push({
            code: "PATTERN_UNJUSTIFIED",
            criterion: "abstraction",
            severity: "note",
            subject: pattern,
            message: `You mention ${label(pattern)} without saying what it buys you here.`,
            suggestion: `Add one line on why ${label(pattern)} fits this problem and what it costs.`,
          });
        }
      }
    }

    if (
      /\bsingleton\b/i.test(`${decisions}\n${keyFlow}`) ||
      model.elements.some((e) => /getinstance/i.test(e.methods.join(" ")))
    ) {
      findings.push({
        code: "SINGLETON_USED",
        criterion: "abstraction",
        severity: "note",
        message: "The design relies on a singleton.",
        suggestion:
          "Singletons make testing and running two instances side by side harder. Consider passing the instance in instead.",
      });
    }

    return { findings, caps };
  }
}
