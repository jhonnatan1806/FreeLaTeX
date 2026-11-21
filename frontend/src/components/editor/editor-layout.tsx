"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { extname } from "@/lib/paths";
import { downloadBytes, exportProjectZip, updateProjectSettings } from "@/lib/projects";
import { PdfPanel } from "@/components/pdf/pdf-panel";
import { useCompileStore } from "@/store/compile-store";
import { useEditorStore, type SaveStatus } from "@/store/editor-store";
import { ENGINES, type Engine } from "@/types/project";
import { EditorPane } from "./editor-pane";
import { SidePanel } from "./side-panel";

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: "Guardado",
  saving: "Guardando…",
  error: "Error al guardar",
};

export function EditorLayout({ projectId }: { projectId: string }) {
  // null = no existe; undefined = cargando.
  const project = useLiveQuery(async () => (await db.projects.get(projectId)) ?? null, [projectId]);
  const allPaths = useLiveQuery(
    async () =>
      (await db.files.where("projectId").equals(projectId).primaryKeys()).map((id) => id.slice(projectId.length + 1)),
    [projectId],
  );
  const texFiles = useMemo(() => (allPaths ?? []).filter((p) => extname(p) === ".tex").sort(), [allPaths]);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  // Listo cuando el store del editor está inicializado para este proyecto.
  const ready = useEditorStore((s) => s.projectId === projectId);

  // Inicializar pestañas cuando el proyecto carga.
  useEffect(() => {
    if (project) {
      useEditorStore.getState().init(projectId, project.mainFile);
      void useCompileStore.getState().init(projectId);
    }
  }, [project, projectId]);

  // Cerrar pestañas recordadas de archivos que ya no existen.
  useEffect(() => {
    if (!ready || !allPaths) return;
    const existing = new Set(allPaths);
    const { openTabs, closeTab } = useEditorStore.getState();
    for (const tab of openTabs) if (!existing.has(tab)) closeTab(tab);
  }, [ready, allPaths]);

  // Atajos fuera del editor (dentro, los gestiona CodeMirror y marca defaultPrevented).
  // Ctrl+S guarda y recompila (y evita el diálogo "Guardar página"); Ctrl+Enter recompila.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "s" || e.key === "Enter") {
        e.preventDefault();
        void useCompileStore.getState().compile();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Autocompilar: tras cada guardado, si está activado (con margen por si se sigue escribiendo).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.saveStatus === "saved" && prev.saveStatus === "saving" && useCompileStore.getState().autoCompile) {
        clearTimeout(timer);
        timer = setTimeout(() => void useCompileStore.getState().compile(), 1000);
      } else if (state.saveStatus === "saving") {
        clearTimeout(timer);
      }
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (project === undefined) return <p className="p-8 text-sm text-zinc-500">Cargando…</p>;

  if (project === null) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-16 text-center">
        <h1 className="text-xl font-semibold">Proyecto no encontrado</h1>
        <p className="text-sm text-zinc-500">
          Los proyectos se guardan en el navegador donde se crearon. Puede que se haya eliminado o que estés en otro
          navegador.
        </p>
        <Link href="/" className="text-emerald-600 hover:underline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-200 px-3 text-sm dark:border-zinc-800">
        <Link href="/" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" title="Mis proyectos">
          FreeLaTeX
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <h1 className="min-w-0 truncate font-medium">{project.name}</h1>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={`hidden text-xs sm:inline ${saveStatus === "error" ? "text-red-600" : "text-zinc-500"}`}
            aria-live="polite"
          >
            {SAVE_LABEL[saveStatus]}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="hidden md:inline">Principal</span>
            <select
              value={project.mainFile ?? ""}
              onChange={(e) => updateProjectSettings(projectId, { mainFile: e.target.value || null })}
              className="max-w-44 rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {!project.mainFile && <option value="">— Elige —</option>}
              {texFiles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label="Compilador"
            value={project.engine}
            onChange={(e) => updateProjectSettings(projectId, { engine: e.target.value as Engine })}
            className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {ENGINES.map((engine) => (
              <option key={engine} value={engine}>
                {engine}
              </option>
            ))}
          </select>
          <Button
            className="!py-1 text-xs"
            onClick={async () => {
              await useEditorStore.getState().flushSaves();
              const { filename, bytes } = await exportProjectZip(projectId);
              downloadBytes(filename, bytes);
            }}
          >
            Descargar ZIP
          </Button>
        </div>
      </header>

      {ready && (
        <Group orientation="horizontal" className="min-h-0 flex-1">
          <Panel id="tree" defaultSize="18" minSize="10" maxSize="40">
            <SidePanel projectId={projectId} mainFile={project.mainFile} />
          </Panel>
          <ResizeHandle />
          <Panel id="editor" defaultSize="47" minSize="20">
            <EditorPane projectId={projectId} />
          </Panel>
          <ResizeHandle />
          <Panel id="pdf" defaultSize="35" minSize="15">
            <PdfPanel projectName={project.name} />
          </Panel>
        </Group>
      )}
    </div>
  );
}

function ResizeHandle() {
  return (
    <Separator className="w-1 shrink-0 bg-zinc-200 transition-colors hover:bg-emerald-500 data-[separator=active]:bg-emerald-600 dark:bg-zinc-800" />
  );
}
