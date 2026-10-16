"use client";

import { useEffect } from "react";

/**
 * Pointer-driven details, from one delegated listener:
 *  - spotlight: panels (.qm-card / .qm-spot) get --mx/--my and [data-spot] while
 *    hovered, which CSS turns into a soft light and a lit edge under the cursor;
 *  - magnetic: [data-magnetic] controls lean up to 3px toward the pointer.
 * Work is batched into one animation frame and touches only the hovered
 * element, so it costs nothing while the pointer is still. Off for touch,
 * coarse pointers and reduced motion.
 */
export function CursorEffects() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches) return;

    let spot: HTMLElement | null = null;
    let magnet: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    let frame = 0;

    const release = (el: HTMLElement | null) => {
      if (el) el.style.translate = "";
    };

    const paint = () => {
      frame = 0;
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty("--mx", `${x - r.left}px`);
        spot.style.setProperty("--my", `${y - r.top}px`);
      }
      if (magnet && !reduced.matches) {
        const r = magnet.getBoundingClientRect();
        const dx = Math.max(-3, Math.min(3, (x - (r.left + r.width / 2)) * 0.12));
        const dy = Math.max(-2, Math.min(2, (y - (r.top + r.height / 2)) * 0.18));
        magnet.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target instanceof Element ? e.target : null;
      const nextSpot = target?.closest<HTMLElement>(".qm-card, .qm-spot") ?? null;
      if (nextSpot !== spot) {
        spot?.removeAttribute("data-spot");
        spot = nextSpot;
        spot?.setAttribute("data-spot", "");
      }
      const nextMagnet = target?.closest<HTMLElement>("[data-magnetic]:not(:disabled)") ?? null;
      if (nextMagnet !== magnet) {
        release(magnet);
        magnet = nextMagnet;
      }
      x = e.clientX;
      y = e.clientY;
      if ((spot || magnet) && !frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      spot?.removeAttribute("data-spot");
      release(magnet);
      spot = null;
      magnet = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      onLeave();
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);
  return null;
}
