import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Magnetic, Reveal, WordReveal } from "../components/motion";
import { BandMeter, Button, DifficultyTag, ErrorPanel, Skeleton, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function ProblemPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const problem = useAsync(() => api.problem(slug), [slug]);
  const rubric = useAsync(() => api.rubric(), []);
  const history = useAsync(() => api.history(), []);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<Error>();

  const mine = history.data?.filter((h) => h.problemSlug === slug) ?? [];

  async function start() {
    setStarting(true);
    setStartError(undefined);
    try {
      const attempt = await api.startAttempt(slug);
      navigate(`/attempts/${attempt.id}`);
    } catch (e) {
      setStartError(e as Error);
      setStarting(false);
    }
  }

  if (problem.error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <ErrorPanel error={problem.error} onRetry={problem.reload} />
      </div>
    );
  }
  const p = problem.data;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      <Link to="/#problems" className="text-sm text-muted transition-colors hover:text-fg">
        All problems
      </Link>

      {!p ? (
        <div className="mt-10 space-y-4">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <header className="mt-8 border-b-2 border-ink pb-10">
            <div className="mb-5 flex flex-wrap items-center gap-4 font-mono text-[12px] text-muted">
              <DifficultyTag difficulty={p.difficulty} />
              <span>~{p.estimatedMinutes} min</span>
            </div>
            <WordReveal text={p.title} className="font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05]" />
            <Reveal delay={0.3}>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{p.context}</p>
            </Reveal>
          </header>

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-12">
              <Reveal delay={0.35}>
                <h2 className="mb-5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">Requirements</h2>
                <ol className="card divide-y-2 divide-ink/10 overflow-hidden rounded-2xl">
                  {p.requirements.map((r) => (
                    <li key={r.id} className="flex gap-5 bg-panel px-5 py-4">
                      <span className="w-12 shrink-0 pt-0.5 font-mono text-[12px] font-bold">{r.id}</span>
                      <span className="text-[15px] leading-relaxed">{r.text}</span>
                    </li>
                  ))}
                </ol>
              </Reveal>

              <Reveal inView className="grid gap-10 sm:grid-cols-2">
                <div>
                  <h2 className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">Constraints</h2>
                  <ul className="space-y-3">
                    {p.constraints.map((c) => (
                      <li key={c} className="border-l border-line-strong pl-4 text-[14px] leading-relaxed text-fg/85">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">Out of scope</h2>
                  <ul className="space-y-2">
                    {p.outOfScope.map((c) => (
                      <li key={c} className="text-[14px] text-muted line-through decoration-faint">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal inView>
                <details className="card group rounded-2xl px-5 py-4">
                  <summary className="cursor-pointer list-none text-sm text-muted transition-colors marker:hidden hover:text-fg">
                    <span className="group-open:hidden">Stuck? Show {p.hints.length} hints</span>
                    <span className="hidden group-open:inline">Hints</span>
                  </summary>
                  <ul className="mt-4 space-y-3">
                    {p.hints.map((h) => (
                      <li key={h} className="text-[14px] leading-relaxed text-fg/85">
                        {h}
                      </li>
                    ))}
                  </ul>
                </details>
              </Reveal>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <Reveal delay={0.45}>
                <div className="card relative overflow-hidden rounded-2xl bg-lilac p-6">
                  <p className="inline-block rounded-md border-[1.5px] border-ink bg-panel px-1.5 py-px font-mono text-[10.5px] font-medium uppercase">
                    Then the requirement changes
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{p.changeScenario.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-fg/85">{p.changeScenario.prompt}</p>
                </div>
              </Reveal>

              <Reveal delay={0.55} className="space-y-3">
                <Magnetic strength={0.15} className="block">
                  <Button onClick={start} disabled={starting} className="w-full py-3">
                    {starting ? <Spinner /> : null}
                    {mine.length ? "Start a fresh attempt" : "Start designing"}
                  </Button>
                </Magnetic>
                {startError && <p className="text-sm text-redline">{startError.message}</p>}
              </Reveal>

              {mine.length > 0 && (
                <Reveal delay={0.6}>
                  <h3 className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">Your attempts</h3>
                  <ul className="space-y-2">
                    {mine.map((a) => {
                      const last = a.revisions.at(-1);
                      return (
                        <li key={a.attemptId} className="card rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] text-muted">
                              {a.revisions.length
                                ? `${a.revisions.length} revision${a.revisions.length > 1 ? "s" : ""}`
                                : "Draft"}{" "}
                              · {timeAgo(a.startedAt)}
                            </span>
                            {last?.bands && Object.keys(last.bands).length > 0 && (
                              <BandMeter
                                size="sm"
                                band={
                                  Math.round(
                                    Object.values(last.bands).reduce((s, b) => s + (b ?? 0), 0) /
                                      Object.values(last.bands).length,
                                  ) as 1 | 2 | 3 | 4
                                }
                              />
                            )}
                          </div>
                          <div className="mt-3 flex gap-4 text-sm">
                            <Link
                              to={`/attempts/${a.attemptId}`}
                              className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-redline"
                            >
                              Continue editing
                            </Link>
                            {last && (
                              <Link to={`/submissions/${last.submissionId}`} className="text-muted hover:text-fg">
                                Latest feedback
                              </Link>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>
              )}

              {rubric.data && (
                <Reveal delay={0.65}>
                  <h3 className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">
                    You'll be reviewed on
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {rubric.data.criteria.map((c) => (
                      <li
                        key={c.id}
                        title={c.question}
                        className="rounded-full border border-line-strong bg-panel px-2.5 py-1 text-[12px]"
                      >
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
