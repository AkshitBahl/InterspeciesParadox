"""A tiny offline router over our own route features.

Why? 1) The demo works with no internet. 2) Unlike public OSRM, it can *avoid
wildlife buffers*, which is exactly what a seasonal detour needs.

How it works:
1. Every route LineString is cut into ~10 m pieces. Each piece is an edge of a
   graph, its two ends are nodes (nodes closer than 1 m are merged).
2. Edges whose middle lies inside an "avoid" polygon are blocked (or made very
   expensive in "penalize" mode).
3. Dijkstra's algorithm finds the cheapest path between the nodes nearest to
   the start and end points.
"""

import heapq
import math
from dataclasses import dataclass
from typing import Any

from shapely.geometry import LineString, Point
from shapely.geometry.base import BaseGeometry

from app.models import MapFeature
from app.services import geo

SNAP_M = 1.0
STEP_M = 10.0
PENALTY_FACTOR = 25.0


@dataclass
class Edge:
    a: int
    b: int
    length: float
    feature_id: str
    feature_name: str
    layer: str
    mid: Point


@dataclass
class PathResult:
    coordinates: list[list[float]]
    length_m: float
    cost: float
    segments: list[dict[str, Any]]  # consecutive edges grouped by feature name
    blocked_edges_used: int


class PathNetwork:
    def __init__(self, features: list[MapFeature], proj: geo.LocalProjection | None = None) -> None:
        self.proj = proj or geo.DEFAULT_PROJECTION
        self.nodes: list[tuple[float, float]] = []
        self._node_index: dict[tuple[int, int], int] = {}
        self.edges: list[Edge] = []
        self.adjacency: dict[int, list[int]] = {}
        for f in features:
            geom = f.geometry
            lines = [geom["coordinates"]] if geom["type"] == "LineString" else geom["coordinates"] if geom["type"] == "MultiLineString" else []
            for coords in lines:
                self._add_line(coords, f)

    def _node(self, x: float, y: float) -> int:
        key = (round(x / SNAP_M), round(y / SNAP_M))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                idx = self._node_index.get((key[0] + dx, key[1] + dy))
                if idx is not None and math.dist(self.nodes[idx], (x, y)) <= SNAP_M:
                    return idx
        self.nodes.append((x, y))
        self._node_index[key] = len(self.nodes) - 1
        return len(self.nodes) - 1

    def _add_line(self, coords: list[list[float]], feature: MapFeature) -> None:
        dense = geo.densify_line(coords, STEP_M, self.proj)
        pts = [self.proj.to_xy(lon, lat) for lon, lat in dense]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:], strict=False):
            a, b = self._node(x1, y1), self._node(x2, y2)
            if a == b:
                continue
            edge = Edge(
                a=a,
                b=b,
                length=math.dist((x1, y1), (x2, y2)),
                feature_id=str(feature.id),
                feature_name=feature.name,
                layer=feature.layer,
                mid=Point((x1 + x2) / 2, (y1 + y2) / 2),
            )
            self.edges.append(edge)
            idx = len(self.edges) - 1
            self.adjacency.setdefault(a, []).append(idx)
            self.adjacency.setdefault(b, []).append(idx)

    def nearest_node(self, lon: float, lat: float) -> tuple[int, float] | None:
        if not self.nodes:
            return None
        x, y = self.proj.to_xy(lon, lat)
        best = min(range(len(self.nodes)), key=lambda i: math.dist(self.nodes[i], (x, y)))
        return best, math.dist(self.nodes[best], (x, y))

    def shortest_path(
        self,
        start: tuple[float, float],
        end: tuple[float, float],
        avoid: list[BaseGeometry] | None = None,
        mode: str = "block",
        layers: set[str] | None = None,
    ) -> PathResult | None:
        """Cheapest path from start to end (lon, lat). `avoid` polygons are in metres."""
        s, e = self.nearest_node(*start), self.nearest_node(*end)
        if s is None or e is None:
            return None
        src, dst = s[0], e[0]
        avoid = avoid or []

        def edge_cost(edge: Edge) -> float | None:
            if layers and edge.layer not in layers:
                return None
            if any(poly.contains(edge.mid) for poly in avoid):
                return None if mode == "block" else edge.length * PENALTY_FACTOR
            return edge.length

        dist = {src: 0.0}
        prev: dict[int, tuple[int, int]] = {}
        heap = [(0.0, src)]
        while heap:
            d, node = heapq.heappop(heap)
            if node == dst:
                break
            if d > dist.get(node, math.inf):
                continue
            for idx in self.adjacency.get(node, []):
                edge = self.edges[idx]
                cost = edge_cost(edge)
                if cost is None:
                    continue
                other = edge.b if edge.a == node else edge.a
                nd = d + cost
                if nd < dist.get(other, math.inf):
                    dist[other] = nd
                    prev[other] = (node, idx)
                    heapq.heappush(heap, (nd, other))
        if dst not in dist:
            return None

        # Walk back from the destination.
        node_path, edge_path = [dst], []
        while node_path[-1] != src:
            node, idx = prev[node_path[-1]]
            node_path.append(node)
            edge_path.append(idx)
        node_path.reverse()
        edge_path.reverse()

        coords = [list(self.proj.to_lonlat(*self.nodes[n])) for n in node_path]
        coords = simplify_coords([[round(c[0], 7), round(c[1], 7)] for c in coords], proj=self.proj)
        length = sum(self.edges[i].length for i in edge_path)
        segments: list[dict[str, Any]] = []
        blocked = 0
        for i in edge_path:
            edge = self.edges[i]
            if any(poly.contains(edge.mid) for poly in avoid):
                blocked += 1
            if segments and segments[-1]["feature_id"] == edge.feature_id:
                segments[-1]["length_m"] += edge.length
            else:
                segments.append({"feature_id": edge.feature_id, "name": edge.feature_name, "layer": edge.layer, "length_m": edge.length})
        for seg in segments:
            seg["length_m"] = round(seg["length_m"], 1)
        return PathResult(coords, round(length, 1), round(dist[dst], 1), segments, blocked)


def simplify_coords(coords: list[list[float]], tolerance_m: float = 0.5, proj: geo.LocalProjection | None = None) -> list[list[float]]:
    """Drop the extra 10 m vertices on straight stretches (smaller payloads, same shape)."""
    if len(coords) < 3:
        return coords
    proj = proj or geo.DEFAULT_PROJECTION
    simple = proj.geom_to_xy(LineString(coords)).simplify(tolerance_m, preserve_topology=False)
    return [[round(c, 7) for c in proj.to_lonlat(x, y)] for x, y in simple.coords]


def line_length_m(coords: list[list[float]], proj: geo.LocalProjection | None = None) -> float:
    proj = proj or geo.DEFAULT_PROJECTION
    return float(proj.geom_to_xy(LineString(coords)).length)
