"use client";

import type { PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { memo, useEffect, useRef, useState } from "react";
import type { PdfRect } from "@/lib/synctex";

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

/** Carga pdf.js solo en el navegador y una única vez. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return pdfjs;
  });
  return pdfjsPromise;
}

export type ZoomMode = "fit-width" | number;

export interface PdfHighlight {
  page: number;
  rects: PdfRect[];
  /** Cambia en cada petición para repetir el desplazamiento aunque sea la misma zona. */
  nonce: number;
}

interface PdfViewerProps {
  data: Uint8Array;
  zoom: ZoomMode;
  onInfo?: (info: { numPages: number; scale: number }) => void;
  /** Zona a resaltar y mostrar (código → PDF). */
  highlight?: PdfHighlight | null;
  /** Doble clic en una página, en puntos PDF desde arriba a la izquierda (PDF → código). */
  onPageDoubleClick?: (page: number, x: number, y: number) => void;
}

interface PageInfo {
  page: PDFPageProxy;
  width: number; // en puntos PDF (escala 1)
  height: number;
}

const PAGE_GAP = 12;
const PADDING = 16;
/** Más allá de 2× la nitidez apenas mejora y el coste de pintar se dispara. */
const MAX_PIXEL_RATIO = 2;

/**
 * Cola global de pintado: una página cada vez. pdf.js dibuja en el hilo principal;
 * pintar muchas a la vez (al hacer scroll rápido) es lo que bloquea la interfaz.
 */
let renderQueue: Promise<void> = Promise.resolve();
function enqueueRender(job: () => Promise<void>): void {
  renderQueue = renderQueue.then(job, job);
}

export function PdfViewer({ data, zoom, onInfo, highlight, onPageDoubleClick }: PdfViewerProps) {
  // Estado (no ref) porque las páginas lo usan como raíz del IntersectionObserver.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Cargar el documento cuando cambian los bytes.
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    loadPdfJs()
      .then((pdfjs) => {
        task = pdfjs.getDocument({ data: data.slice() }); // copia: pdf.js transfiere el buffer
        return task.promise;
      })
      .then(async (loaded) => {
        const infos: PageInfo[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const page = await loaded.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          infos.push({ page, width: vp.width, height: vp.height });
        }
        if (cancelled) return;
        setError(null);
        setPages(infos);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      // Destruir tras un momento: las páginas antiguas siguen visibles hasta que se pintan las nuevas.
      setTimeout(() => void task?.destroy(), 2000);
    };
  }, [data]);

  // Ancho disponible para "ajustar al ancho".
  useEffect(() => {
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  const maxWidth = pages.reduce((m, p) => Math.max(m, p.width), 0) || 612;
  const scale =
    zoom === "fit-width" ? Math.max(0.25, (containerWidth - PADDING * 2) / maxWidth) : zoom;

  useEffect(() => {
    onInfo?.({ numPages: pages.length, scale });
  }, [onInfo, pages.length, scale]);

  // Desplazar hasta la zona resaltada (una vez por petición).
  const scrolledNonce = useRef(0);
  useEffect(() => {
    if (!container || !highlight || highlight.nonce === scrolledNonce.current || pages.length === 0) return;
    const pageEl = container.querySelector<HTMLElement>(`[data-page="${highlight.page}"]`);
    if (!pageEl) return;
    scrolledNonce.current = highlight.nonce;
    const firstY = Math.min(...highlight.rects.map((r) => r.y));
    const offset = pageEl.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({
      top: container.scrollTop + offset + firstY * scale - container.clientHeight / 3,
      behavior: "smooth",
    });
  }, [container, highlight, pages.length, scale]);

  return (
    <div
      ref={(el) => {
        // Medir al montar: ResizeObserver puede tardar (o no dispararse si la pestaña está oculta).
        if (el && el !== container) setContainerWidth(el.clientWidth);
        setContainer(el);
      }}
      className="h-full overflow-auto bg-zinc-200 dark:bg-zinc-800">
      {error && <p className="p-4 text-sm text-red-600">No se pudo mostrar el PDF: {error}</p>}
      <div className="flex flex-col items-center" style={{ padding: PADDING, gap: PAGE_GAP }}>
        {containerWidth > 0 &&
          pages.map((info, i) => (
            <PdfPage
              key={i}
              number={i + 1}
              info={info}
              scale={scale}
              root={container}
              highlight={highlight?.page === i + 1 ? highlight : null}
              onDoubleClick={onPageDoubleClick}
            />
          ))}
      </div>
    </div>
  );
}

interface PdfPageProps {
  number: number;
  info: PageInfo;
  scale: number;
  root: HTMLElement | null;
  highlight: PdfHighlight | null;
  onDoubleClick?: (page: number, x: number, y: number) => void;
}

/** Una página: se pinta solo cuando está cerca de la zona visible, y una sola vez por escala. */
const PdfPage = memo(function PdfPage({ number, info, scale, root, highlight, onDoubleClick }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Lo que ya está pintado en el canvas: evita repintar al volver a una página. */
  const painted = useRef<{ info: PageInfo; scale: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const width = Math.floor(info.width * scale);
  const height = Math.floor(info.height * scale);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root,
      rootMargin: "400px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;
    if (painted.current?.info === info && painted.current.scale === scale) return;
    let task: RenderTask | null = null;
    let cancelled = false;

    enqueueRender(async () => {
      if (cancelled) return; // dejó de ser visible mientras esperaba
      // Renderizar en un canvas aparte y copiar al terminar: sin parpadeo al recompilar.
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const viewport = info.page.getViewport({ scale: scale * ratio });
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.floor(viewport.width);
      offscreen.height = Math.floor(viewport.height);
      task = info.page.render({ canvas: offscreen, viewport });
      try {
        await task.promise;
      } catch {
        return; // cancelado o documento destruido
      }
      if (cancelled) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
      painted.current = { info, scale };
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, info, scale]);

  return (
    <div
      data-page={number}
      className="relative shrink-0 bg-white shadow-md"
      style={{ width, height }}
      onDoubleClick={(e) => {
        if (!onDoubleClick) return;
        const box = e.currentTarget.getBoundingClientRect();
        onDoubleClick(number, (e.clientX - box.left) / scale, (e.clientY - box.top) / scale);
      }}
      title={onDoubleClick ? "Doble clic para ir al código" : undefined}
    >
      <canvas ref={canvasRef} aria-label={`Página ${number}`} style={{ width, height }} className="block" />
      {highlight &&
        highlight.rects.map((r, i) => (
          <div
            // La clave con el nonce reinicia la animación en cada petición.
            key={`${highlight.nonce}-${i}`}
            className="pdf-sync-highlight pointer-events-none absolute rounded-sm"
            style={{ left: r.x * scale - 2, top: r.y * scale - 2, width: r.width * scale + 4, height: r.height * scale + 4 }}
          />
        ))}
    </div>
  );
});
