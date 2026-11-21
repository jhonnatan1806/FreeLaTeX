"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Botones del pie. */
  footer?: ReactNode;
}

/** Diálogo modal basado en <dialog> nativo (foco, Escape y fondo incluidos). */
export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clic en el fondo (fuera del contenido) cierra.
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-fg shadow-xl backdrop:bg-overlay"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="text-sm">{children}</div>
          {footer && <div className="flex justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
