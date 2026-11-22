import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleHelp, Leaf, Volume2, VolumeX } from "lucide-react";

import { useLiveData } from "../../hooks/useLiveData";
import { USE_MOCKS } from "../../services/conflictGateway";
import { playAnimalSound, stopAnimalSound } from "../sounds/animalSounds";
import FeatureDetails from "./FeatureDetails";
import MapGuide from "./MapGuide";
import MapLegend from "./MapLegend";
import NeighborhoodMap, { type DetailsInset, type FocusRequest, type MapPadding } from "./NeighborhoodMap";
import { loadNeighborhood, tidy, type MapFeature } from "./mapData";
import { FOCUS_VIEWS, categoryOf, type CategoryKey } from "./mapStyle";

const GUIDE_KEY = "kinship-map-guide-seen";
const SOUND_KEY = "kinship-map-sound";
const REAL_MAP_KEY = "kinship-map-real-streets";

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Storage can be blocked (private mode); the setting then lasts for this visit only.
  }
}

const isWide = () => typeof window !== "undefined" && window.innerWidth >= 1024;

/** The full-page neighborhood map: the main way to see who lives where. */
export default function MapPage() {
  const [params] = useSearchParams();
  const solutionId = params.get("solution");
  const data = useLiveData(`map:${solutionId ?? "today"}`, () => loadNeighborhood(!USE_MOCKS, solutionId));

  const [viewKey, setViewKey] = useState("overview");
  const [visible, setVisible] = useState<Set<CategoryKey>>(() => new Set(FOCUS_VIEWS[0].categories));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [soundOn, setSoundOn] = useState(() => readFlag(SOUND_KEY, true));
  const [showRealMap, setShowRealMap] = useState(() => readFlag(REAL_MAP_KEY, false));
  const [guideOpen, setGuideOpen] = useState(() => !readFlag(GUIDE_KEY, false));
  const [legendOpen, setLegendOpen] = useState(isWide);
  const [heardOne, setHeardOne] = useState(false);
  const [scenario, setScenario] = useState<"today" | "plan">("plan");
  // Each quick view starts from the whole district again.
  const [viewRound, setViewRound] = useState(0);
  const playTimer = useRef<number | undefined>(undefined);

  const padding = useMemo<MapPadding>(() => (isWide() ? { topLeft: [350, 70], bottomRight: [40, 40] } : { topLeft: [16, 70], bottomRight: [16, 60] }), []);
  // The details card covers the right side on wide screens and the bottom half on phones.
  const detailsInset = useMemo<DetailsInset>(() => (isWide() ? { right: 370, bottom: 0 } : { right: 0, bottom: Math.round(window.innerHeight * 0.5) }), []);

  const planFeatures = data.data?.plan ?? null;
  const showingPlan = scenario === "plan" && planFeatures !== null;
  const features = useMemo(() => (showingPlan ? planFeatures : data.data?.today) ?? [], [showingPlan, planFeatures, data.data?.today]);
  const selected = features.find((f) => f.id === selectedId) ?? null;

  const relatedIds = useMemo(() => {
    const slug = selected?.properties.species_slug;
    if (!selected || !slug) return null;
    return new Set(features.filter((f) => f.properties.species_slug === slug).map((f) => f.id));
  }, [selected, features]);

  const counts = useMemo(() => {
    const out: Partial<Record<CategoryKey, number>> = {};
    for (const f of features) {
      const c = categoryOf(f.properties);
      if (c && !(c === "city" && f.properties.layer !== "building")) out[c] = (out[c] ?? 0) + 1;
    }
    return out;
  }, [features]);

  const play = useCallback((feature: MapFeature) => {
    const ms = playAnimalSound(feature.properties.species_slug);
    window.clearTimeout(playTimer.current);
    setHeardOne(true);
    if (ms > 0) {
      setPlayingId(feature.id);
      playTimer.current = window.setTimeout(() => setPlayingId(null), ms);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(playTimer.current), []);

  const onSelect = useCallback(
    (feature: MapFeature | null) => {
      setSelectedId(feature?.id ?? null);
      if (feature?.properties.layer === "wildlife" && soundOn) play(feature);
    },
    [play, soundOn]
  );

  const show = useCallback((feature: MapFeature) => {
    const c = categoryOf(feature.properties);
    if (c) setVisible((v) => (v.has(c) ? v : new Set([...v, c])));
    setSelectedId(feature.id);
    setFocus({ id: feature.id, nonce: Date.now() });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !guideOpen && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guideOpen]);

  const chooseView = (key: string) => {
    const view = FOCUS_VIEWS.find((v) => v.key === key);
    if (!view) return;
    setViewKey(key);
    setVisible(new Set(view.categories));
    setSelectedId(null);
    setViewRound((n) => n + 1);
  };

  const toggle = (key: CategoryKey) => {
    setViewKey("custom");
    setVisible((v) => {
      const next = new Set(v);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    writeFlag(GUIDE_KEY, true);
  }, []);

  return (
    <div className="kin-map-page">
      <header className="kin-map-topbar">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to="/dashboard" className="kin-icon-button" aria-label="Back to the dashboard" title="Back">
            <ArrowLeft size={17} />
          </Link>
          <span className="kin-map-brand-mark" aria-hidden="true"><Leaf size={16} strokeWidth={1.8} /></span>
          <h1 className="kin-map-title">
            <span className="sr-only">Neighborhood map, </span>Ixelles Ponds <span>2126</span>
          </h1>
        </div>

        <nav className="kin-views" aria-label="What to show">
          {FOCUS_VIEWS.map((view) => (
            <button key={view.key} type="button" onClick={() => chooseView(view.key)} aria-pressed={viewKey === view.key} className="kin-view-chip">
              {view.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              writeFlag(SOUND_KEY, next);
              setSoundOn(next);
              if (!next) {
                stopAnimalSound();
                setPlayingId(null);
              }
            }}
            className="kin-icon-button"
            aria-pressed={soundOn}
            aria-label="Animal sounds"
            title={soundOn ? "Sound on" : "Sound off"}
          >
            {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button type="button" onClick={() => setGuideOpen(true)} className="kin-icon-button" aria-label="Help" title="Help">
            <CircleHelp size={17} />
          </button>
        </div>
      </header>

      <div className="kin-map-stage">
        {data.data && (
          <NeighborhoodMap
            features={features}
            visible={visible}
            selectedId={selectedId}
            relatedIds={relatedIds}
            playingId={playingId}
            showRealMap={showRealMap}
            onSelect={onSelect}
            focus={focus}
            padding={padding}
            detailsInset={selected ? detailsInset : undefined}
            fitKey={`${showingPlan ? "plan" : "today"}:${viewRound}`}
          />
        )}

        {data.loading && !data.data && <div className="kin-map-status">Loading map</div>}
        {data.error && (
          <div className="kin-map-status" role="alert">
            Map unavailable.{" "}
            <button type="button" className="underline" onClick={data.reload}>Retry</button>
          </div>
        )}

        {data.data && (
          <MapLegend
            visible={visible}
            counts={counts}
            onToggle={toggle}
            showRealMap={showRealMap}
            onToggleRealMap={() => {
              writeFlag(REAL_MAP_KEY, !showRealMap);
              setShowRealMap(!showRealMap);
            }}
            open={legendOpen}
            onOpenChange={setLegendOpen}
            planMode={showingPlan}
          />
        )}

        {planFeatures && (
          <div className="kin-scenario" role="group" aria-label="Compare now with the plan">
            <button type="button" aria-pressed={!showingPlan} onClick={() => setScenario("today")}>Now</button>
            <button type="button" aria-pressed={showingPlan} onClick={() => setScenario("plan")} title={tidy(data.data?.planTitle)}>
              With plan
            </button>
          </div>
        )}

        {selected && (
          <FeatureDetails
            feature={selected}
            features={features}
            playing={playingId === selected.id}
            liveMode={!USE_MOCKS && data.data?.source === "live"}
            onClose={() => setSelectedId(null)}
            onShow={show}
            onPlay={play}
          />
        )}

        <div className="kin-map-footnote">
          {!heardOne && data.data && !selected && (
            <span className="kin-hint">
              <Volume2 size={14} aria-hidden="true" /> Tap an animal
            </span>
          )}
          {data.data?.source === "offline" && <span className="kin-source">Offline</span>}
        </div>

        {guideOpen && <MapGuide onClose={closeGuide} />}
      </div>
    </div>
  );
}
