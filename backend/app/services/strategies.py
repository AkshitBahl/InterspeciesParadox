"""Step 5: strategies that turn an assessment into concrete compromise solutions.

Each strategy is a small class with four jobs:
* `applicable`     - does this kind of fix make sense for this conflict?
* `param_specs`    - which knobs can humans negotiate (radius, dates...)?
* `build`          - given knob values, produce a Draft: actions, costs, map
                     changes and how well each need is satisfied (effects).
* `repair`         - given knob values that break an ecological/legal limit,
                     return the closest values that respect it. The species
                     representative uses this to make counter-offers.

Strategies are generic: species-specific details (buffer distances, seasons,
known mitigation measures like "droppings board" or "bat boxes") come from the
Species data, never from code.
"""

import math
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from typing import Any

from shapely.geometry import LineString, Point

from app.models import MapFeature
from app.services import geo, seasons
from app.services.context import MediationContext, _as_date
from app.services.path_network import PathNetwork
from app.services.representative import format_months, lower_name, site_word

# --- data classes -----------------------------------------------------------------

@dataclass
class ParamSpec:
    name: str
    type: str  # number | integer | boolean | date | choice | text
    label: str
    unit: str | None = None
    minimum: float | None = None
    maximum: float | None = None
    choices: list[str] | None = None
    ecological_minimum: float | None = None
    description: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Draft:
    strategy: str
    title: str
    summary: str
    parameters: dict[str, Any]
    actions: list[dict[str, Any]] = field(default_factory=list)
    effects: dict[str, dict[str, Any]] = field(default_factory=dict)
    cost_eur: int = 0
    effort: str = "low"
    implementation_days: int = 1
    valid_months: list[int] = field(default_factory=list)
    legal_compliant: bool = True
    legal_notes: list[str] = field(default_factory=list)
    limit_violations: list[str] = field(default_factory=list)
    hard_violations: list[str] = field(default_factory=list)
    tradeoffs: list[str] = field(default_factory=list)
    map_features: list[dict[str, Any]] = field(default_factory=list)


def eff(satisfaction: float, reason: str) -> dict[str, Any]:
    return {"satisfaction": round(max(0.0, min(1.0, satisfaction)), 2), "reason": reason}


def need_keys(assessment: dict[str, Any]) -> set[str]:
    return {n["key"] for n in assessment["human_needs"] + assessment["wildlife_needs"]}


def baseline(assessment: dict[str, Any], key: str) -> float:
    for n in assessment["human_needs"] + assessment["wildlife_needs"]:
        if n["key"] == key:
            return float(n.get("baseline_satisfaction", 1.0))
    return 1.0


def budget_effect(ctx: MediationContext, cost: int) -> dict[str, Any] | None:
    budget = ctx.budget_eur
    if budget is None:
        return None
    if cost <= budget:
        return eff(1.0, f"{cost} EUR fits the {budget} EUR budget.")
    return eff(1 - (cost - budget) / max(budget, 1), f"{cost} EUR is over the {budget} EUR budget.")


def buffer_satisfaction(radius: float, preferred: float, minimum: float) -> float:
    if radius >= preferred:
        return 1.0
    if radius >= minimum:
        span = max(preferred - minimum, 1e-6)
        return 0.6 + 0.4 * (radius - minimum) / span
    return 0.3 * radius / max(minimum, 1e-6)


def _months_text(ctx: MediationContext) -> str:
    return format_months(ctx.species.sensitive_months)


def _feature(layer: str, name: str, geometry: dict[str, Any], ctx: MediationContext, **props: Any) -> dict[str, Any]:
    active = props.pop("active_months", None)
    replaces = props.pop("replaces_feature_id", None)
    species_specific = props.pop("species_specific", True)
    return {
        "layer": layer,
        "name": name,
        "geometry": geometry,
        "properties": props,
        "active_months": active,
        "replaces_feature_id": replaces,
        "species_id": ctx.species.id if species_specific else None,
    }


def _xy_to_lonlat_point(ctx: MediationContext, p: Point) -> dict[str, Any]:
    lon, lat = ctx.proj.to_lonlat(p.x, p.y)
    return geo.point(lon, lat)


def _network(ctx: MediationContext) -> PathNetwork:
    cached = ctx.__dict__.get("_network")
    if cached is None:
        cached = PathNetwork(ctx.network_features)
        ctx.__dict__["_network"] = cached
    return cached


def reroute_around(
    ctx: MediationContext,
    route: MapFeature,
    zone_lonlat_geojson: dict[str, Any],
    target: tuple[float, float] | None = None,
) -> dict[str, Any] | None:
    """Re-plan `route` so it avoids `zone`. Returns new coordinates and lengths."""
    coords = route.geometry["coordinates"]
    if route.geometry["type"] != "LineString" or len(coords) < 2:
        return None
    net = _network(ctx)
    zone_xy = net.proj.geom_to_xy(zone_lonlat_geojson)
    start, end = tuple(coords[0]), tuple(coords[-1])
    if target is not None:
        if zone_xy.contains(Point(net.proj.to_xy(*end))):
            end = target
        elif zone_xy.contains(Point(net.proj.to_xy(*start))):
            start = target
    result = net.shortest_path(start, end, avoid=[zone_xy], mode="block", layers={route.layer, "human_route"} if route.layer == "delivery_route" else {"human_route"})
    if result is None:
        result = net.shortest_path(start, end, avoid=[zone_xy], mode="penalize")
    if result is None or len(result.coordinates) < 2:
        return None
    old_len = geo.length_m(route.geometry)
    return {
        "coordinates": result.coordinates,
        "old_length_m": round(old_len, 1),
        "new_length_m": result.length_m,
        "extra_m": round(result.length_m - old_len, 1),
        "still_crosses_zone": result.blocked_edges_used > 0,
    }


# --- base class -------------------------------------------------------------------

class Strategy:
    key = "base"
    title = "Base"

    def applicable(self, ctx: MediationContext, a: dict[str, Any]) -> bool:
        raise NotImplementedError

    def param_specs(self, ctx: MediationContext) -> list[ParamSpec]:
        return []

    def default_params(self, ctx: MediationContext, a: dict[str, Any]) -> dict[str, Any]:
        return {}

    def build(self, ctx: MediationContext, a: dict[str, Any], p: dict[str, Any]) -> Draft:
        raise NotImplementedError

    def repair(self, ctx: MediationContext, a: dict[str, Any], p: dict[str, Any]) -> dict[str, Any] | None:
        """Closest parameters that respect ecological/legal limits (None = can't repair)."""
        return None

    def validate(self, ctx: MediationContext, changes: dict[str, Any]) -> dict[str, Any]:
        specs = {s.name: s for s in self.param_specs(ctx)}
        clean: dict[str, Any] = {}
        for name, value in changes.items():
            spec = specs.get(name)
            if spec is None:
                raise ValueError(f"'{name}' is not negotiable for this solution. Options: {sorted(specs)}")
            clean[name] = _coerce(spec, value)
        return clean


