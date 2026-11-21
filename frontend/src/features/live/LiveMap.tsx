import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";

import LoadingState from "../../components/ui/LoadingState";
import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";

interface Props {
  solutionId: string;
  solutionTitle: string;
  center: [number, number];
}

type Props_ = Record<string, unknown>;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function styleFor(properties: Props_): PathOptions {
  const proposed = properties.scenario_role === "proposed";
  const layer = String(properties.layer ?? "");
  return {
    color: String(properties.stroke ?? "#256D59"),
    fillColor: String(properties.fill ?? properties.stroke ?? "#81c784"),
    weight: proposed ? 4 : layer === "wildlife_corridor" ? 3 : 2,
    opacity: proposed ? 1 : 0.75,
    fillOpacity: proposed ? 0.45 : layer === "building" ? 0.35 : 0.2,
    dashArray: layer === "wildlife_corridor" ? "6 6" : undefined,
  };
}

const legend = [
  { color: "#ff8f00", label: "Proposed changes and wildlife buffers" },
  { color: "#2e7d32", label: "Habitat and wildlife corridors (dashed)" },
  { color: "#1e88e5", label: "Daily human journeys" },
  { color: "#fb8c00", label: "Delivery routes" },
  { color: "#9e9e9e", label: "Buildings and streets" },
];

/** The neighborhood map for one plan, drawn from the backend's GeoJSON scenario. */
export default function LiveMap({ solutionId, solutionTitle, center }: Props) {
  const scenario = useLiveData(`scenario:${solutionId}`, () => liveApi.scenario(solutionId));
  const features = scenario.data?.features ?? [];
  const areas = features.filter((f) => f.geometry.type !== "Point");
  const points = features.filter((f) => f.geometry.type === "Point");

  return (
    <section className="rounded-3xl border border-forest/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-forest">See the plan on the map</h2>
      <p className="mt-2 text-sm text-ink/60">
        <strong>{solutionTitle}</strong>. Orange shapes are what this plan adds. Click anything for details.
      </p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-forest/10">
        {scenario.loading && !scenario.data ? (
          <LoadingState label="Drawing the neighborhood…" />
        ) : scenario.error ? (
          <p role="alert" className="p-5 text-sm text-red-700">{scenario.error}</p>
        ) : (
          <MapContainer center={center} zoom={17} scrollWheelZoom={false} className="h-[400px] w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <GeoJSON
              key={solutionId}
              data={{ type: "FeatureCollection", features: areas } as FeatureCollection}
              style={(feature) => styleFor((feature?.properties ?? {}) as Props_)}
              onEachFeature={(feature: Feature<Geometry, Props_>, layer: Layer) => {
                const p = feature.properties ?? {};
                layer.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(String(p.layer ?? "").replace(/_/g, " "))}`);
              }}
            />
            {points.map((feature, index) => {
              const [lon, lat] = feature.geometry.coordinates as [number, number];
              const p = feature.properties;
              const color = String(p["marker-color"] ?? "#173F35");
              return (
                <CircleMarker
                  key={`${String(p.id ?? index)}`}
                  center={[lat, lon]}
                  radius={p.layer === "wildlife_site" ? 8 : 5}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.9 }}
                >
                  <Popup>
                    <strong>{p.emoji ? `${String(p.emoji)} ` : ""}{String(p.name ?? "")}</strong>
                    <br />
                    {String(p.layer ?? "").replace(/_/g, " ")}
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/70">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-peach/30 p-4 text-xs leading-relaxed text-ink/80">
        A fictional 2126 neighborhood drawn over real Brussels streets. Buffers come from each species' data.
      </p>
    </section>
  );
}
