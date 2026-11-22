import { useState, type ReactNode } from "react";
import { ArrowUpRight, Play, X } from "lucide-react";
import { Link } from "react-router-dom";
import { soundInfo } from "../sounds/animalSounds";
import { monthRanges, tidy, type MapFeature } from "./mapData";
import { CATEGORIES, categoryOf, typeLabel } from "./mapStyle";
import Swatch from "./Swatch";

interface Props {
  feature: MapFeature;
  features: MapFeature[];
  playing: boolean;
  liveMode: boolean;
  onClose: () => void;
  onShow: (feature: MapFeature) => void;
  onPlay: (feature: MapFeature) => void;
}

const SITE_WORDS: Record<string, string> = { nest: "Nest", roost: "Roost", den: "Den", bee_nest: "Bee nest" };
const HABITAT_WORDS: Record<string, string> = { wetland: "Pond", hedgerow: "Hedgerow", gardens: "Gardens", meadow: "Meadow", green_roof: "Green roof" };
const RELATED_ORDER = ["wildlife", "wildlife_site", "ecological_buffer", "wildlife_corridor", "conflict_hotspot", "agreed_zone", "barrier", "intervention"];
const RELATED_WORDS: Record<string, string> = {
  wildlife: "Animals",
  wildlife_site: "Home",
  ecological_buffer: "Quiet zone",
  wildlife_corridor: "Path",
  conflict_hotspot: "Conflict",
  agreed_zone: "Agreed zone",
  barrier: "Screen",
  intervention: "Fix",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kin-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The card for whatever was clicked on the map. */
export default function FeatureDetails({ feature, features, playing, liveMode, onClose, onShow, onPlay }: Props) {
  const p = feature.properties;
  const category = categoryOf(p);
  const species = p.species_slug;
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const expanded = moreFor === feature.id;
  const related = species
    ? features
        .filter((f) => f.id !== feature.id && f.properties.species_slug === species && RELATED_ORDER.includes(f.properties.layer))
        .sort((a, b) => RELATED_ORDER.indexOf(a.properties.layer) - RELATED_ORDER.indexOf(b.properties.layer))
    : [];
  const sound = soundInfo(species);
  const hasSound = p.layer === "wildlife" || (species && ["wildlife_site", "conflict_hotspot"].includes(p.layer));
  const text = tidy(p.description || p.note || "");

  return (
    <aside className="kin-details" aria-label={tidy(p.name)}>
      <div className="flex items-start gap-3">
        <div className="kin-details-icon">{category ? <Swatch category={CATEGORIES[category]} emoji={p.emoji} /> : <span aria-hidden="true">📍</span>}</div>
        <div className="min-w-0 flex-1">
          <p className="kin-eyebrow">
            {typeLabel(p)}
            {p.scenario_role === "proposed" && <span className="kin-new-pill">New</span>}
          </p>
          <h2 className="kin-details-title">{tidy(p.name)}</h2>
        </div>
        <button type="button" onClick={onClose} className="kin-icon-button" aria-label="Close">
          <X size={17} />
        </button>
      </div>

      {hasSound && (
        <div className="kin-sound">
          <button type="button" onClick={() => onPlay(feature)} className={`kin-sound-button ${playing ? "is-playing" : ""}`} aria-label={playing ? "Playing" : "Play sound"}>
            <Play size={15} aria-hidden="true" fill="currentColor" />
            <span className="kin-eq" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          </button>
          <p>
            {sound.description}
            <span className="kin-synth">Synthesized</span>
          </p>
        </div>
      )}

      {text && (
        <p className={`kin-desc ${expanded ? "is-open" : ""}`}>
          {text}{" "}
          {!expanded && text.length > 120 && (
            <button type="button" onClick={() => setMoreFor(feature.id)} className="kin-more">
              More
            </button>
          )}
        </p>
      )}

      <dl className="kin-facts">
        {p.layer === "wildlife" && p.count !== undefined && <Fact label="Count">{p.count}</Fact>}
        {p.representative && <Fact label="Voice">{tidy(p.representative)}</Fact>}
        {p.layer === "wildlife_site" && p.site_type && <Fact label="Home">{SITE_WORDS[p.site_type] ?? p.site_type}</Fact>}
        {p.habitat && <Fact label="Habitat">{HABITAT_WORDS[p.habitat] ?? p.habitat.replace(/_/g, " ")}</Fact>}
        {p.layer === "conflict_hotspot" && p.severity !== undefined && (
          <Fact label="Severity">
            <span className="kin-severity" aria-label={`${p.severity} of 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} className={i < p.severity! ? "is-on" : ""} />
              ))}
            </span>
          </Fact>
        )}
        {p.layer === "ecological_buffer" && (
          <>
            <Fact label="Season">{monthRanges(p.active_months)}</Fact>
            <Fact label="Now">{p.active_now === false ? "Open" : "Keep out"}</Fact>
          </>
        )}
        {p.layer !== "ecological_buffer" && p.active_months && p.active_months.length < 12 && <Fact label="Season">{monthRanges(p.active_months)}</Fact>}
        {p.lighting && <Fact label="Lights">{p.lighting === "none" ? "None" : p.lighting === "dim" ? "Dim" : "Bright"}</Fact>}
        {p.step_free !== undefined && <Fact label="Step free">{p.step_free ? "Yes" : "No"}</Fact>}
        {p.layer === "building" && p.height_m !== undefined && <Fact label="Height">{p.height_m} m</Fact>}
      </dl>

      {related.length > 0 && (
        <div className="kin-related-list">
          <p className="kin-eyebrow">Linked</p>
          <ul>
            {related.map((f) => {
              const c = categoryOf(f.properties);
              return (
                <li key={f.id}>
                  <button type="button" onClick={() => onShow(f)} className="kin-related">
                    <span className="kin-related-swatch">{c && <Swatch category={CATEGORIES[c]} emoji={f.properties.emoji} />}</span>
                    <span className="kin-related-word">{RELATED_WORDS[f.properties.layer]}</span>
                    <span className="kin-related-name">{tidy(f.properties.name)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {liveMode && p.layer === "conflict_hotspot" && p.conflict_id && (
        <Link to={`/conflict/${p.conflict_id}/assessment`} className="kin-open-case">
          Open case <ArrowUpRight size={15} />
        </Link>
      )}
    </aside>
  );
}
