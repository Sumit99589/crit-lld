import { Graph, layout } from "@dagrejs/dagre";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { EASE } from "../lib/format";
import type { CanvasEntity, CanvasRelationship, RelationType } from "../lib/types";

const CHAR_W = 6.6;
const LINE_H = 15;
const MAX_METHODS = 4;

interface NodeBox {
  entity: CanvasEntity;
  x: number;
  y: number;
  width: number;
  height: number;
  methods: string[];
  hiddenMethods: number;
}

interface EdgePath {
  rel: CanvasRelationship;
  d: string;
  labelAt: { x: number; y: number } | null;
}

// Parents and owners go on top: layout direction is reversed for "is-a" edges.
const UPWARD: RelationType[] = ["inherits", "implements"];

function methodList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function useLayout(entities: CanvasEntity[], relationships: CanvasRelationship[]) {
  return useMemo(() => {
    const named = entities.filter((e) => e.name.trim());
    const ids = new Set(named.map((e) => e.id));
    const g = new Graph({ multigraph: true });
    g.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 56, marginx: 12, marginy: 12 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const e of named) {
      const methods = methodList(e.methods);
      const shown = methods.slice(0, MAX_METHODS);
      const stereotype = e.kind === "interface" || e.kind === "abstract" || e.kind === "enum";
      const longest = Math.max(e.name.length + 2, ...shown.map((m) => m.length), stereotype ? 13 : 0);
      const width = Math.min(240, Math.max(116, longest * CHAR_W + 24));
      const rows = shown.length + (methods.length > MAX_METHODS ? 1 : 0);
      const height = 30 + (stereotype ? 12 : 0) + (rows ? rows * LINE_H + 12 : 6);
      g.setNode(e.id, { width, height, methods: shown, hidden: methods.length - shown.length });
    }

    const edges = relationships.filter((r) => ids.has(r.from) && ids.has(r.to) && r.from !== r.to);
    for (const r of edges) {
      const [v, w] = UPWARD.includes(r.type) ? [r.to, r.from] : [r.from, r.to];
      g.setEdge(v, w, { label: r.label }, r.id);
    }

    layout(g);

    const nodes: NodeBox[] = named.map((entity) => {
      const n = g.node(entity.id) as unknown as {
        x: number;
        y: number;
        width: number;
        height: number;
        methods: string[];
        hidden: number;
      };
      return {
        entity,
        x: n.x - n.width / 2,
        y: n.y - n.height / 2,
        width: n.width,
        height: n.height,
        methods: n.methods,
        hiddenMethods: n.hidden,
      };
    });

    const paths: EdgePath[] = edges.map((rel) => {
      const reversed = UPWARD.includes(rel.type);
      const [v, w] = reversed ? [rel.to, rel.from] : [rel.from, rel.to];
      const raw = (g.edge({ v, w, name: rel.id }) as unknown as { points: { x: number; y: number }[] }).points ?? [];
      // Always draw from the relationship's "from" to its "to" so markers land on the right end.
      const pts = reversed ? [...raw].reverse() : raw;
      const mid = pts[Math.floor(pts.length / 2)];
      return { rel, d: smooth(pts), labelAt: rel.label && mid ? mid : null };
    });

    const graph = g.graph() as { width?: number; height?: number };
    return { nodes, paths, width: Math.max(graph.width ?? 0, 200), height: Math.max(graph.height ?? 0, 120) };
  }, [entities, relationships]);
}

