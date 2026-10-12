import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Magnetic, Reveal } from "../../components/motion";
import { BandMeter, Button, ButtonLink, ErrorPanel, SeverityTag, Skeleton, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { BAND_LABEL, CRITERION_SHORT, EASE, findingTitle, timeAgo } from "../../lib/format";
import type {
  CriterionAssessment,
  EvaluationView,
  Feedback,
  Finding,
  Problem,
  Rubric,
  SubmissionView as Submission,
} from "../../lib/types";
import { useAsync, usePolling } from "../../lib/useAsync";
import { SubmissionView, type Quote } from "./SubmissionView";

export function FeedbackPage() {
  const { submissionId = "" } = useParams();
  const data = useAsync(async () => {
    const { submission, evaluation } = await api.submission(submissionId);
    const [problem, rubric] = await Promise.all([api.problem(submission.problemSlug), api.rubric()]);
    return { submission, evaluation, problem, rubric };
  }, [submissionId]);

  const pending = data.data && (data.data.evaluation.status === "queued" || data.data.evaluation.status === "running");
  usePolling(
    () => {
      api
        .submission(submissionId)
        .then(({ evaluation }) => data.data && data.setData({ ...data.data, evaluation }))
        .catch(() => {});
    },
    1500,
    !!pending,
  );

  if (data.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <ErrorPanel error={data.error} onRetry={data.reload} />
      </div>
    );
  }
  if (!data.data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { submission, evaluation, problem, rubric } = data.data;
  const onRetry = async () => {
    const next = await api.retry(submission.id);
    data.setData({ ...data.data!, evaluation: next });
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-24 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-muted">
        <Link to={`/problems/${problem.slug}`} className="hover:text-fg">
          {problem.title}
        </Link>
        <span className="text-faint">/</span>
        <Link to={`/attempts/${submission.attemptId}`} className="hover:text-fg">
          revision {submission.revision}
        </Link>
        <span className="text-faint">·</span>
        <span>submitted {timeAgo(submission.createdAt)}</span>
      </div>

      {evaluation.status === "completed" && evaluation.feedback ? (
        <Report
          submission={submission}
          evaluation={evaluation}
          feedback={evaluation.feedback}
          problem={problem}
          rubric={rubric}
          onRetry={onRetry}
        />
      ) : (
        <Pending evaluation={evaluation} onRetry={onRetry} />
      )}
    </div>
  );
}

function Pending({ evaluation, onRetry }: { evaluation: EvaluationView; onRetry: () => Promise<void> }) {
  const failed = evaluation.status === "failed";
  const [busy, setBusy] = useState(false);
  const steps = [
    { label: "Saved", detail: "Nothing is lost if review fails." },
    {
      label: failed ? "Review failed" : "Reviewing",
      detail: failed ? (evaluation.lastError ?? "Something went wrong.") : "Usually 10–20 seconds.",
    },
    { label: "Feedback", detail: "Grades, evidence, next steps." },
  ];
  const current = 1;
  return (
    <div className="mx-auto mt-16 max-w-xl">
      <h1 className="font-display text-2xl">
        {failed ? "We couldn't finish the review." : "Your design is in for a crit."}
      </h1>
      <ol className="mt-10 space-y-3">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
              className={`flex gap-4 rounded-2xl border p-5 ${active && !failed ? "beam border-transparent bg-panel" : active && failed ? "border-redline/40 bg-redline/[0.06]" : "border-line"}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  done
                    ? "border-ok bg-ok/15 text-ok"
                    : active
                      ? failed
                        ? "border-redline text-redline"
                        : "border-redline text-fg"
                      : "border-line-strong text-faint"
                }`}
              >
                {done ? "✓" : active && !failed ? <Spinner className="h-3 w-3 text-redline" /> : i + 1}
              </span>
              <div>
                <p className={`text-[15px] ${done || active ? "text-fg" : "text-muted"}`}>{s.label}</p>
                <p className="mt-1 text-[13px] text-muted">{s.detail}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
      {failed && (
        <Button
          className="mt-8"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onRetry().finally(() => setBusy(false));
          }}
        >
          {busy && <Spinner />}
          Run the review again
        </Button>
      )}
    </div>
  );
}

