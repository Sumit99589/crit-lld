import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { api } from "../lib/api";
import { EASE } from "../lib/format";
import { useAsync } from "../lib/useAsync";

/**
 * Wordmark: "crit" with the dot of the i replaced by a red square,
 * the mark a reviewer leaves on a page.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-baseline ${className}`} aria-label="crit, home">
      <span aria-hidden className="font-display text-[27px] leading-none">
        cr
        <span className="relative inline-block">
          ı
          <span className="absolute left-1/2 top-[0.02em] h-[0.2em] w-[0.2em] -translate-x-1/2 bg-redline transition-transform duration-300 ease-out-quint group-hover:-translate-y-[0.12em] group-hover:rotate-45" />
        </span>
        t
      </span>
    </Link>
  );
}

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `relative text-[15px] font-medium transition-colors duration-200 ${isActive ? "text-fg" : "text-muted hover:text-fg"}`
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              className="absolute -bottom-[19px] left-0 right-0 h-[3px] bg-ink"
              transition={{ duration: 0.45, ease: EASE }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const location = useLocation();
  const health = useAsync(() => api.health(), []);
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const inWorkspace = location.pathname.startsWith("/attempts/");
  const wide = location.pathname.startsWith("/submissions/");

  // Hide on scroll down, show on scroll up. The workspace keeps it fixed.
  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    setHidden(!inWorkspace && y > 120 && y > previous);
  });

  const ai = health.data?.ai;

  return (
    <div className="relative min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>
      <motion.header
        animate={{ y: hidden ? -80 : 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="sticky top-0 z-50 border-b-2 border-ink bg-canvas"
      >
        <div
          className={`mx-auto flex h-14 items-center justify-between px-4 sm:px-6 ${inWorkspace ? "max-w-none" : wide ? "max-w-[1320px]" : "max-w-6xl"}`}
        >
          <div className="flex items-center gap-8">
            <Wordmark />
            <nav className="flex items-center gap-6" aria-label="Main">
              <NavItem to="/">Practice</NavItem>
              <NavItem to="/history">Progress</NavItem>
            </nav>
          </div>
          {ai && (
            <span
              className="hidden items-center gap-2 rounded-full border-2 border-ink bg-panel px-3 py-1 font-mono text-[11px] sm:inline-flex"
              title={ai.enabled ? `AI review by ${ai.model}` : "Rule-based feedback only"}
            >
              <span className={`h-2 w-2 rounded-full border border-ink ${ai.enabled ? "bg-mint" : "bg-sun"}`} />
              {ai.enabled ? "AI review on" : "Rules-only mode"}
            </span>
          )}
        </div>
      </motion.header>
      <main id="main">
        <Outlet />
      </main>
    </div>
  );
}
