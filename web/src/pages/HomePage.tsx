import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Magnetic, Reveal, WordReveal } from "../components/motion";
import { BandMeter, ButtonLink, DifficultyTag, ErrorPanel, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { CRITERION_SHORT, EASE, PROBLEM_COLOR, findingTitle } from "../lib/format";
import type { CriterionId, Insights, ProblemSummary } from "../lib/types";
import { useAsync } from "../lib/useAsync";

export function HomePage() {
  const problems = useAsync(() => api.problems(), []);
  const insights = useAsync(() => api.insights(), []);
  const first = problems.data?.[0];

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-14 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:pb-24 lg:pt-20">
        <div>
          <WordReveal
            text={"Design it.\nGet a crit.\nDesign it better."}
            highlight={["crit."]}
            className="font-display text-[clamp(3rem,7vw,5.6rem)] leading-[0.98]"
            delay={0.05}
          />
          <Reveal delay={0.45}>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-muted">
              Practise low-level design. Get feedback that quotes your own design.
            </p>
          </Reveal>
          <Reveal delay={0.6} className="mt-9 flex flex-wrap items-center gap-5">
            <Magnetic strength={0.2}>
              <ButtonLink to={first ? `/problems/${first.slug}` : "#problems"} className="px-6 py-3 text-base">
                {first ? `Start with ${first.title}` : "Choose a problem"} <Arrow />
              </ButtonLink>
            </Magnetic>
            <a href="#problems" className="font-semibold underline decoration-2 underline-offset-4 hover:text-cobalt">
              All problems
            </a>
          </Reveal>
        </div>
        <Reveal delay={0.35} y={28}>
          <CritCard />
        </Reveal>
      </section>

      {insights.data && insights.data.completedReviews > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <FocusStrip insights={insights.data} />
        </section>
      )}

      <section id="problems" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
        <h2 className="font-display mb-8 text-4xl">Pick a problem</h2>
        {problems.error && <ErrorPanel error={problems.error} onRetry={problems.reload} />}
        {!problems.data && !problems.error && (
          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        )}
        {problems.data && (
          <motion.ul
            className="grid gap-6 sm:grid-cols-2"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          >
            {problems.data.map((p) => (
              <ProblemCard key={p.slug} problem={p} />
            ))}
          </motion.ul>
        )}
      </section>

      <HowItWorks />

      <footer className="border-t-2 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-muted sm:px-6">
          <span className="font-display text-lg text-ink">crit</span>
          <span>History is saved in this browser.</span>
        </div>
      </footer>
    </>
  );
}

export function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h9M8.5 4 12 8l-3.5 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
    </svg>
  );
}

