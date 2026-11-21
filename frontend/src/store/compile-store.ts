"use client";

import { create } from "zustand";
import { compileProject } from "@/lib/compile-client";
import { db } from "@/lib/db";
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
  /** Error al contactar con el compilador o preparar el envío. */
  requestError: string | null;
  /** Compilar automáticamente tras guardar. */
  autoCompile: boolean;
  /** Se pidió compilar mientras otra compilación estaba en curso. */
  queued: boolean;

  init: (projectId: string) => Promise<void>;
  compile: () => Promise<void>;
  setAutoCompile: (on: boolean) => void;
}

const AUTO_KEY = "freelatex:autocompile";

function readAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export const useCompileStore = create<CompileStore>((set, get) => ({
  projectId: null,
  phase: "idle",
  result: null,
  pdf: null,
  requestError: null,
  autoCompile: false,
  queued: false,

  init: async (projectId) => {
    if (get().projectId === projectId) return;
    set({ projectId, phase: "idle", result: null, pdf: null, requestError: null, queued: false, autoCompile: readAuto() });
    const cached = await db.outputs.get(projectId);
    if (get().projectId !== projectId) return; // cambió de proyecto mientras tanto
    if (cached) {
      set({ result: cached, pdf: cached.pdf, phase: "done" });
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
      if (get().projectId !== projectId) return;
      set({ phase: "done", result, pdf: result.pdf ?? get().pdf });
      await db.outputs.put({ ...result, pdf: result.pdf ?? get().pdf, projectId });
    } catch (err) {
      if (get().projectId !== projectId) return;
      set({ phase: "failed", requestError: err instanceof Error ? err.message : String(err) });
    } finally {
      if (get().projectId === projectId && get().queued) void get().compile();
    }
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
