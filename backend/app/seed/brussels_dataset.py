"""Dummy map dataset: "Ixelles Ponds Eco-District", Brussels, in the year 2126.

The layout is *fictional* (a redesigned 2126 district placed near the real
Ixelles ponds), so it will not line up exactly with today's OpenStreetMap
streets. Tip for the frontend: use a light or dark basemap and hide OSM's own
buildings so this layer is the star.

Everything is designed in metres on a local grid (x = east, y = north) around
the map centre, then converted to longitude/latitude. Route lines share exact
node coordinates, so they connect into a routable network.
"""

from typing import Any

from app.services import geo

P = geo.DEFAULT_PROJECTION

# Network nodes (metres from the map centre) ------------------------------------
N: dict[str, tuple[float, float]] = {
    # Avenue du Soleil (north street)
    "Y": (-220, 160), "X": (-115, 160), "G": (-60, 160), "F": (40, 160), "E": (140, 160),
    # Rue de la Mousse (middle street)
    "A": (-220, 60), "Q": (-175, 60), "B": (-60, 60), "C": (40, 60), "P2": (90, 60), "D": (140, 60),
    # Chaussée des Étangs (south street)
    "H": (-220, -60), "Z": (-110, -60), "I": (-60, -60), "R": (-10, -60), "U": (102, -60), "J": (140, -60),
    # Promenade de l'Étang (pond loop)
    "W": (-220, -160), "V": (-120, -160), "L": (-60, -160), "K": (40, -160), "M": (140, -160),
    # Doors and connectors
    "TRAM": (-220, 172),
    "ME": (40, 80),  # Mosshaus main entrance
    "SE": (70, 115), "P1": (90, 115),  # Mosshaus side entrance path
    "SOL": (-175, 90),  # Solaris Tower entrance
    "HUB": (-115, 170),  # delivery hub dock
    "BRW": (-10, -40),  # Old Brewery entrance
    "CC": (102, -40),  # Canopy Court entrance
    "PLAY": (-120, -75), "PT": (-120, -100),  # playground and Pondside garden entrance
}


def ll(x: float, y: float) -> list[float]:
    lon, lat = P.to_lonlat(x, y)
    return [round(lon, 7), round(lat, 7)]


def line(*names: str) -> dict[str, Any]:
    return {"type": "LineString", "coordinates": [ll(*N[n]) for n in names]}


def line_xy(*pts: tuple[float, float]) -> dict[str, Any]:
    return {"type": "LineString", "coordinates": [ll(*p) for p in pts]}


def pt(x: float, y: float) -> dict[str, Any]:
    return {"type": "Point", "coordinates": ll(x, y)}


def rect(x0: float, y0: float, x1: float, y1: float) -> dict[str, Any]:
    ring = [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]
    return {"type": "Polygon", "coordinates": [ring]}


def poly(*pts: tuple[float, float]) -> dict[str, Any]:
    ring = [ll(*p) for p in pts] + [ll(*pts[0])]
    return {"type": "Polygon", "coordinates": [ring]}


NEIGHBOURHOOD = {
    "name": "Ixelles Ponds Eco-District",
    "city": "Brussels",
    "year": 2126,
    "description": (
        "A 2126 solarpunk district around the Ixelles ponds: moss-clad co-housing, a solar co-op tower, "
        "a converted brewery and a pond promenade where people and wildlife share every corner."
    ),
}

