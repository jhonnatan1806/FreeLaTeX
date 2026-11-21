"use client";

import { memo, useCallback, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import {
  AlertIcon,
  DownloadIcon,
  FileTextIcon,
  ListIcon,
  MaximizeWidthIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  Spinner,
} from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
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
  const [page, setPage] = useState(1);
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
    <div className="flex h-full min-h-0 flex-col bg-surface-sunken">
      {/* Barra de compilación (@container: se compacta según el ancho del panel, no de la ventana) */}
      <div className="@container shrink-0 border-b border-line bg-surface-muted">
        <div className="flex h-9 items-center gap-1 overflow-x-auto px-2 @sm:gap-1.5 text-xs whitespace-nowrap [scrollbar-width:none]">
          <Tooltip content="Compilar" shortcut="Ctrl+Enter">
            <button
              type="button"
              onClick={() => void compile()}
              aria-busy={compiling}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-accent px-2.5 font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              {compiling ? <Spinner size={12} /> : <PlayIcon width={12} height={12} />}
              {compiling ? "Compilando…" : "Compilar"}
            </button>
          </Tooltip>
          <Tooltip content="Compilar automáticamente cada vez que se guarda">
            <Switch checked={autoCompile} onChange={setAutoCompile} label="Compilar al guardar">
              <span className="hidden @md:inline">Compilar al guardar</span>
              <span className="@md:hidden">Auto</span>
            </Switch>
          </Tooltip>
          {logText && (
            <Tooltip content={showLog ? "Volver al PDF" : "Errores, avisos y log"}>
              <button
                type="button"
                onClick={() => setShowLog(!showLog)}
                aria-label={showLog ? "Volver al PDF" : "Ver errores, avisos y log"}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-fg-muted hover:bg-surface-hover hover:text-fg ${
                  showLog ? "bg-surface-active text-fg" : ""
                }`}
              >
                {showLog ? <FileTextIcon width={14} height={14} /> : <ListIcon width={14} height={14} />}
                <span className="hidden @sm:inline">{showLog ? "PDF" : "Log"}</span>
                <LogBadges />
              </button>
            </Tooltip>
          )}
          <StatusText />

          {pdf && !showLog && (
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {info.numPages > 0 && (
                <span className="px-1 text-fg-subtle tabular-nums" aria-live="polite">
                  <span className="hidden @sm:inline">Pág. </span>
                  {Math.min(page, info.numPages)} / {info.numPages}
                </span>
              )}
              <span className="mx-1 hidden h-4 w-px bg-line @sm:block" aria-hidden="true" />
              <span className="hidden @xs:contents">
                <IconButton size="sm" label="Alejar" onClick={() => stepZoom(-1)}>
                  <MinusIcon width={14} height={14} />
                </IconButton>
              </span>
              <Tooltip content={zoom === "fit-width" ? "Ajustado al ancho" : "Ajustar al ancho"}>
                <button
                  type="button"
                  onClick={() => setZoom("fit-width")}
                  aria-label={`Zoom ${Math.round(info.scale * 100)} %. Ajustar al ancho`}
                  className="inline-flex h-6 min-w-11 items-center justify-center gap-1 rounded-md px-1 text-fg-muted tabular-nums hover:bg-surface-hover hover:text-fg"
                >
                  {Math.round(info.scale * 100)}%
                  {zoom === "fit-width" && (
                    <MaximizeWidthIcon width={12} height={12} className="hidden text-accent-text @sm:block" />
                  )}
                </button>
              </Tooltip>
              <span className="hidden @xs:contents">
                <IconButton size="sm" label="Acercar" onClick={() => stepZoom(1)}>
                  <PlusIcon width={14} height={14} />
                </IconButton>
              </span>
              <span className="hidden @sm:contents">
                <IconButton
                  size="sm"
                  label="Descargar PDF"
                  onClick={() => downloadBytes(`${projectName}.pdf`, pdf, "application/pdf")}
                >
                  <DownloadIcon width={14} height={14} />
                </IconButton>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Avisos */}
      {requestError && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger-text"
        >
          <AlertIcon width={14} height={14} className="mt-px shrink-0" />
          <span>{requestError}</span>
        </div>
      )}
      {!requestError && failed && phase !== "compiling" && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning-text"
        >
          <AlertIcon width={14} height={14} className="shrink-0" />
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
            <button type="button" onClick={() => setShowLog(true)} className="rounded font-medium underline">
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
            onPageChange={setPage}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-fg-muted">
            {compiling ? (
              <>
                <Spinner size={20} className="text-accent" />
                <p>Compilando…</p>
              </>
            ) : (
              <>
                <FileTextIcon width={32} height={32} className="text-fg-subtle" />
                <p>Aún no hay PDF.</p>
                <p className="flex items-center gap-1.5 text-xs">
                  Pulsa <strong className="font-medium text-fg">Compilar</strong> o <Kbd>Ctrl+Enter</Kbd>
                </p>
              </>
            )}
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
    <span className="hidden truncate text-fg-subtle @lg:inline">
      {result.status === "success" ? `Compilado en ${seconds} s` : `Con errores · ${seconds} s`}
    </span>
  );
}
