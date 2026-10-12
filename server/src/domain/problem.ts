export type Difficulty = "easy" | "medium" | "hard";

export interface Requirement {
  /** Stable id such as "FR-2". Learners map requirements to classes using it. */
  id: string;
  text: string;
}

/**
 * A domain concept most good designs end up representing somehow. Used only as a
 * soft signal ("we couldn't find X, how is it handled?"), never as a correctness
 * check, because two valid designs can name and split things very differently.
 */
export interface CoreConcept {
  name: string;
  aliases: string[];
  whyItMatters: string;
}

export interface ChangeScenario {
  title: string;
  prompt: string;
}

export interface Problem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  tagline: string;
  context: string;
  requirements: Requirement[];
  constraints: string[];
  outOfScope: string[];
  /** A requirement change the learner must explain how their design absorbs. */
  changeScenario: ChangeScenario;
  coreConcepts: CoreConcept[];
  hints: string[];
}

export interface ProblemCatalog {
  list(): Problem[];
  find(slug: string): Problem | undefined;
}
