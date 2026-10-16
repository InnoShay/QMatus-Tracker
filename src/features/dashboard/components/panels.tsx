import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** A dashboard panel: title row (with optional action) over its content. */
export function Panel({
  title,
  caption,
  action,
  children,
  className,
  id,
}: {
  title: string;
  caption?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("qm-card flex min-w-0 flex-col p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <h2 id={`${id}-title`} className="text-section font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          {caption && <p className="mt-0.5 text-label text-fg-3">{caption}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-4 flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center rounded-full border border-line px-3 text-label font-medium text-fg-2 hover:border-line-strong hover:bg-hover hover:text-fg"
    >
      {children}
    </Link>
  );
}

/** Big figure with a quieter unit, e.g. 64%. Proportional figures at display size. */
export function Figure({ value, unit, className, testId }: { value: ReactNode; unit?: string; className?: string; testId?: string }) {
  return (
    <span data-testid={testId} className={cn("inline-flex items-baseline font-medium tracking-[-0.035em] text-fg", className)}>
      {value}
      {unit && <span className="ml-0.5 text-[0.5em] font-medium tracking-normal text-fg-3">{unit}</span>}
    </span>
  );
}

/** Signed change vs the previous period. Up is good for completions, neutral for creation. */
export function Delta({ now, before, goodWhenUp }: { now: number; before: number; goodWhenUp?: boolean }) {
  const diff = now - before;
  if (before === 0 && now === 0) return <span className="text-meta text-fg-3">No change</span>;
  const tone = diff === 0 || goodWhenUp === undefined ? "text-fg-3" : diff > 0 === goodWhenUp ? "text-success" : "text-danger";
  return (
    <span className={cn("text-meta font-medium tabular", tone)}>
      {diff > 0 ? "+" : diff < 0 ? "−" : "±"}
      {Math.abs(diff)} <span className="font-normal text-fg-3">vs previous period</span>
    </span>
  );
}
