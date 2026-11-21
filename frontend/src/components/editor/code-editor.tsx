"use client";

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { db, fileId } from "@/lib/db";
import { saveFileText } from "@/lib/file-ops";
import { useCompileStore } from "@/store/compile-store";
import { useEditorStore } from "@/store/editor-store";
import { editorExtensions } from "./codemirror-setup";
import { applyDiagnostics, jumpToLine } from "./diagnostics";

/** Espera tras la última pulsación antes de guardar en IndexedDB. */
const AUTOSAVE_MS = 700;

interface CodeEditorProps {
  projectId: string;
  path: string;
}

/**
 * Una única instancia de EditorView que cambia de EditorState al cambiar de
 * pestaña. Cada archivo conserva su propio historial de deshacer y cursor.
 */
export function CodeEditor({ projectId, path }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const currentPath = useRef<string | null>(null);
  const appliedJump = useRef(0);
  const scheduleSave = useRef<(path: string, text: string) => void>(() => {});
  const reloadToken = useEditorStore((s) => s.reloadToken);

  // Crear la vista y el sistema de autoguardado.
  useEffect(() => {
    const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; text: string }>();
    const setStatus = useEditorStore.getState().setSaveStatus;

    const write = async (p: string, text: string) => {
      try {
        await saveFileText(projectId, p, text);
        if (pending.size === 0) setStatus("saved");
      } catch (err) {
        console.error("No se pudo guardar", p, err);
        setStatus("error");
      }
    };

    scheduleSave.current = (p, text) => {
      const prev = pending.get(p);
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        pending.delete(p);
        void write(p, text);
      }, AUTOSAVE_MS);
      pending.set(p, { timer, text });
      setStatus("saving");
    };

    const flush = async () => {
      const entries = [...pending.entries()];
      pending.clear();
      for (const [, { timer }] of entries) clearTimeout(timer);
      await Promise.all(entries.map(([p, { text }]) => write(p, text)));
    };

    const view = new EditorView({ parent: hostRef.current!, state: EditorState.create() });
    viewRef.current = view;
    useEditorStore.getState().setFlushSaves(flush);

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.size > 0) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
      useEditorStore.getState().setFlushSaves(async () => {});
      view.destroy();
      viewRef.current = null;
      currentPath.current = null;
    };
  }, [projectId]);

  // Mostrar el documento de la pestaña activa.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const { docStates } = useEditorStore.getState();

    /** Tras mostrar un documento: marcas del último log y salto pendiente. */
    const afterShow = (v: EditorView) => {
      currentPath.current = path;
      applyDiagnostics(v, useCompileStore.getState().entries, path);
      const { jump } = useEditorStore.getState();
      if (jump && jump.path === path && jump.nonce !== appliedJump.current) {
        appliedJump.current = jump.nonce;
        jumpToLine(v, jump.line);
      } else {
        v.focus();
      }
    };

    const cached = docStates.get(path);
    if (cached) {
      if (cached !== view.state) view.setState(cached);
      afterShow(view);
      return;
    }

    let cancelled = false;
    db.files.get(fileId(projectId, path)).then((file) => {
      const v = viewRef.current;
      if (cancelled || !v || file?.kind === "binary") return;
      const state = EditorState.create({
        doc: file?.text ?? "",
        extensions: editorExtensions({
          path,
          // Como en Overleaf: Ctrl+S guarda y recompila.
          onSave: () => void useCompileStore.getState().compile(),
          onCompile: () => void useCompileStore.getState().compile(),
          onChange: (next, docChanged) => {
            // La ruta puede haber cambiado (renombrado): usar siempre la del ref.
            const p = currentPath.current;
            if (!p) return;
            useEditorStore.getState().docStates.set(p, next);
            if (docChanged) scheduleSave.current(p, next.doc.toString());
          },
        }),
      });
      docStates.set(path, state);
      v.setState(state);
      afterShow(v);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, path, reloadToken]);

  // Nuevas marcas al terminar una compilación.
  const entries = useCompileStore((s) => s.entries);
  useEffect(() => {
    const view = viewRef.current;
    if (view && currentPath.current) applyDiagnostics(view, entries, currentPath.current);
  }, [entries]);

  // Saltos pedidos para el archivo que ya está abierto.
  const jump = useEditorStore((s) => s.jump);
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !jump || jump.path !== currentPath.current || jump.nonce === appliedJump.current) return;
    appliedJump.current = jump.nonce;
    jumpToLine(view, jump.line);
  }, [jump]);

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" />;
}
