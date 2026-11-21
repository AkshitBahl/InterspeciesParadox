"""The map API: GeoJSON layers, user-added features, scenarios, animations and the LLM export."""

from app.seed.brussels_dataset import ll
from tests.helpers import API, conflict_by_title, solutions_by_strategy


def test_map_config_for_maplibre(client):
    cfg = client.get(f"{API}/map/config").json()
    assert cfg["today"] == "2126-05-20"
    lon, lat = cfg["center"]
    assert 4.3 < lon < 4.45 and 50.8 < lat < 50.85  # Ixelles, Brussels
    min_lon, min_lat, max_lon, max_lat = cfg["bounds"]
    assert min_lon < lon < max_lon and min_lat < lat < max_lat
    assert cfg["basemap_style_url"].startswith("https://")
    keys = [layer["key"] for layer in cfg["layers"]]
    assert {"building", "wildlife_site", "ecological_buffer", "human_route", "delivery_route", "conflict_hotspot", "agreed_zone"} <= set(keys)
    # ready-made MapLibre style layers, all reading one GeoJSON source
    assert all(layer["source"] == "paradox" for layer in cfg["maplibre_layers"])
    assert any(layer["type"] == "fill-extrusion" for layer in cfg["maplibre_layers"])


def test_features_are_valid_geojson_and_filterable(client):
    fc = client.get(f"{API}/map/features").json()
    assert fc["type"] == "FeatureCollection"
    assert fc["metadata"]["count"] == len(fc["features"]) > 50
    for f in fc["features"]:
        assert f["type"] == "Feature"
        assert f["geometry"]["type"] in ("Point", "LineString", "Polygon", "MultiPolygon", "MultiLineString")
        assert f["properties"]["layer"] and f["properties"]["emoji"]

    buildings = client.get(f"{API}/map/features", params={"layers": "building"}).json()["features"]
    assert len(buildings) == 6 and all(b["properties"]["height_m"] > 0 for b in buildings)
    bats = client.get(f"{API}/map/features", params={"species": "common-pipistrelle", "layers": "wildlife_site"}).json()["features"]
    assert len(bats) == 1 and bats[0]["properties"]["species_slug"] == "common-pipistrelle"
    assert client.get(f"{API}/map/features", params={"layers": "volcano"}).status_code == 422
    assert client.get(f"{API}/map/features", params={"bbox": "1,2,3"}).status_code == 422


def test_seasonal_buffers(client):
    may = client.get(f"{API}/map/features", params={"layers": "ecological_buffer", "active_on": "2126-05-20"}).json()["features"]
    december = client.get(f"{API}/map/features", params={"layers": "ecological_buffer", "active_on": "2126-12-15"}).json()["features"]
    may_species = {f["properties"]["species_slug"] for f in may}
    dec_species = {f["properties"]["species_slug"] for f in december}
    assert "house-martin" in may_species and "house-martin" not in dec_species  # martins are in Africa in winter
    assert "common-pipistrelle" in dec_species  # hibernating bats still need quiet


def test_bbox_filter(client):
    everything = client.get(f"{API}/map/features").json()["features"]
    (w, s), (e, n) = ll(-200, 40), ll(-100, 140)
    some = client.get(f"{API}/map/features", params={"bbox": f"{w},{s},{e},{n}"}).json()["features"]
    assert 0 < len(some) < len(everything)


def test_add_move_and_delete_my_own_features(client, lina, mei):
    places = client.get(f"{API}/map/locations").json()
    playground = next(p for p in places if p["name"] == "Pondside playground")

    r = client.post(f"{API}/map/features", headers=lina, json={
        "layer": "resident", "name": "Lina with the stroller", "location_feature_id": playground["feature_id"], "properties": {"emoji": "👩‍🍼"},
    })
    assert r.status_code == 201, r.text
    me = r.json()
    assert me["geometry"]["coordinates"] == [playground["lon"], playground["lat"]]
    assert me["properties"]["emoji"] == "👩‍🍼"

    moved = client.patch(f"{API}/map/features/{me['id']}", headers=lina, json={"geometry": {"type": "Point", "coordinates": [4.3741, 50.8241]}})
    assert moved.json()["geometry"]["coordinates"] == [4.3741, 50.8241]
    assert client.patch(f"{API}/map/features/{me['id']}", headers=mei, json={"name": "hacked"}).status_code == 403
    assert client.delete(f"{API}/map/features/{me['id']}", headers=lina).status_code == 204
    assert client.get(f"{API}/map/features/{me['id']}").status_code == 404


