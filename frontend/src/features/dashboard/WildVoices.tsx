import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { gsap } from "../../motion/gsap";
import { useReducedMotion } from "../../motion/reducedMotion";

// Each neighbor floats at its own depth: bigger depth = closer = faster on scroll.
const critters = [
  { emoji: "🦊", left: "7%", top: "16%", depth: 1.5, size: 66 },
  { emoji: "🦔", left: "83%", top: "10%", depth: 0.6, size: 42 },
  { emoji: "🦇", left: "78%", top: "70%", depth: 1.9, size: 76 },
  { emoji: "🐝", left: "17%", top: "80%", depth: 0.45, size: 34 },
  { emoji: "🦅", left: "91%", top: "42%", depth: 1.1, size: 54 },
  { emoji: "🐦", left: "2%", top: "52%", depth: 0.8, size: 46 },
];

/** A wildlife voice in a card that tilts up into place, with neighbors drifting at different depths. */
export default function WildVoices() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".voice-critter").forEach((critter) => {
        const depth = Number(critter.dataset.depth);
        gsap.fromTo(
          critter,
          { y: depth * 220, rotate: -depth * 8 },
          { y: -depth * 220, rotate: depth * 8, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.6 } }
        );
      });
      gsap.fromTo(
        ".voice-card",
        { rotateX: 32, y: 140, z: -220, autoAlpha: 0.15 },
        { rotateX: 0, y: 0, z: 0, autoAlpha: 1, ease: "power2.out", scrollTrigger: { trigger: section, start: "top 95%", end: "center 55%", scrub: 0.8 } }
      );
      gsap.fromTo(".voice-glow", { scale: 0.6, autoAlpha: 0 }, { scale: 1.15, autoAlpha: 1, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1 } });
    }, section);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={sectionRef} className="voice" aria-label="A wildlife voice">
      <div className="voice-glow" aria-hidden="true" />
      {critters.map((critter) => (
        <span
          key={critter.emoji}
          className={`voice-critter ${critter.depth < 0.9 ? "is-far" : ""}`}
          data-depth={critter.depth}
          style={{ left: critter.left, top: critter.top, fontSize: critter.size }}
          aria-hidden="true"
        >
          {critter.emoji}
        </span>
      ))}
      <div className="voice-stage">
        <figure className="voice-card">
          <span className="voice-avatar" aria-hidden="true">🐦</span>
          <blockquote className="voice-quote">“Your doorway is next to my nursery. Could we work something out?”</blockquote>
          <figcaption className="voice-caption">Robin · your wild neighbor</figcaption>
          <Link to="/conflict/demo/assessment" className="hero-ghost voice-link">
            Meet your neighbor <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </figure>
      </div>
    </section>
  );
}
