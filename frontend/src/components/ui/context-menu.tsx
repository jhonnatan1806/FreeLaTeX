"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export type MenuEntry = MenuItem | "separator";

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
}

/** Menú flotante en una posición de pantalla. Se cierra con clic fuera, Escape o scroll. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Mantener el menú dentro de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth - width - 8),
      y: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 min-w-44 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === "separator" ? (
          <div key={`sep-${i}`} className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
        ) : (
          <button
            key={item.label}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`block w-full px-3 py-1.5 text-left hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none disabled:opacity-40 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 ${
              item.danger ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
