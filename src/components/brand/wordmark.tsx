import type { CSSProperties } from "react";
import { cn } from "@/components/ui/cn";

/*
 * The QMatus mark, from the official logo (public/brand). The logo is split
 * into two alpha masks so the theme paints it: the ink takes the primary text
 * colour (light on dark, ink on light) and the notch takes --brand-primary.
 */
const mask = (src: string): CSSProperties => ({
  maskImage: `url(${src})`,
  WebkitMaskImage: `url(${src})`,
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
});

export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block aspect-[502/512] w-6 shrink-0", className)}>
      <span className="absolute inset-0 bg-fg" style={mask("/brand/qmatus-mark-ink.png")} />
      <span className="absolute inset-0 bg-brand" style={mask("/brand/qmatus-mark-notch.png")} />
    </span>
  );
}

export function Wordmark({ className, withProduct = false }: { className?: string; withProduct?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-fg", className)}>
      <LogoMark className="w-[26px]" />
      <span className="flex items-baseline gap-1.5">
        <span className="text-[17px] font-semibold tracking-[-0.02em]">QMatus</span>
        {withProduct && <span className="text-label font-normal text-fg-3">Team Tracker</span>}
      </span>
    </span>
  );
}
