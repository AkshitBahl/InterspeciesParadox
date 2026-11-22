import { useEffect } from "react";
import { CATEGORIES, type CategoryKey } from "./mapStyle";
import Swatch from "./Swatch";

const ROWS: { keys: CategoryKey[]; text: string }[] = [
  { keys: ["people"], text: "People" },
  { keys: ["animals"], text: "Animals. Tap to hear them" },
  { keys: ["homes"], text: "Animal homes" },
  { keys: ["people_routes", "animal_paths"], text: "Routes and paths" },
  { keys: ["nature", "quiet_zones"], text: "Nature and quiet zones" },
  { keys: ["conflicts", "fixes"], text: "Conflicts and fixes" },
];

/** A one screen "how to read this map", shown on the first visit and from the help button. */
export default function MapGuide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="kin-guide-backdrop" role="presentation" onClick={onClose}>
      <div className="kin-guide" role="dialog" aria-modal="true" aria-labelledby="kin-guide-title" onClick={(e) => e.stopPropagation()}>
        <p className="kin-eyebrow">Brussels 2126</p>
        <h2 id="kin-guide-title" className="kin-guide-title">One colour, one meaning</h2>
        <ul className="kin-guide-rows">
          {ROWS.map((row) => (
            <li key={row.text}>
              <span className="kin-guide-swatches">
                {row.keys.map((k) => (
                  <Swatch key={k} category={CATEGORIES[k]} />
                ))}
              </span>
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="kin-guide-cta" autoFocus>
          Explore
        </button>
      </div>
    </div>
  );
}
