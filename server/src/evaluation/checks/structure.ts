import { findElement, relationsOf, sameName, type DesignModel } from "../../domain/design.js";
import type { BandCap, Finding } from "../../domain/feedback.js";
import { mentions, type CheckContext, type CheckResult, type DesignCheck } from "./check.js";

const HUB_THRESHOLD = 5;

/** Checks on the shape of the class graph: connectivity, abstractions, coupling. */
export class StructureCheck implements DesignCheck {
  readonly id = "structure";

  run({ model }: CheckContext): CheckResult {
    const findings: Finding[] = [];
    const caps: BandCap[] = [];

    for (const e of model.elements) {
      if (relationsOf(model, e.name).length === 0 && e.kind !== "enum") {
        findings.push({
          code: "ORPHAN_ELEMENT",
          criterion: "relationships",
          severity: "minor",
          subject: e.name,
          message: `${e.name} isn't connected to any other class.`,
          suggestion: `Show who creates, owns or calls ${e.name}, or remove it if nothing does.`,
        });
      }
    }

    for (const e of model.elements.filter((x) => x.kind === "interface" || x.kind === "abstract")) {
      const realisers = model.relations.filter(
        (r) => sameName(r.to, e.name) && (r.type === "implements" || r.type === "inherits"),
      );
      if (realisers.length === 0) {
        findings.push({
          code: "UNREALISED_ABSTRACTION",
          criterion: "abstraction",
          severity: "minor",
          subject: e.name,
          message: `${e.name} is ${e.kind === "interface" ? "an interface" : "abstract"}, but nothing implements or extends it.`,
          suggestion: `Add at least one concrete ${e.name}, or explain what the abstraction is waiting for.`,
        });
      } else if (realisers.length === 1 && e.kind === "interface") {
        const explained = mentions(`${model.narrative.decisions}\n${model.narrative.changeResponse}`, e.name);
        if (!explained) {
          findings.push({
            code: "SINGLE_IMPLEMENTATION",
            criterion: "abstraction",
            severity: "note",
            subject: e.name,
            message: `${e.name} has a single implementation and isn't mentioned in your decisions.`,
            suggestion: `Say what variation ${e.name} protects against (another implementation, testing seam), or inline it.`,
          });
        }
      }
    }

    for (const r of model.relations) {
      const target = findElement(model, r.to);
      if (!target) continue;
      if (r.type === "implements" && target.kind !== "interface") {
        findings.push({
          code: "IMPLEMENTS_NON_INTERFACE",
          criterion: "relationships",
          severity: "minor",
          subject: `${r.from}->${r.to}`,
          message: `${r.from} "implements" ${r.to}, but ${r.to} is ${target.kind === "abstract" ? "an abstract class" : `a${target.kind === "enum" ? "n" : ""} ${target.kind}`}.`,
          suggestion: target.kind === "abstract" ? `Use "inherits" for ${r.to}, or make it an interface.` : `Either make ${r.to} an interface or change the relationship type.`,
        });
      }
      if (r.type === "inherits" && target.kind === "interface") {
        findings.push({
          code: "INHERITS_INTERFACE",
          criterion: "relationships",
          severity: "note",
          subject: `${r.from}->${r.to}`,
          message: `${r.from} "inherits" from the interface ${r.to}.`,
          suggestion: `Use "implements" unless ${r.from} is itself an interface extending ${r.to}.`,
        });
      }
    }

    // Fan-out ignores inheritance: depending on many collaborators is the smell, not having a parent.
    for (const e of model.elements) {
      const outgoing = new Set(
        model.relations
          .filter((r) => sameName(r.from, e.name) && r.type !== "inherits" && r.type !== "implements")
          .map((r) => r.to.toLowerCase()),
      );
      if (outgoing.size >= HUB_THRESHOLD) {
        findings.push({
          code: "HIGH_FAN_OUT",
          criterion: "relationships",
          severity: "minor",
          subject: e.name,
          message: `${e.name} depends directly on ${outgoing.size} other classes.`,
          suggestion: `Group some of ${e.name}'s collaborators behind a smaller interface or move work to them.`,
        });
      }
    }

    const cycle = findCompositionCycle(model);
    if (cycle) {
      findings.push({
        code: "COMPOSITION_CYCLE",
        criterion: "relationships",
        severity: "major",
        subject: cycle.join("->"),
        message: `Ownership loops back on itself: ${cycle.join(" → ")}. A part cannot own its owner.`,
        suggestion: "Decide which side owns the other and turn the reverse link into an association.",
      });
      caps.push({ criterion: "relationships", maxBand: 2, reason: "The composition graph contains a cycle." });
    }

    const abstractions = model.elements.filter((e) => e.kind === "interface" || e.kind === "abstract");
    if (abstractions.length === 0 && model.elements.length >= 5) {
      findings.push({
        code: "NO_ABSTRACTIONS",
        criterion: "abstraction",
        severity: "note",
        message: "The design has no interfaces or abstract classes.",
        suggestion: "That can be fine, but look at the change scenario: whatever varies there is usually where an abstraction pays off.",
      });
    }

    return { findings, caps };
  }
}

function findCompositionCycle(model: DesignModel): string[] | null {
  const edges = new Map<string, string[]>();
  for (const r of model.relations) {
    if (r.type !== "composes" && r.type !== "aggregates") continue;
    const list = edges.get(r.from) ?? [];
    list.push(r.to);
    edges.set(r.from, list);
  }

  const visiting = new Set<string>();
  const done = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    if (visiting.has(node)) return [...stack.slice(stack.indexOf(node)), node];
    if (done.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      const found = visit(next);
      if (found) return found;
    }
    stack.pop();
    visiting.delete(node);
    done.add(node);
    return null;
  };

  for (const node of edges.keys()) {
    const found = visit(node);
    if (found) return found;
  }
  return null;
}
