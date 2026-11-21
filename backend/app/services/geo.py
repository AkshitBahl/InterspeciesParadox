"""Small geometry toolbox.

Map data is stored as GeoJSON in longitude/latitude (degrees). Degrees are bad
for measuring metres, so before any maths we *project* to a flat local grid in
metres around a reference point, do the maths with Shapely, and convert back.

At neighbourhood scale (a few km) this simple "equirectangular" projection is
accurate to well under 1%, which is plenty for a hackathon.
"""

import math
from collections.abc import Iterable
from typing import Any

from shapely import segmentize
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform

from app.core.config import settings

M_PER_DEG_LAT = 110_574.0
M_PER_DEG_LON_EQUATOR = 111_320.0

GEOMETRY_TYPES = {
    "Point",
    "MultiPoint",
    "LineString",
    "MultiLineString",
    "Polygon",
    "MultiPolygon",
}


class LocalProjection:
    """Convert lon/lat <-> metres (x east, y north) around a reference point."""

    def __init__(self, lon0: float | None = None, lat0: float | None = None) -> None:
        self.lon0 = settings.map_center_lon if lon0 is None else lon0
        self.lat0 = settings.map_center_lat if lat0 is None else lat0
        self.m_per_deg_lon = M_PER_DEG_LON_EQUATOR * math.cos(math.radians(self.lat0))

    # --- single points ---------------------------------------------------------
    def to_xy(self, lon: float, lat: float) -> tuple[float, float]:
        return ((lon - self.lon0) * self.m_per_deg_lon, (lat - self.lat0) * M_PER_DEG_LAT)

    def to_lonlat(self, x: float, y: float) -> tuple[float, float]:
        return (self.lon0 + x / self.m_per_deg_lon, self.lat0 + y / M_PER_DEG_LAT)

    # --- whole geometries ------------------------------------------------------
    def _fwd(self, x: Any, y: Any, z: Any = None) -> tuple[Any, Any]:
        return ((x - self.lon0) * self.m_per_deg_lon, (y - self.lat0) * M_PER_DEG_LAT)

    def _inv(self, x: Any, y: Any, z: Any = None) -> tuple[Any, Any]:
        return (self.lon0 + x / self.m_per_deg_lon, self.lat0 + y / M_PER_DEG_LAT)

    def geom_to_xy(self, geometry: dict[str, Any] | BaseGeometry) -> BaseGeometry:
        geom = geometry if isinstance(geometry, BaseGeometry) else shape(geometry)
        return transform(self._fwd, geom)

    def xy_to_geom(self, geom_xy: BaseGeometry) -> BaseGeometry:
        return transform(self._inv, geom_xy)

    def xy_to_geojson(self, geom_xy: BaseGeometry, precision: int = 7) -> dict[str, Any]:
        return round_geojson(dict(mapping(self.xy_to_geom(geom_xy))), precision)


DEFAULT_PROJECTION = LocalProjection()


def projection_near(geometry: dict[str, Any]) -> LocalProjection:
    """A projection centred on a geometry, so that far-away data is also measured well."""
    c = shape(geometry).centroid
    return LocalProjection(c.x, c.y)


def _round_coords(coords: Any, precision: int) -> Any:
    if isinstance(coords, (int, float)):
        return round(float(coords), precision)
    return [_round_coords(c, precision) for c in coords]


def round_geojson(geometry: dict[str, Any], precision: int = 7) -> dict[str, Any]:
    return {"type": geometry["type"], "coordinates": _round_coords(geometry["coordinates"], precision)}


def validate_geometry(geometry: dict[str, Any]) -> dict[str, Any]:
    """Check that a dict is a usable GeoJSON geometry (raises ValueError if not)."""
    if not isinstance(geometry, dict) or geometry.get("type") not in GEOMETRY_TYPES:
        raise ValueError(f"geometry.type must be one of {sorted(GEOMETRY_TYPES)}")
    if "coordinates" not in geometry:
        raise ValueError("geometry.coordinates is required")
    try:
        geom = shape(geometry)
    except Exception as exc:  # shapely raises several error types
        raise ValueError(f"Invalid geometry: {exc}") from exc
    if geom.is_empty:
        raise ValueError("Geometry is empty")
    minx, miny, maxx, maxy = geom.bounds
    if not (-180 <= minx <= 180 and -180 <= maxx <= 180 and -90 <= miny <= 90 and -90 <= maxy <= 90):
        raise ValueError("Coordinates must be [longitude, latitude] in WGS84 degrees")
    return round_geojson(dict(mapping(geom)))


