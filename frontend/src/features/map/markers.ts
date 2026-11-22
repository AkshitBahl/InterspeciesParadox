import type { PositionAnchor } from "maplibre-gl";
import { escapeHtml, type MapFeatureProps } from "./mapData";

export interface MarkerState {
  selected: boolean;
  dimmed: boolean;
  playing: boolean;
  isNew: boolean;
}

export interface MarkerLook {
  html: string;
  anchor: PositionAnchor;
  /** Draw order: animals on top, conflict rings at the bottom. */
  z: number;
}

const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

function classes(base: string, state: MarkerState): string {
  return [base, state.selected && "is-selected", state.dimmed && "is-dimmed", state.playing && "is-playing", state.isNew && "is-new"]
    .filter(Boolean)
    .join(" ");
}

const NEW_TAG = '<span class="kin-new-tag">New</span>';

/** The HTML for a point feature's marker, or null for layers drawn as shapes. */
export function markerLook(p: MapFeatureProps, state: MarkerState): MarkerLook | null {
  const tag = state.isNew ? NEW_TAG : "";
  const emoji = (fallback: string) => escapeHtml(p.emoji || fallback);
  switch (p.layer) {
    case "wildlife":
      return {
        anchor: "bottom",
        z: 50,
        html: `<div class="${classes("kin-animal", state)}">
            <span class="kin-rings" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="kin-animal-pin"><span class="kin-animal-face">${emoji("🐾")}</span></span>
            <span class="kin-sound-badge" aria-hidden="true">${SPEAKER_SVG}</span>${tag}
          </div>`,
      };
    case "resident":
      return { anchor: "center", z: 40, html: `<div class="${classes("kin-person", state)}"><span>${emoji("🧑")}</span>${tag}</div>` };
    case "wildlife_site":
      return { anchor: "center", z: 20, html: `<div class="${classes("kin-home", state)}"></div>` };
    case "point_of_interest":
      return { anchor: "center", z: 25, html: `<div class="${classes("kin-place", state)}"><span>${emoji("📍")}</span>${tag}</div>` };
    case "entrance":
      return { anchor: "center", z: 22, html: `<div class="${classes("kin-entrance", state)}"></div>` };
    case "conflict_hotspot":
      return {
        anchor: "center",
        z: 10,
        html: `<div class="${classes("kin-conflict", state)}"><span class="kin-conflict-pulse" aria-hidden="true"></span><span class="kin-conflict-badge">!</span></div>`,
      };
    case "intervention":
      return { anchor: "center", z: 30, html: `<div class="${classes("kin-fix", state)}"><span>${emoji("✨")}</span>${tag}</div>` };
    default:
      return null;
  }
}
