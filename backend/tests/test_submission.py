from __future__ import annotations

import io
import json
import zipfile
from fastapi.testclient import TestClient

from app.models import BriefModel, IdeaModel
from app.services import gemini_service


def test_submission_generate_and_download_zip_and_files(client: TestClient, db_session, monkeypatch):
    brief = BriefModel(
        title="Civic Tech Hack",
        theme="Smart Cities",
        summary="Improve local transit.",
        source="pasted text",
    )
    db_session.add(brief)
    db_session.commit()
    db_session.refresh(brief)

    idea = IdeaModel(
        brief_id=brief.id,
        title="Transit Pulse",
        one_liner="Live bus crowding predictor",
        problem="Commuters wait for full buses.",
        solution="FastAPI + OpenFreeMap real-time occupancy alerts.",
        tech_json=json.dumps(["FastAPI", "React", "OpenFreeMap"]),
        build_hours=16.0,
        risks_json=json.dumps(["GTFS feed lag"]),
        scores_json=json.dumps([{"criterion": "Impact", "score": 5, "reason": "Daily commuter pain."}]),
        is_locked=True,
    )
    db_session.add(idea)
    db_session.commit()
    db_session.refresh(idea)

    # Without key -> 503
    no_key = client.post("/api/submission/generate", json={"idea_id": idea.id})
    assert no_key.status_code == 503
    assert "Add your Gemini key to .env" in no_key.json()["detail"]

    # With mocked Gemini -> generates all 7 sections + 3 files
    monkeypatch.setenv("GEMINI_API_KEY", "test-fake-key")
    pitch_words = " ".join(["Transit"] * 295)
    sub_json = json.dumps(
        {
            "inspiration": "Commuters lose hours to surprise full buses.",
            "what_it_does": "Shows live bus arrivals and crowding alerts on OpenFreeMap.",
            "how_we_built_it": "FastAPI backend with React + MapLibre frontend.",
            "challenges": "Normalizing inconsistent city GTFS feeds.",
            "accomplishments": "Working live map and alert subscription in 16 hours.",
            "whats_next": "Add SMS alerts and wheelchair-space indicators.",
            "built_with": ["FastAPI", "React", "MapLibre GL JS", "OpenFreeMap"],
            "readme_md": "# Transit Pulse\n\nLive transit alerts.\n",
            "pitch_2min_md": f"# 2-Minute Pitch\n\n{pitch_words}\n",
            "demo_checklist_md": "# Demo Checklist\n\n- [ ] Start backend\n- [ ] Open map\n",
        }
    )
    monkeypatch.setattr(gemini_service, "get_gemini_client", lambda: (object(), "gemini-4-hydrogen"))
    monkeypatch.setattr(gemini_service, "_call_json_model", lambda *_a, **_kw: sub_json)

    res = client.post("/api/submission/generate", json={"idea_id": idea.id})
    assert res.status_code == 200
    body = res.json()
    assert body["inspiration"]
    assert body["what_it_does"]
    assert body["how_we_built_it"]
    assert body["challenges"]
    assert body["accomplishments"]
    assert body["whats_next"]
    assert len(body["built_with"]) == 4
    assert 260 <= body["pitch_word_count"] <= 340

    # Download full zip
    dl_zip = client.get(f"/api/submission/{idea.id}/download")
    assert dl_zip.status_code == 200
    assert dl_zip.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(dl_zip.content)) as zf:
        names = set(zf.namelist())
        assert names == {"DEVPOST_SUBMISSION.md", "README.md", "pitch-2min.md", "demo-checklist.md"}

    # Download individual file
    dl_pitch = client.get(f"/api/submission/{idea.id}/download?file=pitch")
    assert dl_pitch.status_code == 200
    assert "pitch-2min.md" in dl_pitch.headers["content-disposition"]
    assert "2-Minute Pitch" in dl_pitch.text
