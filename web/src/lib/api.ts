import type {
  Attempt,
  AttemptHistory,
  DesignCanvas,
  EvaluationView,
  Health,
  Insights,
  Precheck,
  Problem,
  ProblemSummary,
  RevisionSummary,
  Rubric,
  SubmissionView,
} from "./types";

const LEARNER_KEY = "crit.learner";

/** Anonymous, per-browser learner id. Good enough to keep history apart without accounts. */
export function learnerId(): string {
  try {
    const existing = localStorage.getItem(LEARNER_KEY);
    if (existing) return existing;
    const id = `l-${crypto.randomUUID()}`;
    localStorage.setItem(LEARNER_KEY, id);
    return id;
  } catch {
    return "l-ephemeral-session";
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-learner-id", learnerId());
  if (init.body) headers.set("content-type", "application/json");
  if (init.idempotencyKey) headers.set("idempotency-key", init.idempotencyKey);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.issues ?? []);
  return body as T;
}

const json = (value: unknown) => JSON.stringify(value);

export const api = {
  health: () => request<Health>("/health"),
  rubric: () => request<Rubric>("/rubric"),
  problems: () => request<ProblemSummary[]>("/problems"),
  problem: (slug: string) => request<Problem>(`/problems/${slug}`),
  startAttempt: (problemSlug: string) => request<Attempt>("/attempts", { method: "POST", body: json({ problemSlug }) }),
  attempt: (id: string) => request<{ attempt: Attempt; revisions: RevisionSummary[] }>(`/attempts/${id}`),
  saveDraft: (id: string, draft: DesignCanvas) =>
    request<{ savedAt: string }>(`/attempts/${id}/draft`, { method: "PUT", body: json({ draft }) }),
  precheck: (id: string, draft: DesignCanvas) =>
    request<Precheck>(`/attempts/${id}/precheck`, { method: "POST", body: json({ draft }) }),
  submit: (id: string, draft: DesignCanvas, idempotencyKey: string) =>
    request<{ submission: SubmissionView; evaluation: EvaluationView; duplicate: boolean }>(
      `/attempts/${id}/submissions`,
      {
        method: "POST",
        body: json({ draft }),
        idempotencyKey,
      },
    ),
  submission: (id: string) => request<{ submission: SubmissionView; evaluation: EvaluationView }>(`/submissions/${id}`),
  retry: (id: string) => request<EvaluationView>(`/submissions/${id}/retry`, { method: "POST" }),
  history: () => request<AttemptHistory[]>("/history"),
  insights: () => request<Insights>("/insights"),
};