def _coerce(spec: ParamSpec, value: Any) -> Any:
    try:
        if spec.type == "number":
            v: Any = float(value)
        elif spec.type == "integer":
            v = int(value)
        elif spec.type == "boolean":
            if isinstance(value, str):
                v = value.strip().lower() in {"1", "true", "yes", "on"}
            else:
                v = bool(value)
        elif spec.type == "date":
            v = _as_date(value).isoformat()  # type: ignore[union-attr]
        elif spec.type == "choice":
            v = str(value)
            if spec.choices and v not in spec.choices:
                raise ValueError(f"must be one of {spec.choices}")
        else:
            v = str(value)
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValueError(f"Invalid value for '{spec.name}': {exc}") from exc
    if spec.type in ("number", "integer"):
        if spec.minimum is not None and v < spec.minimum:
            raise ValueError(f"'{spec.name}' must be at least {spec.minimum}")
        if spec.maximum is not None and v > spec.maximum:
            raise ValueError(f"'{spec.name}' must be at most {spec.maximum}")
    return v


# --- 1. Seasonal quiet zone (+ detours) -------------------------------------------------

class SeasonalQuietZone(Strategy):
    key = "seasonal_quiet_zone"
    title = "Seasonal quiet zone with detours"

    def applicable(self, ctx, a):
        sp = ctx.spatial
        return bool(sp["entrances_in_buffer"] or sp["routes_in_buffer"]) or ctx.activity_type == "space_use"

    def param_specs(self, ctx):
        s = ctx.species
        return [
            ParamSpec("radius_m", "number", "Quiet zone radius", "m", 0.5, 200, ecological_minimum=s.min_buffer_m,
                      description="How far people stay away from the site during the sensitive season."),
            ParamSpec("use_alternative_entrance", "boolean", "Use the alternative entrance"),
            ParamSpec("add_temporary_ramp", "boolean", "Add a temporary ramp at the alternative entrance"),
        ]

    def default_params(self, ctx, a):
        sp = ctx.spatial
        used = sp.get("used_entrance")
        alts = sp.get("alternative_entrances") or []
        use_alt = bool(alts and used and used["distance_m"] < sp["buffer_m"])
        needs_ramp = use_alt and not alts[0].get("step_free", True)
        return {
            "radius_m": ctx.species.preferred_buffer_m,
            "use_alternative_entrance": use_alt,
            "add_temporary_ramp": bool(needs_ramp and "step_free_access" in need_keys(a)),
        }

    def repair(self, ctx, a, p):
        fixed = dict(p)
        fixed["radius_m"] = max(float(p.get("radius_m", 0)), ctx.species.min_buffer_m)
        return fixed

    def build(self, ctx, a, p):
        s, sp = ctx.species, ctx.spatial
        r = float(p["radius_m"])
        site = site_word(s)
        months = s.sensitive_months
        mtext = _months_text(ctx)
        keys = need_keys(a)
        draft = Draft(self.key, f"{r:g} m seasonal quiet zone around the {site}", "", dict(p), valid_months=list(months))

        zone = geo.circle(*ctx.site_lonlat, r)
        draft.map_features.append(
            _feature("ecological_buffer", f"Seasonal quiet zone ({r:g} m)", zone, ctx,
                     radius_m=r, kind="quiet_zone", active_months=list(months))
        )

        alts = sp.get("alternative_entrances") or []
        alt = alts[0] if (p.get("use_alternative_entrance") and alts) else None
        alt_lonlat = None
        if alt:
            alt_feature = next((f for f in ctx.features if str(f.id) == alt["id"]), None)
            alt_lonlat = tuple(alt_feature.geometry["coordinates"]) if alt_feature else None

        zone_xy = ctx.site_point_xy.buffer(r)
        extra_human, extra_delivery = 0.0, 0.0
        rerouted = 0
        for n in ctx.journeys("human_route", "delivery_route"):
            if not ctx.xy(n.feature).intersects(zone_xy):
                continue
            result = reroute_around(ctx, n.feature, zone, target=alt_lonlat)
            if result is None:
                draft.tradeoffs.append(f"{n.feature.name} could not be rerouted; people should pass quickly without stopping.")
                continue
            rerouted += 1
            if n.feature.layer == "delivery_route":
                extra_delivery = max(extra_delivery, result["extra_m"])
            else:
                extra_human = max(extra_human, result["extra_m"])
            draft.map_features.append(
                _feature(
                    n.feature.layer, f"{n.feature.name} (seasonal detour)",
                    {"type": "LineString", "coordinates": result["coordinates"]}, ctx,
                    replaces_feature_id=n.feature.id, active_months=list(months), species_specific=False,
                    kind="journey", detour_m=result["extra_m"], original_length_m=result["old_length_m"],
                    new_length_m=result["new_length_m"], animate=True,
                    operating_hours=(n.feature.properties or {}).get("operating_hours"),
                )
            )
            if n.feature.layer == "delivery_route":
                draft.actions.append({"party": "delivery_operator", "action": f"Switch to the seasonal route for '{n.feature.name}' (+{result['extra_m']:.0f} m).", "when": mtext})

        fence_cost = min(1500, int(2 * math.pi * r * 3))
        cost = 120 + fence_cost + 50 * rerouted
        draft.actions.insert(0, {"party": "building_manager", "action": f"Mark a {r:g} m quiet zone around the {site} with signs and a living rope fence.", "when": mtext, "cost_eur": 120 + fence_cost})
        used = sp.get("used_entrance") or {}
        if alt:
            draft.actions.append({"party": "residents", "action": f"Use {alt['name']} instead of {used.get('name', 'the usual entrance')}.", "when": mtext})
            if not alt.get("step_free", True):
                if p.get("add_temporary_ramp"):
                    cost += 600
                    draft.actions.append({"party": "building_manager", "action": f"Install a temporary ramp at {alt['name']}.", "when": "before the quiet zone starts", "cost_eur": 600})
                elif "step_free_access" in keys:
                    draft.hard_violations.append(f"{alt['name']} is not step-free and no ramp is planned, but the resident needs step-free access.")
        end = seasons.end_of_season(months, ctx.today)
        draft.actions.append({"party": "building_manager", "action": "Remove the signs and fence when the season ends.", "when": end.isoformat() if end else "end of season"})

        # Effects ---------------------------------------------------------------
        e = draft.effects
        b_sat = buffer_satisfaction(r, s.preferred_buffer_m, s.min_buffer_m)
        e["undisturbed_site"] = eff(b_sat, f"A {r:g} m zone vs {s.preferred_buffer_m:g} m preferred / {s.min_buffer_m:g} m minimum.")
        e["site_access"] = eff(1.0 if r >= s.min_buffer_m else 0.4, "Nobody lingers near the way in." if r >= s.min_buffer_m else "Zone is too small to keep the way in clear.")
        works_inside = ctx.is_works and sp["activity_distance_m"] < r
        if ctx.is_works:
            if works_inside:
                e["seasonal_quiet"] = eff(0.9, "Works inside the zone must wait until the season ends.")
                e["works_schedule"] = eff(0.35, "Works inside the zone are paused until the end of the season.")
        else:
            e["seasonal_quiet"] = eff(0.85, "Daily activity moves away from the site for the whole season.")
        if "low_noise" in keys:
            e["low_noise"] = eff(0.8, "Footsteps and chatter stay outside the zone.")
        if "access_route" in keys:
            if alt:
                e["access_route"] = eff(max(0.35, 1 - extra_human / 250), f"Detour of about {extra_human:.0f} m via {alt['name']}.")
            elif rerouted:
                e["access_route"] = eff(max(0.4, 1 - extra_human / 250), f"Detour of about {extra_human:.0f} m.")
            else:
                e["access_route"] = eff(0.5, "No alternative: people may pass but must not stop near the site.")
        if "delivery_access" in keys:
            e["delivery_access"] = eff(max(0.4, 1 - extra_delivery / 400) if extra_delivery else 0.9, f"Delivery detour of about {extra_delivery:.0f} m.")
        if "step_free_access" in keys and alt and not alt.get("step_free", True):
            e["step_free_access"] = eff(0.85, "A temporary ramp keeps the new entrance step-free.") if p.get("add_temporary_ramp") else eff(0.0, f"{alt['name']} has steps.")
        if "nuisance_free" in keys:
            e["nuisance_free"] = eff(0.9 if (alt or rerouted) else 0.6, "People no longer walk under the site." if (alt or rerouted) else "People still pass close by.")
        for k in ("peace_of_mind", "sting_safety"):
            if k in keys:
                e[k] = eff(0.85, "The zone keeps a comfortable distance.")
        if "space_use" in keys:
            e["space_use"] = eff(0.6, f"About {math.pi * r * r:.0f} m² of space is off-limits during {mtext}.")
        if (be := budget_effect(ctx, cost)) and "budget_limit" in keys:
            e["budget_limit"] = be

        if r < s.min_buffer_m:
            draft.limit_violations.append(f"A {r:g} m zone is below the {s.min_buffer_m:g} m minimum for the {lower_name(s)} during {mtext}.")
            if s.is_legally_protected:
                draft.legal_compliant = False
                draft.legal_notes.append(f"Disturbing an active {site} of a protected species: {s.legal_protection}")
        draft.cost_eur = cost
        draft.effort = "low"
        draft.implementation_days = 2
        draft.summary = (
            f"Keep people at least {r:g} m from the {site} during {mtext}."
            + (f" Residents use {alt['name']} for the season." if alt else "")
            + (f" {rerouted} route(s) get a seasonal detour." if rerouted else "")
        )
        if extra_human:
            draft.tradeoffs.append(f"Residents walk about {extra_human:.0f} m further.")
        return draft


