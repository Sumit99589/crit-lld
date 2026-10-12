import { z } from "zod";
import { ELEMENT_KINDS, RELATION_TYPES, type DesignModel } from "../domain/design.js";
import type { ValidationIssue } from "../domain/errors.js";
import type { ParseResult, SubmissionFormat } from "../domain/format.js";

// The canvas is a structured text format: enough structure for deterministic
// checks (classes, relationships, requirement mapping), enough free text for a
// reviewer to judge reasoning (flow, decisions, response to change).

const entitySchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().max(60),
  kind: z.enum(ELEMENT_KINDS),
  responsibility: z.string().max(600),
  attributes: z.string().max(1200).default(""),
  methods: z.string().max(1500).default(""),
});

const relationshipSchema = z.object({
  id: z.string().min(1).max(40),
  from: z.string().max(40),
  to: z.string().max(40),
  type: z.enum(RELATION_TYPES),
  label: z.string().max(120).default(""),
});

export const designCanvasSchema = z.object({
  assumptions: z.string().max(3000).default(""),
  entities: z.array(entitySchema).max(40).default([]),
  relationships: z.array(relationshipSchema).max(100).default([]),
  /** requirement id -> entity ids */
  requirementMap: z.record(z.string().max(20), z.array(z.string().max(40)).max(20)).default({}),
  keyFlow: z.string().max(4000).default(""),
  decisions: z.string().max(3000).default(""),
  changeResponse: z.string().max(3000).default(""),
});

export type DesignCanvas = z.infer<typeof designCanvasSchema>;
export type CanvasEntity = DesignCanvas["entities"][number];

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_ ]*$/;
export const MIN_ENTITIES = 3;
const MIN_RESPONSIBILITY = 12;
const MIN_FLOW = 60;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function isBlank(e: CanvasEntity): boolean {
  return !e.name && !e.responsibility.trim() && !e.attributes.trim() && !e.methods.trim();
}

export class DesignCanvasFormat implements SubmissionFormat<DesignCanvas> {
  readonly id = "design-canvas@1";

  parse(raw: unknown): ParseResult<DesignCanvas> {
    const result = designCanvasSchema.safeParse(raw ?? {});
    if (result.success) return { ok: true, value: result.data };
    return {
      ok: false,
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }

  submissionIssues(canvas: DesignCanvas): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const entities = canvas.entities.filter((e) => !isBlank(e));
    const seen = new Set<string>();

    entities.forEach((e, i) => {
      const path = `entities.${i}`;
      if (!e.name) {
        issues.push({ path: `${path}.name`, message: "Every class needs a name." });
        return;
      }
      if (!NAME_PATTERN.test(e.name)) {
        issues.push({
          path: `${path}.name`,
          message: `"${e.name}" should start with a letter and use letters, digits or spaces.`,
        });
      }
      const key = e.name.toLowerCase();
      if (seen.has(key)) issues.push({ path: `${path}.name`, message: `"${e.name}" is defined twice.` });
      seen.add(key);
      if (e.responsibility.trim().length < MIN_RESPONSIBILITY) {
        issues.push({
          path: `${path}.responsibility`,
          message: `Say what ${e.name} is responsible for, in a sentence.`,
        });
      }
    });

    if (entities.length < MIN_ENTITIES) {
      issues.push({ path: "entities", message: `Describe at least ${MIN_ENTITIES} classes or interfaces.` });
    }

    const ids = new Set(entities.map((e) => e.id));
    if (canvas.relationships.length === 0) {
      issues.push({ path: "relationships", message: "Add at least one relationship between your classes." });
    }
    canvas.relationships.forEach((r, i) => {
      if (!ids.has(r.from) || !ids.has(r.to)) {
        issues.push({
          path: `relationships.${i}`,
          message: "This relationship points at a class that no longer exists.",
        });
      }
    });

    if (canvas.keyFlow.trim().length < MIN_FLOW) {
      issues.push({ path: "keyFlow", message: "Walk through at least one key flow step by step." });
    }
    return issues;
  }

  toModel(canvas: DesignCanvas): DesignModel {
    const entities = canvas.entities.filter((e) => e.name);
    const nameOf = new Map(entities.map((e) => [e.id, e.name]));

    const traceability: Record<string, string[]> = {};
    for (const [reqId, entityIds] of Object.entries(canvas.requirementMap)) {
      // Unknown ids are kept as-is so coverage checks can report them as broken.
      traceability[reqId] = entityIds.map((id) => nameOf.get(id) ?? `#${id}`);
    }

    return {
      elements: entities.map((e) => ({
        name: e.name,
        kind: e.kind,
        responsibility: e.responsibility.trim(),
        attributes: lines(e.attributes),
        methods: lines(e.methods),
      })),
      relations: canvas.relationships.flatMap((r) => {
        const from = nameOf.get(r.from);
        const to = nameOf.get(r.to);
        return from && to ? [{ from, to, type: r.type, label: r.label.trim() }] : [];
      }),
      traceability,
      narrative: {
        assumptions: canvas.assumptions.trim(),
        keyFlow: canvas.keyFlow.trim(),
        decisions: canvas.decisions.trim(),
        changeResponse: canvas.changeResponse.trim(),
      },
    };
  }

  render(canvas: DesignCanvas, context: { requirementIds: string[]; changeTitle: string }): string {
    const model = this.toModel(canvas);
    const out: string[] = [];
    const section = (title: string, body: string) => out.push(`## ${title}`, body || "(not provided)", "");

    section("Assumptions", model.narrative.assumptions);

    out.push("## Classes and interfaces");
    for (const e of model.elements) {
      out.push(`### ${e.name} (${e.kind})`, `Responsibility: ${e.responsibility}`);
      if (e.attributes.length) out.push(`Attributes: ${e.attributes.join("; ")}`);
      if (e.methods.length) out.push(`Methods: ${e.methods.join("; ")}`);
      out.push("");
    }

    out.push("## Relationships");
    if (model.relations.length === 0) out.push("(none)");
    for (const r of model.relations) out.push(`- ${r.from} ${r.type} ${r.to}${r.label ? ` (${r.label})` : ""}`);
    out.push("");

    out.push("## Requirement map");
    for (const id of context.requirementIds) {
      const mapped = model.traceability[id] ?? [];
      out.push(`- ${id}: ${mapped.length ? mapped.join(", ") : "(unmapped)"}`);
    }
    out.push("");

    section("Key flow", model.narrative.keyFlow);
    section("Design decisions and trade-offs", model.narrative.decisions);
    section(`Response to change: ${context.changeTitle}`, model.narrative.changeResponse);

    return out.join("\n").trim() + "\n";
  }

  empty(): DesignCanvas {
    return designCanvasSchema.parse({});
  }
}