def test_dataset_and_system_layers_are_protected(client, lina):
    building = client.get(f"{API}/map/features", params={"layers": "building"}).json()["features"][0]
    assert client.patch(f"{API}/map/features/{building['id']}", headers=lina, json={"name": "Mine now"}).status_code == 403
    point = {"type": "Point", "coordinates": [4.374, 50.824]}
    assert client.post(f"{API}/map/features", headers=lina, json={"layer": "agreed_zone", "name": "x", "geometry": point}).status_code == 422
    assert client.post(f"{API}/map/features", headers=lina, json={"layer": "wildlife_site", "name": "x", "geometry": point}).status_code == 422
    assert client.post(f"{API}/map/features", json={"layer": "resident", "name": "x", "geometry": point}).status_code == 401


def test_adding_a_nest_adds_its_buffer(client, noor):
    r = client.post(f"{API}/map/features", headers=noor, json={
        "layer": "wildlife_site", "name": "New hedgehog nest", "species_slug": "european-hedgehog",
        "geometry": {"type": "Point", "coordinates": ll(0, -120)},
    })
    nest = r.json()
    buffers = client.get(f"{API}/map/features", params={"layers": "ecological_buffer"}).json()["features"]
    mine = [b for b in buffers if b["properties"]["parent_id"] == nest["id"]]
    assert len(mine) == 1 and mine[0]["geometry"]["type"] == "Polygon"
    client.delete(f"{API}/map/features/{nest['id']}", headers=noor)
    buffers = client.get(f"{API}/map/features", params={"layers": "ecological_buffer"}).json()["features"]
    assert not any(b["properties"]["parent_id"] == nest["id"] for b in buffers)


def test_current_vs_proposed_scenario(client):
    bees = conflict_by_title(client, "bees")
    habitat = solutions_by_strategy(client, bees["id"])["alternative_habitat"]

    current_ids = {f["id"] for f in client.get(f"{API}/map/features").json()["features"]}
    proposed = client.get(f"{API}/map/scenarios/{habitat['id']}").json()
    proposed_only = [f for f in proposed["features"] if f["properties"].get("scenario_role") == "proposed"]
    assert proposed_only, "a solution should add something to the map"
    assert all(f["id"] not in current_ids for f in proposed_only)
    assert proposed["metadata"]["coexistence_index"] == habitat["coexistence_index"]

    same = client.get(f"{API}/map/features", params={"scenario": "proposed", "solution_id": habitat["id"]}).json()
    assert len(same["features"]) == len(proposed["features"])
    assert client.get(f"{API}/map/features", params={"scenario": "proposed"}).status_code == 422

    cmp_ = client.get(f"{API}/map/scenarios/{habitat['id']}/compare").json()
    assert set(cmp_["added"]) == {f["id"] for f in proposed_only}
    assert cmp_["current"]["type"] == cmp_["proposed"]["type"] == "FeatureCollection"


def test_rerouting_solution_replaces_the_old_route(client):
    """The house martin quiet-zone idea moves Lina's journeys to the side entrance."""
    from app.services import solution_engine  # noqa: F401  (documents where the logic lives)

    martins = conflict_by_title(client, "House martins")
    rows = client.get(f"{API}/conflicts/{martins['id']}/solutions").json()
    quiet = next(s for s in rows if s["strategy"] == "seasonal_quiet_zone")
    cmp_ = client.get(f"{API}/map/scenarios/{quiet['id']}/compare").json()
    assert cmp_["replaced"], "rerouted journeys replace the old ones"
    current_roles = {f["id"]: f["properties"].get("scenario_role") for f in cmp_["current"]["features"]}
    assert all(current_roles.get(fid) == "replaced" for fid in cmp_["replaced"])


