import { motion, useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { ApiError } from "../lib/api";
import { BAND_LABEL, EASE, SEVERITY_LABEL } from "../lib/format";
import type { Band, Difficulty, Severity } from "../lib/types";

type Variant = "primary" | "ghost" | "quiet";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-45";

const BUTTON: Record<Variant, string> = {
  primary: "press bg-sun text-ink",
  ghost: "press bg-panel text-ink",
  quiet: "text-muted underline decoration-2 underline-offset-4 hover:text-ink",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${BASE} ${BUTTON[variant]} ${className}`} {...rest}>
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
    <Link to={to} className={`${BASE} ${BUTTON[variant]} ${className}`}>
      {children}
    </Link>
  );
}

const BAND_FILL: Record<Band, string> = { 1: "bg-redline", 2: "bg-sun", 3: "bg-cobalt", 4: "bg-mint" };

/** Four chunky segments, filled up to the band. Animates its fill once when it appears. */
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
  const seg = size === "sm" ? "h-2.5 w-3.5" : "h-3.5 w-6";
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      role="img"
      aria-label={band ? `${BAND_LABEL[band]} (${band} of 4)` : "Not assessed"}
    >
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={`${seg} overflow-hidden rounded-[3px] border-[1.5px] border-ink bg-panel`}>
          {band && n <= band && (
            <motion.span
              className={`block h-full ${BAND_FILL[band]}`}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ originY: 1 }}
              transition={{ duration: 0.35, ease: EASE, delay: delay + n * 0.07 }}
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
  major: "bg-redline text-white",
  minor: "bg-sun text-ink",
  note: "bg-panel text-ink",
};

export function SeverityTag({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border-[1.5px] border-ink px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wide ${SEVERITY_STYLE[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const DIFFICULTY: Record<Difficulty, string> = {
  easy: "bg-mint",
  medium: "bg-sun",
  hard: "bg-redline text-white",
};

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-[1.5px] border-ink px-2 py-px font-mono text-[10.5px] font-medium ${DIFFICULTY[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ink/[0.06] ${className}`} />;
}

export function ErrorPanel({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  // A 404 won't succeed on retry. Usually an old link: the demo server's data resets when it restarts.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div role="alert" className="card rounded-xl bg-panel p-6">
        <p className="font-display text-2xl">This link has expired.</p>
        <p className="mt-2 text-sm text-muted">
          The work it pointed to isn't on the server any more. The demo resets its data when it restarts, so older
          links stop working. Pick a problem to start again.
        </p>
        <ButtonLink to="/" className="mt-5">
          Back to problems
        </ButtonLink>
      </div>
    );
  }
  return (
    <div role="alert" className="card rounded-xl bg-redline-soft p-6">
      <p className="text-sm font-medium">{error.message}</p>
      {onRetry && (
        <Button variant="ghost" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[13px] font-semibold uppercase tracking-wider">{children}</h2>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}
