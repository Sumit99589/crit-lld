import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";
import { Reveal, WordReveal } from "../components/motion";
import { BandMeter, ButtonLink, ErrorPanel, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { BAND_LABEL, CRITERION_SHORT, EASE, findingTitle, timeAgo } from "../lib/format";
import type { AttemptHistory, Band, CriterionId, Insights } from "../lib/types";
import { useAsync } from "../lib/useAsync";

export function HistoryPage() {
  const data = useAsync(() => Promise.all([api.history(), api.insights()]), []);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6">
      <WordReveal text="Progress" className="font-display text-[clamp(2.25rem,5vw,3.25rem)] leading-[1.05]" />
      <Reveal delay={0.25}>
        <p className="mt-5 max-w-xl text-muted">Your reviews over time, and the gaps that keep coming back.</p>
      </Reveal>

      {data.error && (
        <div className="mt-10">
          <ErrorPanel error={data.error} onRetry={data.reload} />
        </div>
      )}
      {!data.data && !data.error && <Skeleton className="mt-12 h-72" />}
      {data.data && <Body history={data.data[0]} insights={data.data[1]} />}
    </div>
  );
}

function Body({ history, insights }: { history: AttemptHistory[]; insights: Insights }) {
  if (history.length === 0) {
    return (
      <div className="mt-14 rounded-3xl border border-dashed border-line-strong p-10">
        <p className="font-display text-2xl">Nothing here yet.</p>
        <p className="mt-2 text-muted">Submit your first design and its review will show up here.</p>
        <ButtonLink to="/#problems" className="mt-6">
          Choose a problem
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-14 space-y-16">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Reveal delay={0.3}>
          <h2 className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">Focus areas</h2>
          {insights.focusAreas.length === 0 ? (
            <p className="card rounded-2xl p-6 text-[14px] text-muted">
              {insights.completedReviews < 2
                ? "Focus areas appear once you have a couple of reviews to compare."
                : "No criterion keeps coming up weak. Try a harder problem."}
            </p>
          ) : (
            <ul className="card divide-y-2 divide-ink overflow-hidden rounded-2xl">
              {insights.focusAreas.map((f) => (
                <li key={f.criterion} className="flex items-center justify-between gap-4 bg-redline-soft px-5 py-3.5">
                  <p className="font-display text-lg">{f.name}</p>
                  <p className="text-right text-[13px] text-muted">{f.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
        <Reveal delay={0.4}>
          <h2 className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">
            Mistakes that repeat across attempts
          </h2>
          {insights.recurringIssues.length === 0 ? (
            <p className="card rounded-2xl p-6 text-[14px] text-muted">
              No structural issue has appeared in more than one attempt.
            </p>
          ) : (
            <ul className="card divide-y-2 divide-ink overflow-hidden rounded-2xl">
              {insights.recurringIssues.map((i) => (
                <li key={i.code} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[14.5px]">{findingTitle(i.code)}</p>
                    <span className="font-mono text-[11px] text-redline">{i.attempts} attempts</span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{i.example}</p>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </section>

      {insights.completedReviews > 0 && (
        <section>
          <h2 className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">
            Each criterion over your last {Math.min(insights.completedReviews, 8)} reviews
          </h2>
          <ul className="card grid gap-[2px] overflow-hidden rounded-2xl bg-ink sm:grid-cols-2 lg:grid-cols-3">
            {insights.trends.map((t, i) => (
              <Reveal key={t.criterion} inView delay={i * 0.05} className="bg-panel p-5">
                <li className="list-none">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-lg">{CRITERION_SHORT[t.criterion as CriterionId]}</p>
                    <BandMeter band={t.latest} size="sm" />
                  </div>
                  <Sparkline series={t.series} />
                  <p className="font-mono text-[11px] text-faint">latest: {t.latest ? BAND_LABEL[t.latest] : "–"}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink">Attempts</h2>
        <ul className="space-y-4">
          {history.map((a) => (
            <Reveal key={a.attemptId} inView>
              <li className="card rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <Link to={`/problems/${a.problemSlug}`} className="font-display text-xl hover:text-cobalt">
                      {a.problemTitle}
                    </Link>
                    <span className="font-mono text-[11px] text-faint">started {timeAgo(a.startedAt)}</span>
                  </div>
                  <Link
                    to={`/attempts/${a.attemptId}`}
                    className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-redline"
                  >
                    Open workspace
                  </Link>
                </div>
                {a.revisions.length === 0 ? (
                  <p className="mt-3 text-[13px] text-faint">Draft, not submitted yet.</p>
                ) : (
                  <ol className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
                    {a.revisions.map((r) => (
                      <li key={r.submissionId} className="shrink-0">
                        <Link
                          to={`/submissions/${r.submissionId}`}
                          className="lift block w-[220px] rounded-xl border-2 border-ink bg-panel px-4 py-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px]">Revision {r.revision}</span>
                            <span className="font-mono text-[10.5px] text-faint">
                              {r.status === "completed" ? (r.mode === "full" ? "AI + rules" : "rules") : r.status}
                            </span>
                          </div>
                          <div className="mt-3 space-y-1">
                            {(Object.keys(CRITERION_SHORT) as CriterionId[]).map((c) => (
                              <div key={c} className="flex items-center justify-between">
                                <span className="font-mono text-[10px] text-muted">{CRITERION_SHORT[c]}</span>
                                <BandMeter band={r.bands[c] ?? null} size="sm" />
                              </div>
                            ))}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            </Reveal>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Sparkline({ series }: { series: Band[] }) {
  const reduce = useReducedMotion();
  const w = 220;
  const h = 48;
  if (series.length === 0) return <div className="h-12" />;
  const step = series.length > 1 ? w / (series.length - 1) : 0;
  const y = (b: Band) => h - 6 - ((b - 1) / 3) * (h - 12);
  const points = series.map((b, i) => `${series.length > 1 ? i * step : w / 2},${y(b)}`).join(" ");
  return (
    <svg viewBox={`-4 0 ${w + 8} ${h}`} className="my-3 h-12 w-full" aria-label={`Bands: ${series.join(", ")}`}>
      {[1, 2, 3, 4].map((b) => (
        <line key={b} x1={0} x2={w} y1={y(b as Band)} y2={y(b as Band)} stroke="rgba(17,20,28,0.06)" />
      ))}
      <motion.polyline
        points={points}
        fill="none"
        stroke="#14161c"
        strokeWidth={1.5}
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: EASE }}
      />
      {series.map((b, i) => (
        <circle
          key={i}
          cx={series.length > 1 ? i * step : w / 2}
          cy={y(b)}
          r={2.5}
          fill={b >= 3 ? "#14161c" : b === 2 ? "#b7791f" : "#dc4a26"}
        />
      ))}
    </svg>
  );
}