# --- 2. Screens, boards and sharing --------------------------------------------------------

class ScreenMitigation(Strategy):
    key = "screen_mitigation"
    title = "Physical screen or shared-space measure"

    def _measures(self, ctx):
        return [m for m in ctx.species.mitigations if m.get("type") in ("screen", "sharing")]

    def applicable(self, ctx, a):
        sp = ctx.spatial
        close = sp["activity_distance_m"] < max(ctx.species.preferred_buffer_m * 4, 6)
        return bool(self._measures(ctx)) and bool(sp["entrances_in_buffer"] or sp["routes_in_buffer"] or close)

    def param_specs(self, ctx):
        s = ctx.species
        return [
            ParamSpec("measure", "choice", "Measure", choices=[m["key"] for m in self._measures(ctx)]),
            ParamSpec("radius_m", "number", "Reduced quiet zone radius", "m", 0.3, 200, ecological_minimum=s.min_buffer_m),
            ParamSpec("include_hygiene", "boolean", "Add hygiene measures (bins, cleaning)"),
            ParamSpec("include_habitat_boost", "boolean", "Add a small habitat boost (flowers, mud puddle)"),
        ]

    def default_params(self, ctx, a):
        s = ctx.species
        measures = self._measures(ctx)
        keys = need_keys(a)
        chosen = None
        if "nuisance_free" in keys:
            chosen = next((m for m in measures if m.get("solves_nuisance") in s.nuisances), None)
        chosen = chosen or max(measures, key=lambda m: m.get("buffer_reduction", 0.3))
        reduction = chosen.get("buffer_reduction", 0.3)
        hygiene = any(m.get("type") == "hygiene" for m in s.mitigations) and "nuisance_free" in keys
        habitat = any(m.get("type") == "habitat" for m in s.mitigations)
        return {
            "measure": chosen["key"],
            "radius_m": round(max(s.min_buffer_m, s.preferred_buffer_m * (1 - reduction)), 1),
            "include_hygiene": hygiene,
            "include_habitat_boost": habitat,
        }

    def repair(self, ctx, a, p):
        fixed = dict(p)
        fixed["radius_m"] = max(float(p.get("radius_m", 0)), ctx.species.min_buffer_m)
        return fixed

    def build(self, ctx, a, p):
        s, sp = ctx.species, ctx.spatial
        keys = need_keys(a)
        measures = {m["key"]: m for m in self._measures(ctx)}
        m = measures.get(p.get("measure")) or next(iter(measures.values()))
        r = float(p["radius_m"])
        site = site_word(s)
        mtext = _months_text(ctx)
        reduction = m.get("buffer_reduction", 0.3)
        target_r = max(s.min_buffer_m, s.preferred_buffer_m * (1 - reduction))
        draft = Draft(self.key, f"{m['label']} + {r:g} m zone", "", dict(p), valid_months=list(s.sensitive_months))

        # Where does the human side touch the site? Put the screen between them.
        S = ctx.site_point_xy
        human_geoms = [ctx.xy(n.feature) for n in ctx.layer("entrance")[:1]] + [
            ctx.xy(n.feature) for n in ctx.journeys("human_route", "delivery_route")[:1]
        ]
        P = ctx.activity_point_xy
        if human_geoms:
            nearest = min(human_geoms, key=lambda g: g.distance(S))
            if nearest.distance(S) < P.distance(S) or P.distance(S) < 0.5:
                P = nearest.interpolate(nearest.project(S)) if nearest.geom_type == "LineString" else nearest.centroid
        dx, dy = P.x - S.x, P.y - S.y
        dist = math.hypot(dx, dy)
        if dist < 0.3:
            dx, dy, dist = 0.0, -1.0, 1.0
        ux, uy = dx / dist, dy / dist
        mid = Point(S.x + ux * min(dist * 0.5, max(r, 0.5)), S.y + uy * min(dist * 0.5, max(r, 0.5)))
        half = min(max(r, 1.0), 15.0)
        barrier = LineString([(mid.x - uy * half, mid.y + ux * half), (mid.x + uy * half, mid.y - ux * half)])
        draft.map_features.append(
            _feature("barrier", m["label"], ctx.proj.xy_to_geojson(barrier), ctx, measure=m["key"], active_months=list(s.sensitive_months))
        )
        draft.map_features.append(
            _feature("ecological_buffer", f"Reduced quiet zone ({r:g} m)", geo.circle(*ctx.site_lonlat, r), ctx,
                     radius_m=r, kind="reduced_zone", active_months=list(s.sensitive_months))
        )
        cost = int(m.get("cost_eur", 0))
        draft.actions.append({"party": "building_manager", "action": f"Install: {m['label']}. {m.get('description', '')}".strip(), "when": "as soon as possible", "cost_eur": cost})
        draft.actions.append({"party": "residents", "action": f"Keep using the usual space, but stay {r:g} m from the {site} during {mtext}.", "when": mtext})

        solves_nuisance = bool(m.get("solves_nuisance"))
        if p.get("include_hygiene"):
            for h in (x for x in s.mitigations if x.get("type") == "hygiene"):
                cost += int(h.get("cost_eur", 0))
                solves_nuisance = solves_nuisance or bool(h.get("solves_nuisance"))
                draft.actions.append({"party": "residents", "action": h["label"], "when": "now", "cost_eur": h.get("cost_eur", 0)})
                draft.map_features.append(_feature("intervention", h["label"], _xy_to_lonlat_point(ctx, ctx.activity_point_xy), ctx, emoji="🗑️", measure=h["key"]))
        boost = None
        if p.get("include_habitat_boost"):
            boost = next((x for x in s.mitigations if x.get("type") == "habitat"), None)
            if boost:
                cost += int(boost.get("cost_eur", 0))
                spot = Point(S.x - ux * max(r * 2, 3), S.y - uy * max(r * 2, 3))
                draft.map_features.append(_feature("intervention", boost["label"], _xy_to_lonlat_point(ctx, spot), ctx, emoji="🌼", measure=boost["key"]))
                draft.actions.append({"party": "residents", "action": boost["label"], "when": "now", "cost_eur": boost.get("cost_eur", 0)})

        e = draft.effects
        if r >= s.min_buffer_m:
            sat = 0.95 if r >= target_r else 0.75 + 0.2 * (r - s.min_buffer_m) / max(target_r - s.min_buffer_m, 1e-6)
        else:
            sat = 0.3 * r / max(s.min_buffer_m, 1e-6)
        e["undisturbed_site"] = eff(sat, f"The {m['label'].lower()} replaces part of the distance: {r:g} m is enough with it.")
        e["site_access"] = eff(0.9 if r >= s.min_buffer_m else 0.4, "The way in stays open.")
        if ctx.is_works:
            far_enough = sp["activity_distance_m"] >= r
            e["seasonal_quiet"] = eff(0.65 if far_enough else 0.5, "Works go on in season, but screened and kept at a distance.")
            e["works_schedule"] = eff(0.85 if far_enough else 0.6, "Works continue on schedule" + ("." if far_enough else ", but only on the parts outside the zone."))
        else:
            e["seasonal_quiet"] = eff(0.8, "Daily life continues, shielded by the measure.")
        if "low_noise" in keys:
            e["low_noise"] = eff(0.7, "The screen softens noise and movement.")
        if "access_route" in keys:
            e["access_route"] = eff(0.95, "Residents keep using their usual entrance.")
        if "step_free_access" in keys:
            e["step_free_access"] = eff(1.0, "The usual step-free entrance stays in use.")
        if "delivery_access" in keys:
            e["delivery_access"] = eff(0.95, "Deliveries keep their route.")
        if "nuisance_free" in keys:
            e["nuisance_free"] = eff(0.95 if solves_nuisance else 0.65, "The measure deals with the nuisance directly." if solves_nuisance else "The nuisance is reduced, not removed.")
        if "sting_safety" in keys:
            e["sting_safety"] = eff(0.75, "The planter screen keeps bees' flight line away from people.")
        if "peace_of_mind" in keys:
            e["peace_of_mind"] = eff(0.8, "A visible screen makes the boundary clear.")
        if "space_use" in keys:
            e["space_use"] = eff(0.85 if m.get("type") == "sharing" else 0.8, "Most of the space stays usable.")
        if "foraging_habitat" in keys and boost:
            e["foraging_habitat"] = eff(1.0, f"{boost['label']} adds resources close to home.")
        if "green_living" in keys:
            e["green_living"] = eff(1.0, "More plants and greenery.")
        if (be := budget_effect(ctx, cost)) and "budget_limit" in keys:
            e["budget_limit"] = be

        if r < s.min_buffer_m:
            draft.limit_violations.append(f"{r:g} m is below the {s.min_buffer_m:g} m minimum, even with a screen.")
            if s.is_legally_protected:
                draft.legal_compliant = False
                draft.legal_notes.append(s.legal_protection)
        draft.cost_eur = cost
        draft.effort = m.get("effort", "low")
        draft.implementation_days = int(m.get("implementation_days", 1))
        draft.summary = f"{m['label']}: humans keep their space, the {lower_name(s)} keeps {r:g} m of calm during {mtext}."
        draft.tradeoffs.append("Relies on the measure being installed and maintained properly.")
        return draft


