import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Maximize2 } from "lucide-react";

import LoadingState from "../../components/ui/LoadingState";
import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";
import Swatch from "../map/Swatch";
import { tidy, type MapFeature } from "../map/mapData";
import { CATEGORIES, FOCUS_VIEWS, typeLabel, type CategoryKey } from "../map/mapStyle";
import { playAnimalSound } from "../sounds/animalSounds";
import "../map/map.css";

// MapLibre is large, so it only loads when a plan is on screen.
const NeighborhoodMap = lazy(() => import("../map/NeighborhoodMap"));

interface Props {
  solutionId: string;
  solutionTitle: string;
  center: [number, number];
}

const KEY: CategoryKey[] = ["people", "animals", "homes", "people_routes", "nature", "quiet_zones", "conflicts", "fixes"];
const VISIBLE = new Set<CategoryKey>(FOCUS_VIEWS[0].categories);

/** The neighborhood map for one plan, in the mediation studio. The full page map is one click away. */
export default function LiveMap({ solutionId, solutionTitle, center }: Props) {
  const scenario = useLiveData(`scenario:${solutionId}`, () => liveApi.scenario(solutionId));
  const features = useMemo(
    () => (scenario.data?.features ?? []).map((f, i) => ({ ...f, id: String(f.properties.id ?? i) }) as MapFeature),
    [scenario.data]
  );
  const [selected, setSelected] = useState<MapFeature | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const onSelect = useCallback((feature: MapFeature | null) => {
    setSelected(feature);
    if (feature?.properties.layer === "wildlife") {
      const ms = playAnimalSound(feature.properties.species_slug);
      setPlayingId(feature.id);
      window.setTimeout(() => setPlayingId((id) => (id === feature.id ? null : id)), ms);
    }
  }, []);

  const added = features.filter((f) => f.properties.scenario_role === "proposed").length;

  return (
    <section className="rounded-3xl border border-forest/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-forest">Plan on the map</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/60">
            <span className="truncate">{tidy(solutionTitle)}</span>
            {added > 0 && <span className="rounded-full bg-[#b388ff]/20 px-2 py-0.5 text-xs font-semibold text-[#5b2fb8]">{added} new</span>}
          </p>
        </div>
        <Link
          to={`/map?solution=${encodeURIComponent(solutionId)}`}
          className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-semibold text-cream"
        >
          <Maximize2 size={14} aria-hidden="true" /> Open map
        </Link>
      </div>
      <div className="kin-theme kin-embed mt-5">
        <div className="relative h-[420px]">
          {scenario.loading && !scenario.data ? (
            <LoadingState label="Loading map" />
          ) : scenario.error ? (
            <p role="alert" className="p-5 text-sm text-red-300">{scenario.error}</p>
          ) : (
            <Suspense fallback={<LoadingState label="Loading map" />}>
              <NeighborhoodMap
                features={features}
                visible={VISIBLE}
                selectedId={selected?.id ?? null}
                relatedIds={null}
                playingId={playingId}
                showRealMap={false}
                onSelect={onSelect}
                fitKey={solutionId}
                initialCenter={center}
                scrollWheelZoom={false}
              />
            </Suspense>
          )}
        </div>
        <div className="kin-embed-bar">
          <p className="kin-embed-picked" aria-live="polite">
            {selected ? (
              <>
                <strong>{tidy(selected.properties.name)}</strong> · {typeLabel(selected.properties)}
              </>
            ) : (
              "Tap an animal"
            )}
          </p>
          {KEY.map((key) => (
            <span key={key}>
              <Swatch category={CATEGORIES[key]} />
              {CATEGORIES[key].label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
