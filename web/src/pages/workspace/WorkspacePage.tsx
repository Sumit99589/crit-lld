import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ClassDiagram, DiagramLegend, DiagramMarkers } from "../../components/ClassDiagram";
import { Magnetic } from "../../components/motion";
import { Button, ErrorPanel, Skeleton, Spinner } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { EASE, newId, timeAgo } from "../../lib/format";
import type { DesignCanvas, Precheck, Problem, RevisionSummary } from "../../lib/types";
import { useAsync, useDebounced } from "../../lib/useAsync";
import { ClassesEditor, NarrativeEditor, RelationshipsEditor, RequirementMapEditor } from "./editors";
import { Preflight } from "./Preflight";
import { EMPTY_CANVAS, SECTIONS, sectionForPath, type SectionId } from "./sections";

type SaveState = "saved" | "dirty" | "saving" | "error";
type MobilePane = "brief" | "design" | "checks";

export function WorkspacePage() {
  const { attemptId = "" } = useParams();
  const loaded = useAsync(async () => {
    const { attempt, revisions } = await api.attempt(attemptId);
    const problem = await api.problem(attempt.problemSlug);
    return { attempt, revisions, problem };
  }, [attemptId]);

  if (loaded.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <ErrorPanel error={loaded.error} onRetry={loaded.reload} />
      </div>
    );
  }
  if (!loaded.data) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[300px_1fr_420px]">
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[70vh]" />
      </div>
    );
  }
  return (
    <Workspace
      key={attemptId}
      attemptId={attemptId}
      problem={loaded.data.problem}
      initial={{ ...EMPTY_CANVAS, ...loaded.data.attempt.draft }}
      revisions={loaded.data.revisions}
    />
  );
}

