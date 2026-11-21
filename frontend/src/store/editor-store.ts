"use client";

import type { EditorState } from "@codemirror/state";
import { create } from "zustand";
import { ancestors, isWithin, replacePrefix } from "@/lib/tree";

export type SaveStatus = "saved" | "saving" | "error";

interface PersistedUi {
  openTabs: string[];
  activePath: string | null;
  expanded: string[];
}

interface EditorStore {
  projectId: string | null;
  openTabs: string[];
  activePath: string | null;
  /** Carpeta o archivo seleccionado en el árbol. */
  selected: string | null;
  expanded: Set<string>;
  saveStatus: SaveStatus;
  /** Se incrementa cuando el contenido de archivos abiertos cambia desde fuera del editor. */
  reloadToken: number;

  /** Petición de ir a una línea (desde el panel de errores). `nonce` permite repetirla. */
  jump: { path: string; line: number | null; nonce: number } | null;

  /** Estado de CodeMirror por archivo (conserva deshacer/cursor al cambiar de pestaña). */
  docStates: Map<string, EditorState>;
  /** Guarda inmediatamente los cambios pendientes del editor. Lo registra el editor. */
  flushSaves: () => Promise<void>;

  init: (projectId: string, defaultOpen: string | null) => void;
  openFile: (path: string) => void;
  /** Abre el archivo, lo muestra en el árbol y coloca el cursor en la línea. */
  goTo: (path: string, line: number | null) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  select: (path: string | null) => void;
  toggleFolder: (path: string) => void;
  expand: (path: string) => void;
  revealPath: (path: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setFlushSaves: (fn: () => Promise<void>) => void;
  /** Tras renombrar o mover `from` → `to` (archivo o carpeta). */
  onRenamed: (from: string, to: string) => void;
  /** Tras eliminar `path` (archivo o carpeta). */
  onDeleted: (path: string) => void;
  /** Tras reemplazar el contenido de archivos desde fuera (p. ej. subida). */
  invalidate: (paths: string[]) => void;
}

const storageKey = (projectId: string) => `freelatex:ui:${projectId}`;

function loadUi(projectId: string): PersistedUi | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as PersistedUi) : null;
  } catch {
    return null;
  }
}

function saveUi(state: EditorStore) {
  if (!state.projectId) return;
  try {
    const ui: PersistedUi = {
      openTabs: state.openTabs,
      activePath: state.activePath,
      expanded: [...state.expanded],
    };
    localStorage.setItem(storageKey(state.projectId), JSON.stringify(ui));
  } catch {
    // almacenamiento no disponible (modo privado, etc.)
  }
}

const mapPath = (path: string, from: string, to: string) => (isWithin(path, from) ? replacePrefix(path, from, to) : path);

export const useEditorStore = create<EditorStore>((set, get) => ({
  projectId: null,
  openTabs: [],
  activePath: null,
  selected: null,
  expanded: new Set(),
  saveStatus: "saved",
  reloadToken: 0,
  jump: null,
  docStates: new Map(),
  flushSaves: async () => {},

  init: (projectId, defaultOpen) => {
    if (get().projectId === projectId) return;
    const ui = loadUi(projectId);
    const openTabs = ui?.openTabs ?? (defaultOpen ? [defaultOpen] : []);
    const activePath = ui?.activePath ?? openTabs[0] ?? null;
    const expanded = new Set(ui?.expanded ?? (defaultOpen ? ancestors(defaultOpen) : []));
    set({
      projectId,
      openTabs,
      activePath,
      selected: activePath,
      expanded,
      saveStatus: "saved",
      docStates: new Map(),
    });
  },

  openFile: (path) => {
    const { openTabs } = get();
    set({
      openTabs: openTabs.includes(path) ? openTabs : [...openTabs, path],
      activePath: path,
      selected: path,
    });
  },

  goTo: (path, line) => {
    get().openFile(path);
    get().revealPath(path);
    set({ jump: { path, line, nonce: (get().jump?.nonce ?? 0) + 1 } });
  },

  closeTab: (path) => {
    const { openTabs, activePath, docStates } = get();
    const index = openTabs.indexOf(path);
    if (index === -1) return;
    const next = openTabs.filter((p) => p !== path);
    docStates.delete(path);
    set({
      openTabs: next,
      activePath: activePath === path ? (next[index] ?? next[index - 1] ?? null) : activePath,
    });
  },

  setActive: (path) => set({ activePath: path, selected: path }),
  select: (path) => set({ selected: path }),

  toggleFolder: (path) => {
    const expanded = new Set(get().expanded);
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
    set({ expanded });
  },

  expand: (path) => {
    if (get().expanded.has(path)) return;
    set({ expanded: new Set(get().expanded).add(path) });
  },

  revealPath: (path) => {
    const expanded = new Set(get().expanded);
    for (const a of ancestors(path)) expanded.add(a);
    set({ expanded, selected: path });
  },

  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setFlushSaves: (flushSaves) => set({ flushSaves }),

  onRenamed: (from, to) => {
    const { openTabs, activePath, selected, expanded, docStates } = get();
    const newStates = new Map<string, EditorState>();
    for (const [p, s] of docStates) newStates.set(mapPath(p, from, to), s);
    set({
      openTabs: openTabs.map((p) => mapPath(p, from, to)),
      activePath: activePath && mapPath(activePath, from, to),
      selected: selected && mapPath(selected, from, to),
      expanded: new Set([...expanded].map((p) => mapPath(p, from, to))),
      docStates: newStates,
    });
  },

  onDeleted: (path) => {
    const { openTabs, activePath, selected, expanded, docStates } = get();
    const keep = openTabs.filter((p) => !isWithin(p, path));
    for (const p of [...docStates.keys()]) if (isWithin(p, path)) docStates.delete(p);
    const activeGone = activePath !== null && isWithin(activePath, path);
    set({
      openTabs: keep,
      activePath: activeGone ? (keep[keep.length - 1] ?? null) : activePath,
      selected: selected && isWithin(selected, path) ? null : selected,
      expanded: new Set([...expanded].filter((p) => !isWithin(p, path))),
    });
  },

  invalidate: (paths) => {
    const { docStates, openTabs, reloadToken } = get();
    let touched = false;
    for (const p of paths) {
      if (docStates.delete(p) || openTabs.includes(p)) touched = true;
    }
    if (touched) set({ reloadToken: reloadToken + 1 });
  },
}));

// Recordar pestañas y carpetas abiertas por proyecto.
useEditorStore.subscribe((state, prev) => {
  if (
    state.openTabs !== prev.openTabs ||
    state.activePath !== prev.activePath ||
    state.expanded !== prev.expanded
  ) {
    saveUi(state);
  }
});
