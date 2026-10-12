// The format-agnostic view of a learner's design. Every submission format
// (today the structured canvas; later perhaps a class diagram or code) is
// translated into this shape, and evaluators only ever read this shape.

export const ELEMENT_KINDS = ["class", "abstract", "interface", "enum"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export const RELATION_TYPES = ["inherits", "implements", "composes", "aggregates", "associates", "depends"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface DesignElement {
  name: string;
  kind: ElementKind;
  responsibility: string;
  attributes: string[];
  methods: string[];
}

export interface DesignRelation {
  from: string;
  to: string;
  type: RelationType;
  label: string;
}

export interface DesignNarrative {
  assumptions: string;
  keyFlow: string;
  decisions: string;
  changeResponse: string;
}

export interface DesignModel {
  elements: DesignElement[];
  relations: DesignRelation[];
  /** requirement id -> element names the learner says satisfy it */
  traceability: Record<string, string[]>;
  narrative: DesignNarrative;
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function findElement(model: DesignModel, name: string): DesignElement | undefined {
  return model.elements.find((e) => sameName(e.name, name));
}

export function relationsOf(model: DesignModel, name: string): DesignRelation[] {
  return model.relations.filter((r) => sameName(r.from, name) || sameName(r.to, name));
}
