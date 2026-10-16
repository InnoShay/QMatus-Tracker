import { cn } from "./cn";

/** Neutral initials. Colour never encodes role, seniority or permission. */
export function Avatar({ name, size = "md", className }: { name: string | null | undefined; size?: "sm" | "md"; className?: string }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      role="img"
      aria-label={name ?? "Unassigned"}
      title={name ?? "Unassigned"}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full border border-line-strong bg-subtle font-medium text-fg-2 select-none",
        size === "sm" ? "size-5 text-[10px]" : "size-7 text-meta",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}
