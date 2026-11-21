"""The catalogue of map layers, with ready-to-use MapLibre style hints.

The frontend can either:
  * add ONE GeoJSON source (`/map/features`) and use the `maplibre_layers` below
    (each one filters on `properties.layer`), or
  * fetch each layer separately with `/map/features?layers=<key>`.

Colours follow a "solarpunk" palette: living greens, solar golds, warm accents.
"""

from typing import Any

PALETTE = {
    "moss": "#3f7d4e",
    "leaf": "#6fbf73",
    "lime": "#b5e48c",
    "sky": "#4ea8de",
    "solar": "#f9c74f",
    "amber": "#f8961e",
    "coral": "#f3722c",
    "violet": "#9d4edd",
    "stone": "#c9c3b5",
    "night": "#1b263b",
}

LAYERS: list[dict[str, Any]] = [
    {
        "key": "habitat_zone",
        "label": "Habitat zones",
        "emoji": "🌳",
        "geometry": "Polygon",
        "color": PALETTE["leaf"],
        "description": "Ponds, meadows, hedgerows and green roofs that wildlife relies on.",
        "order": 10,
        "user_editable": True,
    },
    {
        "key": "ecological_buffer",
        "label": "Protected ecological buffers",
        "emoji": "🟢",
        "geometry": "Polygon",
        "color": PALETTE["lime"],
        "description": "Seasonal quiet zones around wildlife homes. Only active in sensitive months.",
        "order": 20,
        "seasonal": True,
        "user_editable": False,
    },
    {
        "key": "agreed_zone",
        "label": "Agreed coexistence zones",
        "emoji": "🤝",
        "geometry": "Polygon",
        "color": PALETTE["moss"],
        "description": "Areas covered by a signed, temporary coexistence agreement.",
        "order": 25,
        "user_editable": False,
    },
    {
        "key": "building",
        "label": "Buildings",
        "emoji": "🏠",
        "geometry": "Polygon",
        "color": PALETTE["stone"],
        "description": "Buildings, extruded in 3D using properties.height_m.",
        "order": 30,
        "user_editable": True,
    },
    {
        "key": "human_route",
        "label": "Human walking routes",
        "emoji": "🚶",
        "geometry": "LineString",
        "color": PALETTE["sky"],
        "description": "Footpaths and streets people use every day.",
        "order": 40,
        "user_editable": True,
    },
    {
        "key": "delivery_route",
        "label": "Delivery routes",
        "emoji": "🚚",
        "geometry": "LineString",
        "color": PALETTE["amber"],
        "description": "Cargo-bike and delivery-robot routes.",
        "order": 41,
        "user_editable": True,
    },
    {
        "key": "wildlife_corridor",
        "label": "Wildlife corridors",
        "emoji": "🦔",
        "geometry": "LineString",
        "color": PALETTE["moss"],
        "description": "How animals move: flight paths, hedgehog highways, bat commuting routes.",
        "order": 42,
        "user_editable": True,
    },
    {
        "key": "barrier",
        "label": "Barriers and screens",
        "emoji": "🧱",
        "geometry": "LineString",
        "color": PALETTE["night"],
        "description": "Green screens, fences, droppings boards and other physical measures.",
        "order": 43,
        "user_editable": True,
    },
    {
        "key": "entrance",
        "label": "Building entrances",
        "emoji": "🚪",
        "geometry": "Point",
        "color": PALETTE["night"],
        "description": "Doors and access points.",
        "order": 50,
        "user_editable": True,
    },
    {
        "key": "point_of_interest",
        "label": "Points of interest",
        "emoji": "📍",
        "geometry": "Point",
        "color": PALETTE["violet"],
        "description": "Tram stops, delivery hubs, playgrounds.",
        "order": 51,
        "user_editable": True,
    },
    {
        "key": "wildlife_site",
        "label": "Wildlife homes",
        "emoji": "🪺",
        "geometry": "Point",
        "color": PALETTE["moss"],
        "description": "Nests, roosts, dens and bee nests.",
        "order": 60,
        "user_editable": True,
    },
    {
        "key": "wildlife",
        "label": "Animals",
        "emoji": "🐦",
        "geometry": "Point",
        "color": PALETTE["leaf"],
        "description": "Animal markers and sightings (add your own!).",
        "order": 61,
        "user_editable": True,
    },
    {
        "key": "resident",
        "label": "Humans",
        "emoji": "🧑",
        "geometry": "Point",
        "color": PALETTE["sky"],
        "description": "Residents, workers and other human markers (add your own!).",
        "order": 62,
        "user_editable": True,
    },
    {
        "key": "conflict_hotspot",
        "label": "Conflict hotspots",
        "emoji": "🟠",
        "geometry": "Point",
        "color": PALETTE["coral"],
        "description": "Where a human-wildlife conflict was reported.",
        "order": 70,
        "user_editable": False,
    },
    {
        "key": "intervention",
        "label": "Proposed interventions",
        "emoji": "🟣",
        "geometry": "Point",
        "color": PALETTE["violet"],
        "description": "Bat boxes, signs, dimmed lamps and other measures from a solution.",
        "order": 71,
        "user_editable": False,
    },
]

