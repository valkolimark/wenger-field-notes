import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-navy text-white hover:bg-brand-navy-light focus-visible:outline-brand-navy",
  secondary:
    "bg-white text-brand-navy border border-brand-navy/30 hover:border-brand-navy/60 hover:bg-brand-navy/5 focus-visible:outline-brand-navy",
  destructive:
    "bg-danger text-white hover:bg-danger-dark focus-visible:outline-danger",
  ghost:
    "bg-transparent text-brand-navy/70 hover:bg-brand-navy/5 hover:text-brand-navy focus-visible:outline-brand-navy",
};

const SIZE = { md: "h-11 px-4", lg: "h-12 px-5" } as const;

/** Class string for links/anchors that must stay <a>/<Link>. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: keyof typeof SIZE = "md",
  extra = "",
): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
}) {
  return (
    <button
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
}
