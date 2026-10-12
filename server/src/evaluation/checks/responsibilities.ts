import type { Finding } from "../../domain/feedback.js";
import type { CheckContext, CheckResult, DesignCheck } from "./check.js";

const MANAGER_NAME = /(manager|controller|system|service|handler|helper|util|utils)$/i;
const VAGUE = /^(handles|manages|deals with|takes care of|does|controls)\b.{0,20}$/i;
const GOD_METHOD_COUNT = 9;

function clauseCount(text: string): number {
  return (text.match(/\band\b|,|;/gi) ?? []).length;
}

export class ResponsibilityCheck implements DesignCheck {
  readonly id = "responsibilities";

  run({ model }: CheckContext): CheckResult {
    const findings: Finding[] = [];

    for (const e of model.elements) {
      if (e.kind === "enum") continue;

      const signals: string[] = [];
      if (e.methods.length >= GOD_METHOD_COUNT) signals.push(`${e.methods.length} methods`);
      if (clauseCount(e.responsibility) >= 3) signals.push("a responsibility that lists several jobs");
      if (MANAGER_NAME.test(e.name.replace(/\s/g, "")) && e.methods.length >= 6)
        signals.push(`a catch-all name ("${e.name}")`);

      if (signals.length > 0) {
        findings.push({
          code: "GOD_CLASS",
          criterion: "responsibilities",
          severity: signals.length >= 2 ? "major" : "minor",
          subject: e.name,
          message: `${e.name} shows signs of doing too much: ${signals.join(", ")}.`,
          suggestion: `Split ${e.name} along its separate reasons to change, and give each piece one sentence of responsibility.`,
        });
      }

      if (e.responsibility.length < 25 || VAGUE.test(e.responsibility)) {
        findings.push({
          code: "VAGUE_RESPONSIBILITY",
          criterion: "responsibilities",
          severity: "note",
          subject: e.name,
          message: `${e.name}'s responsibility ("${e.responsibility}") is too vague to judge.`,
          suggestion: `Describe what ${e.name} decides or guarantees, not just that it "handles" something.`,
        });
      }

      if (e.kind === "class" && e.attributes.length >= 2 && e.methods.length === 0) {
        findings.push({
          code: "DATA_ONLY_CLASS",
          criterion: "responsibilities",
          severity: "note",
          subject: e.name,
          message: `${e.name} has data but no behaviour.`,
          suggestion: `If any rule depends only on ${e.name}'s data (validation, state changes, calculations), move it into ${e.name}.`,
        });
      }
    }

    return { findings };
  }
}