function Workspace({
  attemptId,
  problem,
  initial,
  revisions,
}: {
  attemptId: string;
  problem: Problem;
  initial: DesignCanvas;
  revisions: RevisionSummary[];
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DesignCanvas>(initial);
  const [section, setSection] = useState<SectionId>(initial.entities.length ? "classes" : "assumptions");
  const [mobilePane, setMobilePane] = useState<MobilePane>("design");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<string>();
  const [precheck, setPrecheck] = useState<Precheck>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [diagramOpen, setDiagramOpen] = useState(false);
  const dirty = useRef(false);
  // One key per version of the draft: a double click or a network retry reuses it.
  const idempotencyKey = useRef(newId("sub-"));

  const update = useCallback((patch: (d: DesignCanvas) => DesignCanvas) => {
    dirty.current = true;
    idempotencyKey.current = newId("sub-");
    setSaveState("dirty");
    setDraft((d) => patch(d));
  }, []);

  // Autosave, debounced.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        const { savedAt } = await api.saveDraft(attemptId, draft);
        dirty.current = false;
        setSavedAt(savedAt);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 900);
    return () => clearTimeout(t);
  }, [draft, attemptId]);

  // Live pre-flight checks, debounced. Deterministic and free, so it can run on every pause.
  const checked = useDebounced(draft, 500);
  useEffect(() => {
    let live = true;
    api
      .precheck(attemptId, checked)
      .then((r) => live && setPrecheck(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [checked, attemptId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const { submission } = await api.submit(attemptId, draft, idempotencyKey.current);
      dirty.current = false;
      navigate(`/submissions/${submission.id}`);
    } catch (e) {
      setSubmitting(false);
      if (e instanceof ApiError && e.issues.length > 0) {
        setSubmitError(e.message);
        setSection(sectionForPath(e.issues[0]!.path));
      } else {
        setSubmitError((e as Error).message);
      }
    }
  }, [attemptId, draft, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && precheck?.readiness.length === 0 && !submitting) {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [precheck, submit, submitting]);

  const blockers = precheck?.readiness.length ?? 1;
  const coverage = precheck?.coverage ?? [];
  const meta = SECTIONS.find((s) => s.id === section)!;
  const set = (key: "assumptions" | "keyFlow" | "decisions" | "changeResponse") => (v: string) =>
    update((d) => ({ ...d, [key]: v }));

  return (
    <div className="lg:h-[calc(100dvh-56px)]">
      <DiagramMarkers />
      <AnimatePresence>
        {diagramOpen && <DiagramOverlay draft={draft} title={problem.title} onClose={() => setDiagramOpen(false)} />}
      </AnimatePresence>
      <div
        role="tablist"
        aria-label="Workspace panes"
        className="sticky top-14 z-40 flex border-b border-line bg-ink/90 backdrop-blur lg:hidden"
      >
        {(["brief", "design", "checks"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={mobilePane === p}
            onClick={() => setMobilePane(p)}
            className={`flex-1 py-3 text-sm capitalize ${mobilePane === p ? "text-fg shadow-[inset_0_-1px_0_#ff5a36]" : "text-muted"}`}
          >
            {p === "checks" ? "Diagram & checks" : p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] lg:h-full lg:grid-cols-[290px_minmax(0,1fr)_minmax(360px,440px)]">
        {/* Brief */}
        <aside
          className={`scrollbar-thin border-line lg:block lg:overflow-y-auto lg:border-r ${mobilePane === "brief" ? "block" : "hidden"}`}
        >
          <BriefPanel problem={problem} coverage={coverage} revisions={revisions} />
        </aside>

        {/* Canvas */}
        <section
          className={`scrollbar-thin lg:block lg:overflow-y-auto ${mobilePane === "design" ? "block" : "hidden"}`}
          aria-label="Design canvas"
        >
          <nav
            className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-line bg-ink/90 px-4 py-2.5 backdrop-blur scrollbar-thin"
            aria-label="Canvas sections"
          >
            {SECTIONS.map((s) => {
              const active = s.id === section;
              const done = s.done(draft);
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  aria-current={active ? "step" : undefined}
                  className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${active ? "text-ink" : "text-muted hover:text-fg"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="section-pill"
                      className="absolute inset-0 rounded-full bg-fg"
                      transition={{ duration: 0.35, ease: EASE }}
                    />
                  )}
                  <span
                    className={`relative h-1.5 w-1.5 rounded-full ${done ? (active ? "bg-ink" : "bg-ok") : active ? "border border-ink" : "border border-faint"}`}
                    aria-hidden
                  />
                  <span className="relative">
                    {s.label}
                    {s.id === "classes" && draft.entities.length > 0 && (
                      <span className="ml-1 opacity-60">{draft.entities.length}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <h1 className="font-display text-4xl tracking-tight">{meta.label}</h1>
                <p className="mb-7 mt-2 max-w-xl text-[14px] leading-relaxed text-muted">{meta.guide}</p>

                {section === "assumptions" && (
                  <NarrativeEditor
                    label="Assumptions"
                    value={draft.assumptions}
                    onChange={set("assumptions")}
                    placeholder={
                      "One lot only.\nMotorcycles take compact spots, cars regular, vans large.\nCard payments either succeed or the driver retries at the gate."
                    }
                  />
                )}
                {section === "classes" && <ClassesEditor draft={draft} update={update} />}
                {section === "relationships" && <RelationshipsEditor draft={draft} update={update} />}
                {section === "mapping" && (
                  <RequirementMapEditor draft={draft} update={update} problem={problem} coverage={coverage} />
                )}
                {section === "flow" && (
                  <NarrativeEditor
                    label="Key flow"
                    value={draft.keyFlow}
                    onChange={set("keyFlow")}
                    placeholder={
                      "1. Gate calls ParkingLot.park(vehicle)\n2. ParkingLot asks SpotAllocator for a spot that fits…\n3. If none is free…"
                    }
                  />
                )}
                {section === "decisions" && (
                  <NarrativeEditor
                    label="Decisions and trade-offs"
                    value={draft.decisions}
                    onChange={set("decisions")}
                    placeholder="I put pricing behind an interface because… The cost is… I considered … but rejected it because…"
                  />
                )}
                {section === "change" && (
                  <>
                    <div className="mb-5 rounded-2xl border border-redline/30 bg-redline/[0.05] p-5">
                      <p className="font-mono text-[11px] text-redline">{problem.changeScenario.title}</p>
                      <p className="mt-2 text-[14px] leading-relaxed">{problem.changeScenario.prompt}</p>
                    </div>
                    <NarrativeEditor
                      label="Response to change"
                      value={draft.changeResponse}
                      onChange={set("changeResponse")}
                      placeholder="New classes: … Existing classes that change: … What stays untouched and why: …"
                    />
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <SectionPager section={section} onGo={setSection} />
          </div>
        </section>

        {/* Diagram, checks and submit */}
        <aside
          className={`flex-col border-line lg:flex lg:min-h-0 lg:border-l ${mobilePane === "checks" ? "flex" : "hidden"}`}
        >
          <div className="border-b border-line">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="text-[13px] font-medium text-muted">Class diagram</h2>
              <span className="flex items-center gap-3 font-mono text-[11px] text-faint">
                {draft.entities.filter((e) => e.name).length} classes · {draft.relationships.length} links
                <button
                  type="button"
                  onClick={() => setDiagramOpen(true)}
                  className="rounded-full border border-line-strong px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-fg"
                >
                  Expand
                </button>
              </span>
            </div>
            <div className="h-[300px] px-3 lg:h-[34vh]">
              <ClassDiagram entities={draft.entities} relationships={draft.relationships} />
            </div>
            <div className="px-5 pb-3 pt-1">
              <DiagramLegend />
            </div>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <Preflight
              precheck={precheck}
              onJump={(s) => {
                setSection(s);
                setMobilePane("design");
              }}
            />
          </div>

          <div className="border-t border-line bg-panel/60 px-5 py-4">
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-muted">
              <SaveIndicator state={saveState} savedAt={savedAt} />
              <span className="hidden lg:inline">Ctrl/⌘ + Enter to submit</span>
            </div>
            {submitError && (
              <p role="alert" className="mb-3 text-[13px] text-redline">
                {submitError}
              </p>
            )}
            <Magnetic strength={0.12} className="block">
              <Button onClick={submit} disabled={blockers > 0 || submitting} className="w-full py-3">
                {submitting && <Spinner />}
                {submitting
                  ? "Submitting"
                  : blockers > 0
                    ? "Finish the checklist to submit"
                    : revisions.length
                      ? `Submit revision ${revisions.length + 1}`
                      : "Submit for review"}
              </Button>
            </Magnetic>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DiagramOverlay({ draft, title, onClose }: { draft: DesignCanvas; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Class diagram"
      className="fixed inset-0 z-[80] flex flex-col bg-ink/95 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <p className="font-display text-2xl">{title} · class diagram</p>
        <div className="flex items-center gap-6">
          <div className="hidden md:block">
            <DiagramLegend />
          </div>
          <Button variant="ghost" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
      </div>
      <motion.div
        className="min-h-0 flex-1 p-6"
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <ClassDiagram entities={draft.entities} relationships={draft.relationships} />
      </motion.div>
    </motion.div>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt?: string }) {
  const text = {
    saved: savedAt ? `Saved ${timeAgo(savedAt)}` : "All changes saved",
    dirty: "Editing…",
    saving: "Saving…",
    error: "Couldn't save. Retrying when you type.",
  }[state];
  return (
    <span className="inline-flex items-center gap-1.5" aria-live="polite">
      <span
        className={`h-1.5 w-1.5 rounded-full ${state === "error" ? "bg-redline" : state === "saved" ? "bg-ok" : "bg-amber"}`}
        aria-hidden
      />
      {text}
    </span>
  );
}

function SectionPager({ section, onGo }: { section: SectionId; onGo: (s: SectionId) => void }) {
  const i = SECTIONS.findIndex((s) => s.id === section);
  const prev = SECTIONS[i - 1];
  const next = SECTIONS[i + 1];
  return (
    <div className="mt-12 flex items-center justify-between border-t border-line pt-6 text-sm">
      {prev ? (
        <button onClick={() => onGo(prev.id)} className="text-muted transition-colors hover:text-fg">
          Back to {prev.label.toLowerCase()}
        </button>
      ) : (
        <span />
      )}
      {next && (
        <button
          onClick={() => onGo(next.id)}
          className="rounded-full border border-line-strong px-4 py-2 transition-colors hover:border-white/30 hover:bg-white/[0.04]"
        >
          Next: {next.label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function BriefPanel({
  problem,
  coverage,
  revisions,
}: {
  problem: Problem;
  coverage: Precheck["coverage"];
  revisions: RevisionSummary[];
}) {
  return (
    <div className="space-y-7 px-5 py-6">
      <div>
        <Link to={`/problems/${problem.slug}`} className="font-mono text-[11px] text-muted hover:text-fg">
          Brief
        </Link>
        <h2 className="mt-1 font-display text-3xl leading-none">{problem.title}</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">{problem.context}</p>
      </div>

      <div>
        <h3 className="mb-3 text-[12px] font-medium text-muted">Requirements</h3>
        <ul className="space-y-2.5">
          {problem.requirements.map((r) => {
            const status = coverage.find((c) => c.requirementId === r.id);
            const covered = status?.status === "covered";
            return (
              <li key={r.id} className="flex gap-2.5 text-[12.5px] leading-relaxed">
                <span
                  className="relative mt-[5px] h-2.5 w-2.5 shrink-0"
                  title={covered ? `Mapped to ${status!.mappedTo.join(", ")}` : "Not mapped to a class yet"}
                >
                  <span className="absolute inset-0 rounded-full border border-faint" />
                  <AnimatePresence>
                    {covered && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-ok"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      />
                    )}
                  </AnimatePresence>
                </span>
                <span>
                  <span className="font-mono text-faint">{r.id}</span> <span className="text-fg/85">{r.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-[12px] font-medium text-muted">Constraints</h3>
        <ul className="space-y-2">
          {problem.constraints.map((c) => (
            <li key={c} className="border-l border-line-strong pl-3 text-[12.5px] leading-relaxed text-fg/80">
              {c}
            </li>
          ))}
        </ul>
      </div>

      {revisions.length > 0 && (
        <div>
          <h3 className="mb-3 text-[12px] font-medium text-muted">Earlier revisions</h3>
          <ul className="space-y-1.5">
            {[...revisions].reverse().map((r) => (
              <li key={r.submissionId}>
                <Link
                  to={`/submissions/${r.submissionId}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12.5px] transition-colors hover:bg-white/[0.04]"
                >
                  <span>Revision {r.revision}</span>
                  <span className="font-mono text-[11px] text-faint">{timeAgo(r.submittedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
