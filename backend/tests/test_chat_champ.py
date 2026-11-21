from __future__ import annotations

import json
from types import SimpleNamespace
from fastapi.testclient import TestClient

from app.services import champ_agent


def test_chat_returns_503_when_no_key(client: TestClient):
    res = client.post("/api/chat", json={"message": "Hello Champ", "allow_code_run": False})
    assert res.status_code == 503
    assert "Add your Gemini key to .env" in res.json()["detail"]


def test_chat_sse_streams_tool_call_and_answer(client: TestClient, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-fake-key")

    round_num = {"n": 0}

    class FakeModels:
        def generate_content_stream(self, **_kwargs):
            round_num["n"] += 1
            if round_num["n"] == 1:
                fc = SimpleNamespace(name="search_free_apis", args={"query": "weather"})
                part = SimpleNamespace(function_call=fc, text=None, thought=False)
                yield SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))])
            else:
                p1 = SimpleNamespace(function_call=None, text="Try ", thought=False)
                p2 = SimpleNamespace(function_call=None, text="Open-Meteo for weather!", thought=False)
                yield SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[p1]))])
                yield SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[p2]))])

    fake_client = SimpleNamespace(models=FakeModels())
    monkeypatch.setattr(champ_agent, "get_gemini_client", lambda: (fake_client, "gemini-4-hydrogen"))

    res = client.post(
        "/api/chat",
        json={"message": "Find a free weather API", "allow_code_run": False},
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]

    body = res.text
    assert "event: tool_start" in body
    assert "event: tool_end" in body
    assert "search_free_apis" in body
    assert "event: token" in body
    assert "Open-Meteo" in body
    assert "event: done" in body

    history = client.get("/api/chat/history").json()
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
    assert history[1]["tool_logs"][0]["name"] == "search_free_apis"
    assert history[1]["tool_logs"][0]["status"] == "ok"


def test_chat_enforces_max_six_tool_calls(client: TestClient, monkeypatch):
    from google.genai import types

    monkeypatch.setenv("GEMINI_API_KEY", "test-fake-key")
    rounds = {"n": 0}

    class LoopModels:
        def generate_content_stream(self, **_kwargs):
            rounds["n"] += 1
            if rounds["n"] <= 7:
                part = types.Part(
                    function_call=types.FunctionCall(name="search_free_apis", args={"query": "weather"})
                )
                yield SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))])
            else:
                part = types.Part.from_text(text="Done summarizing.")
                yield SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))])

    monkeypatch.setattr(champ_agent, "get_gemini_client", lambda: (SimpleNamespace(models=LoopModels()), "gemini-4-hydrogen"))

    res = client.post("/api/chat", json={"message": "Loop test", "allow_code_run": False})
    assert res.status_code == 200
    history = client.get("/api/chat/history").json()
    logs = history[-1]["tool_logs"]
    ok_calls = [l for l in logs if l["status"] == "ok"]
    blocked_calls = [l for l in logs if l["status"] == "blocked"]
    assert len(ok_calls) == 6
    assert len(blocked_calls) == 1

