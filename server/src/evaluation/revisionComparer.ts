import { findingKey, type Feedback, type RevisionComparison } from "../domain/feedback.js";

/**
 * Deterministic diff between two revisions' feedback. It is computed rather
 * than asked of the model, so "you fixed X" is always true. The judge is also
 * never shown its previous verdict, which keeps it from anchoring on it.
 */
export function compareRevisions(previous: Feedback, previousRevision: number, current: Feedback): RevisionComparison {
  const before = new Map(previous.findings.map((f) => [findingKey(f), f]));
  const after = new Map(current.findings.map((f) => [findingKey(f), f]));

  return {
    previousRevision,
    bandChanges: current.criteria.flatMap((c) => {
      const old = previous.criteria.find((p) => p.criterion === c.criterion);
      return old && old.band !== c.band ? [{ criterion: c.criterion, from: old.band, to: c.band }] : [];
    }),
    resolved: [...before].filter(([k]) => !after.has(k)).map(([, f]) => f),
    persisting: [...after].filter(([k]) => before.has(k)).map(([, f]) => f),
    introduced: [...after].filter(([k]) => !before.has(k)).map(([, f]) => f),
  };
}
