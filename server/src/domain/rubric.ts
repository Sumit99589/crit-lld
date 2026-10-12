// A fixed rubric is what makes feedback comparable across attempts and across
// very different designs. Bands are deliberately coarse (1-4): a learner can act
// on "Developing -> Solid", nobody can act on "71 -> 74".

export const CRITERION_IDS = [
  "requirements",
  "responsibilities",
  "abstraction",
  "relationships",
  "extensibility",
  "behaviour",
] as const;
export type CriterionId = (typeof CRITERION_IDS)[number];

export type Band = 1 | 2 | 3 | 4;

export const BAND_LABELS: Record<Band, string> = {
  1: "Missing",
  2: "Developing",
  3: "Solid",
  4: "Strong",
};

export interface Criterion {
  id: CriterionId;
  name: string;
  question: string;
  levels: Record<Band, string>;
}

export interface Rubric {
  version: string;
  criteria: Criterion[];
}

export const LLD_RUBRIC: Rubric = {
  version: "lld-core@1",
  criteria: [
    {
      id: "requirements",
      name: "Requirement coverage",
      question:
        "Does the design account for every stated requirement, with sensible assumptions where the brief is vague?",
      levels: {
        1: "Several requirements have no home in the design.",
        2: "Most requirements are mapped, but some are only nominally covered or assumptions are missing.",
        3: "Every requirement maps to concrete classes; key assumptions are stated.",
        4: "Coverage is complete and assumptions show a clear grasp of the problem's tricky parts.",
      },
    },
    {
      id: "responsibilities",
      name: "Responsibilities & cohesion",
      question: "Does each class own one clear job, with behaviour living next to the data it needs?",
      levels: {
        1: "Responsibilities are unclear or concentrated in one or two 'manager' classes.",
        2: "Most classes have a purpose, but some mix unrelated jobs or are passive data holders.",
        3: "Classes are cohesive and their responsibilities are stated precisely.",
        4: "Responsibilities are sharp, well-balanced, and behaviour sits with the data it uses.",
      },
    },
    {
      id: "abstraction",
      name: "Abstraction & interfaces",
      question:
        "Are interfaces and abstractions introduced where variation actually exists, and patterns used where they earn their place?",
      levels: {
        1: "No abstractions, or abstractions with no reason to exist.",
        2: "Some useful abstractions, but they are misplaced, leaky, or patterns are named without justification.",
        3: "Abstractions sit at real points of variation and are explained.",
        4: "Abstractions are minimal, well-placed, and trade-offs of each pattern are explicit.",
      },
    },
    {
      id: "relationships",
      name: "Relationships & coupling",
      question:
        "Are relationships the right kind (composition vs association vs inheritance) and is coupling kept low?",
      levels: {
        1: "Relationships are missing, contradictory, or everything depends on everything.",
        2: "Relationships exist but some are the wrong kind, or a few classes are coupled to too much.",
        3: "Relationships are appropriate and dependencies mostly point at abstractions.",
        4: "Dependency direction is deliberate and the model would be easy to test in isolation.",
      },
    },
    {
      id: "extensibility",
      name: "Extensibility under change",
      question:
        "When the requirement change arrives, how much of the design has to change, and is that cost explained?",
      levels: {
        1: "The change is not addressed, or would require rewriting core classes.",
        2: "The change is addressed but would ripple through several existing classes.",
        3: "The change is absorbed mostly by adding new classes at an existing extension point.",
        4: "The change slots in cleanly, and the learner names what would still need to change and why.",
      },
    },
    {
      id: "behaviour",
      name: "Behaviour & edge cases",
      question: "Does the key flow show how objects collaborate, including failure and edge cases?",
      levels: {
        1: "No flow, or a flow that does not use the classes described.",
        2: "The happy path is described, but failures and edge cases are ignored.",
        3: "The flow is concrete and handles the most important failure cases.",
        4: "The flow covers failures, concurrency or ordering concerns where relevant, and state changes are clear.",
      },
    },
  ],
};

export function isBand(value: unknown): value is Band {
  return value === 1 || value === 2 || value === 3 || value === 4;
}