function Report({
  submission,
  evaluation,
  feedback,
  problem,
  rubric,
  onRetry,
}: {
  submission: Submission;
  evaluation: EvaluationView;
  feedback: Feedback;
  problem: Problem;
  rubric: Rubric;
  onRetry: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [startingFresh, setStartingFresh] = useState(false);

  const quotes: Quote[] = useMemo(
    () =>
      feedback.criteria.flatMap((c) =>
        c.evidence.filter((e) => e.verified).map((e, i) => ({ id: `${c.criterion}-${i}`, text: e.text })),
      ),
    [feedback],
  );

  const focusQuote = (id: string) => {
    setActiveQuote(id);
    document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="mt-6 grid gap-10 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <header className="border-b border-line pb-10">
          <ModeChip feedback={feedback} retryable={evaluation.retryable} onRetry={onRetry} />
          <Reveal delay={0.05}>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(1.5rem,2.6vw,2.15rem)] leading-[1.22]">
              {feedback.headline}
            </h1>
          </Reveal>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <BandProfile feedback={feedback} />
            <div className="space-y-7">
              {feedback.nextSteps.length > 0 && (
                <Reveal delay={0.3}>
                  <h2 className="mb-3 text-[13px] font-medium text-muted">Do these next</h2>
                  <ol className="space-y-3">
                    {feedback.nextSteps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
                        <span className="mt-0.5 font-mono text-[12px] text-redline">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </Reveal>
              )}
              {feedback.strengths.length > 0 && (
                <Reveal delay={0.4}>
                  <h2 className="mb-3 text-[13px] font-medium text-muted">Keep doing</h2>
                  <ul className="space-y-2">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-fg/85">
                        <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ok" aria-hidden />
                        {s}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
            </div>
          </div>
        </header>

        {feedback.comparison && <Comparison comparison={feedback.comparison} />}

        <section className="mt-12" aria-labelledby="criteria-heading">
          <h2 id="criteria-heading" className="mb-5 font-display text-2xl">
            Criterion by criterion
          </h2>
          <div className="space-y-4">
            {feedback.criteria.map((c, i) => (
              <CriterionCard
                key={c.criterion}
                assessment={c}
                rubric={rubric}
                index={i}
                onQuote={focusQuote}
                activeQuote={activeQuote}
              />
            ))}
          </div>
        </section>

        {feedback.findings.length > 0 && <Findings findings={feedback.findings} />}

        <Coverage feedback={feedback} />

        <section className="card mt-14 flex flex-col gap-4 rounded-3xl p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl">Try again.</h2>
            <p className="mt-1 text-sm text-muted">The next review shows what you fixed.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Magnetic>
              <ButtonLink to={`/attempts/${submission.attemptId}`}>Revise this design</ButtonLink>
            </Magnetic>
            <Button
              variant="ghost"
              disabled={startingFresh}
              onClick={async () => {
                setStartingFresh(true);
                const attempt = await api.startAttempt(problem.slug).catch(() => null);
                if (attempt) navigate(`/attempts/${attempt.id}`);
                else setStartingFresh(false);
              }}
            >
              Start from scratch
            </Button>
          </div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:self-start">
        <div className="flex h-full flex-col overflow-hidden card rounded-2xl">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[13px] font-medium">Your submission</h2>
            <span className="font-mono text-[11px] text-muted">{quotes.length} passages cited</span>
          </div>
          <div className="scrollbar-thin overflow-y-auto px-5 py-5">
            <SubmissionView canvas={submission.content} problem={problem} quotes={quotes} active={activeQuote} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function ModeChip({
  feedback,
  retryable,
  onRetry,
}: {
  feedback: Feedback;
  retryable: boolean;
  onRetry: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (feedback.mode === "full") {
    return (
      <p className="inline-flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
        Rules + AI review
        {feedback.usage && (
          <span className="text-faint">
            · {feedback.usage.model}
            {feedback.usage.cached ? " · reused from an identical submission" : ""}
          </span>
        )}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/30 bg-amber/[0.06] px-4 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
      <p className="text-[13px]">
        <span className="font-medium">Rule-based review only.</span>{" "}
        <span className="text-muted">{feedback.degradedReason}</span>
      </p>
      {retryable && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onRetry().finally(() => setBusy(false));
          }}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-[12px] hover:bg-black/[0.05]"
        >
          {busy && <Spinner />}
          Ask for the AI review
        </button>
      )}
    </div>
  );
}

function BandProfile({ feedback }: { feedback: Feedback }) {
  return (
    <Reveal delay={0.2}>
      <h2 className="mb-3 text-[13px] font-medium text-muted">Rubric profile</h2>
      <ul className="card divide-y divide-line rounded-2xl">
        {feedback.criteria.map((c, i) => (
          <li key={c.criterion}>
            <a
              href={`#c-${c.criterion}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-black/[0.03]"
            >
              <span className="text-[14px]">{CRITERION_SHORT[c.criterion]}</span>
              <span className="flex items-center gap-3">
                <span className="hidden font-mono text-[11px] text-muted sm:inline">{BAND_LABEL[c.band]}</span>
                <BandMeter band={c.band} delay={0.3 + i * 0.08} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function CriterionCard({
  assessment: a,
  rubric,
  index,
  onQuote,
  activeQuote,
}: {
  assessment: CriterionAssessment;
  rubric: Rubric;
  index: number;
  onQuote: (id: string) => void;
  activeQuote: string | null;
}) {
  const reduce = useReducedMotion();
  const criterion = rubric.criteria.find((c) => c.id === a.criterion);
  return (
    <motion.article
      id={`c-${a.criterion}`}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-6% 0px" }}
      transition={{ duration: 0.6, ease: EASE, delay: (index % 2) * 0.05 }}
      className="scroll-mt-24 card rounded-2xl p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">{criterion?.name ?? a.criterion}</h3>
          <p className="mt-1 max-w-xl text-[13px] text-muted">{criterion?.question}</p>
        </div>
        <div className="text-right">
          <BandMeter band={a.band} />
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {BAND_LABEL[a.band]} · {a.source === "ai" ? "AI" : "rules"} · {a.confidence} confidence
          </p>
        </div>
      </div>

      {criterion && (
        <p className="mt-4 border-l-2 border-line-strong pl-3 text-[13px] italic text-muted">
          “{criterion.levels[a.band]}”
        </p>
      )}

      {a.cappedFrom && (
        <p className="mt-4 rounded-lg border border-amber/25 bg-amber/[0.06] px-3 py-2 text-[12.5px]">
          Capped from {BAND_LABEL[a.cappedFrom]} to {BAND_LABEL[a.band]}: {a.capReason}
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-1.5 font-mono text-[11px] text-redline">Concern</p>
          <p className="text-[14px] leading-relaxed">{a.concern}</p>
        </div>
        <div>
          <p className="mb-1.5 font-mono text-[11px] text-ok">Try this</p>
          <p className="text-[14px] leading-relaxed">{a.suggestion}</p>
        </div>
      </div>

      {a.evidence.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 font-mono text-[11px] text-muted">Evidence from your design</p>
          <ul className="space-y-1.5">
            {a.evidence.map((e, i) => {
              const id = `${a.criterion}-${a.evidence.filter((x, j) => x.verified && j < i).length}`;
              return (
                <li key={i}>
                  {e.verified ? (
                    <button
                      onClick={() => onQuote(id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left font-mono text-[12px] leading-relaxed transition-colors ${
                        activeQuote === id
                          ? "border-redline/50 bg-redline/[0.08]"
                          : "border-line hover:border-line-strong"
                      }`}
                    >
                      “{e.text}”
                    </button>
                  ) : (
                    <p
                      className="rounded-lg border border-dashed border-line px-3 py-2 font-mono text-[12px] text-faint"
                      title="This quote could not be found in your submission"
                    >
                      “{e.text}” <span className="not-italic">· not found in your design</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </motion.article>
  );
}

function Comparison({ comparison }: { comparison: NonNullable<Feedback["comparison"]> }) {
  return (
    <section className="mt-12 rounded-3xl border border-line bg-gradient-to-br from-panel to-canvas p-7">
      <h2 className="font-display text-2xl">Since revision {comparison.previousRevision}</h2>
      {comparison.bandChanges.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {comparison.bandChanges.map((c) => {
            const up = c.to > c.from;
            return (
              <li
                key={c.criterion}
                className={`rounded-full border px-3 py-1.5 text-[13px] ${up ? "border-ok/40 text-ok" : "border-redline/40 text-redline"}`}
              >
                {CRITERION_SHORT[c.criterion]} {up ? "↑" : "↓"} {BAND_LABEL[c.from]} → {BAND_LABEL[c.to]}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No band moved. Look at what is still open below.</p>
      )}
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <FindingColumn title="Fixed" findings={comparison.resolved} tone="ok" empty="Nothing fixed yet." />
        <FindingColumn title="Still open" findings={comparison.persisting} tone="muted" empty="Nothing carried over." />
        <FindingColumn title="New" findings={comparison.introduced} tone="redline" empty="No new issues." />
      </div>
    </section>
  );
}

function FindingColumn({
  title,
  findings,
  tone,
  empty,
}: {
  title: string;
  findings: Finding[];
  tone: "ok" | "muted" | "redline";
  empty: string;
}) {
  const color = { ok: "text-ok", muted: "text-muted", redline: "text-redline" }[tone];
  return (
    <div>
      <p className={`mb-2 font-mono text-[11px] ${color}`}>
        {title} · {findings.length}
      </p>
      {findings.length === 0 ? (
        <p className="text-[13px] text-faint">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {findings.map((f) => (
            <li
              key={`${f.code}:${f.subject}`}
              className={`text-[13px] ${tone === "ok" ? "text-fg/70 line-through decoration-ok/60" : "text-fg/85"}`}
            >
              {findingTitle(f.code)}
              {f.subject ? <span className="font-mono text-[11.5px] text-muted"> · {f.subject}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Findings({ findings }: { findings: Finding[] }) {
  return (
    <section className="mt-14" aria-labelledby="findings-heading">
      <h2 id="findings-heading" className="font-display text-2xl">
        Structural checks
      </h2>
      <ul className="mt-5 card divide-y divide-line rounded-2xl">
        {findings.map((f) => (
          <li key={`${f.code}:${f.subject ?? ""}`} className="grid gap-2 px-5 py-4 sm:grid-cols-[110px_minmax(0,1fr)]">
            <div className="pt-0.5">
              <SeverityTag severity={f.severity} />
            </div>
            <div>
              <p className="text-[14px] font-medium">
                {findingTitle(f.code)}
                <span className="ml-2 font-mono text-[11px] font-normal text-faint">
                  {CRITERION_SHORT[f.criterion]}
                </span>
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-fg/80">{f.message}</p>
              {f.suggestion && <p className="mt-1 text-[13px] leading-relaxed text-muted">{f.suggestion}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Coverage({ feedback }: { feedback: Feedback }) {
  if (feedback.coverage.length === 0) return null;
  return (
    <section className="mt-14" aria-labelledby="coverage-heading">
      <h2 id="coverage-heading" className="font-display text-2xl">
        Requirement coverage
      </h2>
      <ul className="mt-5 space-y-px overflow-hidden rounded-2xl border border-line bg-line">
        {feedback.coverage.map((c) => (
          <li
            key={c.requirementId}
            className="grid gap-2 bg-panel px-5 py-3.5 sm:grid-cols-[70px_minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center"
          >
            <span className={`font-mono text-[12px] ${c.status === "covered" ? "text-ok" : "text-redline"}`}>
              {c.requirementId}
            </span>
            <span className="text-[13.5px] text-fg/85">{c.text}</span>
            <span className="font-mono text-[12px] text-muted">
              {c.mappedTo.length
                ? c.mappedTo.join(", ")
                : c.status === "broken"
                  ? "mapped to a deleted class"
                  : "not mapped"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
