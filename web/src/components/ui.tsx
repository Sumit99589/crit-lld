import { motion, useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { BAND_LABEL, EASE, SEVERITY_LABEL } from "../lib/format";
import type { Band, Difficulty, Severity } from "../lib/types";

type Variant = "primary" | "ghost" | "quiet";

const BUTTON: Record<Variant, string> = {
  primary: "bg-fg text-white hover:bg-fg/85 shadow-[0_1px_2px_rgba(17,20,28,0.2),0_8px_24px_-10px_rgba(17,20,28,0.45)]",
  ghost: "border border-line-strong bg-panel text-fg hover:border-black/25 hover:bg-black/[0.03]",
  quiet: "text-muted hover:text-fg",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-[background,border-color,color,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${BUTTON[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = "primary",
  children,
  className = "",
}: {
  to: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-[background,border-color,color] duration-200 ${BUTTON[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Four pips, filled up to the band. Animates its fill once when it appears. */
export function BandMeter({
  band,
  size = "md",
  delay = 0,
}: {
  band: Band | null | undefined;
  size?: "sm" | "md";
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const pip = size === "sm" ? "h-1.5 w-3" : "h-2 w-5";
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={band ? `${BAND_LABEL[band]} (${band} of 4)` : "Not assessed"}
    >
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={`${pip} overflow-hidden rounded-full bg-black/[0.08]`}>
          {band && n <= band && (
            <motion.span
              className={`block h-full rounded-full ${band === 4 ? "bg-ok" : band >= 3 ? "bg-fg/85" : band === 2 ? "bg-amber" : "bg-redline"}`}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: delay + n * 0.07 }}
            />
          )}
        </span>
      ))}
    </span>
  );
}

export function BandLabel({ band }: { band: Band }) {
  return <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{BAND_LABEL[band]}</span>;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  major: "text-redline border-redline/35 bg-redline/10",
  minor: "text-amber border-amber/30 bg-amber/10",
  note: "text-muted border-line-strong bg-black/[0.03]",
};

export function SeverityTag({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${SEVERITY_STYLE[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const DIFFICULTY_DOTS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 w-1.5 rounded-full ${n <= DIFFICULTY_DOTS[difficulty] ? "bg-fg/80" : "bg-black/10"}`}
          />
        ))}
      </span>
      {difficulty}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.04] ${className}`} />;
}

export function ErrorPanel({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-redline/30 bg-redline/[0.06] p-6">
      <p className="text-sm text-fg">{error.message}</p>
      {onRetry && (
        <Button variant="ghost" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[13px] font-medium text-muted">{children}</h2>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent ${className}`}
    />
  );
}
