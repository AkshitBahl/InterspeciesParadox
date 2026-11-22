import { prefersReducedMotion } from "../../hooks/useCountUp";

const COLORS = ["#4f886d", "#2f6b52", "#7fae6a", "#96bb81", "#3e7a5c"];
const LEAF_SVG = (color: string) =>
  `<svg viewBox="0 0 20 20" width="100%" height="100%" aria-hidden="true"><path d="M10 1c5 3.4 6.4 9.2 0 18-6.4-8.8-5-14.6 0-18z" fill="${color}"/><path d="M10 4v13" stroke="#fff" stroke-opacity=".5" stroke-width="1" stroke-linecap="round"/></svg>`;

/**
 * A quick burst of leaves from the middle of `anchor` (or from a point you pass).
 * It draws on top of the page for under a second and cleans up after itself.
 * Nothing happens when the visitor prefers reduced motion.
 */
export function leafBurst(anchor: Element | DOMRect | null, count = 16) {
  if (!anchor || prefersReducedMotion() || typeof document === "undefined") return;
  const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "leaf-burst";
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  document.body.appendChild(layer);

  let longest = 0;
  for (let i = 0; i < count; i++) {
    const leaf = document.createElement("span");
    leaf.className = "leaf-burst-leaf";
    const size = 12 + Math.random() * 9;
    leaf.style.width = `${size}px`;
    leaf.style.height = `${size}px`;
    leaf.innerHTML = LEAF_SVG(COLORS[i % COLORS.length]);
    layer.appendChild(leaf);

    // Spread the leaves evenly around the circle, with a little wobble so it looks natural.
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 55 + Math.random() * 55;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const spin = (Math.random() > 0.5 ? 1 : -1) * (160 + Math.random() * 200);
    const duration = 650 + Math.random() * 300;
    longest = Math.max(longest, duration);

    leaf.animate(
      [
        { transform: "translate(-50%, -50%) scale(.3) rotate(0deg)", opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.6 },
        // The last stretch drifts down a little, like leaves settling.
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 18}px)) scale(1) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration, easing: "cubic-bezier(.15,.7,.3,1)", fill: "forwards" },
    );
  }

  window.setTimeout(() => layer.remove(), longest + 80);
}
