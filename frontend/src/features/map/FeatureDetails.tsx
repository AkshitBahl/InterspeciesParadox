import type { ReactNode } from "react";
import { ArrowUpRight, Volume2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { soundInfo } from "../sounds/animalSounds";
import { monthRanges, type MapFeature } from "./mapData";
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
const HABITAT_WORDS: Record<string, string> = { wetland: "Pond and reeds", hedgerow: "Hedgerow", gardens: "Gardens", meadow: "Flower meadow", green_roof: "Green roof" };
const RELATED_ORDER = ["wildlife", "wildlife_site", "ecological_buffer", "wildlife_corridor", "conflict_hotspot", "agreed_zone", "barrier", "intervention"];
const RELATED_WORDS: Record<string, string> = {
  wildlife: "The animals",
  wildlife_site: "Their home",
  ecological_buffer: "Quiet zone",
  wildlife_corridor: "How they travel",
  conflict_hotspot: "Conflict",
  agreed_zone: "Agreed zone",
  barrier: "Agreed screen",
  intervention: "Agreed fix",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#173f35]/8 py-2 text-[13px] last:border-0">
      <dt className="text-[#5b7065]">{label}</dt>
      <dd className="text-right font-medium text-[#173f35]">{children}</dd>
    </div>
  );
}

/** The card that explains whatever the user clicked on the map. */
export default function FeatureDetails({ feature, features, playing, liveMode, onClose, onShow, onPlay }: Props) {
  const p = feature.properties;
  const category = categoryOf(p);
  const species = p.species_slug;
  const related = species
    ? features
        .filter((f) => f.id !== feature.id && f.properties.species_slug === species && RELATED_ORDER.includes(f.properties.layer))
        .sort((a, b) => RELATED_ORDER.indexOf(a.properties.layer) - RELATED_ORDER.indexOf(b.properties.layer))
    : [];
  const sound = soundInfo(species);
  const hasSound = p.layer === "wildlife" || (species && ["wildlife_site", "conflict_hotspot"].includes(p.layer));

  return (
    <aside className="kin-details" aria-label={`About ${p.name}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3f1e7]">
          {category ? <Swatch category={CATEGORIES[category]} emoji={p.emoji} /> : <span aria-hidden="true">📍</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5b7065]">{typeLabel(p)}</p>
          <h2 className="mt-0.5 text-[17px] font-semibold leading-snug text-[#173f35]">
            {p.layer === "wildlife" || p.layer === "resident" ? `${p.emoji ?? ""} ` : ""}
            {p.name}
          </h2>
          {p.scenario_role === "proposed" && <span className="kin-new-pill">New in this plan</span>}
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#5b7065] hover:bg-[#173f35]/8" aria-label="Close details">
          <X size={18} />
        </button>
      </div>

      {hasSound && (
        <div className="mt-4 rounded-2xl bg-[#fff4ea] p-3.5">
          <button type="button" onClick={() => onPlay(feature)} className={`kin-sound-button ${playing ? "is-playing" : ""}`}>
            <Volume2 size={17} aria-hidden="true" />
            <span>{playing ? "Playing…" : sound.action}</span>
            <span className="kin-eq" aria-hidden="true"><i /><i /><i /><i /></span>
          </button>
          <p className="mt-2.5 text-[12px] leading-relaxed text-[#6b4a2b]">{sound.description}</p>
          <p className="mt-1 text-[10.5px] text-[#9a7b5f]">Made live by your browser, not a field recording.</p>
        </div>
      )}

      {p.description && <p className="mt-4 text-[13px] leading-relaxed text-[#40564b]">{p.description}</p>}
      {p.note && <p className="mt-4 text-[13px] leading-relaxed text-[#40564b]">{p.note}</p>}

      <dl className="mt-3">
        {p.layer === "wildlife" && p.count !== undefined && <Fact label="How many">{p.count}</Fact>}
        {p.representative && <Fact label="Speaks for them">{p.representative}</Fact>}
        {p.layer === "wildlife_site" && p.site_type && <Fact label="Kind of home">{SITE_WORDS[p.site_type] ?? p.site_type}</Fact>}
        {p.habitat && <Fact label="Habitat">{HABITAT_WORDS[p.habitat] ?? p.habitat.replace(/_/g, " ")}</Fact>}
        {p.layer === "conflict_hotspot" && p.severity !== undefined && (
          <Fact label="How serious">
            <span className="inline-flex items-center gap-1" aria-label={`${p.severity} out of 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i < p.severity! ? "bg-[#dc2626]" : "bg-[#dc2626]/15"}`} />
              ))}
            </span>
          </Fact>
        )}
        {p.layer === "ecological_buffer" && (
          <>
            <Fact label="Active">{monthRanges(p.active_months)}</Fact>
            <Fact label="Right now">{p.active_now === false ? "Not active, you can pass" : "Active, please keep out"}</Fact>
          </>
        )}
        {p.layer !== "ecological_buffer" && p.active_months && p.active_months.length < 12 && <Fact label="Season">{monthRanges(p.active_months)}</Fact>}
        {p.lighting && <Fact label="Street lights">{p.lighting === "none" ? "None" : p.lighting === "dim" ? "Dimmed" : "Bright"}</Fact>}
        {p.step_free !== undefined && <Fact label="Step-free">{p.step_free ? "Yes" : "No"}</Fact>}
        {p.layer === "building" && p.height_m !== undefined && <Fact label="Height">{p.height_m} m</Fact>}
      </dl>

      {related.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5b7065]">Linked on the map</p>
          <ul className="space-y-1.5">
            {related.map((f) => {
              const c = categoryOf(f.properties);
              return (
                <li key={f.id}>
                  <button type="button" onClick={() => onShow(f)} className="kin-related">
                    <span className="flex w-9 shrink-0 justify-center">{c && <Swatch category={CATEGORIES[c]} emoji={f.properties.emoji} />}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5b7065]">{RELATED_WORDS[f.properties.layer]}</span>
                      <span className="block truncate text-[12.5px] text-[#173f35]">{f.properties.name}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {liveMode && p.layer === "conflict_hotspot" && p.conflict_id && (
        <Link to={`/conflict/${p.conflict_id}/assessment`} className="kin-open-case">
          Open this case <ArrowUpRight size={15} />
        </Link>
      )}
    </aside>
  );
}
