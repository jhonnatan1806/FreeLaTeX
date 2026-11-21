"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CloseIcon } from "@/components/ui/icons";
import { db, fileId } from "@/lib/db";
import { basename } from "@/lib/paths";
import { useEditorStore } from "@/store/editor-store";
import { BinaryPreview } from "./binary-preview";
import { CodeEditor } from "./code-editor";

export function EditorPane({ projectId }: { projectId: string }) {
  const openTabs = useEditorStore((s) => s.openTabs);
  const activePath = useEditorStore((s) => s.activePath);
  const setActive = useEditorStore((s) => s.setActive);
  const closeTab = useEditorStore((s) => s.closeTab);
  const revealPath = useEditorStore((s) => s.revealPath);

  // Solo el tipo del archivo activo (y los datos si es binario).
  const active = useLiveQuery(async () => {
    if (!activePath) return null;
    const file = await db.files.get(fileId(projectId, activePath));
    if (!file) return null;
    return file.kind === "binary" ? { kind: "binary" as const, data: file.data! } : { kind: "text" as const };
  }, [projectId, activePath]);

  // Nombres repetidos en pestañas: mostrar también la carpeta.
  const names = openTabs.map(basename);
  const label = (path: string, i: number) =>
    names.filter((n) => n === names[i]).length > 1 ? path : names[i];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        {openTabs.map((path, i) => {
          const isActive = path === activePath;
          return (
            <div
              key={path}
              role="tab"
              aria-selected={isActive}
              title={path}
              onClick={() => {
                setActive(path);
                revealPath(path);
              }}
              onAuxClick={(e) => e.button === 1 && closeTab(path)}
              className={`group flex max-w-56 shrink-0 cursor-pointer items-center gap-1.5 border-r border-zinc-200 px-3 text-sm dark:border-zinc-800 ${
                isActive
                  ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              <span className="truncate">{label(path, i)}</span>
              <button
                type="button"
                aria-label={`Cerrar ${path}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(path);
                }}
                className={`rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 ${isActive ? "" : "opacity-0 group-hover:opacity-100"}`}
              >
                <CloseIcon width={12} height={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {!activePath ? (
          <EmptyState />
        ) : active === null ? (
          <p className="p-6 text-sm text-zinc-500">El archivo ya no existe.</p>
        ) : active?.kind === "binary" ? (
          <BinaryPreview path={activePath} data={active.data} />
        ) : (
          // También mientras se resuelve el tipo (undefined), para no desmontar
          // el editor en cada cambio de pestaña entre archivos de texto.
          <CodeEditor projectId={projectId} path={activePath} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-zinc-500">
      <p>Abre un archivo desde el panel de la izquierda.</p>
      <p className="text-xs">
        Atajos: <kbd className="rounded border px-1">Ctrl</kbd>+<kbd className="rounded border px-1">S</kbd> guardar ·{" "}
        <kbd className="rounded border px-1">Ctrl</kbd>+<kbd className="rounded border px-1">F</kbd> buscar ·{" "}
        <kbd className="rounded border px-1">F2</kbd> renombrar en el árbol
      </p>
    </div>
  );
}
