import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "./icons";

const CONTROL =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

/** <select> nativo (accesible y con buen soporte móvil) con flecha propia. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative flex">
      <select {...props} className={`${CONTROL} appearance-none pr-8 ${props.className ?? ""}`} />
      <ChevronDownIcon
        width={14}
        height={14}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-subtle"
      />
    </span>
  );
}
