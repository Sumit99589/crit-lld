import { AnimatePresence, motion } from "motion/react";
import { EASE, findingTitle } from "../../lib/format";
import type { Precheck } from "../../lib/types";
import { SeverityTag } from "../../components/ui";
import { sectionForPath, type SectionId } from "./sections";

/** Live, deterministic checks while the learner edits. Blocking issues first, then advice. */
export function Preflight({ precheck, onJump }: { precheck: Precheck | undefined; onJump: (s: SectionId) => void }) {
  if (!precheck) return <p className="text-sm text-faint">Checking…</p>;
  const blockers = precheck.readiness;
  const advice = precheck.findings.filter((f) => f.severity !== "note");
  const notes = precheck.findings.filter((f) => f.severity === "note");

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[13px] font-medium">
          {blockers.length === 0 ? (
            <span className="text-ok">Ready to submit</span>
          ) : (
            <span>
              {blockers.length} thing{blockers.length > 1 ? "s" : ""} before you can submit
            </span>
          )}
        </p>
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {blockers.map((b) => (
              <motion.li
                key={`${b.path}:${b.message}`}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <button
                  type="button"
                  onClick={() => onJump(sectionForPath(b.path))}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-fg/85 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full border border-redline" aria-hidden />
                  {b.message}
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {(advice.length > 0 || notes.length > 0) && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Worth a look</p>
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {[...advice, ...notes].map((f) => (
                <motion.li
                  key={`${f.code}:${f.subject ?? ""}`}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="rounded-lg px-2 py-1.5"
                  title={f.suggestion}
                >
                  <div className="flex items-center gap-2">
                    <SeverityTag severity={f.severity} />
                    <span className="text-[13px]">{findingTitle(f.code)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{f.message}</p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}
