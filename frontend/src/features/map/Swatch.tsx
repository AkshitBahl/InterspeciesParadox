import { COLORS, type Category } from "./mapStyle";

/** A small picture of how a category looks on the map, for the key and the guide. */
export default function Swatch({ category, emoji }: { category: Category; emoji?: string }) {
  switch (category.swatch) {
    case "person":
      return <span className="kin-swatch kin-swatch-person" aria-hidden="true">{emoji ?? "🧑"}</span>;
    case "animal":
      return (
        <span className="kin-swatch kin-swatch-animal" aria-hidden="true">
          <span>{emoji ?? "🦊"}</span>
        </span>
      );
    case "home":
      return <span className="kin-swatch kin-swatch-home" aria-hidden="true" />;
    case "place":
      return <span className="kin-swatch kin-swatch-place" aria-hidden="true">{emoji ?? "🚋"}</span>;
    case "entrance":
      return <span className="kin-swatch kin-swatch-entrance" aria-hidden="true" />;
    case "conflict":
      return (
        <span className="kin-swatch kin-swatch-conflict" aria-hidden="true">
          <span>!</span>
        </span>
      );
    case "fix":
      return <span className="kin-swatch kin-swatch-fix" aria-hidden="true">{emoji ?? "🌼"}</span>;
    case "line": {
      const dotted = category.dash?.startsWith("1 ");
      return (
        <svg className="kin-swatch-svg" viewBox="0 0 36 14" aria-hidden="true">
          {!category.dash && <path d="M2 7 H34" stroke="#fff" strokeWidth="7" strokeLinecap="round" />}
          <path
            d="M2 7 H34"
            stroke={category.color}
            strokeWidth={dotted ? 4.5 : category.dash ? 3 : 4}
            strokeDasharray={category.dash}
            strokeLinecap={dotted || !category.dash ? "round" : "butt"}
            fill="none"
          />
        </svg>
      );
    }
    case "zone":
      if (category.key === "city") {
        return (
          <svg className="kin-swatch-svg" viewBox="0 0 36 18" aria-hidden="true">
            <path d="M0 13 H36" stroke={COLORS.streetCasing} strokeWidth="7" />
            <path d="M0 13 H36" stroke={COLORS.street} strokeWidth="4.5" />
            <rect x="9" y="1.5" width="15" height="9" rx="1.5" fill={COLORS.building} stroke={COLORS.buildingEdge} />
          </svg>
        );
      }
      return (
        <svg className="kin-swatch-svg" viewBox="0 0 36 18" aria-hidden="true">
          <rect
            x="2"
            y="2"
            width="32"
            height="14"
            rx={category.dash ? 7 : 4}
            fill={category.fill}
            fillOpacity={category.dash ? 0.45 : 0.7}
            stroke={category.color}
            strokeWidth="1.8"
            strokeDasharray={category.dash}
          />
        </svg>
      );
    default:
      return null;
  }
}
