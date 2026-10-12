import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useMemo, useRef, type ElementType, type ReactNode } from "react";
import { EASE } from "../lib/format";

/** Words rise out of a mask one by one. Used for page titles only, so it stays special. */
export function WordReveal({
  text,
  as: Tag = "h1",
  className = "",
  delay = 0,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const MotionTag = useMemo(() => motion.create(Tag), [Tag]);
  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="show"
      aria-label={text.replace(/\n/g, " ")}
      variants={{ show: { transition: { staggerChildren: 0.055, delayChildren: delay } } }}
    >
      {text
        .split(/(\n| )/)
        .filter((w) => w && w !== " ")
        .map((word, i) =>
          word === "\n" ? (
            <br key={i} />
          ) : (
            <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
              <motion.span
                className="inline-block"
                variants={{
                  hidden: reduce ? { opacity: 0 } : { y: "110%", rotate: 3 },
                  show: { y: 0, rotate: 0, opacity: 1, transition: { duration: 0.85, ease: EASE } },
                }}
              >
                {word}
                {" "}
              </motion.span>
            </span>
          ),
        )}
    </MotionTag>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  inView = false,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  inView?: boolean;
}) {
  const reduce = useReducedMotion();
  const from = { opacity: 0, y: reduce ? 0 : y };
  const to = { opacity: 1, y: 0 };
  return (
    <motion.div
      className={className}
      initial={from}
      {...(inView ? { whileInView: to, viewport: { once: true, margin: "-8% 0px" } } : { animate: to })}
      transition={{ duration: 0.75, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** The primary action leans toward the cursor a little. */
export function Magnetic({
  children,
  strength = 0.25,
  className = "inline-block",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 160, damping: 16 });
  const y = useSpring(useMotionValue(0), { stiffness: 160, damping: 16 });
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      className={className}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** A soft light follows the cursor across the surface. */
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const mx = useMotionValue(-600);
  const my = useMotionValue(-600);
  const bg = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, rgba(255,90,54,0.09), transparent 70%)`;
  return (
    <div
      className={`group relative overflow-hidden ${className}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        mx.set(-600);
        my.set(-600);
      }}
    >
      <motion.div
        aria-hidden
        style={{ background: bg }}
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