def bbox(geometry: dict[str, Any]) -> tuple[float, float, float, float]:
    return tuple(shape(geometry).bounds)  # type: ignore[return-value]


def centroid(geometry: dict[str, Any]) -> tuple[float, float]:
    c = shape(geometry).centroid
    return (c.x, c.y)


def point(lon: float, lat: float) -> dict[str, Any]:
    return {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]}


def distance_m(a: dict[str, Any], b: dict[str, Any], proj: LocalProjection | None = None) -> float:
    proj = proj or DEFAULT_PROJECTION
    return float(proj.geom_to_xy(a).distance(proj.geom_to_xy(b)))


def length_m(geometry: dict[str, Any], proj: LocalProjection | None = None) -> float:
    proj = proj or DEFAULT_PROJECTION
    return float(proj.geom_to_xy(geometry).length)


def area_m2(geometry: dict[str, Any], proj: LocalProjection | None = None) -> float:
    proj = proj or DEFAULT_PROJECTION
    return float(proj.geom_to_xy(geometry).area)


def circle(lon: float, lat: float, radius_m: float, proj: LocalProjection | None = None) -> dict[str, Any]:
    """A circle polygon (GeoJSON) of `radius_m` metres around a point."""
    proj = proj or DEFAULT_PROJECTION
    x, y = proj.to_xy(lon, lat)
    return proj.xy_to_geojson(Point(x, y).buffer(radius_m, quad_segs=16))


def buffer_geometry(geometry: dict[str, Any], radius_m: float, proj: LocalProjection | None = None) -> dict[str, Any]:
    proj = proj or DEFAULT_PROJECTION
    return proj.xy_to_geojson(proj.geom_to_xy(geometry).buffer(radius_m, quad_segs=12))


def intersects(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return shape(a).intersects(shape(b))


def length_inside(line: dict[str, Any], polygon: dict[str, Any], proj: LocalProjection | None = None) -> float:
    proj = proj or DEFAULT_PROJECTION
    inside = proj.geom_to_xy(line).intersection(proj.geom_to_xy(polygon))
    return float(inside.length)


def bbox_polygon(min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> dict[str, Any]:
    return {
        "type": "Polygon",
        "coordinates": [
            [[min_lon, min_lat], [max_lon, min_lat], [max_lon, max_lat], [min_lon, max_lat], [min_lon, min_lat]]
        ],
    }


def densify_line(coords: list[list[float]], step_m: float, proj: LocalProjection | None = None) -> list[list[float]]:
    proj = proj or DEFAULT_PROJECTION
    line_xy = proj.geom_to_xy(LineString(coords))
    dense = segmentize(line_xy, step_m)
    return [list(proj.to_lonlat(x, y)) for x, y in dense.coords]


def sample_along(coords: list[list[float]], n: int, proj: LocalProjection | None = None) -> list[list[float]]:
    """`n` evenly spaced points along a line (handy for animations)."""
    proj = proj or DEFAULT_PROJECTION
    line_xy = proj.geom_to_xy(LineString(coords))
    if n < 2 or line_xy.length == 0:
        return [list(c) for c in coords[:1]]
    out = []
    for i in range(n):
        p = line_xy.interpolate(line_xy.length * i / (n - 1))
        lon, lat = proj.to_lonlat(p.x, p.y)
        out.append([round(lon, 7), round(lat, 7)])
    return out


def bearing_deg(a: Iterable[float], b: Iterable[float]) -> float:
    """Compass bearing from point a to point b (0 = north, 90 = east)."""
    (lon1, lat1), (lon2, lat2) = list(a)[:2], list(b)[:2]
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlon) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def compass(bearing: float) -> str:
    names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
    return names[int((bearing + 22.5) // 45) % 8]


def as_polygon_xy(geometry: dict[str, Any], proj: LocalProjection | None = None) -> Polygon:
    proj = proj or DEFAULT_PROJECTION
    return proj.geom_to_xy(geometry)  # type: ignore[return-value]
