# Phase 0 — Research Notes (Hackathon Champ)

Verified on **2026-11-21**. All open-source projects below were studied for **architecture and workflow concepts only** — zero code was copied from any repository.

## 1. Reference Sources, Reused Ideas, Licences & Link Status

| Source | Status | Licence | Architecture / Workflow Idea Reused |
| :--- | :--- | :--- | :--- |
| [devpost.com/hackathons](https://devpost.com/hackathons) | Live (200) | Site Terms (proprietary; no crawling) | Standard judging rubric structure (weighted criteria, scored judging) and Devpost submission story headings (*Inspiration, What it does, How we built it, Challenges, Accomplishments, What's next, Built with*). |
| [mishmanners/hackathons](https://github.com/mishmanners/hackathons) | Live (200) | `CC0-1.0` | Organizer & participant hackathon checklists, judging expectation framing, and leaving a dedicated submit buffer before deadline. |
| [kaiiyer/hackathon](https://github.com/kaiiyer/hackathon) | Live (200) | `GPL-3.0` (ideas only; no code copied) | Deterministic starter-kit scaffolding to eliminate boilerplate setup during short hackathon sprints. |
| [public-apis/public-apis](https://github.com/public-apis/public-apis) | Live (200) | `MIT` | Markdown category tables of free public APIs. Local copy of `README.md` stored in `backend/data/public_apis.md` (with MIT attribution) for offline `search_free_apis`. |
| [hyperknot/openfreemap](https://github.com/hyperknot/openfreemap) + [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | Live (200) | OpenFreeMap `MIT` (Liberty style: `BSD-3-Clause` code / `CC-BY-4.0` design; OSM data `ODbL`); MapLibre `BSD-3-Clause` | Keyless vector tiles via `https://tiles.openfreemap.org/styles/liberty`, custom markers/popups, GeoJSON layer uploads, and visible attribution (`OpenFreeMap © OpenMapTiles Data from OpenStreetMap`). |
| [adirangel/JARVIS](https://github.com/adirangel/JARVIS) | Live (200) | None / All Rights Reserved (ideas only) | Gemini-powered tool-dispatching assistant with visible HUD status updates. |
| [ethanplusai/jarvis](https://github.com/ethanplusai/jarvis) | Live (200) | Custom Source-Available Non-Commercial (ideas only) | Concise conversational assistant UX with clear operator alerts when user action or permission is required. |
| [treevu-ai/jarvis](https://github.com/treevu-ai/jarvis) | Live (200) | Custom "Jarvis AI Assistant License" (ideas only) | Multi-step task planning and tool-routing architecture inspired by the HuggingGPT/JARVIS paper. |
| [sujankim/jarvis-ai-platform](https://github.com/sujankim/jarvis-ai-platform) | Live (200) | `Apache-2.0` | Local-first assistant architecture cleanly separating backend tool/service layers from the web client UI. |

*(All original URLs resolved live HTTP 200; no dead links required replacement.)*

## 2. Gemini API Verification (`ai.google.dev/gemini-api/docs`)
- **Models (`ai.google.dev/gemini-api/docs/models`, checked 2026-11-21):**
  - `gemini-2.5-flash` and `gemini-2.5-pro` are deprecated/restricted to prior users and route to newer models starting Dec 1, 2026.
  - **Selected Default (`GEMINI_MODEL`):** `gemini-4-hydrogen` — Google's current-generation speed/efficiency model built for everyday coding and agentic workflows, supporting a 1M context window, Free Tier availability, Function Calling, Structured Outputs, and Streaming.
  - **Documented Stable Alternative:** `gemini-3.8-flash` (stable previous-generation Flash model, also Free Tier eligible) or `gemini-3.5-flash-lite`.
- **SDK & Patterns (`google-genai`):**
  - Structured JSON outputs via `types.GenerateContentConfig(response_mime_type="application/json", response_schema=PydanticModel)`.
  - Streaming + Manual Function Calling via `client.models.generate_content_stream(...)` with `types.Tool(function_declarations=...)` and `automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)` so every tool call is intercepted, safety-checked, timed, capped at 6 calls/message, and streamed to the Mission Control panel via SSE.

## 3. Pinned Current Stable Dependencies (Verified 2026-11-21)
- **Backend (PyPI):** `fastapi==0.165.0`, `uvicorn==0.54.0`, `sqlalchemy==2.1.9`, `httpx==0.28.1`, `google-genai==3.6.1`, `pydantic==2.14.4`, `pydantic-settings==2.16.3`, `python-dotenv==1.2.4`, `beautifulsoup4==4.15.0`, `pytest==9.2.0`, `pytest-asyncio==1.5.0`, `respx==0.23.1`.
- **Frontend (npm):** `react@19.3.1`, `react-dom@19.3.1`, `vite@8.3.8`, `@vitejs/plugin-react@6.3.0`, `tailwindcss@4.3.5`, `@tailwindcss/vite@4.3.5`, `maplibre-gl@6.19.0`, `lucide-react@1.77.0`, `typescript@7.0.2`.
