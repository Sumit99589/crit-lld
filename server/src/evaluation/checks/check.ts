import type { DesignModel } from "../../domain/design.js";
import type { BandCap, Finding, RequirementCoverage } from "../../domain/feedback.js";
import type { Problem } from "../../domain/problem.js";

export interface CheckContext {
  problem: Problem;
  model: DesignModel;
}

export interface CheckResult {
  findings: Finding[];
  caps?: BandCap[];
  coverage?: RequirementCoverage[];
}

/** A single deterministic rule. Checks never throw on odd input; they just find less. */
export interface DesignCheck {
  readonly id: string;
  run(ctx: CheckContext): CheckResult;
}

/** Does free text refer to a design element, allowing "ParkingSpot" vs "parking spot"? */
export function mentions(text: string, name: string): boolean {
  const haystack = text.toLowerCase();
  const needle = name.toLowerCase();
  if (haystack.includes(needle)) return true;
  return haystack.replace(/[\s_-]+/g, "").includes(needle.replace(/[\s_-]+/g, ""));
}

export function mentionedElements(text: string, model: DesignModel): string[] {
  return model.elements.filter((e) => mentions(text, e.name)).map((e) => e.name);
}
