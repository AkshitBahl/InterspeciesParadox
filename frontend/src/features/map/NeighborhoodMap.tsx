import { memo, useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { point as pixelPoint, type LeafletEventHandlerFnMap, type Path, type PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";

import { boundsOf, linesOf, pointOf, polygonsOf, shiftRings, type MapFeature } from "./mapData";
import { COLORS, categoryOf, typeLabel, type CategoryKey } from "./mapStyle";
import { MARKER_Z, iconFor } from "./markers";

export interface MapPadding {
  topLeft: [number, number];
  bottomRight: [number, number];
}

/** How much of the map the details card covers (pixels from the right and bottom edges). */
export interface DetailsInset {
  right: number;
  bottom: number;
}

export interface FocusRequest {
  id: string;
  nonce: number;
}

interface Props {
  features: MapFeature[];
  visible: Set<CategoryKey>;
  selectedId: string | null;
  /** Features linked to the selection (same species). Everything else is faded. */
  relatedIds: Set<string> | null;
  playingId: string | null;
  showRealMap: boolean;
  onSelect: (feature: MapFeature | null) => void;
  focus?: FocusRequest | null;
  padding?: MapPadding;
  /** Space covered by a details card, so selections are never hidden under it. */
  detailsInset?: DetailsInset;
  /** Changes when the map should zoom to fit the data again (e.g. a new plan). */
  fitKey?: string;
  /** Embedded maps don't grab the scroll wheel. */
  scrollWheelZoom?: boolean;
  /** Start around this point instead of fitting the whole neighborhood. */
  initialCenter?: [number, number];
  className?: string;
}

const DEFAULT_PADDING: MapPadding = { topLeft: [24, 24], bottomRight: [24, 24] };
const NO_INSET: DetailsInset = { right: 0, bottom: 0 };
const NOT_DIMMED: CategoryKey[] = ["city", "entrances"];

/** Zooms to the data once it arrives (and again when `fitKey` changes). */
function FitToData({ features, padding, fitKey, initialCenter }: { features: MapFeature[]; padding: MapPadding; fitKey: string; initialCenter?: [number, number] }) {
  const map = useMap();
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!features.length || done.current === fitKey) return;
    done.current = fitKey;
    if (initialCenter) {
      map.setView(initialCenter, 18, { animate: false });
      return;
    }
    const bounds = boundsOf(features.filter((f) => categoryOf(f.properties) !== "city" || f.properties.layer === "building"));
    if (bounds) map.fitBounds(bounds, { paddingTopLeft: padding.topLeft, paddingBottomRight: padding.bottomRight, animate: false });
  }, [features, fitKey, initialCenter, map, padding]);
  return null;
}

/**
 * Moves the camera for the selection: flies to a feature when the page asks for it
 * ("show the fox den"), and otherwise just makes sure a clicked feature is not hidden
 * behind the details card.
 */
