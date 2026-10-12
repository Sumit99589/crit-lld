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
    guide: "Where the brief is vague, write down what you decided.",
    done: (c) => c.assumptions.trim().length > 20,
  },
  {
    id: "classes",
    label: "Classes",
    guide: "One sentence of responsibility per class. Methods are optional.",
    done: (c) => c.entities.filter((e) => e.name.trim() && e.responsibility.trim().length >= 12).length >= 3,
  },
  {
    id: "relationships",
    label: "Relationships",
    guide: "How the classes connect, and how strongly.",
    done: (c) => c.relationships.length > 0,
  },
  {
    id: "mapping",
    label: "Requirement map",
    guide: "Pick the classes that satisfy each requirement.",
    done: (c) => Object.values(c.requirementMap).some((ids) => ids.length > 0),
  },
  {
    id: "flow",
    label: "Key flow",
    guide: "Walk through the main use case, including what goes wrong.",
    done: (c) => c.keyFlow.trim().length >= 60,
  },
  {
    id: "decisions",
    label: "Decisions",
    guide: "A choice you made, and what it cost.",
    done: (c) => c.decisions.trim().length > 20,
  },
  {
    id: "change",
    label: "Change",
    guide: "What do you add, and what has to change?",
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
