"use client";

import { memo, useEffect, useState } from "react";
import { FileTree } from "./file-tree";
import { SearchPanel } from "./search-panel";

type View = "files" | "search";

/** Panel izquierdo: árbol de archivos o búsqueda en el proyecto (Ctrl+Shift+F). */
export const SidePanel = memo(function SidePanel({ projectId, mainFile }: { projectId: string; mainFile: string | null }) {
  const [view, setView] = useState<View>("files");
  const [focusToken, setFocusToken] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setView("search");
        setFocusToken((t) => t + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-zinc-900/50">
      <div role="tablist" className="flex h-8 shrink-0 border-b border-zinc-200 text-xs dark:border-zinc-800">
        <Tab active={view === "files"} onClick={() => setView("files")}>
          Archivos
        </Tab>
        <Tab
          active={view === "search"}
          onClick={() => {
            setView("search");
            setFocusToken((t) => t + 1);
          }}
          title="Buscar en el proyecto (Ctrl+Shift+F)"
        >
          Buscar
        </Tab>
      </div>
      <div className="min-h-0 flex-1">
        {/* El árbol se mantiene montado para no perder su estado. */}
        <div className={view === "files" ? "h-full" : "hidden"}>
          <FileTree projectId={projectId} mainFile={mainFile} />
        </div>
        {view === "search" && <SearchPanel projectId={projectId} focusToken={focusToken} />}
      </div>
    </div>
  );
});

function Tab({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={title}
      className={`flex-1 border-b-2 font-semibold uppercase tracking-wide ${
        active
          ? "border-emerald-600 text-zinc-900 dark:text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
