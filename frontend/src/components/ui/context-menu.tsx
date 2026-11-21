"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon } from "./icons";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Icono a la izquierda. */
  icon?: ReactNode;
  /** Texto secundario a la derecha (atajo, detalle). */
  hint?: string;
  /** Opción marcada (menús de selección): muestra ✓ y usa role="menuitemradio". */
  checked?: boolean;
}

export type MenuEntry = MenuItem | "separator" | { heading: string };

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
  /** Nombre accesible del menú. */
  label?: string;
}

const isItem = (entry: MenuEntry): entry is MenuItem => typeof entry === "object" && "label" in entry;

/** Menú flotante en una posición de pantalla. Se cierra con clic fuera, Escape o scroll. */
export function ContextMenu({ x, y, items, onClose, label }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const selectable = items.some((i) => isItem(i) && i.checked !== undefined);

  // Mantener el menú dentro de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    // Foco en la opción marcada, o en la primera disponible.
    const el = ref.current;
    (
      el?.querySelector<HTMLButtonElement>('[aria-checked="true"]:not(:disabled)') ??
      el?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    )?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") onClose();
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

  // Flechas, Inicio y Fin para moverse entre opciones.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (index + 1) % buttons.length;
    else if (e.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    if (next !== null) {
      e.preventDefault();
      buttons[next]?.focus();
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 max-h-[min(24rem,calc(100vh-1rem))] max-w-80 min-w-44 overflow-y-auto rounded-lg border border-line bg-surface p-1 text-sm text-fg shadow-lg"
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) =>
        item === "separator" ? (
          <div key={`sep-${i}`} className="-mx-1 my-1 border-t border-line" />
        ) : !isItem(item) ? (
          <div key={`h-${i}`} className="px-2 pt-1.5 pb-1 text-xs font-medium text-fg-subtle">
            {item.heading}
          </div>
        ) : (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role={selectable ? "menuitemradio" : "menuitem"}
            aria-checked={selectable ? !!item.checked : undefined}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-surface-hover focus:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent ${
              item.danger ? "text-danger-text" : ""
            }`}
          >
            {selectable && (
              <span className="flex w-4 shrink-0 justify-center text-accent-text">
                {item.checked && <CheckIcon width={14} height={14} />}
              </span>
            )}
            {item.icon && <span className="flex shrink-0 text-fg-subtle">{item.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.hint && <span className="shrink-0 pl-4 text-xs text-fg-subtle">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
