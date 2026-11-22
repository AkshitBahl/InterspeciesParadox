import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, MapPinned } from "lucide-react";
import { gsap } from "../../../motion/gsap";
import { useReducedMotion } from "../../../motion/reducedMotion";
import type { CityLabel, CityScene } from "./cityScene";

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/ixelles-ponds-2126.geojson`;

/**
 * The home page hero: a real 3D flight over the neighborhood, driven by your scroll.
 * Three short lines of text slide past at different depths while the camera glides
 * from the sky, round the solar tower, down to the fox den by the playground.
 */
export default function HeroFlight() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [labels, setLabels] = useState<CityLabel[]>([]);
  const [ready, setReady] = useState(false);
  const sceneRef = useRef<CityScene | null>(null);

  // Build the 3D city (three.js loads only now, in its own chunk).
  useEffect(() => {
    const host = canvasRef.current;
    const section = sectionRef.current;
    if (!host || !section) return;
    let cancelled = false;
    let scene: CityScene | null = null;
    let observer: IntersectionObserver | null = null;
    const onResize = () => scene?.resize();
    const onPointer = (event: PointerEvent) => {
      scene?.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    };

    (async () => {
      try {
        const [{ createCityScene }, response] = await Promise.all([import("./cityScene"), fetch(SNAPSHOT_URL)]);
        const data = await response.json();
        if (cancelled) return;
        scene = createCityScene(host, data, { still: reduced });
        sceneRef.current = scene;
        setLabels(scene.labels);
        setReady(true);
        window.addEventListener("resize", onResize);
        if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });
        observer = new IntersectionObserver(([entry]) => scene?.setRunning(entry.isIntersecting), { rootMargin: "120px" });
        observer.observe(section);
      } catch {
        // No WebGL or no data: the glowing CSS backdrop stays, and every link still works.
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      scene?.dispose();
      sceneRef.current = null;
      setReady(false);
    };
  }, [reduced]);

  // Labels float next to each animal; they show up once the camera dives in.
  useEffect(() => {
    const scene = sceneRef.current;
    const layer = labelsRef.current;
    if (!scene || !layer) return;
    const nodes = Array.from(layer.children) as HTMLElement[];
    scene.onFrame = (project, progress) => {
      const show = Math.min(1, Math.max(0, (progress - 0.22) / 0.12));
      scene.labels.forEach((label, i) => {
        const node = nodes[i];
        if (!node) return;
        const point = project(label.position);
        const alpha = show * point.strength;
        node.style.opacity = alpha.toFixed(3);
        node.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${(0.85 + alpha * 0.15).toFixed(3)})`;
      });
    };
    return () => {
      scene.onFrame = null;
    };
  }, [labels]);

  // Scroll drives the camera and the three chapters of text.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.8,
          onUpdate: (self) => sceneRef.current?.setProgress(self.progress),
        },
      });
      // Chapter one leaves in layers: the title fastest, the buttons slowest.
      timeline.to("[data-depth-speed]", {
        y: (_i: number, el: HTMLElement) => -Number(el.dataset.depthSpeed) * 160,
        autoAlpha: 0,
        stagger: 0.012,
        duration: 0.16,
        ease: "power1.in",
      }, 0.06);
      timeline.to(".hero-cue", { autoAlpha: 0, duration: 0.04 }, 0);
      timeline.fromTo(".hero-chapter-2", { autoAlpha: 0, y: 90, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.12 }, 0.3);
      timeline.to(".hero-chapter-2", { autoAlpha: 0, y: -90, scale: 1.04, duration: 0.12, ease: "power1.in" }, 0.56);
      timeline.fromTo(".hero-chapter-3", { autoAlpha: 0, y: 90, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.12 }, 0.74);
      timeline.fromTo(".hero-rail-fill", { scaleY: 0 }, { scaleY: 1, duration: 1, ease: "none" }, 0);
    }, section);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={sectionRef} className={`hero-flight ${reduced ? "is-still" : ""}`} aria-labelledby="hero-title">
      <div className="hero-sticky">
        <div className="hero-fallback" aria-hidden="true" />
        <div ref={canvasRef} className={`hero-canvas ${ready ? "is-ready" : ""}`} aria-hidden="true" />
        <div ref={labelsRef} className="hero-labels" aria-hidden="true">
          {labels.map((label) => (
            <span key={label.id} className="hero-label">
              <span className="hero-label-emoji">{label.emoji}</span>
              {label.name}
            </span>
          ))}
        </div>
        <div className="hero-shade" aria-hidden="true" />

        <div className="hero-chapter hero-chapter-1">
          <p className="hero-eyebrow" data-depth-speed="0.6">
            <span className="hero-eyebrow-dot" aria-hidden="true" /> Ixelles Ponds · 2126
          </p>
          <h1 id="hero-title" className="hero-title" data-depth-speed="1.2">
            The city is not <em>ours</em> alone.
          </h1>
          <div className="hero-actions" data-depth-speed="0.35">
            <Link to="/conflict/new" className="hero-cta">
              Start a mediation <span aria-hidden="true"><ArrowUpRight size={17} /></span>
            </Link>
            <Link to="/map" className="hero-ghost">
              <MapPinned size={17} aria-hidden="true" /> Open the map
            </Link>
          </div>
        </div>

        {!reduced && (
          <>
            <div className="hero-chapter hero-chapter-2" aria-hidden="true">
              <p className="hero-line">Six wild neighbors.</p>
              <p className="hero-sub">One street.</p>
            </div>
            <div className="hero-chapter hero-chapter-3">
              <p className="hero-line">When needs collide,</p>
              <p className="hero-line hero-line-accent">we mediate.</p>
              <a href="#how-it-works" className="hero-ghost hero-ghost-small">
                See how <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="hero-rail" aria-hidden="true">
              <span className="hero-rail-fill" />
            </div>
            <p className="hero-cue" aria-hidden="true">
              <span className="hero-cue-line" /> Scroll
            </p>
          </>
        )}
      </div>
    </section>
  );
}
