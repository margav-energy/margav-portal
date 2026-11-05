"use client";

import { useEffect, useRef, useState } from "react";

const GAP_PX = 16;

/**
 * A column that stays in view while the page scrolls past it. If it's shorter than the window it pins to the
 * top; if it's taller it scrolls with the page until its bottom reaches the bottom of the window, then pins
 * there — so every card is reachable without a scrollbar of its own. `className` carries the layout and the
 * breakpoint that turns stickiness on (e.g. "xl:sticky xl:self-start"); `top` has no effect while it's static.
 */
export function StickyColumn({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(GAP_PX);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    function update() {
      if (!element) return;
      setTop(Math.min(GAP_PX, window.innerHeight - element.offsetHeight - GAP_PX));
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ top }}>
      {children}
    </div>
  );
}
