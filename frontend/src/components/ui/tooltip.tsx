"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Kbd } from "./kbd";

const SHOW_DELAY_MS = 400;
const GAP = 6;
const MARGIN = 8;

interface TooltipProps {
  /** Texto del tooltip. */
  content: ReactNode;
  /** Atajo de teclado, p. ej. "Ctrl+Enter". Se pinta con <Kbd>. */
  shortcut?: string;
  children: ReactNode;
}

/**
 * Tooltip flotante (en un portal, así no lo recortan los contenedores con scroll).
 * El envoltorio usa `display: contents`, de modo que no altera el layout del hijo.
 */
export function Tooltip({ content, shortcut, children }: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const show = (delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = wrapperRef.current?.firstElementChild;
      if (el) setAnchor(el.getBoundingClientRect());
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setAnchor(null);
    setPos(null);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // Ocultar al desplazar o redimensionar: la posición quedaría desfasada.
  useEffect(() => {
    if (!anchor) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [anchor]);

  // Colocar debajo (o encima si no cabe), centrado y dentro de la ventana.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const { width, height } = tip.getBoundingClientRect();
    let top = anchor.bottom + GAP;
    if (top + height > window.innerHeight - MARGIN) top = anchor.top - GAP - height;
    const left = Math.min(
      Math.max(MARGIN, anchor.left + anchor.width / 2 - width / 2),
      window.innerWidth - width - MARGIN,
    );
    setPos({ left, top });
  }, [anchor]);

  return (
    <span
      ref={wrapperRef}
      className="contents"
      onMouseOver={() => !anchor && show(SHOW_DELAY_MS)}
      onMouseLeave={hide}
      onFocus={(e) => e.target.matches(":focus-visible") && show(0)}
      onBlur={hide}
      onPointerDown={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {children}
      {anchor &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
            className="pointer-events-none fixed z-[60] flex max-w-72 items-center gap-2 rounded-md bg-fg px-2 py-1 text-xs font-medium text-surface shadow-lg motion-safe:animate-[tooltip-in_120ms_ease-out]"
          >
            <span>{content}</span>
            {shortcut && <Kbd inverted>{shortcut}</Kbd>}
          </div>,
          document.body,
        )}
    </span>
  );
}