function SelectionCamera({ focus, selectedId, features, padding, inset }: { focus: FocusRequest | null | undefined; selectedId: string | null; features: MapFeature[]; padding: MapPadding; inset: DetailsInset }) {
  const map = useMap();
  const handled = useRef<number | null>(null);
  useEffect(() => {
    const size = map.getSize();
    const left = padding.topLeft[0];
    const top = padding.topLeft[1];
    const right = Math.max(padding.bottomRight[0], inset.right);
    const bottom = Math.max(padding.bottomRight[1], inset.bottom);

    if (focus && handled.current !== focus.nonce) {
      handled.current = focus.nonce;
      const feature = features.find((f) => f.id === focus.id);
      if (!feature) return;
      const point = pointOf(feature.geometry);
      if (point) {
        // Land the point in the middle of the free part of the map, not under a panel.
        const zoom = Math.max(map.getZoom(), 18);
        const shift = pixelPoint((left - right) / 2, (top - bottom) / 2);
        map.flyTo(map.unproject(map.project(point, zoom).subtract(shift), zoom), zoom, { duration: 0.6 });
      } else {
        const bounds = boundsOf([feature]);
        if (bounds) map.flyToBounds(bounds, { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom], maxZoom: 18.5, duration: 0.6 });
      }
      return;
    }

    const feature = selectedId ? features.find((f) => f.id === selectedId) : undefined;
    const point = feature && pointOf(feature.geometry);
    if (!point) return;
    // If the clicked point is near an edge or under a panel, slide it into the free area.
    const p = map.latLngToContainerPoint(point);
    const margin = 48;
    const free = { x1: Math.min(left, size.x / 3), y1: top, x2: size.x - right, y2: size.y - bottom };
    if (p.x < free.x1 + margin || p.x > free.x2 - margin || p.y < free.y1 + margin || p.y > free.y2 - margin) {
      map.panBy([p.x - (free.x1 + free.x2) / 2, p.y - (free.y1 + free.y2) / 2], { duration: 0.4 });
    }
    // Only react to a new selection or request, not to every data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, selectedId]);
  return null;
}

/** Background click clears the selection; zoom level drives marker size. */
function MapBehaviour({ onBackground }: { onBackground: () => void }) {
  const map = useMapEvents({
    click: onBackground,
    zoomend: () => {
      map.getContainer().dataset.zoom = String(Math.round(map.getZoom()));
    },
  });
  useEffect(() => {
    map.getContainer().dataset.zoom = String(Math.round(map.getZoom()));
  }, [map]);
  return null;
}

interface ShapeProps {
  feature: MapFeature;
  category: CategoryKey;
  selected: boolean;
  dimmed: boolean;
  onSelect: (feature: MapFeature) => void;
}

function fade(options: PathOptions, dimmed: boolean): PathOptions {
  if (!dimmed) return options;
  return { ...options, opacity: (options.opacity ?? 1) * 0.22, fillOpacity: (options.fillOpacity ?? 0.2) * 0.25 };
}

function hoverHandlers(feature: MapFeature, onSelect: (f: MapFeature) => void, base: PathOptions): LeafletEventHandlerFnMap {
  return {
    click: () => onSelect(feature),
    mouseover: (e) => (e.target as Path).setStyle({ weight: (base.weight ?? 2) + 2.5 }),
    mouseout: (e) => (e.target as Path).setStyle({ weight: base.weight ?? 2 }),
  };
}

function lineStyle(category: CategoryKey, selected: boolean): PathOptions {
  const extra = selected ? 2.5 : 0;
  const common = { bubblingMouseEvents: false, lineJoin: "round" as const };
  switch (category) {
    case "people_routes":
      return { ...common, color: COLORS.people, weight: 4.5 + extra, opacity: 0.95, lineCap: "round" };
    case "animal_paths":
      return { ...common, color: COLORS.animals, weight: 5.5 + extra, opacity: 0.95, dashArray: "1 9", lineCap: "round", className: "kin-flow kin-flow-dots" };
    case "deliveries":
      return { ...common, color: COLORS.delivery, weight: 3.5 + extra, opacity: 0.9, dashArray: "10 8", lineCap: "butt", className: "kin-flow kin-flow-dash" };
    case "fixes":
      return { ...common, color: COLORS.fix, weight: 7 + extra, opacity: 1, lineCap: "butt" };
    case "city":
      return { ...common, color: COLORS.street, weight: 10, opacity: 1, lineCap: "round" };
    default:
      return { ...common, color: "#64748b", weight: 3 };
  }
}

const RouteShape = memo(function RouteShape({ feature, category, selected, dimmed, onSelect }: ShapeProps) {
  const lines = linesOf(feature.geometry);
  const base = fade(lineStyle(category, selected), dimmed);
  const isNew = feature.properties.scenario_role === "proposed";
  return (
    <>
      {isNew && <Polyline positions={lines} pathOptions={{ color: COLORS.fix, weight: base.weight! + 10, opacity: dimmed ? 0.08 : 0.28, interactive: false, lineCap: "round" }} />}
      {category === "city" && <Polyline positions={lines} pathOptions={{ color: COLORS.streetCasing, weight: 13, opacity: 1, interactive: false, lineCap: "round", lineJoin: "round" }} />}
      {category === "people_routes" && <Polyline positions={lines} pathOptions={{ color: "#ffffff", weight: base.weight! + 3.5, opacity: dimmed ? 0.3 : 0.95, interactive: false, lineCap: "round", lineJoin: "round" }} />}
      <Polyline positions={lines} pathOptions={base} eventHandlers={hoverHandlers(feature, onSelect, base)}>
        <Tooltip sticky direction="top" className="kin-tooltip" pane="tooltipPane">
          <strong>{feature.properties.name}</strong>
          <span>{isNew ? "New in this plan · " : ""}{typeLabel(feature.properties)}</span>
        </Tooltip>
      </Polyline>
    </>
  );
});

function zoneStyle(category: CategoryKey, feature: MapFeature, selected: boolean): PathOptions {
  const p = feature.properties;
  const extra = selected ? 2 : 0;
  const common = { bubblingMouseEvents: false };
  let style: PathOptions;
  switch (category) {
    case "nature":
      style = p.habitat === "wetland"
        ? { ...common, color: COLORS.nature, weight: 3 + extra, fillColor: COLORS.water, fillOpacity: 0.85, opacity: 0.85 }
        : { ...common, color: COLORS.nature, weight: 1.5 + extra, fillColor: COLORS.natureFill, fillOpacity: 0.6, opacity: 0.9 };
      break;
    case "quiet_zones":
      style = p.active_now === false
        ? { ...common, color: "#a8a29e", weight: 1.5 + extra, dashArray: "3 6", fillColor: COLORS.quietFill, fillOpacity: 0.05, opacity: 0.9 }
        : { ...common, color: COLORS.quiet, weight: 2 + extra, dashArray: "6 5", fillColor: COLORS.quietFill, fillOpacity: 0.32, opacity: 1 };
      break;
    case "fixes":
      style = { ...common, color: COLORS.fix, weight: 2.5 + extra, fillColor: "#c4b5fd", fillOpacity: 0.3, opacity: 1 };
      break;
    case "city":
      style = { ...common, color: COLORS.buildingEdge, weight: 1.2 + extra, fillColor: COLORS.building, fillOpacity: 1, opacity: 1 };
      break;
    default:
      style = { ...common, color: "#64748b", weight: 1.5, fillOpacity: 0.2 };
  }
  if (p.scenario_role === "proposed") style = { ...style, color: COLORS.fix, weight: (style.weight ?? 2) + 1, dashArray: "4 4" };
  return style;
}

const ZoneShape = memo(function ZoneShape({ feature, category, selected, dimmed, onSelect }: ShapeProps) {
  const polygons = polygonsOf(feature.geometry);
  const base = fade(zoneStyle(category, feature, selected), dimmed);
  const isBuilding = feature.properties.layer === "building";
  const p = feature.properties;
  return (
    <>
      {isBuilding &&
        polygons.map((rings, i) => (
          <Polygon key={`shadow-${i}`} positions={shiftRings(rings, 2.6, -2.6)} pathOptions={{ stroke: false, fillColor: "#5b4f36", fillOpacity: 0.16, interactive: false }} />
        ))}
      <Polygon positions={polygons} pathOptions={base} eventHandlers={hoverHandlers(feature, onSelect, base)}>
        {isBuilding ? (
          <Tooltip permanent direction="center" className="kin-building-label" interactive={false} pane="kin-labels">
            {p.name}
          </Tooltip>
        ) : (
          <Tooltip sticky direction="top" className="kin-tooltip" pane="tooltipPane">
            <strong>{p.name}</strong>
            <span>
              {p.scenario_role === "proposed" ? "New in this plan · " : ""}
              {typeLabel(p)}
              {category === "quiet_zones" && p.active_now === false ? " (not active this month)" : ""}
            </span>
          </Tooltip>
        )}
      </Polygon>
    </>
  );
});

interface MarkerProps {
  feature: MapFeature;
  selected: boolean;
  dimmed: boolean;
  playing: boolean;
  onSelect: (feature: MapFeature) => void;
}

const PointMarker = memo(function PointMarker({ feature, selected, dimmed, playing, onSelect }: MarkerProps) {
  const p = feature.properties;
  const position = pointOf(feature.geometry);
  const isNew = p.scenario_role === "proposed";
  const icon = useMemo(() => iconFor(p, { selected, dimmed, playing, isNew }), [p, selected, dimmed, playing, isNew]);
  if (!position || !icon) return null;
  const label = `${p.name}. ${typeLabel(p)}${p.layer === "wildlife" ? ". Press to hear it." : ""}`;
  return (
    <Marker
      position={position}
      icon={icon}
      keyboard
      zIndexOffset={(MARKER_Z[p.layer] ?? 0) + (selected ? 2000 : 0)}
      eventHandlers={{
        click: () => onSelect(feature),
        // Leaflet only handles Enter for popups, so markers get Enter and Space here.
        keydown: (e) => {
          const key = (e.originalEvent as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            e.originalEvent.preventDefault();
            onSelect(feature);
          }
        },
        add: (e) => e.target.getElement()?.setAttribute("aria-label", label),
      }}
    >
      <Tooltip direction="top" className="kin-tooltip">
        <strong>{p.name}</strong>
        <span>
          {isNew ? "New in this plan · " : ""}
          {typeLabel(p)}
          {p.layer === "wildlife" ? " · tap to hear" : ""}
        </span>
      </Tooltip>
    </Marker>
  );
});

/** The neighborhood map: every feature drawn in its category's style. */
export default function NeighborhoodMap({
  features,
  visible,
  selectedId,
  relatedIds,
  playingId,
  showRealMap,
  onSelect,
  focus,
  padding = DEFAULT_PADDING,
  detailsInset = NO_INSET,
  fitKey = "initial",
  scrollWheelZoom = true,
  initialCenter,
  className = "",
}: Props) {
  const groups = useMemo(() => {
    const out = { nature: [] as [MapFeature, CategoryKey][], city: [] as [MapFeature, CategoryKey][], zones: [] as [MapFeature, CategoryKey][], routes: [] as [MapFeature, CategoryKey][], points: [] as [MapFeature, CategoryKey][] };
    for (const f of features) {
      const category = categoryOf(f.properties);
      // Hidden categories still show the features linked to the selection (e.g. the fox's path).
      if (!category || (!visible.has(category) && !relatedIds?.has(f.id))) continue;
      const type = f.geometry.type;
      if (type === "Point") out.points.push([f, category]);
      else if (type === "LineString" || type === "MultiLineString") (category === "city" ? out.city : out.routes).push([f, category]);
      // Green roofs sit on top of buildings, so they are drawn above them.
      else if (category === "nature" && f.properties.habitat !== "green_roof") out.nature.push([f, category]);
      else if (category === "city") out.city.push([f, category]);
      else out.zones.push([f, category]);
    }
    return out;
  }, [features, visible, relatedIds]);

  const isDimmed = (f: MapFeature, category: CategoryKey) =>
    relatedIds !== null && !relatedIds.has(f.id) && !NOT_DIMMED.includes(category);

  const center: [number, number] = initialCenter ?? [50.8242, 4.3738];

  return (
    <MapContainer
      center={center}
      zoom={17}
      minZoom={15.5}
      maxZoom={20}
      zoomSnap={0.25}
      zoomControl={false}
      scrollWheelZoom={scrollWheelZoom}
      maxBounds={[
        [50.8195, 4.364],
        [50.8295, 4.3835],
      ]}
      maxBoundsViscosity={0.8}
      className={`kin-map h-full w-full ${className}`}
    >
      {showRealMap && (
        <TileLayer
          className="kin-real-tiles"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={20}
        />
      )}
      <ZoomControl position="bottomright" />
      <MapBehaviour onBackground={() => onSelect(null)} />
      <FitToData features={features} padding={padding} fitKey={fitKey} initialCenter={initialCenter} />
      <SelectionCamera focus={focus} selectedId={selectedId} features={features} padding={padding} inset={detailsInset} />

      {/* Building names sit above the shapes but under the markers, so they never cover an animal. */}
      <Pane name="kin-labels" style={{ zIndex: 450, pointerEvents: "none" }} />
      <Pane name="kin-nature" style={{ zIndex: 310 }}>
        {groups.nature.map(([f, c]) => (
          <ZoneShape key={f.id} feature={f} category={c} selected={f.id === selectedId} dimmed={isDimmed(f, c)} onSelect={onSelect} />
        ))}
      </Pane>
      <Pane name="kin-streets" style={{ zIndex: 320 }}>
        {groups.city
          .filter(([f]) => f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")
          .map(([f, c]) => (
            <RouteShape key={f.id} feature={f} category={c} selected={f.id === selectedId} dimmed={false} onSelect={onSelect} />
          ))}
      </Pane>
      <Pane name="kin-buildings" style={{ zIndex: 330 }}>
        {groups.city
          .filter(([f]) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
          .map(([f, c]) => (
            <ZoneShape key={f.id} feature={f} category={c} selected={f.id === selectedId} dimmed={false} onSelect={onSelect} />
          ))}
      </Pane>
      <Pane name="kin-zones" style={{ zIndex: 340 }}>
        {groups.zones.map(([f, c]) => (
          <ZoneShape key={f.id} feature={f} category={c} selected={f.id === selectedId} dimmed={isDimmed(f, c)} onSelect={onSelect} />
        ))}
      </Pane>
      <Pane name="kin-routes" style={{ zIndex: 420 }}>
        {groups.routes.map(([f, c]) => (
          <RouteShape key={f.id} feature={f} category={c} selected={f.id === selectedId} dimmed={isDimmed(f, c)} onSelect={onSelect} />
        ))}
      </Pane>
      {groups.points.map(([f, c]) => (
        <PointMarker key={f.id} feature={f} selected={f.id === selectedId} dimmed={isDimmed(f, c)} playing={f.id === playingId} onSelect={onSelect} />
      ))}
    </MapContainer>
  );
}
