import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md";

const base =
  "qm-press inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium select-none " +
  "disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const variants: Record<Variant, string> = {
  primary: "bg-action text-action-fg hover:bg-action-hover",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-hover hover:border-control",
  quiet: "text-fg-2 hover:bg-hover hover:text-fg",
  danger: "border border-line-strong bg-surface text-danger hover:bg-danger-bg hover:border-danger",
};

// 36px on desktop, 40px on coarse pointers (touch) per spec §11.1.
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-label pointer-coarse:h-10",
  md: "h-9 px-3.5 text-body pointer-coarse:h-11",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
  pendingLabel?: string;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", pending, pendingLabel, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {icon}
      {/* Geometry stays put while pending: the label swaps, the box doesn't. */}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
});

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  icon,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }>(
  function IconButton({ label, className, children, size = "md", type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          "qm-press inline-grid shrink-0 place-items-center rounded-sm text-fg-2 hover:bg-hover hover:text-fg",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50",
          size === "sm" ? "size-7 pointer-coarse:size-10" : "size-9 pointer-coarse:size-11",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
