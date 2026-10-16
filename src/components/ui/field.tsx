import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control =
  "rounded-sm border border-control bg-surface px-3 text-body text-fg placeholder:text-fg-3 " +
  "transition-colors duration-[120ms] hover:border-fg-3 focus-visible:outline-2 focus-visible:outline-offset-0 " +
  "focus-visible:outline-focus focus-visible:border-transparent disabled:bg-subtle disabled:text-fg-3 " +
  "aria-[invalid=true]:border-danger";

/** Full width unless the caller sets its own width. */
const width = (className?: string) => (className && /(^|\s)(w-|max-w-|min-w-)/.test(className) ? "" : "w-full");

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, width(className), "h-9 pointer-coarse:h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, "w-full min-h-20 py-2 leading-5", className)} {...rest} />;
});

/** Native select: accessible, touch-friendly and consistent on every platform. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        control,
        width(className),
        "h-9 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9 pointer-coarse:h-11",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23848F9F' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
};

/** Visible label, hint and announced error wired to one control. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label font-medium text-fg-2">
        {label}
        {optional && <span className="ml-1 font-normal text-fg-3">(optional)</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-meta text-fg-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-meta font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