function smooth(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  if (rest.length === 0) return `M${first!.x},${first!.y}`;
  let d = `M${first!.x},${first!.y}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const c = rest[i]!;
    const next = rest[i + 1]!;
    d += ` Q${c.x},${c.y} ${(c.x + next.x) / 2},${(c.y + next.y) / 2}`;
  }
  const last = rest[rest.length - 1]!;
  return `${d} L${last.x},${last.y}`;
}

const STROKE = "rgba(20,22,28,0.55)";

function edgeStyle(type: RelationType) {
  switch (type) {
    case "inherits":
      return { dash: undefined, end: "url(#m-triangle)", start: undefined };
    case "implements":
      return { dash: "5 4", end: "url(#m-triangle)", start: undefined };
    case "composes":
      return { dash: undefined, end: undefined, start: "url(#m-diamond-filled)" };
    case "aggregates":
      return { dash: undefined, end: undefined, start: "url(#m-diamond)" };
    case "depends":
      return { dash: "5 4", end: "url(#m-arrow)", start: undefined };
    default:
      return { dash: undefined, end: "url(#m-arrow)", start: undefined };
  }
}

export function ClassDiagram({
  entities,
  relationships,
  highlight,
}: {
  entities: CanvasEntity[];
  relationships: CanvasRelationship[];
  highlight?: Set<string>;
}) {
  const reduce = useReducedMotion();
  const { nodes, paths, width, height } = useLayout(entities, relationships);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 px-6 text-center">
        <svg width="56" height="40" viewBox="0 0 56 40" aria-hidden className="opacity-40">
          <rect x="1" y="1" width="22" height="16" rx="3" fill="none" stroke="currentColor" />
          <rect x="33" y="23" width="22" height="16" rx="3" fill="none" stroke="currentColor" />
          <path d="M23 9 C 30 9, 30 31, 33 31" fill="none" stroke="currentColor" strokeDasharray="3 3" />
        </svg>
        <p className="text-sm text-muted">Your class diagram draws itself as you add classes.</p>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Class diagram with ${nodes.length} classes and ${paths.length} relationships`}
    >
      {nodes.map((n) => {
        const { entity } = n;
        const stereotype = entity.kind === "class" ? null : `«${entity.kind}»`;
        const lit = highlight?.has(entity.name.toLowerCase());
        const headerH = 30 + (stereotype ? 12 : 0);
        return (
          <motion.g
            key={entity.id}
            initial={reduce ? false : { opacity: 0, scale: 0.92, x: n.x, y: n.y }}
            animate={{ opacity: 1, scale: 1, x: n.x, y: n.y }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <rect
              width={n.width}
              height={n.height}
              rx={7}
              fill={lit ? "rgba(220,74,38,0.08)" : "#ffffff"}
              stroke={lit ? "rgba(220,74,38,0.7)" : "rgba(20,22,28,0.22)"}
            />
            {stereotype && (
              <text x={n.width / 2} y={15} textAnchor="middle" className="fill-muted font-mono" fontSize={9}>
                {stereotype}
              </text>
            )}
            <text
              x={n.width / 2}
              y={stereotype ? 31 : 19.5}
              textAnchor="middle"
              className="fill-fg font-mono"
              fontSize={11.5}
              fontWeight={500}
              fontStyle={entity.kind === "abstract" ? "italic" : "normal"}
            >
              {entity.name}
            </text>
            {(n.methods.length > 0 || n.hiddenMethods > 0) && (
              <>
                <line x1={0} x2={n.width} y1={headerH} y2={headerH} stroke="rgba(20,22,28,0.1)" />
                {n.methods.map((m, i) => (
                  <text key={i} x={10} y={headerH + 15 + i * LINE_H} className="fill-muted font-mono" fontSize={9.5}>
                    {m.length > 32 ? `${m.slice(0, 31)}…` : m}
                  </text>
                ))}
                {n.hiddenMethods > 0 && (
                  <text
                    x={10}
                    y={headerH + 15 + n.methods.length * LINE_H}
                    className="fill-faint font-mono"
                    fontSize={9.5}
                  >
                    +{n.hiddenMethods} more
                  </text>
                )}
              </>
            )}
          </motion.g>
        );
      })}

      {/* Edges on top so markers at the owning end are never hidden under a box. */}
      {paths.map(({ rel, d, labelAt }) => {
        const s = edgeStyle(rel.type);
        return (
          <g key={rel.id}>
            <motion.path
              d={d}
              fill="none"
              stroke={STROKE}
              strokeWidth={1.2}
              strokeDasharray={s.dash}
              markerEnd={s.end}
              markerStart={s.start}
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            />
            {labelAt && (
              <text x={labelAt.x + 6} y={labelAt.y - 4} className="fill-muted font-mono" fontSize={9.5}>
                {rel.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Marker definitions shared by the diagram and its legend; render once per page. */
export function DiagramMarkers() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <marker
          id="m-triangle"
          viewBox="0 0 12 12"
          refX="11"
          refY="6"
          markerWidth="11"
          markerHeight="11"
          orient="auto-start-reverse"
        >
          <path d="M1,1 L11,6 L1,11 Z" fill="#ffffff" stroke={STROKE} />
        </marker>
        <marker
          id="m-arrow"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M2,2 L10,6 L2,10" fill="none" stroke={STROKE} strokeWidth="1.3" />
        </marker>
        <marker id="m-diamond" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="14" markerHeight="9" orient="auto">
          <path d="M1,5 L8,1 L15,5 L8,9 Z" fill="#ffffff" stroke={STROKE} />
        </marker>
        <marker
          id="m-diamond-filled"
          viewBox="0 0 16 10"
          refX="1"
          refY="5"
          markerWidth="14"
          markerHeight="9"
          orient="auto"
        >
          <path d="M1,5 L8,1 L15,5 L8,9 Z" fill="rgba(20,22,28,0.8)" stroke={STROKE} />
        </marker>
      </defs>
    </svg>
  );
}

export function DiagramLegend() {
  const items: { label: string; type: RelationType }[] = [
    { label: "inherits", type: "inherits" },
    { label: "implements", type: "implements" },
    { label: "composes", type: "composes" },
    { label: "aggregates", type: "aggregates" },
    { label: "associates", type: "associates" },
    { label: "depends", type: "depends" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => {
        const s = edgeStyle(it.type);
        return (
          <li key={it.type} className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
            <svg width="30" height="10" aria-hidden>
              <path d="M4,5 L26,5" stroke={STROKE} strokeDasharray={s.dash} markerEnd={s.end} markerStart={s.start} />
            </svg>
            {it.label}
          </li>
        );
      })}
    </ul>
  );
}
