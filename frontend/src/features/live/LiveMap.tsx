import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Maximize2 } from "lucide-react";

import LoadingState from "../../components/ui/LoadingState";
import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";
import NeighborhoodMap from "../map/NeighborhoodMap";
import Swatch from "../map/Swatch";
import type { MapFeature } from "../map/mapData";
import { CATEGORIES, FOCUS_VIEWS, typeLabel, type CategoryKey } from "../map/mapStyle";
import { playAnimalSound } from "../sounds/animalSounds";

interface Props {
  solutionId: string;
  solutionTitle: string;
  center: [number, number];
}

const KEY: CategoryKey[] = ["people", "animals", "homes", "people_routes", "nature", "quiet_zones", "conflicts", "fixes"];
const VISIBLE = new Set<CategoryKey>(FOCUS_VIEWS[0].categories);

/** The neighborhood map for one plan, in the mediation studio. The full-page map is one click away. */
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-forest">See the plan on the map</h2>
          <p className="mt-2 text-sm text-ink/60">
            <strong>{solutionTitle}</strong>. {added ? `The ${added} purple item${added === 1 ? " is" : "s are"} what this plan adds.` : ""} Tap an animal to hear it.
          </p>
        </div>
        <Link
          to={`/map?solution=${encodeURIComponent(solutionId)}`}
          className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-semibold text-cream"
        >
          <Maximize2 size={14} aria-hidden="true" /> Full-screen map
        </Link>
      </div>
      <div className="mt-5 h-[420px] overflow-hidden rounded-2xl border border-forest/10">
        {scenario.loading && !scenario.data ? (
          <LoadingState label="Drawing the neighborhood…" />
        ) : scenario.error ? (
          <p role="alert" className="p-5 text-sm text-red-700">{scenario.error}</p>
        ) : (
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
        )}
      </div>
      <p className="mt-3 min-h-5 text-sm text-ink/80" aria-live="polite">
        {selected ? (
          <>
            <strong>{selected.properties.name}</strong> · {typeLabel(selected.properties)}
          </>
        ) : (
          "Click anything on the map to see what it is."
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink/70">
        {KEY.map((key) => (
          <span key={key} className="inline-flex items-center gap-2">
            <Swatch category={CATEGORIES[key]} />
            {CATEGORIES[key].label}
          </span>
        ))}
      </div>
    </section>
  );
}
