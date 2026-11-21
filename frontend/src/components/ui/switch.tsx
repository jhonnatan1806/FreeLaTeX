import type { ReactNode } from "react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto visible junto al interruptor. */
  children?: ReactNode;
  /** Nombre accesible si el texto visible se oculta en pantallas estrechas. */
  label?: string;
  className?: string;
}

/** Interruptor encendido/apagado (role="switch"). */
export function Switch({ checked, onChange, children, label, className = "" }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`group inline-flex shrink-0 items-center gap-2 rounded-md px-1 py-0.5 text-fg-muted hover:text-fg ${className}`}
    >
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-line-strong"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {children}
    </button>
  );
}
