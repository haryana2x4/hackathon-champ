# Hackathon Champ

**Hackathon Champ** is a cross-platform (Windows, macOS, Linux) web application with a Jarvis-style AI co-pilot (**Champ**) built to help a student team win a hackathon — from brief analysis and idea scoring to event mapping, time-boxed sprint planning, deterministic repo scaffolding, and Devpost submission writing.

## Quick Start (3 Commands Max)

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
# Optional: paste your Gemini API key into .env line 1 (Map, Sprint & Scaffold work without a key)
python run.py
```

- **Web App:** `http://localhost:5173`
- **Backend API:** `http://localhost:8000`
- **OpenAPI Docs:** `http://localhost:8000/docs`

> `python run.py` automatically bootstraps `backend/.venv` and installs `frontend/node_modules` if missing, then starts FastAPI (`:8000`) and Vite (`:5173`).

## Features (7 Mission Control Pages)

| Page | Works Without API Key? | What It Does |
| :--- | :--- | :--- |
| **Brief** | Shows key banner | Paste a public hackathon URL or text to get a structured card, sponsor tech, rules checklist, and organiser judging criteria (never invented; falls back cleanly to `"Default rubric (not from organiser)"`). |
| **Ideas** | Shows key banner | Generates 3 distinct ideas tailored to sponsor tech & rules, scored 1–5 per rubric criterion; lock your winner. |
| **Champ** | Shows key banner | Streaming SSE Jarvis-style chat + real-time **Mission Control** tool log (max 6 tool calls/message) + explicit opt-in Python execution toggle (not a full sandbox). |
| **Map** | Yes | Track in-person hackathons (OpenFreeMap Liberty + MapLibre markers/popups via cached Nominatim geocoding), online hackathons list, and uploaded GeoJSON project areas. |
| **Sprint** | Yes | Converts deadline + team size into an exact `10% setup / 50% build / 15% test & fix / 15% polish & demo / 10% submit buffer` schedule with a **75% feature freeze**, live countdown, and persistent task ticks. |
| **Submission** | Shows key banner | Generates all 7 Devpost sections plus downloadable `README.md`, `pitch-2min.md` (~300 words), and `demo-checklist.md` (single files or `.zip`). |
| **Scaffold** | Yes | Deterministically generates a FastAPI + React starter repository inside `workspace_out/<project-slug>/` with its own `README.md` and `/health` endpoint. |

## Champ Tool Safety Guards

- `fetch_url(url)`: HTTP/HTTPS only; DNS + IP SSRF guard blocking localhost, loopback, private, and link-local addresses on every redirect hop; 10s timeout; 2 MB cap.
- `github_repo(owner, repo, path?)`: GitHub REST API with optional `GITHUB_TOKEN`, 200 KB cap, clear rate-limit error.
- `search_free_apis(query)`: Searches local `backend/data/public_apis.md` (no external scraping).
- `find_place(query)`: Nominatim geocoding (`User-Agent: HackathonChamp/1.0`, <= 1 req/sec, cached in SQLite `geocode_cache`).
- `create_file(path, content)`: Strictly jailed inside `workspace_out/`, rejects path traversal (`../`) and files > 200 KB.
- `run_python(code)`: Refused by default unless the UI toggle is ON; runs in a temporary folder with `-I` isolated mode, stripped environment (never inherits `.env` keys), 10s timeout, and 1 MB output cap.

## Testing & Verification

```bash
cd backend && .venv/Scripts/python -m pytest -v    # macOS/Linux: .venv/bin/python -m pytest -v
cd frontend && npm run build
```

## Documentation

- [docs/research-notes.md](docs/research-notes.md) — Architecture research, licences, and API references
- [docs/decisions.md](docs/decisions.md) — Architectural and product decisions
- [docs/next-steps.md](docs/next-steps.md) — Deferred ideas kept out of v1 scope

## Open-Source Credits & Attribution

Studied for architecture & workflow inspiration only (zero code copied), except where an MIT-licensed data file or runtime library is explicitly used:

- **OpenFreeMap** ([hyperknot/openfreemap](https://github.com/hyperknot/openfreemap), MIT; Liberty style BSD-3-Clause/CC-BY-4.0) & **MapLibre GL JS** ([maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js), BSD-3-Clause) — vector map tiles & rendering. Map data attribution: `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` (ODbL).
- **Public APIs** ([public-apis/public-apis](https://github.com/public-apis/public-apis), MIT) — local copy of `README.md` bundled in `backend/data/public_apis.md` for `search_free_apis`.
- **mishmanners/hackathons** (`CC0-1.0`) — hackathon workflow & submission buffer inspiration.
- **kaiiyer/hackathon** (`GPL-3.0`, architecture concept only) — deterministic starter-kit workflow inspiration.
- **Jarvis-style agent repos** studied for HUD & tool-routing architecture only: `adirangel/JARVIS`, `ethanplusai/jarvis`, `treevu-ai/jarvis`, and `sujankim/jarvis-ai-platform` (`Apache-2.0`).
- **Nominatim / OpenStreetMap** — place geocoding under OpenStreetMap ODbL.
