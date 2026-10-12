import type { Band, CriterionId, Severity } from "./types";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const BAND_LABEL: Record<Band, string> = { 1: "Missing", 2: "Developing", 3: "Solid", 4: "Strong" };

export const CRITERION_SHORT: Record<CriterionId, string> = {
  requirements: "Requirements",
  responsibilities: "Responsibilities",
  abstraction: "Abstraction",
  relationships: "Relationships",
  extensibility: "Extensibility",
  behaviour: "Behaviour",
};

export const SEVERITY_LABEL: Record<Severity, string> = { major: "Major", minor: "Minor", note: "Note" };

/** Plain-language titles for the deterministic finding codes. */
export const FINDING_TITLE: Record<string, string> = {
  REQ_MAP_EMPTY: "Requirements not mapped",
  REQ_UNMAPPED: "Requirement with no owner",
  REQ_CONCENTRATED: "One class owns most requirements",
  CONCEPT_NOT_FOUND: "Core concept not found",
  GOD_CLASS: "Class doing too much",
  VAGUE_RESPONSIBILITY: "Vague responsibility",
  DATA_ONLY_CLASS: "Data without behaviour",
  ORPHAN_ELEMENT: "Unconnected class",
  UNREALISED_ABSTRACTION: "Abstraction with no implementation",
  SINGLE_IMPLEMENTATION: "Interface with one implementation",
  IMPLEMENTS_NON_INTERFACE: "'Implements' on a non-interface",
  INHERITS_INTERFACE: "'Inherits' from an interface",
  HIGH_FAN_OUT: "Too many dependencies",
  COMPOSITION_CYCLE: "Ownership cycle",
  NO_ABSTRACTIONS: "No abstractions",
  NO_ASSUMPTIONS: "No assumptions stated",
  CHANGE_NOT_ADDRESSED: "Change scenario not addressed",
  CHANGE_NOT_GROUNDED: "Change answer not tied to classes",
  FLOW_NOT_GROUNDED: "Flow doesn't use your classes",
  NO_FAILURE_CASES: "No failure cases",
  NO_DECISIONS: "No trade-offs explained",
  PATTERN_UNJUSTIFIED: "Pattern without a reason",
  SINGLETON_USED: "Singleton in use",
};

export function findingTitle(code: string): string {
  return FINDING_TITLE[code] ?? code.toLowerCase().replace(/_/g, " ");
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function newId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}
