from __future__ import annotations

import pytest
import respx
import httpx

from app.tools.create_file import UnsafePathError, create_file
from app.tools.fetch_url import UnsafeURLError, assert_safe_url, fetch_url
from app.tools.github_repo import github_repo
from app.tools.registry import execute_tool
from app.tools.run_python import CodeExecutionRefusedError, run_python
from app.tools.search_free_apis import search_free_apis


def test_fetch_url_blocks_localhost_private_link_local_and_non_http():
    blocked_urls = [
        "http://localhost:8000/api/health",
        "http://127.0.0.1:8000/api/health",
        "http://[::1]:8000/api/health",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/admin",
        "http://192.168.1.1/",
        "file:///etc/passwd",
        "ftp://example.com/file",
    ]
    for url in blocked_urls:
        with pytest.raises(UnsafeURLError):
            assert_safe_url(url)

    with pytest.raises(UnsafeURLError):
        fetch_url("http://localhost:8000/api/health")


def test_create_file_rejects_traversal_and_writes_inside_workspace(tmp_env_empty):
    for bad in ["../x", "sub/../../x", "/etc/passwd", "C:\\temp\\evil.txt", ""]:
        with pytest.raises(UnsafePathError):
            create_file(bad, "bad")

    # Over 200 KB cap rejected
    with pytest.raises(ValueError, match="200 KB"):
        create_file("too_big.txt", "a" * (200 * 1024 + 5))

    # Valid path succeeds inside workspace_out
    res = create_file("notes/pitch.md", "# Hello Champ")
    assert res["path"] == "workspace_out/notes/pitch.md"
    assert res["bytes"] == len(b"# Hello Champ")


def test_run_python_refused_when_toggle_off_and_strips_env_when_on(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "SUPER_SECRET_SHOULD_NEVER_LEAK")
    monkeypatch.setenv("GITHUB_TOKEN", "SUPER_SECRET_GH")

    # Toggle OFF -> strictly refused
    with pytest.raises(CodeExecutionRefusedError):
        run_python("print('hi')", allow_code_run=False)

    # Toggle ON -> runs in temp dir with stripped env (no secrets!)
    res = run_python(
        "import os\nprint('KEY=', os.environ.get('GEMINI_API_KEY'))\nprint('GH=', os.environ.get('GITHUB_TOKEN'))\nprint(2 + 2)",
        allow_code_run=True,
    )
    assert res["returncode"] == 0
    assert "SUPER_SECRET" not in res["stdout"]
    assert "KEY= None" in res["stdout"]
    assert "GH= None" in res["stdout"]
    assert "4" in res["stdout"]


def test_search_free_apis_finds_weather_apis():
    res = search_free_apis("free weather API")
    assert res["total_matches"] > 0
    assert len(res["results"]) > 0
    names_and_cats = " ".join(f"{r['category']} {r['name']} {r['description']}" for r in res["results"]).lower()
    assert "weather" in names_and_cats


def test_github_repo_rate_limit_message(tmp_env_empty):
    with respx.mock(assert_all_called=True) as mock:
        mock.get("https://api.github.com/repos/public-apis/public-apis").mock(
            return_value=httpx.Response(
                403,
                headers={"X-RateLimit-Remaining": "0"},
                json={"message": "API rate limit exceeded"},
            )
        )
        with pytest.raises(RuntimeError, match="GITHUB_TOKEN"):
            github_repo("public-apis", "public-apis")


def test_registry_logs_blocked_safety_calls(db_session, tmp_env_empty):
    payload1, log1 = execute_tool(
        "fetch_url",
        {"url": "http://localhost:8000/api/health"},
        db=db_session,
        allow_code_run=False,
    )
    assert payload1["ok"] is False and payload1["blocked"] is True
    assert log1["status"] == "blocked"

    payload2, log2 = execute_tool(
        "create_file",
        {"path": "../x", "content": "nope"},
        db=db_session,
        allow_code_run=False,
    )
    assert payload2["ok"] is False and payload2["blocked"] is True
    assert log2["status"] == "blocked"

    payload3, log3 = execute_tool(
        "run_python",
        {"code": "print(1)"},
        db=db_session,
        allow_code_run=False,
    )
    assert payload3["ok"] is False and payload3["blocked"] is True
    assert log3["status"] == "blocked"
