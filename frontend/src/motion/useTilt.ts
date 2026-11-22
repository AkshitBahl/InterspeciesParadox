import { useEffect, useRef } from "react";
import { useReducedMotion } from "./reducedMotion";

/*
  A card that leans towards your pointer, like a real object on a table.

  The pointer position over the card (from -1 to 1 on each axis) becomes a small rotation.
  Each frame the card moves only part of the way towards that target, so the motion glides.
  The values land in CSS variables (--tilt-x, --tilt-y, --glare-x, --glare-y) and the CSS does
  the rest. Only for a mouse or trackpad, and never with reduced motion.
*/
export function useTilt<T extends HTMLElement>(maxDegrees = 7) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const step = () => {
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      el.style.setProperty("--tilt-x", `${(-y * maxDegrees).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * maxDegrees).toFixed(2)}deg`);
      el.style.setProperty("--glare-x", `${((x + 1) * 50).toFixed(1)}%`);
      el.style.setProperty("--glare-y", `${((y + 1) * 50).toFixed(1)}%`);
      const settled = Math.abs(targetX - x) < 0.002 && Math.abs(targetY - y) < 0.002;
      frame = settled ? 0 : requestAnimationFrame(step);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      targetX = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
      targetY = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
      wake();
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      wake();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      for (const name of ["--tilt-x", "--tilt-y", "--glare-x", "--glare-y"]) el.style.removeProperty(name);
    };
  }, [reduced, maxDegrees]);

  return ref;
}
