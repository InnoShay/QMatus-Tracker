"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const SEEN = "qm-hello";
/* One continuous, hand-drawn stroke (original lettering for QMatus). */
const HELLO =
  "M40 196 C78 178 118 132 140 82 C154 50 152 22 132 26 C110 31 104 82 102 132 C101 162 100 186 100 204 C110 168 132 140 156 142 C176 144 176 170 174 196 C173 206 180 210 192 204 C212 192 230 176 244 160 C258 144 254 126 238 128 C216 131 206 168 214 190 C222 210 252 210 278 190 C304 170 326 128 338 84 C346 52 340 26 322 30 C300 36 296 92 296 140 C296 178 300 204 318 204 C334 204 352 186 366 166 C384 140 404 104 414 76 C424 50 418 26 400 30 C378 36 374 96 374 142 C374 178 378 204 396 204 C414 204 432 186 446 166 C460 146 476 134 494 134 C518 134 530 156 524 178 C518 200 496 210 478 202 C460 194 458 168 472 150 C484 136 504 132 520 136 C540 140 560 140 586 128";

/* Spectrum along the word, left to right: h warm, e yellow, l l green to teal, o blue. */
const SPECTRUM: [number, string][] = [
  [0, "#ff2d6f"],
  [0.12, "#ff3b30"],
  [0.26, "#ff8a00"],
  [0.4, "#ffcc00"],
  [0.54, "#9fe02a"],
  [0.64, "#30d158"],
  [0.76, "#00c7be"],
  [0.88, "#0a84ff"],
  [1, "#2f7bff"],
];

/** Timeline in ms. Draw 1.3s, a short hold, then a 0.5s glide into the app. */
const T = { draw: 1300, delay: 80, hold: 320, exit: 500 };
const LEAVE_AT = T.delay + T.draw + T.hold;
const LEAVE_AT_REDUCED = 900;

/** Runs before first paint on full page loads, so the app never flashes before the greeting. */
export const BOOT_SCRIPT = `try{if(!sessionStorage.getItem("${SEEN}"))document.documentElement.dataset.boot="1"}catch(e){}`;

/**
 * The greeting: "hello" is written in one stroke, holds for a beat, then the
 * screen dissolves while the app (already loaded underneath) settles into
 * place. Once per browser session: every sign-in, and every new tab or window.
 * About 2s, and it never blocks work: input passes straight through and any
 * click or key ends it early. Under reduced motion the word fades in instead
 * of being written, and nothing moves.
 */
export function BootHello() {
  const [leaving, setLeaving] = useState(false);

  // Decide before paint. Full page loads already have <html data-boot> from
  // BOOT_SCRIPT; client-side arrivals (straight after sign-in) are decided here.
  useLayoutEffect(() => {
    const root = document.documentElement;
    let seen = true;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
    } catch {
      /* storage unavailable: don't greet */
    }
    if (seen) {
      delete root.dataset.boot;
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.dataset.boot = "1";

    let removeTimer = 0;
    const leave = () => {
      window.clearTimeout(leaveTimer);
      window.removeEventListener("pointerdown", leave, { capture: true });
      window.removeEventListener("keydown", leave, { capture: true });
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {
        /* nothing to remember */
      }
      setLeaving(true);
      // The app settles in as the greeting lifts away (compositor-only).
      if (!reduced) {
        document.getElementById("main")?.animate(
          [
            { opacity: 0.4, transform: "scale(0.985)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
      removeTimer = window.setTimeout(() => delete root.dataset.boot, T.exit);
    };
    // Start writing only once the app underneath has hydrated and painted a
    // frame, so the stroke never competes with startup work.
    let leaveTimer = 0;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        root.dataset.boot = "draw";
        leaveTimer = window.setTimeout(leave, reduced ? LEAVE_AT_REDUCED : LEAVE_AT);
      });
    });
    window.addEventListener("pointerdown", leave, { once: true, capture: true });
    window.addEventListener("keydown", leave, { once: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
      window.removeEventListener("pointerdown", leave, { capture: true });
      window.removeEventListener("keydown", leave, { capture: true });
      delete root.dataset.boot;
    };
  }, []);

  return (
    <div className="qm-boot" data-phase={leaving ? "out" : "in"} aria-hidden>
      <svg viewBox="-20 -20 680 300" className="qm-boot-word">
        <defs>
          <linearGradient id="qm-hello-ink" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="590" y2="0">
            {SPECTRUM.map(([o, c]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </linearGradient>
          <linearGradient id="qm-hello-gloss" x1="0" y1="0" x2="0" y2="1">
            <stop className="qm-hello-gloss-stop" offset="0" stopOpacity="0.75" />
            <stop className="qm-hello-gloss-stop" offset="1" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path className="qm-hello-ink" d={HELLO} pathLength={1} stroke="url(#qm-hello-ink)" />
        <path className="qm-hello-gloss" d={HELLO} pathLength={1} stroke="url(#qm-hello-gloss)" />
      </svg>
    </div>
  );
}

/** Mounted on the signed-out pages: the next sign-in greets again. */
export function ResetHello() {
  useEffect(() => {
    try {
      sessionStorage.removeItem(SEEN);
    } catch {
      /* storage unavailable: the greeting just won't repeat */
    }
  }, []);
  return null;
}
