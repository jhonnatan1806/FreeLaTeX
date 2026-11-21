"use client";

import type { PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

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

interface PdfViewerProps {
  data: Uint8Array;
  zoom: ZoomMode;
  onInfo?: (info: { numPages: number; scale: number }) => void;
}

interface PageInfo {
  page: PDFPageProxy;
  width: number; // en puntos PDF (escala 1)
  height: number;
}

const PAGE_GAP = 12;
const PADDING = 16;

export function PdfViewer({ data, zoom, onInfo }: PdfViewerProps) {
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
            <PdfPage key={i} info={info} scale={scale} root={container} label={`Página ${i + 1}`} />
          ))}
      </div>
    </div>
  );
}

interface PdfPageProps {
  info: PageInfo;
  scale: number;
  root: HTMLElement | null;
  label: string;
}

/** Una página: se renderiza solo cuando está cerca de la zona visible. */
function PdfPage({ info, scale, root, label }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const width = Math.floor(info.width * scale);
  const height = Math.floor(info.height * scale);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root,
      rootMargin: "600px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;
    let task: RenderTask | null = null;
    let cancelled = false;

    // Renderizar en un canvas aparte y copiar al terminar: sin parpadeo al recompilar.
    const ratio = window.devicePixelRatio || 1;
    const viewport = info.page.getViewport({ scale: scale * ratio });
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.floor(viewport.width);
    offscreen.height = Math.floor(viewport.height);
    task = info.page.render({ canvas: offscreen, viewport });
    task.promise
      .then(() => {
        if (cancelled) return;
        canvas.width = offscreen.width;
        canvas.height = offscreen.height;
        canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
      })
      .catch(() => {
        // cancelado o documento destruido
      });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, info, scale]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={label}
      style={{ width, height }}
      className="shrink-0 bg-white shadow-md"
    />
  );
}
