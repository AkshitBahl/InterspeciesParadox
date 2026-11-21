import { useEffect } from "react";
import { CATEGORIES, type CategoryKey } from "./mapStyle";
import Swatch from "./Swatch";

const ROWS: { keys: CategoryKey[]; text: string }[] = [
  { keys: ["people"], text: "Blue circles are people." },
  { keys: ["animals"], text: "Orange pins are animals. Tap one to hear it." },
  { keys: ["homes"], text: "Brown dots are animal homes: nests, dens and roosts." },
  { keys: ["people_routes", "animal_paths"], text: "Blue lines are people's routes. Orange dots are animal paths." },
  { keys: ["nature", "quiet_zones"], text: "Green is nature. Yellow dashed areas are quiet zones the animals need." },
  { keys: ["conflicts", "fixes"], text: "Red rings are conflicts. Purple shapes are fixes both sides agreed on." },
];

/** A one-screen "how to read this map", shown on the first visit and from the ? button. */
export default function MapGuide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="kin-guide-backdrop" role="presentation" onClick={onClose}>
      <div className="kin-guide" role="dialog" aria-modal="true" aria-labelledby="kin-guide-title" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4f886d]">Ixelles Ponds Eco-District · 2126</p>
        <h2 id="kin-guide-title" className="mt-2 text-[22px] font-semibold leading-tight text-[#173f35]">How to read this map</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#40564b]">
          A made-up Brussels neighborhood where people and wildlife share the same streets. Every colour means one thing:
        </p>
        <ul className="mt-4 space-y-2.5">
          {ROWS.map((row) => (
            <li key={row.text} className="flex items-center gap-3">
              <span className="flex w-[84px] shrink-0 items-center justify-start gap-1.5">
                {row.keys.map((k) => (
                  <Swatch key={k} category={CATEGORIES[k]} />
                ))}
              </span>
              <span className="text-[13px] leading-snug text-[#173f35]">{row.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-[#eef4ea] p-3 text-[12.5px] leading-relaxed text-[#40564b]">
          Feeling lost? Use the buttons at the top to see only <strong>People</strong>, only <strong>Animals</strong> or only <strong>Conflicts</strong>.
          Click anything to see what it is and what it is linked to.
        </p>
        <button type="button" onClick={onClose} className="kin-guide-cta" autoFocus>
          Start exploring
        </button>
      </div>
    </div>
  );
}