LAYER_KEYS = {layer["key"] for layer in LAYERS}
USER_EDITABLE_LAYERS = {layer["key"] for layer in LAYERS if layer.get("user_editable")}
ROUTE_LAYERS = {"human_route", "delivery_route", "wildlife_corridor"}


def _filter(key: str) -> list[Any]:
    return ["==", ["get", "layer"], key]


def maplibre_layers(source_id: str = "paradox") -> list[dict[str, Any]]:
    """MapLibre style layers for a single GeoJSON source holding all features."""
    p = PALETTE
    return [
        {
            "id": "habitat-zones",
            "type": "fill",
            "source": source_id,
            "filter": _filter("habitat_zone"),
            "paint": {"fill-color": p["leaf"], "fill-opacity": 0.35, "fill-outline-color": p["moss"]},
        },
        {
            "id": "ecological-buffers",
            "type": "fill",
            "source": source_id,
            "filter": _filter("ecological_buffer"),
            "paint": {
                "fill-color": p["lime"],
                "fill-opacity": ["case", ["get", "active_now"], 0.35, 0.08],
            },
        },
        {
            "id": "ecological-buffers-outline",
            "type": "line",
            "source": source_id,
            "filter": _filter("ecological_buffer"),
            "paint": {"line-color": p["moss"], "line-width": 1.5, "line-dasharray": [2, 2]},
        },
        {
            "id": "agreed-zones",
            "type": "fill",
            "source": source_id,
            "filter": _filter("agreed_zone"),
            "paint": {"fill-color": p["moss"], "fill-opacity": 0.3, "fill-outline-color": p["lime"]},
        },
        {
            "id": "buildings-3d",
            "type": "fill-extrusion",
            "source": source_id,
            "filter": _filter("building"),
            "paint": {
                "fill-extrusion-color": ["coalesce", ["get", "color"], p["stone"]],
                "fill-extrusion-height": ["coalesce", ["get", "height_m"], 12],
                "fill-extrusion-opacity": 0.85,
            },
        },
        {
            "id": "human-routes",
            "type": "line",
            "source": source_id,
            "filter": _filter("human_route"),
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": p["sky"],
                "line-width": 4,
                "line-opacity": ["case", ["==", ["get", "scenario_role"], "replaced"], 0.25, 0.9],
            },
        },
        {
            "id": "delivery-routes",
            "type": "line",
            "source": source_id,
            "filter": _filter("delivery_route"),
            "layout": {"line-cap": "round"},
            "paint": {"line-color": p["amber"], "line-width": 3, "line-dasharray": [3, 1.5]},
        },
        {
            "id": "wildlife-corridors",
            "type": "line",
            "source": source_id,
            "filter": _filter("wildlife_corridor"),
            "layout": {"line-cap": "round"},
            "paint": {"line-color": p["moss"], "line-width": 3, "line-dasharray": [0.5, 1.5]},
        },
        {
            "id": "barriers",
            "type": "line",
            "source": source_id,
            "filter": _filter("barrier"),
            "paint": {"line-color": p["night"], "line-width": 5},
        },
        {
            "id": "points",
            "type": "symbol",
            "source": source_id,
            "filter": [
                "in",
                ["get", "layer"],
                [
                    "literal",
                    [
                        "entrance",
                        "point_of_interest",
                        "wildlife_site",
                        "wildlife",
                        "resident",
                        "intervention",
                    ],
                ],
            ],
            "layout": {
                "text-field": ["get", "emoji"],
                "text-size": 22,
                "text-allow-overlap": True,
            },
        },
        {
            "id": "conflict-hotspots",
            "type": "circle",
            "source": source_id,
            "filter": _filter("conflict_hotspot"),
            "paint": {
                "circle-radius": 14,
                "circle-color": p["coral"],
                "circle-opacity": 0.55,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
            },
        },
    ]


def layer_info(key: str) -> dict[str, Any]:
    for layer in LAYERS:
        if layer["key"] == key:
            return layer
    raise KeyError(key)
