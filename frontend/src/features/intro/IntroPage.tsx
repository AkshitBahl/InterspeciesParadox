import { lazy, Suspense, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Bird, Compass, Footprints,
  Leaf, RotateCcw, SkipForward, Sparkles,
} from "lucide-react";
import type { Direction, } from "./introWorld";
import type { IntroPhase } from "./MiniCityGame";
import "../../styles/intro.css";

const MiniCityGame = lazy(() => import("./MiniCityGame"));

export default function IntroPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<IntroPhase>("ready");
  const [direction, setDirection] = useState<Direction>(null);
  const [autoWalk, setAutoWalk] = useState(false);
  const [runId, setRunId] = useState(0);
  const [dialogueStep, setDialogueStep] = useState(0);

  const onEncounter = useCallback(() => {
    setPhase("encounter");
    setDirection(null);
    setAutoWalk(false);
    setDialogueStep(0);
  }, []);

  const start = (automatically = false) => {
    setAutoWalk(automatically);
    setPhase("exploring");
  };

  const replay = () => {
    setRunId((id) => id + 1);
    setAutoWalk(false);
    setDirection(null);
    setDialogueStep(0);
    setPhase("ready");
  };

  const nextDialogue = () => setDialogueStep((step) => Math.min(step + 1, 2));

  return (
    <main className="kinship-intro" id="intro-main">
      <div className="intro-world-stage" aria-hidden="true">
        <Suspense fallback={<div className="intro-scene-loading">Growing your neighborhood…</div>}>
          <MiniCityGame key={runId} phase={phase} virtualDirection={direction} autoWalk={autoWalk} onEncounter={onEncounter} />
        </Suspense>
      </div>
      <div className="intro-vignette" aria-hidden="true" />
      <div className="intro-noise" aria-hidden="true" />

      <header className="intro-topbar">
        <Link to="/dashboard" className="intro-brand" aria-label="Open Kinship dashboard">
          <span className="intro-brand-mark"><Leaf size={19} strokeWidth={1.8} /></span>
          <span className="intro-brand-word">kinship<span>.</span></span>
        </Link>
        <div className="intro-topbar-center"><span className="intro-live-dot" /> A living city / Earth, 2126</div>
        <Link to="/dashboard" className="intro-skip">Skip experience <SkipForward size={16}/></Link>
      </header>

      <section className="intro-story" aria-label="Introduction">
        <div className="intro-story-kicker"><span className="intro-kicker-line" /> An interspecies experience</div>
        <h1 className="intro-title">
          The city<br />isn't <em>ours</em><br />alone<span>.</span>
        </h1>
        <p className="intro-story-copy">
          It's 2126. Our wild neighbors are back in the city.
          Getting home, it turns out, is a little more complicated now.
        </p>
        <div className="intro-story-actions">
          {phase === "ready" ? (
            <>
              <button type="button" className="intro-pill intro-pill-primary" onClick={() => start()}>
                Start exploring <span><ArrowRight size={18}/></span>
              </button>
              <button type="button" className="intro-text-button" onClick={() => start(true)}>
                Watch the encounter <ArrowUpRight size={17}/>
              </button>
            </>
          ) : phase === "exploring" ? (
            <div className="intro-progress-message"><Footprints size={17}/> Walk towards the glowing building entrance</div>
          ) : (
            <div className="intro-progress-message"><Bird size={17}/> You've met your wild neighbor</div>
          )}
        </div>
      </section>

      {phase === "exploring" && (
        <section className="intro-controls" aria-label="Movement controls">
          <div className="intro-control-copy">
            <span className="intro-panel-label">01 / A small journey</span>
            <strong>Follow the glowing path</strong>
            <span>Move using WASD or arrow keys. Explore the street, then approach the entrance.</span>
          </div>
          <div className="intro-direction-pad" aria-label="Touch movement controls">
            <button type="button" aria-label="Move up" className="intro-control-up" onPointerDown={() => setDirection("up")} onPointerUp={() => setDirection(null)} onPointerCancel={() => setDirection(null)} onPointerLeave={() => setDirection(null)}><ArrowDown style={{transform:"rotate(180deg)"}} size={20}/></button>
            <button type="button" aria-label="Move left" className="intro-control-left" onPointerDown={() => setDirection("left")} onPointerUp={() => setDirection(null)} onPointerCancel={() => setDirection(null)} onPointerLeave={() => setDirection(null)}><ArrowRight style={{transform:"rotate(180deg)"}} size={20}/></button>
            <button type="button" aria-label="Move down" className="intro-control-down" onPointerDown={() => setDirection("down")} onPointerUp={() => setDirection(null)} onPointerCancel={() => setDirection(null)} onPointerLeave={() => setDirection(null)}><ArrowDown size={20}/></button>
            <button type="button" aria-label="Move right" className="intro-control-right" onPointerDown={() => setDirection("right")} onPointerUp={() => setDirection(null)} onPointerCancel={() => setDirection(null)} onPointerLeave={() => setDirection(null)}><ArrowRight size={20}/></button>
          </div>
          <button type="button" className="intro-auto-button" onClick={() => setAutoWalk(true)}>
            <Compass size={16} /> Auto-walk
          </button>
        </section>
      )}

      {phase === "ready" && (
        <div className="intro-hint" aria-hidden="true"><Sparkles size={16}/> A tiny playable story before the real work begins</div>
      )}

      {phase === "encounter" && (
        <section className="intro-encounter" aria-labelledby="intro-encounter-title" aria-live="polite">
          <div className="intro-encounter-inner">
            <div className="intro-encounter-header">
              <span className="intro-panel-label"><span className="intro-live-dot" /> Unexpected encounter / 001</span>
              <button type="button" onClick={replay} className="intro-replay" aria-label="Replay the scene"><RotateCcw size={17}/></button>
            </div>
            <div className="intro-encounter-avatars" aria-hidden="true">
              <span className="intro-avatar-human">🧑</span>
              <span className="intro-encounter-connecting">↔</span>
              <span className="intro-avatar-bird">🐦</span>
            </div>
            {dialogueStep === 0 && (
              <>
                <p className="intro-speaker"><Bird size={16}/> Robin / Your wild neighbor</p>
                <h2 id="intro-encounter-title" className="intro-dialogue">“Chirp! Chirp! This spot is my home, too.”</h2>
                <p className="intro-dialogue-caption">A robin is nesting beside the entrance to your building.</p>
                <button type="button" className="intro-pill intro-pill-primary intro-dialogue-next" onClick={nextDialogue}>What happened? <ArrowRight size={18}/></button>
              </>
            )}
            {dialogueStep === 1 && (
              <>
                <p className="intro-speaker"><Footprints size={16}/> You / Human neighbor</p>
                <h2 id="intro-encounter-title" className="intro-dialogue">“Oh no. I need to get inside… but I can't disturb your nest.”</h2>
                <p className="intro-dialogue-caption">Both of you need this space. Neither need should be ignored.</p>
                <button type="button" className="intro-pill intro-pill-primary intro-dialogue-next" onClick={nextDialogue}>There must be a better way <ArrowRight size={18}/></button>
              </>
            )}
            {dialogueStep === 2 && (
              <>
                <p className="intro-speaker"><Leaf size={16}/> The Interspecies Paradox</p>
                <h2 id="intro-encounter-title" className="intro-dialogue">“What if neither neighbor had to lose?”</h2>
                <p className="intro-dialogue-caption">Understand each side, negotiate the trade-offs, and draft a solution.</p>
                <div className="intro-final-actions">
                  <button type="button" className="intro-pill intro-pill-primary" onClick={() => navigate("/conflict/demo/assessment")}>Let's solve this <ArrowUpRight size={18}/></button>
                  <Link to="/conflict/new" className="intro-link-secondary">Report my own conflict</Link>
                </div>
              </>
            )}
            <div className="intro-encounter-footer">
              <span>Fictional dialogue / No animal consent implied</span>
              <Link to="/dashboard">Go to the full app <ArrowUpRight size={14}/></Link>
            </div>
          </div>
        </section>
      )}

      <footer className="intro-footer">
        <span><span className="intro-footer-square" /> A shared address. A shared future.</span>
        <span>Use your keyboard or touch controls <span aria-hidden="true">·</span> <Link to="/dashboard">Enter the app</Link></span>
      </footer>
    </main>
  );
}
