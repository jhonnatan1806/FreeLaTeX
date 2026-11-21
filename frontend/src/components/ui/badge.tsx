import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "danger" | "warning" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-active text-fg-muted",
  accent: "bg-accent-soft text-accent-soft-fg",
  danger: "bg-danger text-white",
  // Texto oscuro sobre ámbar: el blanco no llega a 4.5:1.
  warning: "bg-warning text-zinc-950",
  info: "bg-info text-white",
};

/** Contador o etiqueta pequeña. */
export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-xs leading-none font-semibold tabular-nums ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
