from __future__ import annotations

from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
from fastapi.testclient import TestClient
import respx
import httpx

from app.models import GeocodeCacheModel
from app.services import geocode_service


def test_hackathons_online_and_geocoded_with_cache(client: TestClient, db_session, monkeypatch):
    monkeypatch.setattr(geocode_service, "MIN_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(geocode_service, "_last_request_monotonic", 0.0)

    # 1. Online hackathon skips geocoding
    r_online = client.post(
        "/api/hackathons",
        json={"name": "Global AI Jam", "link": "https://example.com", "date": "2026-12-01", "location": "online"},
    )
    assert r_online.status_code == 201
    online_data = r_online.json()
    assert online_data["is_online"] is True
    assert online_data["lat"] is None
    assert online_data["lon"] is None

    # 2. In-person hackathon geocodes via Nominatim & caches result
    with respx.mock(assert_all_called=True) as mock:
        route = mock.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(
                200,
                json=[{"lat": "18.5204", "lon": "73.8567", "display_name": "Pune, Maharashtra, India"}],
            )
        )
        r1 = client.post(
            "/api/hackathons",
            json={"name": "Pune Buildathon", "link": "", "date": "2026-12-05", "location": "Pune, India"},
        )
        assert r1.status_code == 201
        d1 = r1.json()
        assert d1["is_online"] is False
        assert abs(d1["lat"] - 18.5204) < 0.001
        assert abs(d1["lon"] - 73.8567) < 0.001
        assert route.call_count == 1
        assert route.calls[0].request.headers["User-Agent"] == "HackathonChamp/1.0"

        # Second request for same place uses geocode_cache (no second HTTP call)
        r2 = client.post(
            "/api/hackathons",
            json={"name": "Pune Hack 2", "link": "", "date": "2026-12-06", "location": "  pune, india "},
        )
        assert r2.status_code == 201
        assert route.call_count == 1

    assert db_session.query(GeocodeCacheModel).count() == 1

    # 3. List & delete
    listed = client.get("/api/hackathons").json()
    assert len(listed) == 3

    del_res = client.delete(f"/api/hackathons/{online_data['id']}")
    assert del_res.status_code == 204
    assert len(client.get("/api/hackathons").json()) == 2


def test_sprint_24h_exact_sum_feature_freeze_and_task_tick(client: TestClient):
    deadline = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    res = client.post("/api/sprint", json={"deadline_iso": deadline, "team_size": 3})
    assert res.status_code == 200
    data = res.json()

    # Exact total time = 1440 minutes = 24.0 hours
    assert data["total_minutes"] == 1440
    assert data["total_hours"] == 24.0

    # Phases split 10/50/15/15/10 and sum strictly to total_minutes
    pcts = [p["percent"] for p in data["phases"]]
    assert pcts == [10, 50, 15, 15, 10]
    assert sum(p["minutes"] for p in data["phases"]) == 1440
    assert data["feature_freeze_minutes"] == 1080  # 75% of 1440

    # Tasks sum strictly to 1440 minutes (24h)
    tasks = data["tasks"]
    assert sum(t["duration_minutes"] for t in tasks) == 1440
    assert any(t["is_feature_freeze"] for t in tasks)

    # Tick first task and verify persistence on GET /api/sprint
    first_id = tasks[0]["id"]
    patch = client.patch(f"/api/tasks/{first_id}", json={"completed": True})
    assert patch.status_code == 200
    assert patch.json()["completed"] is True

    reloaded = client.get("/api/sprint").json()
    reloaded_first = next(t for t in reloaded["tasks"] if t["id"] == first_id)
    assert reloaded_first["completed"] is True


def test_scaffold_deterministic_and_generated_backend_health(client: TestClient):
    res = client.post(
        "/api/scaffold",
        json={
            "project_name": "Civic Pulse",
            "one_liner": "Real-time transit alert dashboard",
            "tech": ["FastAPI", "React", "MapLibre"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    out_dir = Path(data["path"])
    assert out_dir.exists()
    assert (out_dir / "README.md").exists()
    backend_main = out_dir / "backend" / "main.py"
    assert backend_main.exists()
    assert (out_dir / "frontend" / "package.json").exists()

    # Dynamically load generated FastAPI app and verify /health returns 200 OK
    spec = importlib.util.spec_from_file_location("generated_scaffold_main", backend_main)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    gen_client = TestClient(mod.app)
    health_res = gen_client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "ok"
    assert health_res.json()["project"] == "Civic Pulse"
