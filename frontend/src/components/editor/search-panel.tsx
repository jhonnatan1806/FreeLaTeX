"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { searchProject, type SearchResult } from "@/lib/project-search";
import { useEditorStore } from "@/store/editor-store";

interface SearchPanelProps {
  projectId: string;
  /** Cambia para pedir el foco en el campo de búsqueda (Ctrl+Shift+F). */
  focusToken: number;
}

export function SearchPanel({ projectId, focusToken }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const goTo = useEditorStore((s) => s.goTo);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusToken]);

  // Buscar con un pequeño retardo mientras se escribe.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!query) {
        if (!cancelled) setResult(null);
        return;
      }
      await useEditorStore.getState().flushSaves();
      const files = await db.files.where("projectId").equals(projectId).toArray();
      const found = searchProject(
        files.map((f) => ({ path: f.path, text: f.kind === "text" ? f.text : undefined })),
        query,
        { caseSensitive, regex },
      );
      if (!cancelled) setResult(found);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [projectId, query, caseSensitive, regex]);

  // Agrupar por archivo.
  const groups = new Map<string, NonNullable<SearchResult>["matches"]>();
  for (const m of result?.matches ?? []) groups.set(m.path, [...(groups.get(m.path) ?? []), m]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-line p-2">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el proyecto"
            aria-label="Buscar en el proyecto"
            className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 py-1 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
          <Toggle active={caseSensitive} onClick={() => setCaseSensitive((v) => !v)} label="Distinguir mayúsculas">
            Aa
          </Toggle>
          <Toggle active={regex} onClick={() => setRegex((v) => !v)} label="Expresión regular">
            .*
          </Toggle>
        </div>
        {result && (
          <p className={`text-xs ${result.error ? "text-danger-text" : "text-fg-subtle"}`}>
            {result.error
              ? `Expresión no válida: ${result.error}`
              : `${result.matches.length}${result.truncated ? "+" : ""} resultados en ${groups.size} archivos`}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-1 text-xs">
        {[...groups].map(([path, matches]) => (
          <div key={path} className="mb-1">
            <p className="truncate px-2 py-1 font-semibold text-fg" title={path}>
              {path} <span className="font-normal text-fg-subtle">({matches.length})</span>
            </p>
            <ul>
              {matches.map((m, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => goTo(m.path, m.line)}
                    className="flex w-full gap-2 px-2 py-0.5 text-left font-mono hover:bg-surface-hover"
                  >
                    <span className="w-8 shrink-0 text-right text-fg-subtle">{m.line}</span>
                    <span className="min-w-0 truncate text-fg-muted">
                      {m.text.slice(0, m.start)}
                      <mark className="rounded-sm bg-[var(--cm-search)] text-fg">
                        {m.text.slice(m.start, m.end)}
                      </mark>
                      {m.text.slice(m.end)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`rounded px-1.5 py-1 font-mono text-xs ${
        active ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
