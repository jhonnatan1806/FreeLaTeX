"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { memo } from "react";
import { CloseIcon, FileTextIcon, LocateIcon } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { db, fileId } from "@/lib/db";
import { basename } from "@/lib/paths";
import { useEditorStore } from "@/store/editor-store";
import { BinaryPreview } from "./binary-preview";
import { CodeEditor, syncCursorToPdf } from "./code-editor";
import { useCompileStore } from "@/store/compile-store";

export const EditorPane = memo(function EditorPane({ projectId }: { projectId: string }) {
  const openTabs = useEditorStore((s) => s.openTabs);
  const activePath = useEditorStore((s) => s.activePath);
  const setActive = useEditorStore((s) => s.setActive);
  const closeTab = useEditorStore((s) => s.closeTab);
  const revealPath = useEditorStore((s) => s.revealPath);
  const hasPdf = useCompileStore((s) => s.syncReady);

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
        className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-line bg-surface-muted"
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
              className={`group relative flex max-w-56 shrink-0 cursor-pointer items-center gap-1.5 border-r border-line pr-1.5 pl-3 text-sm ${
                isActive
                  ? "bg-surface text-fg before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-accent"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg"
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
                className={`rounded p-1 text-fg-subtle hover:bg-surface-active hover:text-fg focus-visible:opacity-100 ${isActive ? "" : "opacity-0 group-hover:opacity-100"}`}
              >
                <CloseIcon width={12} height={12} />
              </button>
            </div>
          );
        })}
        {activePath && hasPdf && (
          <div className="sticky right-0 ml-auto flex shrink-0 items-center border-l border-line bg-surface-muted px-1.5">
            <Tooltip content="Ver en el PDF la línea del cursor" shortcut="Ctrl+Alt+J">
              <button
                type="button"
                onClick={() => syncCursorToPdf()}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg"
              >
                <LocateIcon width={14} height={14} />
                Ir al PDF
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {!activePath ? (
          <EmptyState />
        ) : active === null ? (
          <p className="p-6 text-sm text-fg-subtle">El archivo ya no existe.</p>
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
});

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-sm text-fg-muted">
      <FileTextIcon width={32} height={32} className="text-fg-subtle" />
      <p>Abre un archivo desde el panel de la izquierda.</p>
      <dl className="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-1.5 text-left text-xs">
        <dt className="justify-self-end"><Kbd>Ctrl+S</Kbd></dt>
        <dd>Compilar (el guardado es automático)</dd>
        <dt className="justify-self-end"><Kbd>Ctrl+F</Kbd></dt>
        <dd>Buscar en el archivo</dd>
        <dt className="justify-self-end"><Kbd>Ctrl+Shift+F</Kbd></dt>
        <dd>Buscar en el proyecto</dd>
        <dt className="justify-self-end"><Kbd>F2</Kbd></dt>
        <dd>Renombrar en el árbol</dd>
      </dl>
    </div>
  );
}
