"""Step 1: accounts and human profiles."""

from tests.conftest import login

API = "/api/v1"


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_register_login_refresh_and_me(client):
    r = client.post(f"{API}/auth/register", json={"email": "New@Example.org", "password": "longpassword", "display_name": "Newbie"})
    assert r.status_code == 201, r.text
    assert r.json()["email"] == "new@example.org"

    again = client.post(f"{API}/auth/register", json={"email": "new@example.org", "password": "longpassword", "display_name": "Twin"})
    assert again.status_code == 409

    tokens = client.post(f"{API}/auth/login", json={"email": "new@example.org", "password": "longpassword"}).json()
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.json()["display_name"] == "Newbie"

    refreshed = client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    # an access token is not accepted as a refresh token
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401


def test_wrong_password_and_missing_token(client):
    assert client.post(f"{API}/auth/login", json={"email": "lina@example.org", "password": "nope-nope"}).status_code == 401
    assert client.get(f"{API}/auth/me").status_code == 401
    assert client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_oauth2_form_login_for_swagger(client):
    r = client.post(f"{API}/auth/token", data={"username": "lina@example.org", "password": "coexist2126"})
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"


def test_profile_get_patch_put(client, lina):
    profile = client.get(f"{API}/profiles/me", headers=lina).json()
    assert "stroller" in profile["mobility_needs"]
    assert profile["home_building_id"]

    r = client.patch(f"{API}/profiles/me", headers=lina, json={"noise_tolerance": 1, "priorities": {"quiet": 5}})
    assert r.status_code == 200
    body = r.json()
    assert body["noise_tolerance"] == 1
    assert body["priorities"]["quiet"] == 5
    assert body["priorities"]["safety"] == profile["priorities"]["safety"]  # untouched keys stay

    r = client.put(f"{API}/profiles/me", headers=lina, json={"wildlife_comfort": 5, "allergies": ["bee_sting"]})
    assert r.status_code == 200
    assert r.json()["allergies"] == ["bee_sting"]
    assert r.json()["mobility_needs"] == []  # PUT replaces everything


def test_profile_home_must_be_a_building(client, lina):
    hotspot = client.get(f"{API}/map/features", params={"layers": "conflict_hotspot"}).json()["features"][0]
    r = client.patch(f"{API}/profiles/me", headers=lina, json={"home_building_id": hotspot["id"]})
    assert r.status_code == 422


def test_public_profile_hides_private_fields(client, lina):
    mei_id = client.get(f"{API}/auth/me", headers=login(client, "mei@example.org")).json()["id"]
    public = client.get(f"{API}/profiles/{mei_id}", headers=lina).json()
    assert public["display_name"]
    assert "allergies" not in public and "budget_eur" not in public
