import type { DesignCanvas } from "../../lib/types";

export type SectionId = "assumptions" | "classes" | "relationships" | "mapping" | "flow" | "decisions" | "change";

export interface SectionMeta {
  id: SectionId;
  label: string;
  guide: string;
  done: (c: DesignCanvas) => boolean;
}

export const SECTIONS: SectionMeta[] = [
  {
    id: "assumptions",
    label: "Assumptions",
    guide:
      "Where the brief is vague, decide. Scope, sizes, payment, concurrency: write down the two or three calls you made.",
    done: (c) => c.assumptions.trim().length > 20,
  },
  {
    id: "classes",
    label: "Classes",
    guide:
      "Name each class or interface and say in one sentence what it is responsible for. Methods are optional, but they show where behaviour lives.",
    done: (c) => c.entities.filter((e) => e.name.trim() && e.responsibility.trim().length >= 12).length >= 3,
  },
  {
    id: "relationships",
    label: "Relationships",
    guide:
      "Composes when the part can't outlive the whole. Aggregates when it can. Associates when they just know each other. Depends for a short-lived use.",
    done: (c) => c.relationships.length > 0,
  },
  {
    id: "mapping",
    label: "Requirement map",
    guide:
      "For each requirement, pick the classes that make it happen. A requirement with no owner is a gap in the design.",
    done: (c) => Object.values(c.requirementMap).some((ids) => ids.length > 0),
  },
  {
    id: "flow",
    label: "Key flow",
    guide:
      "Walk through the most important use case as calls between your objects. Then say what happens when it goes wrong.",
    done: (c) => c.keyFlow.trim().length >= 60,
  },
  {
    id: "decisions",
    label: "Decisions",
    guide: "Name one or two choices you made, what they cost, and the alternative you rejected.",
    done: (c) => c.decisions.trim().length > 20,
  },
  {
    id: "change",
    label: "Change",
    guide: "Which classes do you add, which existing ones change, and why? Be honest about what ripples.",
    done: (c) => c.changeResponse.trim().length >= 40,
  },
];

/** Maps a validation path from the server ("entities.2.name") to the section that owns it. */
export function sectionForPath(path: string): SectionId {
  if (path.startsWith("entities")) return "classes";
  if (path.startsWith("relationships")) return "relationships";
  if (path.startsWith("requirementMap")) return "mapping";
  if (path.startsWith("keyFlow")) return "flow";
  if (path.startsWith("decisions")) return "decisions";
  if (path.startsWith("changeResponse")) return "change";
  return "assumptions";
}

export const EMPTY_CANVAS: DesignCanvas = {
  assumptions: "",
  entities: [],
  relationships: [],
  requirementMap: {},
  keyFlow: "",
  decisions: "",
  changeResponse: "",
};
