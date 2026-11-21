import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngExpression } from "leaflet";
import type { RouteVariant } from "../../types/mediation";

// All map coordinates and routes are invented demo geometry.
// They do NOT represent a real building, a navigable path, or a verified wildlife buffer.
const home: LatLngExpression = [50.84640, 4.35350];
const nest: LatLngExpression = [50.84665, 4.35335];
const destination: LatLngExpression = [50.84702, 4.35270];

const paths: Record<RouteVariant, LatLngExpression[]> = {
  protected: [home, [50.84641, 4.35312], [50.84677, 4.35302], destination],
  alternative: [home, [50.84618, 4.35355], [50.84610, 4.35283], [50.84668, 4.35275], destination],
  managed: [home, [50.84653, 4.35324], [50.84690, 4.35292], destination],
};

const routeNames: Record<RouteVariant, string> = {
  protected: "Proposed protected corridor",
  alternative: "Proposed alternative route",
  managed: "Proposed managed access",
};

export default function MediationMap({ route }: { route: RouteVariant }) {
  return (
    <section className="rounded-3xl border border-forest/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-forest">Explore the route</h2>
      <p className="mt-2 text-sm text-ink/60">Selecting a plan updates the highlighted path. Zoom and drag to explore.</p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-forest/10">
        <MapContainer center={[50.8466, 4.3531]} zoom={17} scrollWheelZoom={false} className="h-[360px] w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={nest}
            radius={14}
            pathOptions={{ color: "#B7791F", fillColor: "#F5D6BD", fillOpacity: 0.35 }}
          ><Popup>Illustrative nest zone. Radius is NOT a species-specific safety distance.</Popup></Circle>
          <CircleMarker center={home} radius={9} pathOptions={{ color: "#173F35", fillColor: "#173F35", fillOpacity: 1 }}>
            <Popup>Example entrance</Popup>
          </CircleMarker>
          <CircleMarker center={nest} radius={6} pathOptions={{ color: "#B7791F", fillColor: "#B7791F", fillOpacity: 1 }}>
            <Popup>Example nesting location</Popup>
          </CircleMarker>
          <CircleMarker center={destination} radius={9} pathOptions={{ color: "#4F886D", fillColor: "#4F886D", fillOpacity: 1 }}>
            <Popup>Example destination</Popup>
          </CircleMarker>
          <Polyline positions={paths[route]} pathOptions={{ color: "#256D59", weight: 6, opacity: 0.88 }}>
            <Popup>{routeNames[route]}</Popup>
          </Polyline>
        </MapContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/70">
        <span>🟢 Example entrance / destination</span>
        <span>🟠 Example nesting area</span>
        <span>━ Suggested path</span>
      </div>
      <p className="mt-4 rounded-xl bg-peach/30 p-4 text-xs leading-relaxed text-ink/80">
        <strong>Fictional route preview:</strong> points and lines are manually sketched over a sample map in Brussels. These are not walking directions, validated accessible routes or authorized wildlife buffers. A future backend can provide actual mapped geometry and verified constraints.
      </p>
    </section>
  );
}
