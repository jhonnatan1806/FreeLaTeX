"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertIcon, CloseIcon, FileTextIcon } from "@/components/ui/icons";
import { countByLevel, type LogEntry, type LogLevel } from "@/lib/log-parser";
import { useCompileStore } from "@/store/compile-store";
import { useEditorStore } from "@/store/editor-store";

type Filter = "all" | LogLevel;

const LEVEL_ORDER: Record<LogLevel, number> = { error: 0, warning: 1, typesetting: 2 };

const LEVEL_STYLE: Record<LogLevel, { label: string; icon: React.ReactNode; text: string; border: string }> = {
  error: {
    label: "Error",
    icon: <CloseIcon width={12} height={12} strokeWidth={2.5} />,
    text: "bg-danger text-white",
    border: "border-l-danger",
  },
  warning: {
    label: "Aviso",
    icon: <AlertIcon width={12} height={12} strokeWidth={2.2} />,
    text: "bg-warning text-zinc-950",
    border: "border-l-warning",
  },
  typesetting: {
    label: "Maquetación",
    icon: <FileTextIcon width={12} height={12} strokeWidth={2.2} />,
    text: "bg-info text-white",
    border: "border-l-info",
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
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-2 py-1.5 text-xs">
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
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs break-words whitespace-pre-wrap text-fg">
          {rawText || "No hay log."}
        </pre>
      ) : visible.length === 0 ? (
        <p className="p-4 text-sm text-fg-subtle">
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
    <li className={`rounded-md border border-l-4 border-line bg-surface-muted text-xs ${style.border}`}>
      <div className="flex items-start gap-2 p-2">
        {/* Icono + texto: el nivel no depende solo del color. */}
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${style.text}`}
        >
          {style.icon}
          {style.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words text-fg">{entry.message}</p>
          {location &&
            (entry.file ? (
              <button
                type="button"
                onClick={() => goTo(entry.file!, entry.line)}
                className="mt-0.5 rounded font-mono text-accent-text hover:underline"
                title="Ir a la línea en el editor"
              >
                {entry.file}
                {entry.line !== null && `, línea ${entry.line}`}
              </button>
            ) : (
              <span className="mt-0.5 block font-mono text-fg-subtle">
                {location}
                {entry.line !== null && `, línea ${entry.line}`}
              </span>
            ))}
        </div>
        {entry.context && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded text-fg-subtle hover:text-fg"
            aria-expanded={open}
          >
            {open ? "Ocultar" : "Detalles"}
          </button>
        )}
      </div>
      {open && entry.context && (
        <pre className="overflow-x-auto border-t border-line px-2 py-1.5 font-mono text-xs text-fg-muted">
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
      aria-pressed={active}
      className={`rounded-full px-2.5 py-0.5 transition-colors ${
        active ? "bg-fg text-surface" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
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
      {errors > 0 && (
        <Badge tone="danger" title={`${errors} errores`}>
          {errors}
        </Badge>
      )}
      {warnings > 0 && (
        <Badge tone="warning" title={`${warnings} avisos`}>
          {warnings}
        </Badge>
      )}
    </>
  );
}
