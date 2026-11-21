import { divIcon, type DivIcon } from "leaflet";
import { escapeHtml, type MapFeatureProps } from "./mapData";

export interface MarkerState {
  selected: boolean;
  dimmed: boolean;
  playing: boolean;
  isNew: boolean;
}

const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const DOOR_SVG =
  '<svg viewBox="0 0 24 24" width="9" height="9" aria-hidden="true"><path fill="currentColor" d="M6 3h12v18H6z" opacity=".25"/><path fill="none" stroke="currentColor" stroke-width="2.4" d="M6 21V3h12v18"/><circle cx="14.5" cy="12" r="1.6" fill="currentColor"/></svg>';

function classes(base: string, state: MarkerState): string {
  return [
    base,
    state.selected && "is-selected",
    state.dimmed && "is-dimmed",
    state.playing && "is-playing",
    state.isNew && "is-new",
  ]
    .filter(Boolean)
    .join(" ");
}

const NEW_TAG = '<span class="kin-new-tag">New</span>';

function emojiOf(p: MapFeatureProps, fallback: string): string {
  return escapeHtml(p.emoji || fallback);
}

/** Builds the HTML marker for a point feature. Returns null for layers drawn as shapes. */
export function iconFor(p: MapFeatureProps, state: MarkerState): DivIcon | null {
  const tag = state.isNew ? NEW_TAG : "";
  switch (p.layer) {
    case "wildlife":
      return divIcon({
        className: "kin-icon",
        html: `<div class="${classes("kin-animal", state)}">
            <span class="kin-rings" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="kin-animal-pin"><span class="kin-animal-face">${emojiOf(p, "🐾")}</span></span>
            <span class="kin-sound-badge" aria-hidden="true">${SPEAKER_SVG}</span>${tag}
          </div>`,
        iconSize: [46, 52],
        iconAnchor: [23, 48],
        tooltipAnchor: [0, -46],
      });
    case "resident":
      return divIcon({
        className: "kin-icon",
        html: `<div class="${classes("kin-person", state)}"><span>${emojiOf(p, "🧑")}</span>${tag}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        tooltipAnchor: [0, -18],
      });
    case "wildlife_site":
      return divIcon({
        className: "kin-icon",
        html: `<div class="${classes("kin-home", state)}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        tooltipAnchor: [0, -10],
      });
    case "point_of_interest":
      return divIcon({
        className: "kin-icon",
        html: `<div class="${classes("kin-place", state)}"><span>${emojiOf(p, "📍")}</span>${tag}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        tooltipAnchor: [0, -16],
      });
    case "entrance":
      return divIcon({
        className: "kin-icon",
        html: `<div class="${classes("kin-entrance", state)}">${DOOR_SVG}</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        tooltipAnchor: [0, -9],
      });
    case "conflict_hotspot":
      return divIcon({
        className: "kin-icon",
        html: `<div class="${classes("kin-conflict", state)}"><span class="kin-conflict-pulse" aria-hidden="true"></span><span class="kin-conflict-badge">!</span></div>`,
        iconSize: [64, 64],
        iconAnchor: [32, 32],
        tooltipAnchor: [0, -30],
      });
    case "intervention":
      return divIcon({
        className: "kin-icon",
        html: `<div class="${classes("kin-fix", state)}"><span>${emojiOf(p, "🛠️")}</span>${tag}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        tooltipAnchor: [0, -16],
      });
    default:
      return null;
  }
}

/** Draw order for markers: animals on top, conflict rings at the bottom. */
export const MARKER_Z: Record<string, number> = {
  conflict_hotspot: -1000,
  wildlife_site: 0,
  entrance: 50,
  point_of_interest: 100,
  intervention: 150,
  resident: 300,
  wildlife: 500,
};
