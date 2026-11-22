import { ChevronDown, Layers, Map as MapIcon } from "lucide-react";
import { CATEGORY_GROUPS, type CategoryKey } from "./mapStyle";
import Swatch from "./Swatch";

interface Props {
  visible: Set<CategoryKey>;
  counts: Partial<Record<CategoryKey, number>>;
  onToggle: (key: CategoryKey) => void;
  showRealMap: boolean;
  onToggleRealMap: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planMode: boolean;
}

/** The map key: every category with its symbol, a count and an on/off switch. */
export default function MapLegend({ visible, counts, onToggle, showRealMap, onToggleRealMap, open, onOpenChange, planMode }: Props) {
  return (
    <section className={`kin-legend ${open ? "is-open" : ""}`} aria-label="Map key">
      <button type="button" className="kin-legend-head" onClick={() => onOpenChange(!open)} aria-expanded={open} aria-controls="kin-legend-body">
        <Layers size={15} aria-hidden="true" />
        <span className="flex-1 text-left">Key</span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div id="kin-legend-body" className="kin-legend-body">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.title} className="kin-legend-group">
              <p className="kin-legend-title">{group.title}</p>
              {group.categories.map((category) => {
                const on = visible.has(category.key);
                return (
                  <button
                    key={category.key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggle(category.key)}
                    className={`kin-legend-row ${on ? "" : "is-off"}`}
                  >
                    <span className="kin-legend-symbol">
                      <Swatch category={category} />
                    </span>
                    <span className="kin-legend-label">{category.label}</span>
                    <span className="kin-legend-count">{counts[category.key] ?? 0}</span>
                    <span className="kin-toggle" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ))}

          {planMode && (
            <div className="kin-legend-group">
              <div className="kin-legend-row is-static">
                <span className="kin-legend-symbol">
                  <span className="kin-swatch kin-swatch-new">New</span>
                </span>
                <span className="kin-legend-label">Added by the plan</span>
              </div>
            </div>
          )}

          <div className="kin-legend-group">
            <button type="button" role="switch" aria-checked={showRealMap} onClick={onToggleRealMap} className={`kin-legend-row ${showRealMap ? "" : "is-off"}`}>
              <span className="kin-legend-symbol">
                <MapIcon size={15} aria-hidden="true" />
              </span>
              <span className="kin-legend-label">Real Brussels</span>
              <span className="kin-toggle" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
