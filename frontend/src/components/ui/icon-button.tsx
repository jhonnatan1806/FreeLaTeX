import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./tooltip";

type Size = "sm" | "md";

const SIZES: Record<Size, string> = {
  sm: "h-6 w-6", // barras compactas (24 px: mínimo WCAG 2.2)
  md: "h-7 w-7",
};

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Nombre accesible y texto del tooltip (obligatorio: el botón solo tiene un icono). */
  label: string;
  /** Atajo que se muestra en el tooltip. */
  shortcut?: string;
  size?: Size;
  /** Estado activado (p. ej. un filtro): se pinta resaltado y expone aria-pressed. */
  active?: boolean;
  children: ReactNode;
}

export function IconButton({
  label,
  shortcut,
  size = "md",
  active,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={active}
        className={`inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${SIZES[size]} ${
          active ? "bg-surface-active text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
        } ${className}`}
        {...props}
      />
    </Tooltip>
  );
}
