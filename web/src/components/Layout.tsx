import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { api } from "../lib/api";
import { EASE } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export function Wordmark() {
  return (
    <Link to="/" className="group inline-flex items-baseline gap-1.5" aria-label="crit, home">
      <span className="font-display text-[26px] italic leading-none tracking-tight">crit</span>
      <span className="relative top-[-2px] h-[3px] w-4 origin-left rounded-full bg-redline transition-transform duration-500 ease-out-quint group-hover:scale-x-150" />
    </Link>
  );
}

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `relative text-sm transition-colors duration-200 ${isActive ? "text-fg" : "text-muted hover:text-fg"}`
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              className="absolute -bottom-1.5 left-0 right-0 h-px bg-redline"
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
      <div className="grain" aria-hidden />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <motion.header
        animate={{ y: hidden ? -80 : 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="sticky top-0 z-50 border-b border-line bg-ink/75 backdrop-blur-xl"
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
              className="hidden items-center gap-2 font-mono text-[11px] text-muted sm:inline-flex"
              title={ai.enabled ? `AI review by ${ai.model}` : "Rule-based feedback only"}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${ai.enabled ? "bg-ok shadow-[0_0_8px_#7fd1ae]" : "bg-amber"}`}
              />
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
