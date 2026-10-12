import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
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
      <section className="relative overflow-hidden">
        <div className="blueprint pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:pb-28 lg:pt-24">
          <Reveal>
            <p className="mb-6 text-sm text-muted">Low-level design practice, with a reviewer that shows its work.</p>
          </Reveal>
          <WordReveal
            text={"Design it. Get a crit.\nDesign it better."}
            className="font-display text-[clamp(2.9rem,8.4vw,7rem)] leading-[0.95] tracking-[-0.025em]"
            delay={0.1}
          />
          <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
            <div>
              <Reveal delay={0.55}>
                <p className="max-w-[32rem] text-[17px] leading-relaxed text-muted">
                  Pick a problem, lay out your classes and the reasoning behind them, and get feedback that quotes your
                  own design back to you. Every point is tied to a fixed rubric, so two very different designs can both
                  do well.
                </p>
              </Reveal>
              <Reveal delay={0.7} className="mt-9 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <ButtonLink to={first ? `/problems/${first.slug}` : "#problems"}>
                    {first ? `Start with ${first.title}` : "Choose a problem"}
                  </ButtonLink>
                </Magnetic>
                <a href="#how" className="rounded-full px-4 py-2.5 text-sm text-muted transition-colors hover:text-fg">
                  How feedback works
                </a>
              </Reveal>
            </div>
            <Reveal delay={0.45} y={32}>
              <CritCard />
            </Reveal>
          </div>
        </div>
      </section>

      {insights.data && insights.data.completedReviews > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <FocusStrip insights={insights.data} />
        </section>
      )}

      <section id="problems" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <WordReveal as="h2" text="Problems" className="font-display text-5xl tracking-tight" />
          <p className="max-w-sm text-sm text-muted">
            Four classics, each leaning on a different skill. Every one ends with a requirement change you have to
            absorb.
          </p>
        </div>
        {problems.error && <ErrorPanel error={problems.error} onRetry={problems.reload} />}
        {!problems.data && !problems.error && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        )}
        {problems.data && (
          <motion.ul
            className="divide-y divide-line border-y border-line"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10%" }}
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          >
            {problems.data.map((p) => (
              <ProblemRow key={p.slug} problem={p} />
            ))}
          </motion.ul>
        )}
      </section>

      <HowItWorks />

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-faint sm:px-6">
          <span>crit, a practice loop for low-level design.</span>
          <span>Your history is stored against an anonymous id in this browser.</span>
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
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
      }}
    >
      <Spotlight>
        <Link
          to={`/problems/${problem.slug}`}
          className="grid gap-4 px-2 py-7 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-8 sm:px-4"
        >
          <div>
            <div className="flex items-baseline gap-4">
              <h3 className="font-display text-[2rem] leading-none tracking-tight transition-transform duration-500 ease-out-quint group-hover:translate-x-1">
                {problem.title}
              </h3>
              <DifficultyTag difficulty={problem.difficulty} />
            </div>
            <p className="mt-2 text-sm text-muted">{problem.tagline}</p>
          </div>
          <div className="space-y-1 font-mono text-[12px] text-muted">
            <p>
              {problem.requirementCount} requirements · ~{problem.estimatedMinutes} min
            </p>
            <p>
              Change: <span className="text-fg/80">{problem.changeTitle}</span>
            </p>
          </div>
          <div className="flex items-center gap-4 sm:justify-end">
            {bands ? (
              <div className="text-right">
                <MiniProfile bands={bands} />
                <p className="mt-1.5 font-mono text-[11px] text-faint">
                  {problem.progress.attempts} attempt{problem.progress.attempts > 1 ? "s" : ""}
                </p>
              </div>
            ) : problem.progress.attempts > 0 ? (
              <span className="font-mono text-[11px] text-muted">In progress</span>
            ) : (
              <span className="font-mono text-[11px] text-faint">Not started</span>
            )}
            <span
              aria-hidden
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-muted transition-all duration-300 group-hover:border-redline/60 group-hover:text-fg sm:inline-flex"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
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
            className={`w-1.5 rounded-sm ${b >= 3 ? "bg-fg/80" : b === 2 ? "bg-amber" : "bg-redline"}`}
            style={{ height: 6 + b * 5 }}
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
        className="flex flex-col gap-3 rounded-2xl border border-line bg-panel/70 px-5 py-4 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-redline" aria-hidden />
          <p className="text-sm">
            {focus ? (
              <>
                Keep an eye on <span className="font-medium">{focus.name.toLowerCase()}</span>. {focus.reason}
              </>
            ) : (
              <>
                <span className="font-medium">{findingTitle(issue!.code)}</span> has come up in {issue!.attempts}{" "}
                different attempts.
              </>
            )}
          </p>
        </div>
        <span className="text-sm text-muted">See your progress</span>
      </Link>
    </Reveal>
  );
}

/** The hero's signature: a real design excerpt receiving a redline mark and a margin note. */
function CritCard() {
  const reduce = useReducedMotion();
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), reduce ? 0 : 1300);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-redline/10 blur-3xl" />
      <figure className="rounded-2xl border border-line-strong bg-panel/90 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="font-mono text-[11px] text-muted">parking-lot · revision 1</span>
          <span className="font-mono text-[11px] text-muted">change response</span>
        </div>
        <blockquote className="px-5 pb-2 pt-5 font-mono text-[12.5px] leading-[1.75] text-fg/85">
          Add a ChargingSpot that extends ParkingSpot. SpotAllocator prefers a ChargingSpot for electric cars when one
          is free. Charging cost becomes a ChargingPricing that the exit flow adds,{" "}
          <span className="redline" data-drawn={drawn} data-active={drawn}>
            so ParkingLot itself doesn't change.
          </span>
        </blockquote>
        <motion.figcaption
          initial={reduce ? false : { opacity: 0, x: 16 }}
          animate={drawn ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
          className="m-4 rounded-xl border border-redline/25 bg-redline/[0.06] p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium">Extensibility under change</span>
            <BandMeter band={drawn ? 3 : null} size="sm" delay={0.4} />
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            The exit flow lives in ParkingLot, so adding charging costs there contradicts "ParkingLot doesn't change".
            Wrap the base PricingPolicy instead, and the claim holds.
          </p>
        </motion.figcaption>
      </figure>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Readiness check",
      body: "Your design needs at least three classes with real responsibilities, a relationship and a walked-through flow before it's worth reviewing. You'll see what's missing as you type.",
    },
    {
      title: "Structural checks",
      body: "Deterministic rules look for unmapped requirements, ownership cycles, unconnected classes, god classes and an unanswered change scenario. These are facts, not opinions.",
    },
    {
      title: "Rubric review",
      body: "An AI reviewer grades six fixed criteria on a four-step scale. It must quote your design for every judgement and is told there is no single right answer.",
    },
    {
      title: "Verification",
      body: "Every quote is checked against what you actually wrote. Deterministic facts cap optimistic grades, and the reason is shown. If the AI is down, you still get the rule-based review.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-20 border-t border-line bg-panel/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <WordReveal
              as="h2"
              text="How the feedback is made"
              className="font-display text-5xl leading-[1.02] tracking-tight"
            />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted">
              LLD has many valid answers, so crit doesn't compare you with a model solution. It grades against a rubric
              and shows you the evidence.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {Object.values(CRITERION_SHORT).map((c) => (
                <li key={c} className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {steps.map((s, i) => (
              <Reveal key={s.title} inView delay={i * 0.08} className="bg-ink p-6">
                <li className="list-none">
                  <span className="font-mono text-[11px] text-redline">step {i + 1}</span>
                  <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
