"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A Link that fully prefetches its page as soon as the user shows intent
 * (pointer enters, keyboard focus, touch start). In the viewport it keeps
 * Next's default (layout + loading shell), so a sidebar of ten links doesn't
 * render ten pages on every load, yet the page you're about to open is
 * usually ready before the click lands.
 */
export function IntentLink({ onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? true : null}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
    />
  );
}
