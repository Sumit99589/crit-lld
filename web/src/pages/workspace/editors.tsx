import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { EASE, newId } from "../../lib/format";
import {
  ELEMENT_KINDS,
  RELATION_TYPES,
  type CanvasEntity,
  type CanvasRelationship,
  type DesignCanvas,
  type Problem,
  type RequirementCoverage,
} from "../../lib/types";

type Update = (patch: (draft: DesignCanvas) => DesignCanvas) => void;

/** A textarea that grows with its content instead of scrolling inside itself. */
export function AutoText({
  minRows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={minRows} {...props} className={`field resize-none ${props.className ?? ""}`} />;
}

export function NarrativeEditor({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div>
      <label className="sr-only">{label}</label>
      <AutoText
        minRows={8}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-2 text-right font-mono text-[11px] text-faint">
        {value.trim() ? value.trim().split(/\s+/).length : 0} words
      </p>
    </div>
  );
}

const KIND_LABEL: Record<CanvasEntity["kind"], string> = {
  class: "class",
  abstract: "abstract",
  interface: "interface",
  enum: "enum",
};

export function ClassesEditor({ draft, update }: { draft: DesignCanvas; update: Update }) {
  const add = (kind: CanvasEntity["kind"]) =>
    update((d) => ({
      ...d,
      entities: [...d.entities, { id: newId("e"), name: "", kind, responsibility: "", attributes: "", methods: "" }],
    }));

  const change = (id: string, patch: Partial<CanvasEntity>) =>
    update((d) => ({ ...d, entities: d.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  // Removing a class also removes the relationships and requirement links that pointed at it.
  const remove = (id: string) =>
    update((d) => ({
      ...d,
      entities: d.entities.filter((e) => e.id !== id),
      relationships: d.relationships.filter((r) => r.from !== id && r.to !== id),
      requirementMap: Object.fromEntries(
        Object.entries(d.requirementMap).map(([k, v]) => [k, v.filter((x) => x !== id)]),
      ),
    }));

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {draft.entities.map((e, i) => (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
            transition={{ duration: 0.45, ease: EASE }}
            className="card rounded-2xl p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="field w-full font-mono sm:w-auto sm:max-w-[260px] sm:flex-1"
                placeholder={i === 0 ? "ParkingLot" : "ClassName"}
                value={e.name}
                aria-label="Class name"
                autoFocus={!e.name && i === draft.entities.length - 1}
                onChange={(ev) => change(e.id, { name: ev.target.value })}
              />
              <div role="radiogroup" aria-label="Kind" className="flex rounded-full border border-line p-0.5">
                {ELEMENT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={e.kind === k}
                    onClick={() => change(e.id, { kind: k })}
                    className={`relative rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors ${e.kind === k ? "text-canvas" : "text-muted hover:text-fg"}`}
                  >
                    {e.kind === k && (
                      <motion.span
                        layoutId={`kind-${e.id}`}
                        className="absolute inset-0 rounded-full bg-fg"
                        transition={{ duration: 0.3, ease: EASE }}
                      />
                    )}
                    <span className="relative">{KIND_LABEL[k]}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="ml-auto rounded-full px-2 py-1 text-xs text-faint transition-colors hover:text-redline"
                aria-label={`Remove ${e.name || "class"}`}
              >
                Remove
              </button>
            </div>
            <AutoText
              minRows={2}
              className="mt-3"
              placeholder="Responsible for… (one sentence: what it decides or guarantees)"
              value={e.responsibility}
              aria-label="Responsibility"
              onChange={(ev) => change(e.id, { responsibility: ev.target.value })}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <AutoText
                minRows={2}
                className="font-mono text-[12.5px]"
                placeholder={"Attributes, one per line\nfloors: List<Floor>"}
                value={e.attributes}
                aria-label="Attributes"
                onChange={(ev) => change(e.id, { attributes: ev.target.value })}
              />
              <AutoText
                minRows={2}
                className="font-mono text-[12.5px]"
                placeholder={"Methods, one per line\npark(vehicle): Ticket"}
                value={e.methods}
                aria-label="Methods"
                onChange={(ev) => change(e.id, { methods: ev.target.value })}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {draft.entities.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-sm text-muted">
          Start with the nouns in the requirements, then keep the ones that have behaviour.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => add("class")}
          className="rounded-full border border-line-strong px-4 py-2 text-sm transition-colors hover:border-black/25 hover:bg-black/[0.04]"
        >
          Add class
        </button>
        <button
          type="button"
          onClick={() => add("interface")}
          className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          Add interface
        </button>
      </div>
    </div>
  );
}

const RELATION_HINT: Record<CanvasRelationship["type"], string> = {
  inherits: "is a kind of",
  implements: "implements",
  composes: "owns (lifecycle)",
  aggregates: "has (shared)",
  associates: "knows about",
  depends: "uses briefly",
};

export function RelationshipsEditor({ draft, update }: { draft: DesignCanvas; update: Update }) {
  const named = draft.entities.filter((e) => e.name.trim());
  const add = () =>
    update((d) => ({
      ...d,
      relationships: [
        ...d.relationships,
        { id: newId("r"), from: named[0]?.id ?? "", to: named[1]?.id ?? "", type: "associates", label: "" },
      ],
    }));
  const change = (id: string, patch: Partial<CanvasRelationship>) =>
    update((d) => ({ ...d, relationships: d.relationships.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const remove = (id: string) => update((d) => ({ ...d, relationships: d.relationships.filter((r) => r.id !== id) }));

  if (named.length < 2) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-sm text-muted">
        Name at least two classes first.
      </p>
    );
  }

  const select = "field w-auto min-w-0 py-2 font-mono text-[12.5px]";
  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {draft.relationships.map((r) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.35, ease: EASE }}
            className="grid grid-cols-[1fr_auto] gap-2 card rounded-xl p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
          >
            <select
              className={select}
              value={r.from}
              aria-label="From"
              onChange={(e) => change(r.id, { from: e.target.value })}
            >
              {named.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <select
              className={`${select} text-redline`}
              value={r.type}
              aria-label="Relationship"
              onChange={(e) => change(r.id, { type: e.target.value as CanvasRelationship["type"] })}
            >
              {RELATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t} · {RELATION_HINT[t]}
                </option>
              ))}
            </select>
            <select
              className={select}
              value={r.to}
              aria-label="To"
              onChange={(e) => change(r.id, { to: e.target.value })}
            >
              {named.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <input
              className="field py-2 text-[13px]"
              placeholder="label (optional)"
              value={r.label}
              aria-label="Label"
              onChange={(e) => change(r.id, { label: e.target.value })}
            />
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="px-2 text-xs text-faint hover:text-redline"
              aria-label="Remove relationship"
            >
              Remove
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-full border border-line-strong px-4 py-2 text-sm transition-colors hover:border-black/25 hover:bg-black/[0.04]"
      >
        Add relationship
      </button>
    </div>
  );
}

export function RequirementMapEditor({
  draft,
  update,
  problem,
  coverage,
}: {
  draft: DesignCanvas;
  update: Update;
  problem: Problem;
  coverage: RequirementCoverage[];
}) {
  const named = draft.entities.filter((e) => e.name.trim());
  const toggle = (reqId: string, entityId: string) =>
    update((d) => {
      const current = d.requirementMap[reqId] ?? [];
      const next = current.includes(entityId) ? current.filter((x) => x !== entityId) : [...current, entityId];
      return { ...d, requirementMap: { ...d.requirementMap, [reqId]: next } };
    });

  if (named.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-sm text-muted">
        Add some classes first.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {problem.requirements.map((req) => {
        const selected = draft.requirementMap[req.id] ?? [];
        const status =
          coverage.find((c) => c.requirementId === req.id)?.status ?? (selected.length ? "covered" : "unmapped");
        return (
          <li key={req.id} className="card rounded-2xl p-4">
            <div className="flex gap-3">
              <span className={`font-mono text-[12px] ${status === "covered" ? "text-ok" : "text-redline"}`}>
                {req.id}
              </span>
              <p className="text-[14px] leading-relaxed">{req.text}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 pl-11">
              {named.map((e) => {
                const on = selected.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(req.id, e.id)}
                    className={`rounded-full border px-2.5 py-1 font-mono text-[11.5px] transition-all duration-200 ${
                      on
                        ? "border-fg bg-fg text-canvas"
                        : "border-line text-muted hover:border-line-strong hover:text-fg"
                    }`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
