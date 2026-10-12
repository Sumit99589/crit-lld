import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Magnetic, Reveal, Spotlight, WordReveal } from "../components/motion";
import { BandMeter, ButtonLink, DifficultyTag, ErrorPanel, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { CRITERION_SHORT, EASE, findingTitle } from "../lib/format";
import type { CriterionId, Insights, ProblemSummary } from "../lib/types";
import { useAsync } from "../lib/useAsync";

export function HomePage() {
  const problems = useAsync(() => api.problems(), []);
  const insights = useAsync(() => api.insights(), []);
  const first = problems.data?.[0];

  return (
    <>
      <section className="hero-wash relative overflow-hidden border-b border-line">
        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:pb-24 lg:pt-24">
          <div>
            <WordReveal
              text={"Design it. Get a crit.\nDesign it better."}
              className="font-display text-[clamp(2.5rem,5.6vw,4.4rem)] leading-[1.02]"
              delay={0.05}
            />
            <Reveal delay={0.45}>
              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
                Low-level design practice with feedback that quotes your own design.
              </p>
            </Reveal>
            <Reveal delay={0.6} className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <ButtonLink to={first ? `/problems/${first.slug}` : "#problems"}>
                  {first ? `Start with ${first.title}` : "Choose a problem"}
                </ButtonLink>
              </Magnetic>
              <a
                href="#problems"
                className="rounded-full px-4 py-2.5 text-sm text-muted transition-colors hover:text-fg"
              >
                Browse problems
              </a>
            </Reveal>
          </div>
          <Reveal delay={0.35} y={28}>
            <CritCard />
          </Reveal>
        </div>
      </section>

      {insights.data && insights.data.completedReviews > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <FocusStrip insights={insights.data} />
        </section>
      )}

      <section id="problems" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-3xl">Problems</h2>
          <p className="text-sm text-muted">Each ends with a requirement change.</p>
        </div>
        {problems.error && <ErrorPanel error={problems.error} onRetry={problems.reload} />}
        {!problems.data && !problems.error && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        )}
        {problems.data && (
          <motion.ul
            className="card divide-y divide-line overflow-hidden rounded-2xl"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10%" }}
            variants={{ show: { transition: { staggerChildren: 0.07 } } }}
          >
            {problems.data.map((p) => (
              <ProblemRow key={p.slug} problem={p} />
            ))}
          </motion.ul>
        )}
      </section>

      <HowItWorks />

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-faint sm:px-6">
          <span>crit</span>
          <span>History is saved in this browser.</span>
        </div>
      </footer>
    </>
  );
}

function ProblemRow({ problem }: { problem: ProblemSummary }) {
  const bands = problem.progress.latestBands;
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      <Spotlight>
        <Link
          to={`/problems/${problem.slug}`}
          className="grid gap-3 px-5 py-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-8 sm:px-6"
        >
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold tracking-[-0.02em] transition-transform duration-500 ease-out-quint group-hover:translate-x-0.5">
                {problem.title}
              </h3>
              <DifficultyTag difficulty={problem.difficulty} />
            </div>
            <p className="mt-1 text-sm text-muted">{problem.tagline}</p>
          </div>
          <p className="font-mono text-[12px] text-muted">
            ~{problem.estimatedMinutes} min · then <span className="text-fg">{problem.changeTitle.toLowerCase()}</span>
          </p>
          <div className="flex items-center gap-4 sm:justify-end">
            {bands ? (
              <MiniProfile bands={bands} />
            ) : (
              <span className="font-mono text-[11px] text-faint">
                {problem.progress.attempts > 0 ? "In progress" : "New"}
              </span>
            )}
            <span
              aria-hidden
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-muted transition-all duration-300 group-hover:border-fg group-hover:bg-fg group-hover:text-white sm:inline-flex"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </Link>
      </Spotlight>
    </motion.li>
  );
}