# --- 3. Move the works to a safe window ---------------------------------------------------

class ScheduleShift(Strategy):
    key = "schedule_shift"
    title = "Move the works outside the sensitive season"

    def applicable(self, ctx, a):
        return bool(ctx.is_works and ctx.planned_start and ctx.planned_end)

    def param_specs(self, ctx):
        return [
            ParamSpec("new_start", "date", "New start date"),
            ParamSpec("duration_days", "integer", "Duration", "days", 1, 365),
            ParamSpec("ecologist_check", "boolean", "Ecologist check before works start"),
        ]

    def _duration(self, ctx):
        return (ctx.planned_end - ctx.planned_start).days + 1

    def default_params(self, ctx, a):
        duration = self._duration(ctx)
        start = seasons.next_window_outside(ctx.species.sensitive_months, max(ctx.planned_start, ctx.today), duration)
        return {
            "new_start": (start or ctx.planned_start).isoformat(),
            "duration_days": duration,
            "ecologist_check": ctx.species.is_legally_protected,
        }

    def repair(self, ctx, a, p):
        fixed = dict(p)
        duration = int(p.get("duration_days") or self._duration(ctx))
        requested = max(_as_date(p.get("new_start")) or ctx.today, ctx.today)
        start = seasons.next_window_outside(ctx.species.sensitive_months, requested, duration)
        if start is None:
            return None
        fixed["new_start"] = start.isoformat()
        return fixed

    def build(self, ctx, a, p):
        s = ctx.species
        keys = need_keys(a)
        duration = int(p.get("duration_days") or self._duration(ctx))
        start = _as_date(p["new_start"])
        end = start + timedelta(days=duration - 1)
        frac = seasons.overlap_fraction(start, end, s.sensitive_months)
        delay = (start - ctx.planned_start).days
        flex_days = ctx.flexibility_weeks * 7
        activity = ctx.activity.get("description") or ctx.activity_type.replace("_", " ")
        draft = Draft(self.key, f"Do the {activity} from {start:%d %b} to {end:%d %b %Y}", "", dict(p),
                      valid_months=seasons.months_between(ctx.today, end))

        if delay <= 0:
            sched = eff(1.0, "No delay.")
        elif delay <= flex_days:
            sched = eff(1 - 0.3 * delay / max(flex_days, 1), f"{delay // 7} weeks later, within the {ctx.flexibility_weeks}-week flexibility.")
        else:
            sched = eff(max(0.15, 0.65 - 0.004 * (delay - flex_days)), f"{delay // 7} weeks later, beyond the {ctx.flexibility_weeks}-week flexibility.")
        e = draft.effects
        e["works_schedule"] = sched
        e["seasonal_quiet"] = eff(1 - frac, f"{frac:.0%} of the works fall in the sensitive season ({_months_text(ctx)}).")
        e["undisturbed_site"] = eff(1 - 0.9 * frac, "Works happen when the site is not in sensitive use." if frac == 0 else "Part of the works still overlaps the sensitive season.")
        e["site_access"] = eff(1 - 0.5 * frac, "Access to the site is untouched during the season.")
        if "low_noise" in keys:
            e["low_noise"] = eff(1 - 0.8 * frac, "Noise happens outside the sensitive months.")

        cost = 50
        draft.actions.append({"party": "reporter", "action": f"Reschedule the {activity} to {start} - {end}.", "when": "now", "cost_eur": 50})
        draft.actions.append({"party": "contractor", "action": "Confirm the new dates and keep the site untouched until then.", "when": "within 2 weeks"})
        if p.get("ecologist_check"):
            cost += 300
            draft.actions.append({"party": "ecologist", "action": f"Check the {site_word(s)} is no longer in sensitive use.", "when": (start - timedelta(days=7)).isoformat(), "cost_eur": 300})
        if (be := budget_effect(ctx, cost)) and "budget_limit" in keys:
            e["budget_limit"] = be

        draft.map_features.append(
            _feature("intervention", f"Works window: {start:%d %b} - {end:%d %b %Y}", geo.point(*ctx.activity_lonlat), ctx,
                     emoji="📅", window_start=start.isoformat(), window_end=end.isoformat())
        )
        if start < ctx.today:
            draft.limit_violations.append("The new start date is in the past.")
        if frac > 0:
            draft.limit_violations.append(f"{frac:.0%} of the works still fall in {_months_text(ctx)}.")
            if s.is_legally_protected:
                draft.legal_compliant = False
                draft.legal_notes.append(s.legal_protection)
        draft.cost_eur = cost
        draft.effort = "low"
        draft.implementation_days = 1
        draft.summary = f"Start the works on {start} instead of {ctx.planned_start} ({max(delay, 0) // 7} weeks later), when the {lower_name(s)} is not in its sensitive season."
        if delay > flex_days:
            draft.tradeoffs.append(f"The delay ({delay // 7} weeks) is longer than the {ctx.flexibility_weeks} weeks of flexibility.")
        return draft