# Each item: key, layer, name, geometry, properties, (optional) species slug, parent key.
FEATURES: list[dict[str, Any]] = [
    # --- Buildings -----------------------------------------------------------------
    {"key": "mosshaus", "layer": "building", "name": "Mosshaus Residences", "geometry": rect(10, 80, 70, 130),
     "properties": {"height_m": 24, "floors": 8, "use": "co-housing", "color": "#8fbf8f", "description": "Moss-clad co-housing with 48 flats."}},
    {"key": "solaris", "layer": "building", "name": "Solaris Co-op Tower", "geometry": rect(-200, 90, -150, 140),
     "properties": {"height_m": 80, "floors": 24, "use": "energy co-op + flats", "color": "#f2d16b"}},
    {"key": "brewery", "layer": "building", "name": "Old Brewery Lofts", "geometry": rect(-40, -40, 20, 10),
     "properties": {"height_m": 18, "floors": 4, "use": "lofts", "color": "#c98f5a", "built": 1910}},
    {"key": "canopy", "layer": "building", "name": "Canopy Court", "geometry": rect(80, -40, 125, 20),
     "properties": {"height_m": 21, "floors": 6, "use": "flats with balconies", "color": "#a8d5ba"}},
    {"key": "pondside", "layer": "building", "name": "Pondside Terraces", "geometry": rect(-150, -140, -90, -100),
     "properties": {"height_m": 9, "floors": 3, "use": "terraced houses", "color": "#d9c7a7"}},
    {"key": "hub", "layer": "building", "name": "Flagey Commons Hub", "geometry": rect(-140, 170, -90, 210),
     "properties": {"height_m": 12, "floors": 2, "use": "delivery and repair hub", "color": "#b3a6d9"}},

    # --- Entrances ----------------------------------------------------------------
    {"key": "moss_main", "layer": "entrance", "name": "Mosshaus main entrance", "geometry": pt(*N["ME"]), "parent": "mosshaus",
     "properties": {"step_free": True, "main": True}},
    {"key": "moss_side", "layer": "entrance", "name": "Mosshaus side entrance", "geometry": pt(*N["SE"]), "parent": "mosshaus",
     "properties": {"step_free": False, "access_note": "3 steps; a temporary ramp can be added"}},
    {"key": "solaris_door", "layer": "entrance", "name": "Solaris Tower entrance", "geometry": pt(*N["SOL"]), "parent": "solaris", "properties": {"step_free": True}},
    {"key": "brewery_door", "layer": "entrance", "name": "Old Brewery entrance", "geometry": pt(*N["BRW"]), "parent": "brewery", "properties": {"step_free": True}},
    {"key": "canopy_door", "layer": "entrance", "name": "Canopy Court entrance", "geometry": pt(*N["CC"]), "parent": "canopy", "properties": {"step_free": True}},
    {"key": "pondside_door", "layer": "entrance", "name": "Pondside Terraces garden gate", "geometry": pt(*N["PT"]), "parent": "pondside", "properties": {"step_free": True}},
    {"key": "hub_dock", "layer": "entrance", "name": "Hub delivery dock", "geometry": pt(*N["HUB"]), "parent": "hub", "properties": {"step_free": True, "kind": "delivery_dock"}},

    # --- Points of interest ------------------------------------------------------------
    {"key": "tram", "layer": "point_of_interest", "name": "Flagey tram stop", "geometry": pt(*N["TRAM"]), "properties": {"emoji": "🚋", "kind": "transit"}},
    {"key": "playground", "layer": "point_of_interest", "name": "Pondside playground", "geometry": pt(*N["PLAY"]), "properties": {"emoji": "🛝", "kind": "playground"}},
    {"key": "solar_north", "layer": "point_of_interest", "name": "Solaris solar array (north roof)", "geometry": pt(-170, 128), "parent": "solaris", "properties": {"emoji": "☀️", "kind": "solar_array", "height_m": 80}},
    {"key": "solar_south", "layer": "point_of_interest", "name": "Solaris solar array (south roof)", "geometry": pt(-185, 100), "parent": "solaris", "properties": {"emoji": "☀️", "kind": "solar_array", "height_m": 80}},

    # --- Habitat zones -----------------------------------------------------------------
    {"key": "pond", "layer": "habitat_zone", "name": "Ixelles pond wetland",
     "geometry": poly((-40, -80), (30, -75), (120, -85), (125, -120), (80, -145), (0, -150), (-40, -130)),
     "properties": {"habitat": "wetland", "description": "Open water, reeds and muddy banks: insects for bats and martins, mud for nests."}},
    {"key": "hedgerow", "layer": "habitat_zone", "name": "Pondside hedgerow", "geometry": rect(-85, -150, -65, -70),
     "properties": {"habitat": "hedgerow", "description": "Dense native hedge, home of hedgehogs."}},
    {"key": "allotments", "layer": "habitat_zone", "name": "Ixelles allotment gardens", "geometry": rect(-200, -45, -80, 40),
     "properties": {"habitat": "gardens", "description": "Vegetable plots, compost heaps and beetles galore."}},
    {"key": "meadow", "layer": "habitat_zone", "name": "Canopy pollinator meadow", "geometry": rect(150, -40, 200, 30),
     "properties": {"habitat": "meadow", "description": "Spring flowers and fruit trees for pollinators."}},
    {"key": "green_roof", "layer": "habitat_zone", "name": "Old Brewery green roof", "geometry": rect(-35, -35, 15, 5),
     "properties": {"habitat": "green_roof", "height_m": 18}},
    {"key": "gardens", "layer": "habitat_zone", "name": "Pondside back gardens", "geometry": rect(-150, -98, -90, -64),
     "properties": {"habitat": "gardens"}},

    # --- Wildlife homes ----------------------------------------------------------------
    {"key": "martin_nest", "layer": "wildlife_site", "name": "House martin colony above Mosshaus entrance", "geometry": pt(44, 80.5), "species": "house-martin",
     "parent": "mosshaus", "properties": {"site_type": "nest", "count": 4, "height_m": 7, "description": "Four mud nests under the eaves, right above the main door."}},
    {"key": "peregrine_nest", "layer": "wildlife_site", "name": "Peregrine ledge, Solaris Tower", "geometry": pt(-152, 138), "species": "peregrine-falcon",
     "parent": "solaris", "properties": {"site_type": "nest", "count": 1, "height_m": 78, "description": "A gravel ledge on the north-east corner, 78 m up."}},
    {"key": "bat_roost", "layer": "wildlife_site", "name": "Pipistrelle roost, Old Brewery roof", "geometry": pt(-30, 5), "species": "common-pipistrelle",
     "parent": "brewery", "properties": {"site_type": "roost", "count": 40, "height_m": 17, "description": "About 40 bats under the old roof tiles."}},
    {"key": "bee_nest", "layer": "wildlife_site", "name": "Red mason bee nest, balcony 4B", "geometry": pt(124, -5), "species": "red-mason-bee",
     "parent": "canopy", "properties": {"site_type": "bee_nest", "count": 12, "height_m": 13, "description": "Twelve sealed tubes in an old bamboo blind."}},
    {"key": "hedgehog_nest", "layer": "wildlife_site", "name": "Hedgehog nest in the hedgerow", "geometry": pt(-75, -110), "species": "european-hedgehog",
     "properties": {"site_type": "nest", "count": 1, "description": "A leaf nest at the bottom of the hedge."}},
    {"key": "fox_den", "layer": "wildlife_site", "name": "Fox den under the garden shed", "geometry": pt(-108, -86), "species": "red-fox",
     "parent": "pondside", "properties": {"site_type": "den", "count": 5, "description": "A vixen and four cubs under an old shed."}},

    # --- Wildlife corridors ------------------------------------------------------------
    {"key": "martin_flight", "layer": "wildlife_corridor", "name": "House martin feeding flight to the pond", "species": "house-martin",
     "geometry": line_xy((44, 80.5), (35, 20), (30, -70), (60, -110), (90, -95)), "properties": {"mode": "flight", "animate": True}},
    {"key": "peregrine_flight", "layer": "wildlife_corridor", "name": "Peregrine hunting circuit over the ponds", "species": "peregrine-falcon",
     "geometry": line_xy((-152, 138), (-80, 60), (0, -40), (60, -110), (-20, -140), (-152, 138)), "properties": {"mode": "flight", "animate": True}},
    {"key": "bat_commute", "layer": "wildlife_corridor", "name": "Bat commuting route along the tree line", "species": "common-pipistrelle",
     "geometry": line_xy((-30, 5), (-45, -20), (-50, -55), (-30, -90), (20, -110)), "properties": {"mode": "flight", "animate": True, "needs_darkness": True}},
    {"key": "bee_foraging", "layer": "wildlife_corridor", "name": "Mason bee foraging trip to the meadow", "species": "red-mason-bee",
     "geometry": line_xy((124, -5), (150, 0), (175, 5), (185, -20)), "properties": {"mode": "flight", "animate": True}},
    {"key": "hedgehog_highway", "layer": "wildlife_corridor", "name": "Hedgehog highway to the allotments", "species": "european-hedgehog",
     "geometry": line_xy((-75, -110), (-76, -85), (-77, -50), (-85, -40), (-130, 0)), "properties": {"mode": "walk", "animate": True}},
    {"key": "fox_path", "layer": "wildlife_corridor", "name": "Fox family path to the pond", "species": "red-fox",
     "geometry": line_xy((-108, -86), (-90, -95), (-50, -115), (-20, -140)), "properties": {"mode": "walk", "animate": True}},

    # --- Streets (the walkable network) ----------------------------------------------------------
    {"key": "st_soleil", "layer": "human_route", "name": "Avenue du Soleil", "geometry": line("Y", "X", "G", "F", "E"), "properties": {"kind": "street", "lighting": "bright"}},
    {"key": "st_mousse", "layer": "human_route", "name": "Rue de la Mousse", "geometry": line("A", "Q", "B", "C", "P2", "D"), "properties": {"kind": "street", "lighting": "dim"}},
    {"key": "st_etangs", "layer": "human_route", "name": "Chaussée des Étangs", "geometry": line("H", "Z", "I", "R", "U", "J"), "properties": {"kind": "street", "lighting": "dim"}},
    {"key": "st_moulin", "layer": "human_route", "name": "Rue du Moulin", "geometry": line("G", "B", "I", "L"), "properties": {"kind": "street", "lighting": "bright"}},
    {"key": "st_vert", "layer": "human_route", "name": "Boulevard Vert", "geometry": line("E", "D", "J", "M"), "properties": {"kind": "street", "lighting": "dim"}},
    {"key": "st_ouest", "layer": "human_route", "name": "Allée Ouest", "geometry": line("TRAM", "Y", "A", "H", "W"), "properties": {"kind": "street", "lighting": "dim"}},
    {"key": "st_promenade", "layer": "human_route", "name": "Promenade de l'Étang", "geometry": line("W", "V", "L", "K", "M"), "properties": {"kind": "street", "lighting": "none"}},
    {"key": "path_moss_main", "layer": "human_route", "name": "Mosshaus front path", "geometry": line("ME", "C"), "properties": {"kind": "street", "lighting": "dim"}},
    {"key": "path_moss_side", "layer": "human_route", "name": "Mosshaus side path", "geometry": line("SE", "P1", "P2"), "properties": {"kind": "street", "lighting": "dim", "step_free": False}},
    {"key": "path_solaris", "layer": "human_route", "name": "Solaris forecourt", "geometry": line("SOL", "Q"), "properties": {"kind": "street", "lighting": "dim"}},
    {"key": "path_hub", "layer": "human_route", "name": "Hub access lane", "geometry": line("HUB", "X"), "properties": {"kind": "street", "lighting": "bright"}},
    {"key": "path_brewery", "layer": "human_route", "name": "Brewery Lane", "geometry": line("BRW", "R"), "properties": {"kind": "street", "lighting": "bright"}},
    {"key": "path_canopy", "layer": "human_route", "name": "Canopy Court path", "geometry": line("CC", "U"), "properties": {"kind": "street", "lighting": "dim"}},
    {"key": "path_pondside", "layer": "human_route", "name": "Pondside garden path", "geometry": line("PT", "PLAY", "Z"), "properties": {"kind": "street", "lighting": "dim"}},

    # --- Daily journeys (what people actually walk) ----------------------------------------------
    {"key": "j_commute", "layer": "human_route", "name": "Mosshaus to Flagey tram (daily commute)", "geometry": line("TRAM", "Y", "A", "Q", "B", "C", "ME"),
     "properties": {"kind": "journey", "who": "Mosshaus residents", "trips_per_day": 120, "daily_hours": ["07:30-09:00", "17:30-19:00"], "animate": True}},
    {"key": "j_school", "layer": "human_route", "name": "School run: Pondside to Mosshaus", "geometry": line("PT", "PLAY", "Z", "I", "B", "C", "ME"),
     "properties": {"kind": "journey", "who": "Pondside families", "trips_per_day": 30, "daily_hours": ["08:00-08:30", "15:30-16:00"], "animate": True}},
    {"key": "j_pondloop", "layer": "human_route", "name": "Evening pond loop", "geometry": line("I", "L", "K", "M", "J", "U", "R", "I"),
     "properties": {"kind": "journey", "who": "joggers and dog walkers", "trips_per_day": 80, "daily_hours": ["18:00-22:00"], "animate": True}},
    {"key": "j_brewery", "layer": "human_route", "name": "Brewery Lane evening walk", "geometry": line("BRW", "R", "I", "B"),
     "properties": {"kind": "journey", "who": "Old Brewery residents", "trips_per_day": 25, "lighting": "bright", "daily_hours": ["19:00-23:00"], "animate": True}},

    # --- Delivery routes ---------------------------------------------------------------------
    {"key": "d_cargo", "layer": "delivery_route", "name": "Cargo-bike route: Hub to Mosshaus", "geometry": line("HUB", "X", "G", "F", "E", "D", "P2", "C", "ME"),
     "properties": {"kind": "journey", "vehicle": "cargo bike", "operator": "GreenLoop Deliveries", "operating_hours": "08:00-18:00", "trips_per_day": 14, "animate": True}},
    {"key": "d_robots", "layer": "delivery_route", "name": "Night delivery robots: Hub to Canopy Court", "geometry": line("HUB", "X", "Y", "A", "H", "Z", "I", "R", "U", "CC"),
     "properties": {"kind": "journey", "vehicle": "delivery robot", "operator": "GreenLoop Deliveries", "operating_hours": "21:00-06:00", "trips_per_day": 40, "animate": True}},

    # --- People (markers) -----------------------------------------------------------------------
    {"key": "r_lina", "layer": "resident", "name": "Lina Okafor (Mosshaus 3A)", "geometry": pt(35, 110), "properties": {"emoji": "👩🏾‍🍼", "role": "resident", "note": "Pushes a stroller twice a day."}},
    {"key": "r_jonas", "layer": "resident", "name": "Jonas Verbeke (Old Brewery owner)", "geometry": pt(-10, -15), "properties": {"emoji": "👷", "role": "owner"}},
    {"key": "r_mei", "layer": "resident", "name": "Mei Tanaka (Canopy Court 4B)", "geometry": pt(118, -5), "properties": {"emoji": "🧑🏻‍🎨", "role": "resident", "note": "Allergic to bee stings."}},
    {"key": "r_rafael", "layer": "resident", "name": "Rafael Duarte (solar technician)", "geometry": pt(-178, 112), "properties": {"emoji": "🧑‍🔧", "role": "technician"}},
    {"key": "r_noor", "layer": "resident", "name": "Noor El Idrissi (Pondside parent)", "geometry": pt(-125, -115), "properties": {"emoji": "👩‍👧‍👦", "role": "resident"}},
    {"key": "r_courier", "layer": "resident", "name": "GreenLoop courier", "geometry": pt(-115, 178), "properties": {"emoji": "🚲", "role": "courier"}},

    # --- Animals (markers) -----------------------------------------------------------------------
    {"key": "a_martins", "layer": "wildlife", "name": "House martin pair", "geometry": pt(46, 84), "species": "house-martin", "properties": {"count": 2, "representative": "Martina Mudd"}},
    {"key": "a_peregrines", "layer": "wildlife", "name": "Peregrine pair", "geometry": pt(-150, 141), "species": "peregrine-falcon", "properties": {"count": 2, "representative": "Commander Stoop"}},
    {"key": "a_bats", "layer": "wildlife", "name": "Pipistrelle colony", "geometry": pt(-28, 8), "species": "common-pipistrelle", "properties": {"count": 40, "representative": "Count Pipistrello"}},
    {"key": "a_bee", "layer": "wildlife", "name": "Red mason bee", "geometry": pt(127, -4), "species": "red-mason-bee", "properties": {"count": 1, "representative": "Osmia Stonewright"}},
    {"key": "a_hedgehog", "layer": "wildlife", "name": "Hedgehog on patrol", "geometry": pt(-78, -75), "species": "european-hedgehog", "properties": {"count": 1, "representative": "Professor Hogsworth Prickles"}},
    {"key": "a_foxes", "layer": "wildlife", "name": "Fox family", "geometry": pt(-104, -90), "species": "red-fox", "properties": {"count": 5, "representative": "Vix Rousseau"}},
]