function ProblemCard({ problem }: { problem: ProblemSummary }) {
  const bands = problem.progress.latestBands;
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      <Link to={`/problems/${problem.slug}`} className="card lift group block h-full overflow-hidden rounded-2xl">
        <div
          className={`flex items-center justify-between border-b-2 border-ink px-5 py-3 ${PROBLEM_COLOR[problem.slug] ?? "bg-sun"}`}
        >
          <DifficultyTag difficulty={problem.difficulty} />
          <span className="font-mono text-[12px] font-medium">~{problem.estimatedMinutes} min</span>
        </div>
        <div className="p-5">
          <h3 className="font-display text-[1.75rem] leading-tight">{problem.title}</h3>
          <p className="mt-1.5 text-[15px] text-muted">{problem.tagline}</p>
          <div className="mt-6 flex items-end justify-between gap-4">
            <p className="text-[13px]">
              <span className="text-muted">Twist: </span>
              <span className="font-semibold">{problem.changeTitle}</span>
            </p>
            {bands ? (
              <MiniProfile bands={bands} />
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink transition-colors group-hover:bg-ink group-hover:text-canvas">
                <Arrow />
              </span>
            )}
          </div>
        </div>
      </Link>
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
  const fill = { 1: "bg-redline", 2: "bg-sun", 3: "bg-cobalt", 4: "bg-mint" } as const;
  return (
    <span className="inline-flex items-end gap-1" aria-label="Your latest scores per criterion">
      {order.map((c) => {
        const b = bands[c];
        return (
          <span
            key={c}
            title={`${CRITERION_SHORT[c]}: ${b ?? "–"}/4`}
            className={`w-2.5 rounded-[2px] border-[1.5px] border-ink ${b ? fill[b] : "bg-panel"}`}
            style={{ height: 8 + (b ?? 0) * 6 }}
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
      <Link to="/history" className="card lift flex items-center justify-between gap-4 rounded-xl bg-lilac px-5 py-3.5">
        <p className="text-[15px]">
          {focus ? (
            <>
              <b>Work on {focus.name.toLowerCase()}.</b> {focus.reason}
            </>
          ) : (
            <>
              <b>{findingTitle(issue!.code)}</b> keeps coming up.
            </>
          )}
        </p>
        <Arrow />
      </Link>
    </Reveal>
  );
}

/** The hero's signature: a real design excerpt receiving a red-pen mark and a margin note. */
function CritCard() {
  const reduce = useReducedMotion();
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), reduce ? 0 : 1100);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="relative lg:rotate-[1.5deg]">
      <figure className="card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b-2 border-ink bg-cobalt px-4 py-2.5 text-white">
          <span className="font-mono text-[12px]">parking-lot / change response</span>
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-ink bg-sun" />
            <span className="h-3 w-3 rounded-full border-2 border-ink bg-mint" />
          </span>
        </div>
        <blockquote className="px-5 pb-2 pt-5 font-mono text-[13px] leading-[1.85]">
          Add a ChargingSpot that extends ParkingSpot. Charging cost becomes a ChargingPricing that the exit flow adds,{" "}
          <span className="redline" data-drawn={drawn}>
            so ParkingLot itself doesn't change.
          </span>
        </blockquote>
        <motion.figcaption
          initial={reduce ? false : { opacity: 0, y: 12, rotate: -3 }}
          animate={drawn ? { opacity: 1, y: 0, rotate: -1.5 } : {}}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.25 }}
          className="m-4 rounded-xl border-2 border-ink bg-sun p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-lg">Extensibility</span>
            <BandMeter band={drawn ? 3 : null} size="sm" delay={0.4} />
          </div>
          <p className="text-[14px] leading-relaxed">
            The exit flow lives in ParkingLot, so this contradicts your claim. Wrap the base PricingPolicy instead.
          </p>
        </motion.figcaption>
      </figure>
    </div>
  );
}

const STEPS: { title: string; note: string; color: string; icon: ReactNode }[] = [
  {
    title: "You design",
    note: "Classes, links, one flow",
    color: "bg-sun",
    icon: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="1" />
        <path d="M4 10h16" />
      </>
    ),
  },
  { title: "Rules check", note: "Gaps, cycles, coverage", color: "bg-mint", icon: <path d="M5 12.5l4 4 10-10" /> },
  {
    title: "AI reviews",
    note: "6 criteria, 4 levels",
    color: "bg-lilac",
    icon: <path d="M4 19h4v-7H4zM10 19h4V8h-4zM16 19h4V4h-4z" />,
  },
  {
    title: "Quotes verified",
    note: "Facts cap the grade",
    color: "bg-redline",
    icon: <path d="M5 7h14M5 12h9M5 17h6" />,
  },
];

function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="scroll-mt-20 border-y-2 border-ink bg-ink text-canvas">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="font-display text-4xl">How feedback works</h2>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -8% 0px" }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.12 }}
              className="rounded-2xl border-2 border-canvas bg-canvas p-5 text-ink shadow-[5px_5px_0_var(--color-sun)]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 border-ink ${s.color}`}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="square"
                  aria-hidden
                >
                  {s.icon}
                </svg>
              </span>
              <p className="font-display mt-5 text-xl">{s.title}</p>
              <p className="mt-1 text-[14px] text-muted">{s.note}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
