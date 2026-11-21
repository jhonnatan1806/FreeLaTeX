"use client";

import { create } from "zustand";
import { compileProject } from "@/lib/compile-client";
import { db } from "@/lib/db";
import { parseLatexLog, type LogEntry } from "@/lib/log-parser";
import { forwardSearch, parseSynctex, reverseSearch, type SyncData } from "@/lib/synctex";
import type { PdfHighlight } from "@/components/pdf/pdf-viewer";
import type { CompileResult } from "@/types/project";
import { useEditorStore } from "./editor-store";

export type CompilePhase = "idle" | "compiling" | "done" | "failed";

interface CompileStore {
  projectId: string | null;
  phase: CompilePhase;
  /** Último resultado (puede ser un error de LaTeX, con o sin PDF). */
  result: CompileResult | null;
  /** Último PDF generado: se sigue mostrando aunque la siguiente compilación falle. */
  pdf: Uint8Array | null;
  /** Errores, avisos y problemas de maquetación extraídos del log. */
  entries: LogEntry[];
  /** Datos SyncTeX del PDF mostrado (para saltar entre código y PDF). */
  sync: SyncData | null;
  /** Zona del PDF a resaltar tras un salto desde el código. */
  highlight: PdfHighlight | null;
  /** Mostrar el panel de errores en lugar del PDF. */
  showLog: boolean;
  /** Error al contactar con el compilador o preparar el envío. */
  requestError: string | null;
  /** Compilar automáticamente tras guardar. */
  autoCompile: boolean;
  /** Se pidió compilar mientras otra compilación estaba en curso. */
  queued: boolean;

  init: (projectId: string) => Promise<void>;
  compile: () => Promise<void>;
  setAutoCompile: (on: boolean) => void;
  setShowLog: (show: boolean) => void;
  /** Código → PDF. Devuelve false si no hay datos para esa línea. */
  syncToPdf: (file: string, line: number) => boolean;
  /** PDF → código: abre el archivo en la línea correspondiente. */
  syncToCode: (page: number, x: number, y: number) => boolean;
}

const AUTO_KEY = "freelatex:autocompile";

function readAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Analiza el log asociando las rutas solo a archivos que existen en el proyecto. */
async function analyze(projectId: string, result: CompileResult): Promise<LogEntry[]> {
  const ids = await db.files.where("projectId").equals(projectId).primaryKeys();
  const projectFiles = new Set(ids.map((id) => id.slice(projectId.length + 1)));
  return parseLatexLog(result.log ?? "", { mainFile: result.mainFile, projectFiles }, result.output);
}

function toSync(result: CompileResult): SyncData | null {
  if (!result.synctex) return null;
  try {
    return parseSynctex(result.synctex, result.mainFile);
  } catch (err) {
    console.warn("SyncTeX no válido", err);
    return null;
  }
}

export const useCompileStore = create<CompileStore>((set, get) => ({
  projectId: null,
  phase: "idle",
  result: null,
  pdf: null,
  entries: [],
  sync: null,
  highlight: null,
  showLog: false,
  requestError: null,
  autoCompile: false,
  queued: false,

  init: async (projectId) => {
    if (get().projectId === projectId) return;
    set({
      projectId,
      phase: "idle",
      result: null,
      pdf: null,
      entries: [],
      sync: null,
      highlight: null,
      showLog: false,
      requestError: null,
      queued: false,
      autoCompile: readAuto(),
    });
    const cached = await db.outputs.get(projectId);
    if (get().projectId !== projectId) return; // cambió de proyecto mientras tanto
    if (cached) {
      const entries = await analyze(projectId, cached);
      if (get().projectId !== projectId) return;
      set({ result: cached, pdf: cached.pdf, phase: "done", entries, sync: toSync(cached) });
    } else {
      // Primera vez que se abre: compilar para mostrar el PDF (como Overleaf).
      const project = await db.projects.get(projectId);
      if (project?.mainFile) void get().compile();
    }
  },

  compile: async () => {
    const { projectId, phase } = get();
    if (!projectId) return;
    if (phase === "compiling") {
      // No lanzar compilaciones en paralelo: repetir al terminar la actual.
      set({ queued: true });
      return;
    }

    set({ phase: "compiling", requestError: null, queued: false });
    try {
      await useEditorStore.getState().flushSaves();
      const result = await compileProject(projectId);
      const entries = await analyze(projectId, result);
      if (get().projectId !== projectId) return;
      // Si no hay PDF nuevo, se sigue mostrando el anterior con su SyncTeX.
      const sync = result.pdf ? toSync(result) : get().sync;
      set({ phase: "done", result, pdf: result.pdf ?? get().pdf, entries, sync, highlight: null });
      await db.outputs.put({ ...result, pdf: result.pdf ?? get().pdf, projectId });
    } catch (err) {
      if (get().projectId !== projectId) return;
      set({ phase: "failed", requestError: err instanceof Error ? err.message : String(err) });
    } finally {
      if (get().projectId === projectId && get().queued) void get().compile();
    }
  },

  setShowLog: (showLog) => set({ showLog }),

  syncToPdf: (file, line) => {
    const { sync, pdf } = get();
    if (!sync || !pdf) return false;
    const found = forwardSearch(sync, file, line);
    if (!found) return false;
    set({ highlight: { ...found, nonce: (get().highlight?.nonce ?? 0) + 1 }, showLog: false });
    return true;
  },

  syncToCode: (page, x, y) => {
    const { sync } = get();
    if (!sync) return false;
    const found = reverseSearch(sync, page, x, y);
    if (!found) return false;
    useEditorStore.getState().goTo(found.file, found.line);
    return true;
  },

  setAutoCompile: (on) => {
    try {
      localStorage.setItem(AUTO_KEY, on ? "1" : "0");
    } catch {
      // sin almacenamiento
    }
    set({ autoCompile: on });
  },
}));
