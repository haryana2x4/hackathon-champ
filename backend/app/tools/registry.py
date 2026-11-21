from __future__ import annotations

import time
from typing import Any
from google.genai import types
from sqlalchemy.orm import Session

from app.tools.create_file import UnsafePathError, create_file
from app.tools.fetch_url import UnsafeURLError, fetch_url
from app.tools.find_place import find_place
from app.tools.github_repo import github_repo
from app.tools.run_python import CodeExecutionRefusedError, run_python
from app.tools.search_free_apis import search_free_apis


def get_tool_declarations() -> list[types.FunctionDeclaration]:
    return [
        types.FunctionDeclaration(
            name="fetch_url",
            description="Fetch readable text from a public http or https URL (blocks localhost and private IPs; 10s timeout; 2 MB cap).",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The public http:// or https:// URL to fetch."}
                },
                "required": ["url"],
            },
        ),
        types.FunctionDeclaration(
            name="github_repo",
            description="Inspect a public GitHub repository's metadata, README, file tree, or a specific file (max 200 KB).",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "owner": {"type": "string", "description": "GitHub organization or username (e.g. 'public-apis')."},
                    "repo": {"type": "string", "description": "Repository name (e.g. 'public-apis')."},
                    "path": {
                        "type": "string",
                        "description": "Optional file or folder path inside the repository. Omit for README and root tree.",
                    },
                },
                "required": ["owner", "repo"],
            },
        ),
        types.FunctionDeclaration(
            name="search_free_apis",
            description="Search the local curated public-apis directory for free APIs by topic or keyword (e.g. 'weather', 'maps', 'finance').",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Topic or keyword to search for."}
                },
                "required": ["query"],
            },
        ),
        types.FunctionDeclaration(
            name="find_place",
            description="Geocode a city or place name to latitude and longitude using OpenStreetMap Nominatim (cached locally).",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Place name such as 'Pune, India' or 'Boston, MA'."}
                },
                "required": ["query"],
            },
        ),
        types.FunctionDeclaration(
            name="create_file",
            description="Write a text or code file inside workspace_out/ (relative path only, max 200 KB).",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path inside workspace_out/ (e.g. 'notes/plan.md')."},
                    "content": {"type": "string", "description": "UTF-8 file contents."},
                },
                "required": ["path", "content"],
            },
        ),
        types.FunctionDeclaration(
            name="run_python",
            description="Run a short Python snippet in a temporary folder (only works when the user turns ON 'Allow Python execution' in the UI).",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python code to execute."}
                },
                "required": ["code"],
            },
        ),
    ]


def execute_tool(
    name: str,
    args: dict[str, Any],
    *,
    db: Session,
    allow_code_run: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Execute a Champ tool and return (model_response_payload, mission_control_log_entry).
    Never raises on expected tool/safety rejections so both Gemini and Mission Control record the status.
    """
    started = time.perf_counter()
    safe_args = dict(args or {})

    try:
        if name == "fetch_url":
            result = fetch_url(str(safe_args.get("url", "")))
            summary = f"Fetched {result['bytes']} bytes (HTTP {result['status_code']})"
        elif name == "github_repo":
            result = github_repo(
                str(safe_args.get("owner", "")),
                str(safe_args.get("repo", "")),
                str(safe_args.get("path", "") or ""),
            )
            summary = f"Loaded {result.get('repo')} ({result.get('type', 'overview')})"
        elif name == "search_free_apis":
            result = search_free_apis(str(safe_args.get("query", "")))
            summary = f"Found {result['total_matches']} matches (showing {len(result['results'])})"
        elif name == "find_place":
            result = find_place(str(safe_args.get("query", "")), db)
            cached_tag = "cached" if result.get("cached") else "live"
            summary = f"{result['lat']:.4f}, {result['lon']:.4f} ({cached_tag})"
        elif name == "create_file":
            result = create_file(str(safe_args.get("path", "")), str(safe_args.get("content", "")))
            summary = f"Wrote {result['path']} ({result['bytes']} bytes)"
        elif name == "run_python":
            result = run_python(str(safe_args.get("code", "")), allow_code_run=allow_code_run)
            summary = f"Exit {result['returncode']}" + (" (timed out)" if result.get("timed_out") else "")
        else:
            raise ValueError(f"Unknown tool '{name}'.")

        elapsed_ms = max(1, int((time.perf_counter() - started) * 1000))
        log_entry = {
            "name": name,
            "args": _redact_large_args(safe_args),
            "duration_ms": elapsed_ms,
            "status": "ok",
            "summary": summary,
        }
        return {"ok": True, "data": result}, log_entry

    except (UnsafeURLError, UnsafePathError, CodeExecutionRefusedError) as exc:
        elapsed_ms = max(1, int((time.perf_counter() - started) * 1000))
        log_entry = {
            "name": name,
            "args": _redact_large_args(safe_args),
            "duration_ms": elapsed_ms,
            "status": "blocked",
            "summary": str(exc),
        }
        return {"ok": False, "blocked": True, "error": str(exc)}, log_entry

    except Exception as exc:
        elapsed_ms = max(1, int((time.perf_counter() - started) * 1000))
        log_entry = {
            "name": name,
            "args": _redact_large_args(safe_args),
            "duration_ms": elapsed_ms,
            "status": "error",
            "summary": str(exc),
        }
        return {"ok": False, "error": str(exc)}, log_entry


def _redact_large_args(args: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in args.items():
        if isinstance(v, str) and len(v) > 220:
            out[k] = v[:220] + "... [truncated]"
        else:
            out[k] = v
    return out
