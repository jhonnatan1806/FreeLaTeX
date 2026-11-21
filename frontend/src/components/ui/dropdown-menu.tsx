"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ContextMenu, type MenuEntry } from "./context-menu";
import { ChevronDownIcon } from "./icons";
import { Tooltip } from "./tooltip";

interface DropdownMenuProps {
  /** Contenido del botón que abre el menú. */
  trigger: ReactNode;
  items: MenuEntry[];
  /** Nombre accesible del botón (si el contenido visible no basta) y del menú. */
  label: string;
  /** Tooltip del botón. */
  tooltip?: string;
  /** Alinear el menú al borde derecho del botón. */
  align?: "start" | "end";
  className?: string;
}

/** Botón con menú desplegable (descargas, selectores compactos de la cabecera…). */
export function DropdownMenu({ trigger, items, label, tooltip, align = "start", className = "" }: DropdownMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const close = useCallback(() => {
    setPos(null);
    buttonRef.current?.focus();
  }, []);

  const open = () => {
    const rect = buttonRef.current!.getBoundingClientRect();
    // Con align="end" se pasa el borde derecho; el menú se recoloca dentro de la ventana.
    setPos({ x: align === "end" ? rect.right - 176 : rect.left, y: rect.bottom + 4 });
  };

  const button = (
    <button
      ref={buttonRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={pos !== null}
      aria-label={label}
      onClick={() => (pos ? setPos(null) : open())}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && !pos) {
          e.preventDefault();
          open();
        }
      }}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 text-xs text-fg transition-colors hover:bg-surface-hover ${
        pos ? "bg-surface-hover" : ""
      } ${className}`}
    >
      {trigger}
      <ChevronDownIcon width={12} height={12} className="shrink-0 text-fg-subtle" />
    </button>
  );

  return (
    <>
      {tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button}
      {pos && <ContextMenu x={pos.x} y={pos.y} items={items} onClose={close} label={label} />}
    </>
  );
}