function MiniProfile({ bands }: { bands: Partial<Record<CriterionId, 1 | 2 | 3 | 4>> }) {
  const order: CriterionId[] = [
    "requirements",
    "responsibilities",
    "abstraction",
    "relationships",
    "extensibility",
    "behaviour",
  ];
  return (
    <span className="inline-flex items-end gap-[3px]" aria-label="Latest scores per criterion">
      {order.map((c) => {
        const b = bands[c] ?? 0;
        return (
          <span
            key={c}
            title={`${CRITERION_SHORT[c]}: ${b || "–"}/4`}
            className={`w-1.5 rounded-sm ${b === 4 ? "bg-ok" : b === 3 ? "bg-fg/70" : b === 2 ? "bg-amber" : "bg-redline"}`}
            style={{ height: 5 + b * 4 }}
          />
        );
      })}
    </span>
  );
}

function FocusStrip({ insights }: { insights: Insights }) {
  const focus = insights.focusAreas[0];
  const issue = insights.recurringIssues[0];
  if (!focus && !issue) return null;
  return (
    <Reveal>
      <Link
        to="/history"
        className="card flex flex-col gap-2 rounded-xl px-5 py-3.5 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-center gap-3 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-redline" aria-hidden />
          {focus ? (
            <span>
              Focus on <span className="font-medium">{focus.name.toLowerCase()}</span>: {focus.reason.toLowerCase()}
            </span>
          ) : (
            <span>
              <span className="font-medium">{findingTitle(issue!.code)}</span> keeps coming up.
            </span>
          )}
        </p>
        <span className="text-sm text-muted">Progress</span>
      </Link>
    </Reveal>
  );
}

/** The hero's signature: a real design excerpt receiving a red mark and a margin note. */
function CritCard() {
  const reduce = useReducedMotion();
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), reduce ? 0 : 1100);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <figure className="card overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-line bg-raised/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="ml-2 font-mono text-[11px] text-muted">parking-lot · change response</span>
      </div>
      <blockquote className="px-5 pb-1 pt-5 font-mono text-[12.5px] leading-[1.8] text-fg/80">
        Add a ChargingSpot that extends ParkingSpot. Charging cost becomes a ChargingPricing that the exit flow adds,{" "}
        <span className="redline text-fg" data-drawn={drawn} data-active={drawn}>
          so ParkingLot itself doesn't change.
        </span>
      </blockquote>
      <motion.figcaption
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={drawn ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
        className="m-4 rounded-xl border border-redline/25 bg-redline-soft/60 p-4"
      >
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold">Extensibility</span>
          <BandMeter band={drawn ? 3 : null} size="sm" delay={0.35} />
        </div>
        <p className="text-[13px] leading-relaxed text-fg/75">
          The exit flow lives in ParkingLot, so this contradicts your claim. Wrap the base PricingPolicy instead.
        </p>
      </motion.figcaption>
    </figure>
  );
}

const STEPS: { title: string; note: string; icon: ReactNode }[] = [
  {
    title: "You design",
    note: "Classes, links, one flow",
    icon: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M4 10h16" />
      </>
    ),
  },
  {
    title: "Rules check",
    note: "Gaps, cycles, coverage",
    icon: <path d="M5 12.5l4 4 10-10" />,
  },
  {
    title: "AI reviews",
    note: "6 criteria, 4 levels",
    icon: (
      <>
        <path d="M4 18h4V11H4zM10 18h4V7h-4zM16 18h4V4h-4z" />
      </>
    ),
  },
  {
    title: "Quotes verified",
    note: "Facts cap the grade",
    icon: (
      <>
        <path d="M5 7h14M5 12h9" />
        <path d="M5 17h6" className="stroke-redline" />
      </>
    ),
  },
];

/** Four steps on one line. The line between them fills as the section scrolls in. */
function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="scroll-mt-20 border-t border-line bg-panel">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <h2 className="font-display text-3xl">How feedback works</h2>
        <div className="relative mt-10">
          <div aria-hidden className="absolute left-6 right-6 top-6 hidden h-px bg-line md:block">
            <motion.div
              className="h-full origin-left bg-fg"
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{ duration: 1.4, ease: EASE }}
            />
          </div>
          <ol className="relative grid gap-8 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20%" }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.25 }}
                className="flex items-start gap-4 md:flex-col"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-panel shadow-sm">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {s.icon}
                  </svg>
                </span>
                <div>
                  <p className="font-semibold tracking-[-0.01em]">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{s.note}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
