import { useNavigate, Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Compass,
  Feather,
  HeartHandshake,
  Leaf,
  MoveUpRight,
  ShieldCheck,
} from "lucide-react";
import LivingCityScene from "./LivingCityScene";
import RecentCases from "./RecentCases";
import LiveRecentCases from "../live/LiveRecentCases";
import { USE_MOCKS } from "../../services/conflictGateway";

const journey = [
  {
    number: "01",
    eyebrow: "Observe",
    title: "Tell your side.",
    text: "A nest by your doorway. A fox along your commute. Describe what's happening in your shared space.",
    icon: Compass,
  },
  {
    number: "02",
    eyebrow: "Understand",
    title: "Meet the other side.",
    text: "Meet a playful wildlife representative and explore the needs that make this space important to both of you.",
    icon: Feather,
  },
  {
    number: "03",
    eyebrow: "Resolve",
    title: "Find common ground.",
    text: "Compare compromises, explore alternative routes, and turn a considered plan into a coexistence draft.",
    icon: HeartHandshake,
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="kinship-dashboard space-y-11 lg:space-y-14">
      <section className="kinship-hero relative isolate min-h-[660px] overflow-hidden rounded-[28px] sm:rounded-[36px] lg:min-h-[700px]" aria-labelledby="kinship-hero-title">
        <LivingCityScene />
        <div className="kinship-hero-vignette absolute inset-0" aria-hidden="true" />
        <div className="kinship-hero-content relative z-10 flex min-h-[660px] flex-col justify-between px-6 py-7 sm:px-11 sm:py-10 lg:min-h-[700px] lg:px-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="kinship-hero-chip inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
              <span className="kinship-spark" aria-hidden="true" /> A living experiment in coexistence
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-[#D8EBCA]/70 sm:inline">EARTH / 2126</span>
          </div>

          <div className="kinship-hero-copy max-w-[720px] py-16 lg:py-12">
            <p className="kinship-eyebrow mb-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C9E2B4]">
              A new kind of neighborhood
            </p>
            <h1 id="kinship-hero-title" className="kinship-display-title text-[#F6F7E7]">
              The city<br />is not <em>ours</em><br /><span className="kinship-title-underline">alone.</span>
            </h1>
            <p className="mt-7 max-w-[430px] text-[15px] leading-[1.8] text-[#DBE5D7]/85 sm:text-[16px]">
              We brought wildlife back into our cities. Now comes the interesting part: learning how to live together.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => navigate("/conflict/new")} className="kinship-hero-cta group inline-flex min-h-14 items-center gap-4 rounded-full px-6 text-sm font-semibold">
                Start a mediation
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#163E36] text-[#E6F3D0] transition-transform group-hover:translate-x-1"><ArrowUpRight size={17} /></span>
              </button>
              <Link to="/map" className="kinship-hero-secondary inline-flex min-h-12 items-center gap-2 px-2 text-sm font-medium">
                Open the neighborhood map <ArrowUpRight size={18} />
              </Link>
              <a className="kinship-hero-secondary inline-flex min-h-12 items-center gap-2 px-2 text-sm font-medium" href="#how-it-works">
                Explore the idea <ArrowDownRight size={18} />
              </a>
            </div>
          </div>

          <div className="kinship-hero-bottom flex flex-wrap items-end justify-between gap-4 border-t border-white/20 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2" aria-hidden="true">
                <span className="kinship-hero-avatar">🐦</span><span className="kinship-hero-avatar">🦊</span><span className="kinship-hero-avatar">🦔</span>
              </div>
              <p className="max-w-[150px] text-[10px] leading-4 tracking-[0.02em] text-[#E6F2DF]/80">More than one kind of neighbor lives here.</p>
            </div>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#DDEED8]/70">Scroll to discover ↓</span>
          </div>
        </div>
      </section>

      <section className="kinship-manifesto grid items-start gap-8 py-4 lg:grid-cols-[0.78fr_1.22fr] lg:gap-10" aria-label="Our mission">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#507B6B]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5B9777]" /> A shared address / A shared future
        </div>
        <div>
          <h2 className="kinship-editorial-heading max-w-[850px] text-[#173F35]">A better city isn't one without conflict. <em>It's one that knows how to listen.</em></h2>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-5 border-t border-[#9AAFA5]/35 pt-5">
            <p className="max-w-[540px] text-sm leading-relaxed text-[#5B7065]">Human needs are real. Wildlife needs are real. Kinship helps us understand both, then explore possible arrangements without treating either as disposable.</p>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#A3B9AA] text-[#376351]"><MoveUpRight size={21}/></span>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="kinship-journey-section scroll-mt-20" aria-labelledby="kinship-journey-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kinship-section-kicker mb-2 text-[10px] font-bold uppercase tracking-[0.23em]">The coexistence process / 01—03</p>
            <h2 id="kinship-journey-title" className="kinship-editorial-heading text-[#173F35]">From friction to <em>understanding.</em></h2>
          </div>
          <Link to="/conflict/demo/assessment" className="kinship-text-link inline-flex items-center gap-2 text-[12px] font-semibold">Explore the demo <ArrowUpRight size={17}/></Link>
        </div>
        <div className="kinship-journey-grid grid gap-4 lg:grid-cols-3">
          {journey.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.number} className={`kinship-journey-card kinship-journey-card-${index + 1} group relative flex min-h-[310px] flex-col overflow-hidden rounded-[27px] p-7 sm:p-8`}>
                <div className="mb-10 flex items-start justify-between">
                  <span className="kinship-card-number text-[48px] leading-none tracking-[-0.09em]">{item.number}</span>
                  <span className="kinship-card-icon flex h-12 w-12 items-center justify-center rounded-full"><Icon size={22} strokeWidth={1.5} /></span>
                </div>
                <div className="mt-auto">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] opacity-60">{item.eyebrow}</p>
                  <h3 className="font-serif text-[31px] leading-tight tracking-[-0.04em]">{item.title}</h3>
                  <p className="mt-3 max-w-[330px] text-[13px] leading-[1.65] opacity-75">{item.text}</p>
                </div>
                <ArrowRight className="kinship-journey-arrow absolute bottom-7 right-7 opacity-35 transition-transform duration-300 group-hover:translate-x-1" size={19} aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </section>

      <section className="kinship-neighbor-note relative overflow-hidden rounded-[27px] px-7 py-8 sm:px-10 sm:py-10" aria-label="Wildlife voices">
        <div className="kinship-note-glow" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#C3D8B2]/30 bg-white/10 text-[38px]" aria-hidden="true">🐦</span>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B9DEAE]">The other side of the story</p>
              <p className="max-w-[650px] font-serif text-[22px] leading-[1.3] tracking-[-0.02em] text-[#F5F6E9] sm:text-[27px]">“Your doorway is next to my nursery. Could we work something out?”</p>
              <p className="mt-3 text-xs text-[#C8DCC9]/75">Fictional dialogue translating an illustrative nesting need.</p>
            </div>
          </div>
          <Link to="/conflict/demo/assessment" className="kinship-note-link inline-flex shrink-0 items-center gap-2 self-start rounded-full px-5 py-3 text-xs font-semibold md:self-center">Meet Robin <ArrowUpRight size={16}/></Link>
        </div>
      </section>

      <section className="kinship-recent-section">
        <div className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.19em] text-[#668774]"><ShieldCheck size={15}/> Private prototype workspace</div>
        {USE_MOCKS ? <RecentCases /> : <LiveRecentCases />}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#AFC4B8]/50 pt-5 text-[10px] uppercase tracking-[0.18em] text-[#6B8A79]">
        <span>Reimagining how we live together</span>
        <span className="inline-flex items-center gap-2"><Leaf size={13}/> Designed for all our neighbors</span>
      </div>
    </div>
  );
}
