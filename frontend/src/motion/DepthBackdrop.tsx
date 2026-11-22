import { useEffect, useRef } from "react";
import { gsap } from "./gsap";
import { useReducedMotion } from "./reducedMotion";

/*
  The 3D space behind every app page.

  Each layer has a "depth". When you scroll, a layer moves by scroll × depth, so far layers
  (small depth) drift slowly and near layers (big depth) rush past. That difference in speed is
  what the eye reads as distance: classic parallax. The pointer adds a small tilt the same way.
  Layers marked with a tile size loop forever, so the effect never runs out on long pages.
*/

interface Layer {
  el: HTMLElement;
  depth: number;
  tile: number;
  offset: number;
  floor: boolean;
}

function Leaf({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 320" aria-hidden="true">
      <path d="M100 6C38 70 14 150 36 228c14 50 40 76 64 86 24-10 50-36 64-86C186 150 162 70 100 6Z" fill="currentColor" stroke="rgba(61,255,176,.4)" strokeWidth="2" />
      <path d="M100 30v280M100 110l-38-34M100 150l44-38M100 196l-50-40M100 236l52-42" stroke="rgba(61,255,176,.3)" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function DepthBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    const layers: Layer[] = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]")).map((el) => ({
      el,
      depth: Number(el.dataset.depth ?? 0),
      tile: Number(el.dataset.tile ?? 0),
      offset: Number(el.dataset.offset ?? 0),
      floor: el.dataset.floor === "true",
    }));

    // Pointer position from -1 to 1, eased so the tilt glides instead of snapping.
    let targetX = 0;
    let targetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    const onPointer = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let lastScroll = Number.NaN;
    let lastX = Number.NaN;
    let lastY = Number.NaN;

    const render = () => {
      pointerX += (targetX - pointerX) * 0.05;
      pointerY += (targetY - pointerY) * 0.05;
      const scroll = window.scrollY;
      if (scroll === lastScroll && Math.abs(pointerX - lastX) < 1e-4 && Math.abs(pointerY - lastY) < 1e-4) return;
      lastScroll = scroll;
      lastX = pointerX;
      lastY = pointerY;

      for (const layer of layers) {
        let shift = -scroll * layer.depth - layer.offset;
        if (layer.tile) shift %= layer.tile;
        const sway = layer.depth * 60;
        if (layer.floor) {
          // The floor slides towards you, so scrolling feels like moving forward through the city.
          layer.el.style.transform = `rotateX(76deg) translate3d(${(-pointerX * sway).toFixed(2)}px, ${(-shift).toFixed(2)}px, 0)`;
        } else {
          layer.el.style.transform = `translate3d(${(-pointerX * sway).toFixed(2)}px, ${(shift - pointerY * sway).toFixed(2)}px, 0)`;
        }
      }
    };

    gsap.ticker.add(render);
    render();
    return () => {
      gsap.ticker.remove(render);
      window.removeEventListener("pointermove", onPointer);
      for (const layer of layers) layer.el.style.transform = "";
    };
  }, [reduced]);

  return (
    <div ref={rootRef} className="depth-backdrop" aria-hidden="true">
      <div className="depth-sky" />
      <div className="depth-orb depth-orb-far" data-depth="0.03" />
      <div className="depth-orb depth-orb-mid" data-depth="0.08" />
      <div className="depth-orb depth-orb-near" data-depth="0.14" />
      <div className="depth-floor">
        <div className="depth-floor-plane" data-depth="0.6" data-tile="64" data-floor="true" />
      </div>
      <div className="depth-dust depth-dust-far" data-depth="0.06" data-tile="220" />
      <div className="depth-dust depth-dust-mid" data-depth="0.16" data-tile="300" />
      <div className="depth-dust depth-dust-near" data-depth="0.32" data-tile="420" />
      <div className="depth-leaf depth-leaf-left" data-depth="0.5" data-tile="2600" data-offset="180">
        <Leaf className="depth-leaf-shape" />
      </div>
      <div className="depth-leaf depth-leaf-right" data-depth="0.85" data-tile="3400" data-offset="1500">
        <Leaf className="depth-leaf-shape" />
      </div>
      <div className="depth-vignette" />
    </div>
  );
}