# --- 4. Alternative habitat ---------------------------------------------------------------

class AlternativeHabitat(Strategy):
    key = "alternative_habitat"
    title = "Offer an alternative home nearby"

    def _measures(self, ctx):
        return [m for m in ctx.species.mitigations if m.get("type") == "alt_habitat"]

    def applicable(self, ctx, a):
        sp = ctx.spatial
        return bool(self._measures(ctx)) and bool(
            ctx.is_works or sp["entrances_in_buffer"] or sp["routes_in_buffer"] or ctx.activity_type == "space_use"
        )

    def param_specs(self, ctx):
        specs = [
            ParamSpec("measure", "choice", "Alternative home", choices=[m["key"] for m in self._measures(ctx)]),
            ParamSpec("distance_m", "number", "Distance from the current site", "m", 2, 300),
        ]
        if ctx.is_works:
            specs.append(ParamSpec("works_after", "date", "Works allowed from"))
        return specs

    def _season_end(self, ctx) -> date:
        end = seasons.end_of_season(ctx.species.sensitive_months, ctx.today if ctx.in_season else (ctx.planned_start or ctx.today))
        return end or ctx.today

    def default_params(self, ctx, a):
        measures = self._measures(ctx)
        best = max(measures, key=lambda m: m.get("uptake", 0.5))
        p: dict[str, Any] = {"measure": best["key"], "distance_m": round(max(ctx.species.preferred_buffer_m * 3, 15), 1)}
        if ctx.is_works:
            start = max(self._season_end(ctx) + timedelta(days=1), ctx.planned_start or ctx.today)
            # Prefer a window that also avoids the next sensitive run.
            duration = (ctx.planned_end - ctx.planned_start).days + 1 if ctx.planned_start and ctx.planned_end else 7
            p["works_after"] = (seasons.next_window_outside(ctx.species.sensitive_months, start, duration) or start).isoformat()
        return p

    def repair(self, ctx, a, p):
        if not ctx.is_works:
            return dict(p)
        fixed = dict(p)
        requested = _as_date(p.get("works_after")) or ctx.today
        duration = (ctx.planned_end - ctx.planned_start).days + 1 if ctx.planned_start and ctx.planned_end else 7
        start = seasons.next_window_outside(ctx.species.sensitive_months, max(requested, ctx.today), duration)
        if start is None:
            return None
        fixed["works_after"] = start.isoformat()
        return fixed

    def build(self, ctx, a, p):
        s = ctx.species
        keys = need_keys(a)
        measures = {m["key"]: m for m in self._measures(ctx)}
        m = measures.get(p.get("measure")) or next(iter(measures.values()))
        uptake = float(m.get("uptake", 0.5))
        site = site_word(s)
        distance = float(p["distance_m"])
        mtext = _months_text(ctx)
        draft = Draft(self.key, f"{m['label']} + keep the current {site} until the season ends", "", dict(p))

        # Place the new home on the far side of the site, away from the human activity.
        S, A = ctx.site_point_xy, ctx.activity_point_xy
        vx, vy = S.x - A.x, S.y - A.y
        norm = math.hypot(vx, vy)
        if norm < 1.0:
            habitats = [f for f in ctx.features if f.layer == "habitat_zone"]
            if habitats:
                c = ctx.xy(min(habitats, key=lambda f: ctx.xy(f).distance(S))).centroid
                vx, vy = c.x - S.x, c.y - S.y
                norm = math.hypot(vx, vy) or 1.0
            else:
                vx, vy, norm = 1.0, 0.0, 1.0
        new = Point(S.x + vx / norm * distance, S.y + vy / norm * distance)
        new_geo = _xy_to_lonlat_point(ctx, new)
        install_on = _next_month_date(ctx.today, m.get("install_months") or list(range(1, 13)))
        draft.map_features.append(_feature("intervention", m["label"], new_geo, ctx, emoji="🏡", measure=m["key"], install_from=install_on.isoformat()))
        draft.map_features.append(
            _feature("wildlife_corridor", f"Moving route to the new {site}", {"type": "LineString", "coordinates": [list(ctx.site_lonlat), new_geo["coordinates"]]}, ctx,
                     kind="relocation_path", animate=True)
        )
        cost = int(m.get("cost_eur", 0))
        draft.actions.append({"party": "building_manager", "action": f"{m['label']} about {distance:.0f} m away. {m.get('description', '')}".strip(), "when": f"from {install_on}", "cost_eur": cost})
        draft.actions.append({"party": "residents", "action": f"Leave the current {site} untouched while it is in use.", "when": mtext})
        if m.get("legal_note"):
            draft.legal_notes.append(m["legal_note"])
        if s.is_legally_protected:
            cost += 300
            draft.actions.append({"party": "ecologist", "action": f"Advise on placement and confirm the old {site} is empty before any change.", "when": "before works", "cost_eur": 300})
        if install_on > ctx.today + timedelta(days=30):
            draft.tradeoffs.append(f"The new home can only be installed from {install_on} ({m.get('timing_note', 'timing rule')}).")
        draft.tradeoffs.append(f"Animals might not move in: expected uptake about {uptake:.0%}.")

        e = draft.effects
        season_end = self._season_end(ctx)
        if ctx.is_works:
            works_after = _as_date(p.get("works_after")) or season_end + timedelta(days=1)
            duration = (ctx.planned_end - ctx.planned_start).days + 1
            frac = seasons.overlap_fraction(works_after, works_after + timedelta(days=duration - 1), s.sensitive_months)
            delay = (works_after - ctx.planned_start).days
            flex = ctx.flexibility_weeks * 7
            e["works_schedule"] = eff(1.0 if delay <= 0 else (1 - 0.3 * delay / max(flex, 1)) if delay <= flex else max(0.15, 0.65 - 0.004 * (delay - flex)),
                                      f"Works start on {works_after} ({max(delay, 0) // 7} weeks later).")
            e["seasonal_quiet"] = eff(1 - frac, "Works wait for the end of the season." if frac == 0 else f"{frac:.0%} of the works overlap the season.")
            e["undisturbed_site"] = eff((0.85 if frac == 0 else 0.3) * (0.85 + 0.15 * uptake), "The current site is kept until the season ends, then a new home is ready.")
            draft.valid_months = seasons.months_between(ctx.today, works_after + timedelta(days=duration))
            draft.map_features.append(_feature("intervention", f"Works allowed from {works_after:%d %b %Y}", geo.point(*ctx.activity_lonlat), ctx, emoji="📅"))
            if frac > 0:
                draft.limit_violations.append(f"Works overlap the sensitive season ({mtext}).")
                if s.is_legally_protected:
                    draft.legal_compliant = False
                    draft.legal_notes.append(s.legal_protection)
        else:
            e["undisturbed_site"] = eff(0.7 + 0.1 * uptake, "The current site is kept this season; the new home helps next season.")
            e["seasonal_quiet"] = eff(min(1.0, baseline(a, "seasonal_quiet") + 0.2), "Pressure on the current site drops as soon as the new home is used.")
            draft.valid_months = seasons.months_between(ctx.today, (seasons.next_season_start(s.sensitive_months, ctx.today) or ctx.today + timedelta(days=300)))
        e["site_access"] = eff(0.8, "Access to the current site stays open.")
        for k, reason in (
            ("access_route", "Same entrance this season, likely conflict-free next season."),
            ("nuisance_free", "Fewer nuisances once the animals use the new home."),
            ("space_use", "Space comes back once the animals move."),
            ("sting_safety", "Bees end up further away after the move."),
            ("peace_of_mind", "Animals end up further away after the move."),
        ):
            if k in keys:
                e[k] = eff(0.55 + 0.35 * uptake, reason)
        if "green_living" in keys:
            e["green_living"] = eff(1.0, "A new wildlife home in the neighbourhood.")
        if (be := budget_effect(ctx, cost)) and "budget_limit" in keys:
            e["budget_limit"] = be

        draft.cost_eur = cost
        draft.effort = m.get("effort", "low")
        draft.implementation_days = int(m.get("implementation_days", 1))
        draft.summary = f"Keep the current {site} safe until the season ends, and offer a {m['label'].lower()} about {distance:.0f} m away for the future."
        return draft


