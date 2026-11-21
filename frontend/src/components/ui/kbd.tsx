/**
 * Atajo de teclado. "Ctrl+Shift+F" se pinta como teclas separadas.
 * `inverted` para usarlo sobre fondos oscuros (tooltips).
 */
export function Kbd({ children, inverted = false }: { children: string; inverted?: boolean }) {
  const keys = children.split("+");
  const style = inverted
    ? "border-surface/30 bg-surface/15 text-surface"
    : "border-line-strong bg-surface-muted text-fg-muted";
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {keys.map((key, i) => (
        <kbd
          key={i}
          className={`inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-xs leading-4 font-medium ${style}`}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
