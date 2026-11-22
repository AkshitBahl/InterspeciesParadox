import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap, ScrollTrigger } from "./gsap";

/*
  Smooth scrolling for the app pages.

  Lenis keeps a "target" scroll position and eases the real page scroll towards it a little
  every frame (linear interpolation, the `lerp` below). The page still scrolls natively, so
  sticky elements, anchors, forms and screen readers keep working. GSAP's ticker drives Lenis,
  so every scroll animation reads the same, already smoothed position in the same frame.
*/

let current: Lenis | null = null;

export function getLenis(): Lenis | null {
  return current;
}

export function startSmoothScroll(): () => void {
  const lenis = new Lenis({
    lerp: 0.085, // smaller = silkier glide, larger = snappier
    smoothWheel: true,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.3,
    anchors: { offset: -16 },
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
    autoRaf: false,
  });
  current = lenis;

  const onScroll = () => ScrollTrigger.update();
  lenis.on("scroll", onScroll);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
    if (current === lenis) current = null;
  };
}

/** Jump to the top without easing (used when you open another page). */
export function jumpToTop() {
  if (current) current.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}
