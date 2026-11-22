import { useEffect, useRef, useState } from "react";

/** True when the visitor asked their system for less motion. */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts smoothly from the last shown value to `target`.
 * The first time it climbs from 0, later changes glide from the old number to the new one.
 * With reduced motion it simply returns `target`.
 */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      shown.current = target;
      return;
    }
    const from = shown.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // fast start, soft landing
      shown.current = from + (target - from) * eased;
      setValue(shown.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return reduced ? target : value;
}
