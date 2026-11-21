"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { basename, extname } from "@/lib/paths";
import { downloadBytes } from "@/lib/projects";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
};

interface BinaryPreviewProps {
  path: string;
  data: Uint8Array;
}

/** Vista de un archivo no editable: imágenes y PDF se muestran; el resto se puede descargar. */
export function BinaryPreview({ path, data }: BinaryPreviewProps) {
  const ext = extname(path);
  const mime = MIME[ext];
  const mediaRef = useRef<HTMLImageElement & HTMLIFrameElement>(null);

  // La URL del blob se asigna directamente al elemento y se libera al cambiar.
  useEffect(() => {
    const el = mediaRef.current;
    if (!mime || !el) return;
    const objectUrl = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
    el.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [data, mime]);

  const download = (
    <Button onClick={() => downloadBytes(basename(path), data, mime ?? "application/octet-stream")}>Descargar</Button>
  );

  if (mime === "application/pdf") {
    return <iframe ref={mediaRef} title={path} className="h-full w-full border-0" />;
  }

  if (mime) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 overflow-auto bg-[repeating-conic-gradient(var(--surface-active)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob local, no optimizable */}
        <img ref={mediaRef} alt={path} className="max-h-[80%] max-w-full object-contain shadow" />
        <p className="rounded bg-surface/80 px-2 py-0.5 text-xs text-fg-muted">
          {basename(path)} · {formatBytes(data.byteLength)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-fg-subtle">
      <p>
        <strong className="text-fg">{basename(path)}</strong> es un archivo binario (
        {formatBytes(data.byteLength)}) y no se puede editar aquí.
      </p>
      <p className="max-w-sm text-xs">
        Si es un .tex en una codificación distinta de UTF-8 (p. ej. latin1), se conserva tal cual para compilar.
      </p>
      {download}
    </div>
  );
}
