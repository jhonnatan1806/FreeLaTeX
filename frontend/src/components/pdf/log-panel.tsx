"use client";

import { useState } from "react";
import { countByLevel, type LogEntry, type LogLevel } from "@/lib/log-parser";
import { useCompileStore } from "@/store/compile-store";
import { useEditorStore } from "@/store/editor-store";

type Filter = "all" | LogLevel;

const LEVEL_ORDER: Record<LogLevel, number> = { error: 0, warning: 1, typesetting: 2 };

const LEVEL_STYLE: Record<LogLevel, { label: string; badge: string; border: string }> = {
  error: {
    label: "Error",
    badge: "bg-red-600 text-white",
    border: "border-l-red-500",
  },
  warning: {
    label: "Aviso",
    badge: "bg-amber-500 text-white",
    border: "border-l-amber-400",
  },
  typesetting: {
    label: "Maquetación",
    badge: "bg-sky-600 text-white",
    border: "border-l-sky-400",
  },
};

export function LogPanel() {
  const entries = useCompileStore((s) => s.entries);
  const result = useCompileStore((s) => s.result);
  const [filter, setFilter] = useState<Filter>("all");
  const [raw, setRaw] = useState(false);
  const counts = countByLevel(entries);
  // Errores primero, luego avisos y maquetación (orden del log dentro de cada grupo).
  const visible = (filter === "all" ? entries : entries.filter((e) => e.level === filter))
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => LEVEL_ORDER[a.entry.level] - LEVEL_ORDER[b.entry.level] || a.index - b.index)
    .map(({ entry }) => entry);
  const rawText = result?.log || result?.output || "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-zinc-950">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-800">
        <FilterChip active={filter === "all" && !raw} onClick={() => (setFilter("all"), setRaw(false))}>
          Todos ({entries.length})
        </FilterChip>
        <FilterChip active={filter === "error" && !raw} onClick={() => (setFilter("error"), setRaw(false))}>
          Errores ({counts.errors})
        </FilterChip>
        <FilterChip active={filter === "warning" && !raw} onClick={() => (setFilter("warning"), setRaw(false))}>
          Avisos ({counts.warnings})
        </FilterChip>
        <FilterChip active={filter === "typesetting" && !raw} onClick={() => (setFilter("typesetting"), setRaw(false))}>
          Maquetación ({counts.typesetting})
        </FilterChip>
        <span className="ml-auto" />
        <FilterChip active={raw} onClick={() => setRaw((v) => !v)}>
          Log completo
        </FilterChip>
      </div>

      {raw ? (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-zinc-800 dark:text-zinc-200">
          {rawText || "No hay log."}
        </pre>
      ) : visible.length === 0 ? (
        <p className="p-4 text-sm text-zinc-500">
          {entries.length === 0 ? "Sin errores ni avisos." : "Nada en esta categoría."}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
          {visible.map((entry, i) => (
            <LogItem key={i} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LogItem({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(entry.level === "error");
  const goTo = useEditorStore((s) => s.goTo);
  const style = LEVEL_STYLE[entry.level];
  const location = entry.file ?? entry.rawFile;

  return (
    <li className={`rounded border border-l-4 border-zinc-200 bg-zinc-50 text-xs dark:border-zinc-800 dark:bg-zinc-900 ${style.border}`}>
      <div className="flex items-start gap-2 p-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}>
          {style.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-zinc-900 dark:text-zinc-100">{entry.message}</p>
          {location && (
            entry.file ? (
              <button
                type="button"
                onClick={() => goTo(entry.file!, entry.line)}
                className="mt-0.5 font-mono text-emerald-700 hover:underline dark:text-emerald-400"
                title="Ir a la línea en el editor"
              >
                {entry.file}
                {entry.line !== null && `, línea ${entry.line}`}
              </button>
            ) : (
              <span className="mt-0.5 block font-mono text-zinc-500">
                {location}
                {entry.line !== null && `, línea ${entry.line}`}
              </span>
            )
          )}
        </div>
        {entry.context && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-expanded={open}
          >
            {open ? "Ocultar" : "Detalles"}
          </button>
        )}
      </div>
      {open && entry.context && (
        <pre className="overflow-x-auto border-t border-zinc-200 px-2 py-1.5 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {entry.context}
        </pre>
      )}
    </li>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 ${
        active
          ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

/** Contadores para el botón de la barra. */
export function LogBadges() {
  const entries = useCompileStore((s) => s.entries);
  const { errors, warnings } = countByLevel(entries);
  return (
    <>
      {errors > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{errors}</span>}
      {warnings > 0 && (
        <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{warnings}</span>
      )}
    </>
  );
}