def _next_month_date(today: date, months: list[int]) -> date:
    day = today
    for _ in range(400):
        if day.month in months:
            return day
        day = date(day.year + (day.month // 12), day.month % 12 + 1, 1)
    return today


# --- 5. Dark corridor (lighting) ------------------------------------------------------------

class DarkCorridor(Strategy):
    key = "dark_corridor"
    title = "Wildlife-friendly lighting"

    def applicable(self, ctx, a):
        return ctx.species.light_sensitivity >= 3 and bool(ctx.spatial["lit_routes_nearby"] or "night_lighting" in need_keys(a))

    def param_specs(self, ctx):
        return [
            ParamSpec("dim_percent", "integer", "Dim lights by", "%", 0, 90),
            ParamSpec("color_temperature_k", "choice", "Light colour", "K", choices=["1800", "2200", "2700", "3000", "4000"]),
            ParamSpec("motion_sensors", "boolean", "Motion sensors (light only when someone passes)"),
            ParamSpec("curfew", "text", "Lights-off hours", description="For example 23:00-06:00"),
        ]

    def default_params(self, ctx, a):
        return {"dim_percent": 70, "color_temperature_k": "2200", "motion_sensors": True, "curfew": "23:00-06:00"}

    def repair(self, ctx, a, p):
        fixed = dict(p)
        fixed["dim_percent"] = max(int(p.get("dim_percent", 0)), 50)
        return fixed

    def build(self, ctx, a, p):
        s = ctx.species
        keys = need_keys(a)
        dim = int(p["dim_percent"])
        cct = int(p["color_temperature_k"])
        sensors = bool(p["motion_sensors"])
        draft = Draft(self.key, f"Amber {cct} K lights dimmed {dim}% near the {site_word(s)}", "", dict(p), valid_months=list(s.active_months))
        lamps = 0
        S = ctx.site_point_xy
        for route in [n for n in ctx.layer("human_route", "delivery_route") if (n.feature.properties or {}).get("lighting") == "bright" and n.distance_m <= 45]:
            line = ctx.xy(route.feature)
            if line.geom_type != "LineString":
                continue
            at = line.project(S)
            for offset in (-15, 0, 15):
                pos = min(max(at + offset, 0), line.length)
                pt = line.interpolate(pos)
                draft.map_features.append(_feature("intervention", "Amber dimmed lamp", _xy_to_lonlat_point(ctx, pt), ctx, emoji="💡", color_temperature_k=cct, dim_percent=dim, species_specific=False))
                lamps += 1
        lamps = max(lamps, 2)
        draft.map_features.append(
            _feature("ecological_buffer", "Dark zone", geo.circle(*ctx.site_lonlat, 40), ctx, kind="dark_zone", radius_m=40, active_months=list(s.active_months))
        )
        unit = next((int(m.get("cost_eur", 350)) for m in s.mitigations if m.get("type") == "lighting"), 350)
        cost = unit * lamps // 2  # the mitigation cost covers a pair of lamps
        draft.actions.append({"party": "building_manager", "action": f"Replace {lamps} lamps with {cct} K amber, downward-facing lights dimmed {dim}%" + (" with motion sensors." if sensors else "."), "when": "within a month", "cost_eur": cost})
        draft.actions.append({"party": "residents", "action": f"Lights off during {p.get('curfew', '23:00-06:00')} except on motion.", "when": format_months(s.active_months)})
        e = draft.effects
        warm = 0.15 if cct <= 2200 else 0.08 if cct <= 2700 else 0.0
        e["dark_skies"] = eff(0.25 + 0.55 * dim / 90 + warm, f"{dim}% dimmer, {cct} K light.")
        if "night_lighting" in keys:
            e["night_lighting"] = eff(0.9 if sensors else max(0.3, 1 - dim / 100), "Motion sensors still light the way when someone walks by." if sensors else "Paths are darker.")
        if "peace_of_mind" in keys and sensors:
            e["peace_of_mind"] = eff(0.85, "Lights react when someone is there.")
        if (be := budget_effect(ctx, cost)) and "budget_limit" in keys:
            e["budget_limit"] = be
        if dim < 30:
            draft.limit_violations.append("Lights dimmed less than 30% barely help a light-sensitive species.")
        draft.cost_eur = cost
        draft.effort = "medium"
        draft.implementation_days = 3
        draft.summary = f"Make nights darker where the {lower_name(s)} lives and commutes, while motion sensors keep people safe."
        draft.tradeoffs.append("Only fixes the lighting part of the conflict.")
        return draft


# --- 6. Safe passage ---------------------------------------------------------------------

class SafePassage(Strategy):
    key = "safe_passage"
    title = "Safe crossings for moving wildlife"

    def applicable(self, ctx, a):
        return ctx.species.movement_mode == "ground" and bool(ctx.spatial["corridor_crossings"])

    def param_specs(self, ctx):
        return [
            ParamSpec("speed_limit_kmh", "number", "Night speed limit at crossings", "km/h", 3, 30),
            ParamSpec("night_hours", "text", "Night hours", description="For example 21:00-06:00"),
            ParamSpec("fence_gaps", "boolean", "Add 13 x 13 cm fence gaps"),
            ParamSpec("crossing_tunnel", "boolean", "Build a small wildlife tunnel"),
            ParamSpec("reroute_night_deliveries", "boolean", "Reroute night deliveries away from crossings"),
        ]

    def default_params(self, ctx, a):
        return {"speed_limit_kmh": 10.0, "night_hours": "21:00-06:00", "fence_gaps": True, "crossing_tunnel": False, "reroute_night_deliveries": False}

    def repair(self, ctx, a, p):
        fixed = dict(p)
        fixed["speed_limit_kmh"] = min(float(p.get("speed_limit_kmh", 10)), 15.0)
        return fixed

    def build(self, ctx, a, p):
        s, sp = ctx.species, ctx.spatial
        keys = need_keys(a)
        speed = float(p["speed_limit_kmh"])
        draft = Draft(self.key, f"Night slow zones ({speed:g} km/h) at wildlife crossings", "", dict(p), valid_months=list(s.active_months))
        zones = []
        for c in sp["corridor_crossings"]:
            zone = geo.circle(c["lon"], c["lat"], 25)
            zones.append(zone)
            draft.map_features.append(_feature("intervention", f"{s.common_name} crossing", geo.point(c["lon"], c["lat"]), ctx, emoji="🚸", route=c["route_name"]))
            draft.map_features.append(_feature("ecological_buffer", f"Night slow zone ({speed:g} km/h)", zone, ctx, kind="slow_zone", speed_limit_kmh=speed, hours=p.get("night_hours"), active_months=list(s.active_months)))
        measure = next((m for m in s.mitigations if m.get("key") == "night_slow_zone"), {"cost_eur": 200})
        cost = int(measure.get("cost_eur", 200))
        draft.actions.append({"party": "delivery_operator", "action": f"Limit robots and cargo bikes to {speed:g} km/h with small-animal detection at {len(zones)} crossing(s), {p.get('night_hours')}.", "when": format_months(s.active_months), "cost_eur": cost})
        extra = 0.0
        if p.get("reroute_night_deliveries"):
            crossing_routes = {c["route_id"] for c in sp["corridor_crossings"] if c["route_layer"] == "delivery_route"}
            for n in ctx.journeys("delivery_route"):
                if str(n.feature.id) not in crossing_routes:
                    continue
                merged = {"type": "MultiPolygon", "coordinates": [z["coordinates"] for z in zones]}
                result = reroute_around(ctx, n.feature, merged)
                if result and not result["still_crosses_zone"]:
                    extra = max(extra, result["extra_m"])
                    draft.map_features.append(
                        _feature("delivery_route", f"{n.feature.name} (night route)", {"type": "LineString", "coordinates": result["coordinates"]}, ctx,
                                 replaces_feature_id=n.feature.id, species_specific=False, kind="journey", detour_m=result["extra_m"], animate=True,
                                 operating_hours=p.get("night_hours"))
                    )
                else:
                    draft.tradeoffs.append(f"No night route around the crossing was found for {n.feature.name}.")
            draft.actions.append({"party": "delivery_operator", "action": f"Use the night route (+{extra:.0f} m).", "when": p.get("night_hours")})
        if p.get("fence_gaps"):
            gaps = next((m for m in s.mitigations if m.get("key") == "hedgehog_highway"), {"cost_eur": 100, "label": "Fence gaps for wildlife"})
            cost += int(gaps.get("cost_eur", 100))
            draft.actions.append({"party": "residents", "action": gaps.get("label", "Fence gaps"), "when": "now", "cost_eur": gaps.get("cost_eur", 100)})
            draft.map_features.append(_feature("intervention", gaps.get("label", "Fence gaps"), geo.point(*ctx.site_lonlat), ctx, emoji="🕳️"))
        if p.get("crossing_tunnel"):
            tunnel = next((m for m in s.mitigations if m.get("key") == "crossing_tunnel"), {"cost_eur": 1500, "label": "Wildlife tunnel"})
            cost += int(tunnel.get("cost_eur", 1500))
            draft.actions.append({"party": "building_manager", "action": tunnel.get("label", "Wildlife tunnel"), "when": "within 2 months", "cost_eur": tunnel.get("cost_eur", 1500)})
        e = draft.effects
        sat = 0.45 + (0.3 if speed <= 10 else 0.15 if speed <= 15 else 0.05)
        sat += 0.1 if p.get("fence_gaps") else 0
        sat += 0.15 if p.get("crossing_tunnel") else 0
        sat += 0.25 if p.get("reroute_night_deliveries") and extra else 0
        e["safe_passage"] = eff(sat, f"{speed:g} km/h at crossings" + (", fence gaps" if p.get("fence_gaps") else "") + (", tunnel" if p.get("crossing_tunnel") else "") + (", night reroute" if extra else "") + ".")
        e["undisturbed_site"] = eff(min(1.0, baseline(a, "undisturbed_site") + 0.1), "Less traffic stress around the home range.")
        if p.get("fence_gaps"):
            e["site_access"] = eff(0.95, "Gaps keep the way home open.")
        if "delivery_access" in keys:
            if extra:
                e["delivery_access"] = eff(max(0.4, 1 - extra / 500), f"Night detour of {extra:.0f} m.")
            else:
                e["delivery_access"] = eff(min(1.0, 0.6 + 0.4 * speed / 25), f"Slower at {len(zones)} short stretch(es) only.")
        if "access_route" in keys:
            e["access_route"] = eff(0.95, "Pedestrians are barely affected.")
        if (be := budget_effect(ctx, cost)) and "budget_limit" in keys:
            e["budget_limit"] = be
        if speed > 15:
            draft.limit_violations.append(f"{speed:g} km/h is too fast to stop for a small animal at night (15 km/h maximum).")
        draft.cost_eur = cost
        draft.effort = "high" if p.get("crossing_tunnel") else "low"
        draft.implementation_days = 5 if p.get("crossing_tunnel") else 2
        draft.summary = f"Slow, animal-aware traffic where routes cross the {lower_name(s)}'s corridor at night."
        return draft


# --- 7. Watch and adapt (the cheap baseline) ----------------------------------------------------

class WatchAndAdapt(Strategy):
    key = "watch_and_adapt"
    title = "Watch, inform and adapt"

    def applicable(self, ctx, a):
        return True

    def param_specs(self, ctx):
        return [
            ParamSpec("check_every_days", "integer", "Check the site every", "days", 3, 60),
            ParamSpec("volunteers", "integer", "Number of volunteer watchers", None, 1, 20),
        ]

    def default_params(self, ctx, a):
        return {"check_every_days": 14, "volunteers": 2}

    def build(self, ctx, a, p):
        s = ctx.species
        every = int(p["check_every_days"])
        draft = Draft(self.key, f"Info sign + volunteer check-ins every {every} days", "", dict(p), valid_months=list(s.sensitive_months))
        S = ctx.site_point_xy
        draft.map_features.append(_feature("intervention", "Coexistence info sign (QR check-in)", _xy_to_lonlat_point(ctx, Point(S.x + 3, S.y - 3)), ctx, emoji="🪧"))
        draft.actions.append({"party": "residents", "action": f"{p['volunteers']} volunteers log the {site_word(s)} status every {every} days in the app.", "when": _months_text(ctx), "cost_eur": 0})
        draft.actions.append({"party": "building_manager", "action": "Put up an info sign explaining the species and the season.", "when": "this week", "cost_eur": 50})
        e = draft.effects
        for n in a["wildlife_needs"]:
            e[n["key"]] = eff(min(0.75, n["baseline_satisfaction"] + 0.15), "Awareness and monitoring reduce accidental disturbance.")
        for n in a["human_needs"]:
            e[n["key"]] = eff(min(1.0, n["baseline_satisfaction"] + 0.05), "Better informed, but nothing really changes.")
        if ctx.is_works and ctx.planned_start and ctx.planned_end and s.is_legally_protected:
            frac = seasons.overlap_fraction(ctx.planned_start, ctx.planned_end, s.sensitive_months)
            if frac > 0:
                draft.legal_compliant = False
                draft.legal_notes.append(f"The works would still happen during {_months_text(ctx)}. {s.legal_protection}")
                draft.limit_violations.append("Works stay in the sensitive season.")
        draft.cost_eur = 50
        draft.effort = "low"
        draft.implementation_days = 1
        draft.summary = "Inform everyone, monitor the site, and step in if things get worse. Cheap, but it does not really solve the conflict."
        draft.tradeoffs.append("The underlying conflict stays.")
        return draft


STRATEGIES: list[Strategy] = [
    SeasonalQuietZone(),
    ScreenMitigation(),
    ScheduleShift(),
    AlternativeHabitat(),
    DarkCorridor(),
    SafePassage(),
    WatchAndAdapt(),
]
STRATEGY_BY_KEY = {s.key: s for s in STRATEGIES}
