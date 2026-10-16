import { EyeOff, Lock, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function PageHeader({
  title,
  description,
  actions,
  context,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  context?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {context && <div className="mb-1 text-label text-fg-3">{context}</div>}
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.025em] text-balance text-fg">{title}</h1>
        {description && <p className="mt-1 max-w-[68ch] text-body text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-section font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-label text-fg-3">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Purposeful empty state: why it's empty and one useful next action. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 rounded-xl border border-dashed border-line-strong px-5 py-6", className)}>
      <p className="text-body font-medium text-fg">{title}</p>
      {body && <p className="max-w-[60ch] text-body text-fg-2">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * The audience seam — QMatus's signature detail. Wherever audiences mix, a
 * hairline names who can see what follows.
 */
export function AudienceSeam({
  audience,
  tone = "private",
  className,
}: {
  audience: string;
  tone?: "private" | "shared";
  className?: string;
}) {
  const Icon = tone === "private" ? Lock : Users;
  return (
    <div className={cn("flex items-center gap-2", className)} role="separator" aria-label={`Visible to: ${audience}`}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 text-meta font-medium",
          tone === "private" ? "text-warning" : "text-accent",
        )}
      >
        <Icon className="size-3.5" aria-hidden strokeWidth={2.25} />
        {audience}
      </span>
      <span className={cn("h-px flex-1", tone === "private" ? "bg-warning/40" : "bg-accent/40")} aria-hidden />
    </div>
  );
}

export function NotAvailable({ title = "This isn't available", body }: { title?: string; body?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 py-16">
      <EyeOff className="size-5 text-fg-3" aria-hidden />
      <h1 className="text-title font-semibold text-fg">{title}</h1>
      <p className="text-body text-fg-2">
        {body ??
          "It may have been moved or archived, or it belongs to a space you don't have access to. If you think you should see it, ask a workspace admin."}
      </p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-sm bg-subtle", className)} aria-hidden />;
}
