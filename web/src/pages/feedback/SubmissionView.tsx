import { Fragment, useMemo, type ReactNode } from "react";
import type { DesignCanvas, Problem } from "../../lib/types";

export interface Quote {
  id: string;
  text: string;
}

interface Block {
  key: string;
  heading?: string;
  text: string;
  mono?: boolean;
}

/** Breaks a quote into the pieces we can find in a single block (quotes may span lines or use "..."). */
function fragments(quote: string): string[] {
  return quote
    .split(/\n|\.{3}|…/)
    .map((f) =>
      f
        .replace(/^(responsibility|attributes|methods):\s*/i, "")
        .replace(/^[-\s"“]+|["”\s.,;]+$/g, "")
        .trim(),
    )
    .filter((f) => f.length >= 10);
}

function blocksOf(canvas: DesignCanvas, problem: Problem): Block[] {
  const names = new Map(canvas.entities.map((e) => [e.id, e.name]));
  const blocks: Block[] = [{ key: "assumptions", heading: "Assumptions", text: canvas.assumptions || "(none)" }];
  for (const e of canvas.entities.filter((x) => x.name)) {
    blocks.push({ key: `e-${e.id}`, heading: `${e.name} · ${e.kind}`, text: e.responsibility });
    if (e.methods.trim())
      blocks.push({ key: `m-${e.id}`, text: e.methods.split(/\n/).filter(Boolean).join("\n"), mono: true });
  }
  blocks.push({
    key: "relationships",
    heading: "Relationships",
    mono: true,
    text:
      canvas.relationships
        .map((r) => `${names.get(r.from)} ${r.type} ${names.get(r.to)}${r.label ? ` (${r.label})` : ""}`)
        .join("\n") || "(none)",
  });
  blocks.push({
    key: "map",
    heading: "Requirement map",
    mono: true,
    text: problem.requirements
      .map(
        (r) =>
          `${r.id}: ${
            (canvas.requirementMap[r.id] ?? [])
              .map((id) => names.get(id))
              .filter(Boolean)
              .join(", ") || "(unmapped)"
          }`,
      )
      .join("\n"),
  });
  blocks.push({ key: "flow", heading: "Key flow", text: canvas.keyFlow });
  blocks.push({ key: "decisions", heading: "Decisions", text: canvas.decisions || "(none)" });
  blocks.push({
    key: "change",
    heading: `Change · ${problem.changeScenario.title}`,
    text: canvas.changeResponse || "(none)",
  });
  return blocks;
}

interface Range {
  start: number;
  end: number;
  quoteId: string;
}

function rangesIn(text: string, quotes: Quote[]): Range[] {
  const lower = text.toLowerCase();
  const ranges: Range[] = [];
  for (const q of quotes) {
    for (const frag of fragments(q.text)) {
      const at = lower.indexOf(frag.toLowerCase());
      if (at >= 0) ranges.push({ start: at, end: at + frag.length, quoteId: q.id });
    }
  }
  // Keep the earliest, then longest, and drop overlaps so marks never nest.
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Range[] = [];
  for (const r of ranges) if (!kept.length || r.start >= kept[kept.length - 1]!.end) kept.push(r);
  return kept;
}

function marked(text: string, quotes: Quote[], active: string | null): ReactNode {
  const ranges = rangesIn(text, quotes);
  if (!ranges.length) return text;
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    out.push(<Fragment key={`t${i}`}>{text.slice(at, r.start)}</Fragment>);
    out.push(
      <span
        key={`m${i}`}
        id={`q-${r.quoteId}`}
        className="redline scroll-mt-32"
        data-drawn="true"
        data-active={active === r.quoteId}
      >
        {text.slice(r.start, r.end)}
      </span>,
    );
    at = r.end;
  });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return out;
}

/** The learner's own design, with every verified evidence quote marked in red. */
export function SubmissionView({
  canvas,
  problem,
  quotes,
  active,
}: {
  canvas: DesignCanvas;
  problem: Problem;
  quotes: Quote[];
  active: string | null;
}) {
  const blocks = useMemo(() => blocksOf(canvas, problem), [canvas, problem]);
  return (
    <div className="space-y-4">
      {blocks.map((b) => (
        <div key={b.key}>
          {b.heading && <p className="mb-1 font-mono text-[10.5px] text-faint">{b.heading}</p>}
          <p
            className={`whitespace-pre-wrap leading-relaxed ${b.mono ? "font-mono text-[11.5px] text-fg/75" : "text-[13px] text-fg/85"}`}
          >
            {marked(b.text, quotes, active)}
          </p>
        </div>
      ))}
    </div>
  );
}
