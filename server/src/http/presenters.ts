import type { Attempt } from "../domain/attempt.js";
import type { Evaluation } from "../domain/evaluation.js";
import type { Problem } from "../domain/problem.js";
import type { Submission } from "../domain/submission.js";

// Response shapes are kept separate from domain objects so the API can stay
// stable while the domain evolves (and private fields like `version` stay private).

export function problemSummary(p: Problem) {
  return {
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    estimatedMinutes: p.estimatedMinutes,
    tagline: p.tagline,
    requirementCount: p.requirements.length,
    changeTitle: p.changeScenario.title,
  };
}

export function attemptDto(a: Attempt) {
  const s = a.toSnapshot();
  return {
    id: s.id,
    problemSlug: s.problemSlug,
    formatId: s.formatId,
    draft: s.draft,
    revisionCount: s.revisionCount,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function evaluationDto(e: Evaluation) {
  const s = e.toSnapshot();
  return {
    id: s.id,
    status: s.status,
    tries: s.tries,
    lastError: s.status === "failed" ? s.lastError : null,
    feedback: s.feedback,
    retryable: s.status === "failed" || (s.status === "completed" && s.feedback?.mode === "rules_only"),
    updatedAt: s.updatedAt,
    completedAt: s.completedAt,
  };
}

export function submissionDto(s: Submission) {
  return {
    id: s.id,
    attemptId: s.attemptId,
    problemSlug: s.problemSlug,
    revision: s.revision,
    formatId: s.formatId,
    content: s.content,
    createdAt: s.createdAt,
  };
}
