import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50 disabled:hover:bg-accent",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-surface-hover disabled:opacity-50",
  ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-danger-hover disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-2 px-3 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
