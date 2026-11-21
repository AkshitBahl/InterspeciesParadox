import { ChevronDown, Layers } from "lucide-react";
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
        <Layers size={16} aria-hidden="true" />
        <span className="flex-1 text-left">Map key</span>
        <span className="text-[11px] font-normal text-[#5b7065]">{open ? "Hide" : "Show"}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div id="kin-legend-body" className="kin-legend-body">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.title} className="kin-legend-group">
              <p className="kin-legend-title">{group.title}</p>
              {group.categories.map((category) => {
                const on = visible.has(category.key);
                const count = counts[category.key] ?? 0;
                return (
                  <button
                    key={category.key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggle(category.key)}
                    className={`kin-legend-row ${on ? "" : "is-off"}`}
                    title={category.hint}
                  >
                    <span className="kin-legend-symbol">
                      <Swatch category={category} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[12.5px] font-medium text-[#173f35]">{category.label}</span>
                      <span className="block truncate text-[10.5px] text-[#6a7d72]">{category.hint}</span>
                    </span>
                    <span className="kin-legend-count">{count}</span>
                    <span className="kin-toggle" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ))}

          {planMode && (
            <div className="kin-legend-group">
              <p className="kin-legend-title">This plan</p>
              <div className="kin-legend-row" aria-hidden="false">
                <span className="kin-legend-symbol">
                  <span className="kin-swatch kin-swatch-new">New</span>
                </span>
                <span className="flex-1 text-[12px] text-[#173f35]">Purple glow or tag = added by the plan</span>
              </div>
            </div>
          )}

          <div className="kin-legend-group">
            <button type="button" role="switch" aria-checked={showRealMap} onClick={onToggleRealMap} className={`kin-legend-row ${showRealMap ? "" : "is-off"}`}>
              <span className="kin-legend-symbol text-base" aria-hidden="true">🗺️</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[12.5px] font-medium text-[#173f35]">Real Brussels underneath</span>
                <span className="block text-[10.5px] text-[#6a7d72]">Faint OpenStreetMap streets (needs internet).</span>
              </span>
              <span className="kin-toggle" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
