"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import {
  AlertIcon,
  ArchiveIcon,
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  Logo,
  Spinner,
  StarIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { db } from "@/lib/db";
import { basename, extname } from "@/lib/paths";
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

  if (project === undefined) return <p className="p-8 text-sm text-fg-subtle">Cargando…</p>;

  if (project === null) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-16 text-center">
        <h1 className="text-xl font-semibold">Proyecto no encontrado</h1>
        <p className="text-sm text-fg-subtle">
          Los proyectos se guardan en el navegador donde se crearon. Puede que se haya eliminado o que estés en otro
          navegador.
        </p>
        <Link href="/" className="text-accent-text hover:underline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 text-sm">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md font-semibold text-fg hover:text-accent-text"
          title="Mis proyectos"
        >
          <Logo size={22} />
          <span className="hidden sm:inline">FreeLaTeX</span>
        </Link>
        <span className="text-line-strong" aria-hidden="true">
          /
        </span>
        <h1 className="min-w-0 truncate font-medium">{project.name}</h1>
        <SaveIndicator status={saveStatus} />

        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu
            label="Archivo principal"
            tooltip="Archivo que se compila"
            align="end"
            className={project.mainFile ? "" : "border-warning-line bg-warning-soft text-warning-text"}
            trigger={
              <>
                <StarIcon width={13} height={13} className="shrink-0 fill-amber-400 text-amber-500" />
                <span className="hidden text-fg-subtle lg:inline">Principal:</span>
                <span className="max-w-36 truncate">{project.mainFile ? basename(project.mainFile) : "Elegir…"}</span>
              </>
            }
            items={
              texFiles.length === 0
                ? [{ label: "No hay archivos .tex", onSelect: () => {}, disabled: true }]
                : texFiles.map((p) => ({
                    label: p,
                    checked: p === project.mainFile,
                    onSelect: () => updateProjectSettings(projectId, { mainFile: p }),
                  }))
            }
          />
          <DropdownMenu
            label="Motor de compilación"
            tooltip="Motor de compilación"
            align="end"
            trigger={
              <>
                <span className="hidden text-fg-subtle lg:inline">Motor:</span>
                {ENGINE_LABEL[project.engine]}
              </>
            }
            items={ENGINES.map((engine) => ({
              label: ENGINE_LABEL[engine],
              hint: ENGINE_HINT[engine],
              checked: engine === project.engine,
              onSelect: () => updateProjectSettings(projectId, { engine }),
            }))}
          />
          <DownloadMenu projectId={projectId} name={project.name} />
          <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
          <ThemeToggle />
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

const ENGINE_LABEL: Record<Engine, string> = { pdflatex: "pdfLaTeX", xelatex: "XeLaTeX", lualatex: "LuaLaTeX" };
const ENGINE_HINT: Record<Engine, string> = {
  pdflatex: "El más común",
  xelatex: "Fuentes del sistema",
  lualatex: "Fuentes y Lua",
};

/** Estado del autoguardado: siempre visible (icono) y con texto en pantallas anchas. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "error") {
    return (
      <Tooltip content="No se pudieron guardar los últimos cambios. Pulsa para reintentar.">
        <button
          type="button"
          onClick={() => void useEditorStore.getState().flushSaves()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-danger-line bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-text hover:brightness-95"
        >
          <AlertIcon width={14} height={14} />
          <span className="hidden sm:inline">Error al guardar ·</span> Reintentar
        </button>
      </Tooltip>
    );
  }
  const saving = status === "saving";
  return (
    <Tooltip content={saving ? "Guardando en este navegador…" : "Todos los cambios están guardados en este navegador"}>
      <span
        role="status"
        aria-label={SAVE_LABEL[status]}
        tabIndex={0}
        className="inline-flex shrink-0 items-center gap-1 rounded text-xs text-fg-subtle"
      >
        {saving ? <Spinner size={12} /> : <CheckIcon width={14} height={14} className="text-accent-text" />}
        <span className="hidden md:inline">{SAVE_LABEL[status]}</span>
      </span>
    </Tooltip>
  );
}

/** Descargas agrupadas: PDF (si hay) y el proyecto en ZIP. */
function DownloadMenu({ projectId, name }: { projectId: string; name: string }) {
  const pdf = useCompileStore((s) => s.pdf);
  return (
    <DropdownMenu
      label="Descargar"
      align="end"
      trigger={
        <>
          <DownloadIcon width={14} height={14} className="shrink-0" />
          <span className="hidden md:inline">Descargar</span>
        </>
      }
      items={[
        {
          label: "PDF",
          icon: <FileTextIcon width={14} height={14} />,
          hint: pdf ? undefined : "Compila primero",
          disabled: !pdf,
          onSelect: () => pdf && downloadBytes(`${name}.pdf`, pdf, "application/pdf"),
        },
        {
          label: "Proyecto (.zip)",
          icon: <ArchiveIcon width={14} height={14} />,
          onSelect: async () => {
            await useEditorStore.getState().flushSaves();
            const { filename, bytes } = await exportProjectZip(projectId);
            downloadBytes(filename, bytes);
          },
        },
      ]}
    />
  );
}

/** Separador con zona de arrastre amplia, línea fina y asa visible al pasar el ratón. */
function ResizeHandle() {
  return (
    <Separator className="group relative z-10 -mx-[3px] flex w-[7px] shrink-0 cursor-col-resize items-center justify-center outline-none">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover:w-0.5 group-hover:bg-accent group-focus-visible:w-0.5 group-focus-visible:bg-accent group-data-[separator=active]:w-0.5 group-data-[separator=active]:bg-accent" />
      <span className="relative flex h-8 w-1.5 flex-col items-center justify-center gap-0.5 rounded-full bg-surface opacity-0 ring-1 ring-line-strong transition-opacity group-hover:opacity-100 group-data-[separator=active]:opacity-100">
        <span className="h-0.5 w-0.5 rounded-full bg-fg-subtle" />
        <span className="h-0.5 w-0.5 rounded-full bg-fg-subtle" />
        <span className="h-0.5 w-0.5 rounded-full bg-fg-subtle" />
      </span>
    </Separator>
  );
}
