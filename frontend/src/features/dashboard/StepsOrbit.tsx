import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FilePlus2, HeartHandshake, Scale, ScrollText } from "lucide-react";
import { gsap } from "../../motion/gsap";
import { useReducedMotion } from "../../motion/reducedMotion";

const steps = [
  { number: "01", title: "Report", line: "Tell us what happened.", to: "/conflict/new", icon: FilePlus2 },
  { number: "02", title: "Assess", line: "See what both sides need.", to: "/conflict/demo/assessment", icon: Scale },
  { number: "03", title: "Mediate", line: "Compare fair compromises.", to: "/conflict/demo/mediation", icon: HeartHandshake },
  { number: "04", title: "Agree", line: "Sign a living agreement.", to: "/conflict/demo/agreement", icon: ScrollText },
];

const SPACING = 38; // degrees between cards on the ring

/**
 * The four steps on a 3D ring. While this section is pinned, scrolling turns the ring,
 * so each card swings to the front in turn. Cards further round fade and sink back.
 */
export default function StepsOrbit() {
  const sectionRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    const ring = ringRef.current;
    if (!section || !ring || reduced) return;
    const cards = Array.from(ring.querySelectorAll<HTMLElement>(".orbit-card"));
    const dots = Array.from(section.querySelectorAll<HTMLElement>(".orbit-dot"));
    const state = { angle: 0 };

    const paint = () => {
      ring.style.transform = `translateZ(calc(var(--orbit-radius) * -1)) rotateY(${(-state.angle).toFixed(3)}deg)`;
      cards.forEach((card, i) => {
        const offset = Math.abs(i * SPACING - state.angle);
        const focus = Math.max(0, 1 - offset / (SPACING * 1.6));
        card.style.opacity = (0.18 + focus * 0.82).toFixed(3);
        card.style.setProperty("--focus", focus.toFixed(3));
        card.classList.toggle("is-front", offset < SPACING / 2);
        dots[i]?.classList.toggle("is-on", offset < SPACING / 2);
      });
    };

    const ctx = gsap.context(() => {
      gsap.fromTo(".orbit-heading > *", { y: 60, autoAlpha: 0, rotateX: -25 }, {
        y: 0,
        autoAlpha: 1,
        rotateX: 0,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 80%", end: "top 20%", scrub: 0.8 },
      });
      // Turn the ring over most of the section, then hold the last card for a moment.
      gsap
        .timeline({ scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.9 } })
        .to(state, { angle: SPACING * (steps.length - 1), ease: "none", duration: 0.86, onUpdate: paint })
        .to({}, { duration: 0.14 });
    }, section);
    paint();
    return () => {
      ctx.revert();
      ring.style.transform = "";
      cards.forEach((card) => {
        card.style.opacity = "";
        card.style.removeProperty("--focus");
        card.classList.remove("is-front");
      });
    };
  }, [reduced]);

  return (
    <section ref={sectionRef} id="how-it-works" className={`orbit ${reduced ? "is-still" : ""}`} aria-labelledby="orbit-title">
      <div className="orbit-sticky">
        <div className="orbit-heading">
          <p className="orbit-kicker">How it works</p>
          <h2 id="orbit-title" className="orbit-title">From friction to <em>agreement.</em></h2>
        </div>

        <div className="orbit-stage">
          <div ref={ringRef} className="orbit-ring">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.number}
                  to={step.to}
                  className="orbit-card"
                  style={{ "--i": i, "--angle": `${i * SPACING}deg` } as CSSProperties}
                >
                  <span className="orbit-card-number" aria-hidden="true">{step.number}</span>
                  <span className="orbit-card-icon" aria-hidden="true"><Icon size={26} strokeWidth={1.6} /></span>
                  <span className="orbit-card-title">{step.title}</span>
                  <span className="orbit-card-line">{step.line}</span>
                  <span className="orbit-card-go" aria-hidden="true"><ArrowUpRight size={18} /></span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="orbit-dots" aria-hidden="true">
          {steps.map((step) => <span key={step.number} className="orbit-dot" />)}
        </div>
      </div>
    </section>
  );
}