def test_animations(client):
    anim = client.get(f"{API}/map/animations").json()
    kinds = {t["kind"] for t in anim["tracks"]}
    assert {"wildlife", "human", "delivery"} <= kinds
    for t in anim["tracks"]:
        assert len(t["coordinates"]) >= 2 and t["duration_ms"] > 0
        assert len(t["keyframes"]) >= 2 and all(len(k) == 2 for k in t["keyframes"])  # evenly spaced [lon, lat]
    with_streets = client.get(f"{API}/map/animations", params={"include_streets": True}).json()
    assert len(with_streets["tracks"]) >= len(anim["tracks"])


def test_markdown_export_for_an_llm(client):
    fox = conflict_by_title(client, "Fox")
    r = client.post(f"{API}/map/export/markdown", json={"conflict_id": fox["id"], "question": "Where should the fence go?", "include_geojson": True})
    assert r.status_code == 200, r.text
    out = r.json()
    md = out["markdown"]
    assert md.startswith("# ")
    for heading in ("## Area", "## Wildlife homes", "## Conflicts", "## Task"):
        assert heading in md
    assert "Red fox" in md and "Where should the fence go?" in md
    assert out["geojson"]["type"] == "FeatureCollection"
    assert sum(out["summary"]["counts"].values()) == len(out["geojson"]["features"])
    assert any(site["species"] == "red-fox" and site["sensitive_now"] for site in out["summary"]["wildlife_sites"])

    raw = client.get(f"{API}/map/export/markdown", params={"conflict_id": fox["id"]})
    assert raw.headers["content-type"].startswith("text/markdown")


def test_markdown_export_with_drawn_polygon_and_extra_features(client):
    ring = [ll(-140, -130), ll(-40, -130), ll(-40, -40), ll(-140, -40), ll(-140, -130)]
    drawn = {"type": "Feature", "geometry": {"type": "Point", "coordinates": ll(-90, -90)}, "properties": {"name": "Planned bench"}}
    out = client.post(f"{API}/map/export/markdown", json={"polygon": {"type": "Polygon", "coordinates": [ring]}, "extra_features": drawn}).json()
    assert "Planned bench" in out["markdown"]
    whole = client.post(f"{API}/map/export/markdown", json={}).json()  # no area = the whole dataset
    assert whole["summary"]["area"]["kind"] == "whole dataset"
    assert client.post(f"{API}/map/export/markdown", json={"bbox": [1, 2, 3]}).status_code == 400


def test_geojson_download(client):
    fc = client.get(f"{API}/map/export/geojson").json()
    assert fc["type"] == "FeatureCollection" and fc["metadata"]["neighbourhood"]["name"]


def test_simplestyle_colours_for_geojson_io(client):
    plain = client.get(f"{API}/map/features").json()["features"]
    assert not any("marker-color" in f["properties"] or "stroke" in f["properties"] for f in plain)

    styled = client.get(f"{API}/map/features", params={"simplestyle": True}).json()["features"]
    colour = {f["properties"]["layer"]: f["properties"].get("marker-color") for f in styled if f["geometry"]["type"] == "Point"}
    assert colour["resident"] != colour["wildlife"]  # humans and animals look different
    building = next(f for f in styled if f["properties"]["layer"] == "building")
    assert building["properties"]["fill"] and building["properties"]["fill-opacity"] > 0
    assert all("stroke" in f["properties"] for f in styled if f["geometry"]["type"] == "LineString")
    export = client.get(f"{API}/map/export/geojson", params={"simplestyle": True}).json()["features"]
    assert all(("marker-color" in f["properties"]) or ("stroke" in f["properties"]) for f in export)
