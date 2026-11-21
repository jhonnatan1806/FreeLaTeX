"use client";

import { memo, useCallback, useState } from "react";
import { downloadBytes } from "@/lib/projects";
import { useCompileStore } from "@/store/compile-store";
import { useShallow } from "zustand/react/shallow";
import { LogBadges, LogPanel } from "./log-panel";
import { PdfViewer, type ZoomMode } from "./pdf-viewer";

const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export const PdfPanel = memo(function PdfPanel({ projectName }: { projectName: string }) {
  const { phase, result, pdf, requestError, autoCompile, showLog, highlight } = useCompileStore(
    useShallow((s) => ({
      phase: s.phase,
      result: s.result,
      pdf: s.pdf,
      requestError: s.requestError,
      autoCompile: s.autoCompile,
      showLog: s.showLog,
      highlight: s.highlight,
    })),
  );
  const { compile, setAutoCompile, setShowLog } = useCompileStore.getState();
  const onPageDoubleClick = useCallback(
    (page: number, x: number, y: number) => void useCompileStore.getState().syncToCode(page, x, y),
    [],
  );
  const [zoom, setZoom] = useState<ZoomMode>("fit-width");
  const [info, setInfo] = useState({ numPages: 0, scale: 1 });
  const onInfo = useCallback((i: { numPages: number; scale: number }) => setInfo(i), []);

  const compiling = phase === "compiling";
  const failed = result && result.status !== "success";
  const logText = result?.log || result?.output || "";

  const stepZoom = (dir: 1 | -1) => {
    const current = info.scale;
    const next =
      dir > 0 ? ZOOM_STEPS.find((z) => z > current + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001);
    if (next) setZoom(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100 dark:bg-zinc-900">
      {/* Barra de compilación */}
      <div className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-zinc-200 px-2 text-xs dark:border-zinc-800">
        <button
          type="button"
          onClick={() => void compile()}
          title="Recompilar (Ctrl+Enter o Ctrl+S)"
          className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1 font-medium text-white hover:bg-emerald-700"
        >
          {compiling ? <Spinner /> : <PlayIcon />}
          {compiling ? "Compilando…" : "Recompilar"}
        </button>
        <label className="flex cursor-pointer items-center gap-1 text-zinc-600 dark:text-zinc-400" title="Compilar al guardar">
          <input type="checkbox" checked={autoCompile} onChange={(e) => setAutoCompile(e.target.checked)} />
          Auto
        </label>
        {logText && (
          <button
            type="button"
            onClick={() => setShowLog(!showLog)}
            title={showLog ? "Volver al PDF" : "Errores, avisos y log"}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 ${showLog ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
          >
            {showLog ? "PDF" : "Log"}
            <LogBadges />
          </button>
        )}
        <StatusText />

        <div className="ml-auto flex items-center gap-1">
          {pdf && (
            <>
              <ToolbarButton label="Alejar" onClick={() => stepZoom(-1)}>
                −
              </ToolbarButton>
              <button
                type="button"
                onClick={() => setZoom("fit-width")}
                title="Ajustar al ancho"
                className={`w-12 rounded px-1 py-0.5 text-center tabular-nums hover:bg-zinc-200 dark:hover:bg-zinc-800 ${zoom === "fit-width" ? "font-semibold" : ""}`}
              >
                {Math.round(info.scale * 100)}%
              </button>
              <ToolbarButton label="Acercar" onClick={() => stepZoom(1)}>
                +
              </ToolbarButton>
              <ToolbarButton label="Descargar PDF" onClick={() => downloadBytes(`${projectName}.pdf`, pdf, "application/pdf")}>
                ⤓
              </ToolbarButton>
            </>
          )}
        </div>
      </div>

      {/* Avisos */}
      {requestError && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {requestError}
        </div>
      )}
      {!requestError && failed && phase !== "compiling" && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="flex-1">
            {result.status === "timeout"
              ? "La compilación superó el tiempo máximo y se detuvo."
              : result.pdf
                ? "Hubo errores de compilación; el PDF puede estar incompleto."
                : pdf
                  ? "La compilación falló. Se muestra el PDF anterior."
                  : "La compilación falló y no se generó PDF."}
          </span>
          {!showLog && logText && pdf && (
            <button type="button" onClick={() => setShowLog(true)} className="font-medium underline">
              Ver errores
            </button>
          )}
        </div>
      )}

      {/* Contenido */}
      <div className="relative min-h-0 flex-1">
        {/* Sin PDF que mostrar tras un fallo: directamente los errores. */}
        {showLog || (!pdf && failed && !compiling) ? (
          <LogPanel />
        ) : pdf ? (
          <PdfViewer
            data={pdf}
            zoom={zoom}
            onInfo={onInfo}
            highlight={highlight}
            onPageDoubleClick={onPageDoubleClick}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
            {compiling ? "Compilando…" : "Pulsa Recompilar para generar el PDF."}
          </div>
        )}
      </div>
    </div>
  );
});

function StatusText() {
  const phase = useCompileStore((s) => s.phase);
  const result = useCompileStore((s) => s.result);
  if (phase === "compiling" || !result) return null;
  const seconds = (result.durationMs / 1000).toFixed(1);
  return (
    <span className="hidden truncate text-zinc-500 lg:inline">
      {result.status === "success" ? `Compilado en ${seconds} s` : `Con errores · ${seconds} s`}
    </span>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="h-6 w-6 rounded text-sm leading-none hover:bg-zinc-200 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function Spinner() {
  return <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />;
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 1l7 4-7 4z" fill="currentColor" />
    </svg>
  );
}
