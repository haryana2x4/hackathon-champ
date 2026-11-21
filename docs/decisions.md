# Architectural & Product Decisions

Every autonomous decision made while building **Hackathon Champ** is logged here.

## D1 — Default Gemini Model (`gemini-4-hydrogen`)
- **Decision:** Default `GEMINI_MODEL` to `gemini-4-hydrogen` in `.env.example` and `backend/app/config.py`.
- **Why:** Checked live Gemini API docs on 2026-11-21; `gemini-2.5-flash` is deprecated and restricted. `gemini-4-hydrogen` is the current fast coding/agentic model with Free Tier support, Structured Outputs, Function Calling, and Streaming. Users can override via `.env` (e.g., `gemini-3.8-flash`).

## D2 — Exact 6 SQLite Tables
- **Decision:** Keep the exact six tables requested (`briefs`, `ideas`, `hackathons`, `geocode_cache`, `tasks`, `chat_messages`). Store generated submission kit JSON in a nullable `submission_json` column on `ideas` and store sprint metadata (`sprint_id`, `deadline_iso`, `team_size`) on `tasks`.
- **Why:** Prevents schema bloat while supporting full reload persistence for briefs, locked ideas, submission kits, sprint countdowns, and task ticks.

## D3 — Zero-Key Degradation & Keyless Scaffold Support
- **Decision:** Expose `gemini_configured` from `GET /api/health`. Return HTTP `503` with `"Add your Gemini key to .env"` from AI routes when `GEMINI_API_KEY` is blank. Allow `POST /api/scaffold` to accept either `{idea_id}` (for locked AI ideas) OR `{project_name, one_liner?, tech?}` (for manual scaffolding when no Gemini key is configured).
- **Why:** Ensures every non-AI page (Map, Sprint, Scaffold) works end-to-end with an empty `.env`, while displaying the exact required banner on AI pages (Brief, Ideas, Champ, Submission).

## D4 — Strict Manual Function Calling Loop for Champ SSE
- **Decision:** Disable automatic function calling in `google-genai` during chat and run an explicit multi-turn streaming tool loop capped at 6 tool calls per user message.
- **Why:** Guarantees backend enforcement of `allow_code_run`, SSRF guards, path traversal guards, exact per-tool timing (`duration_ms`), status logging, and real-time SSE `tool_start` / `tool_end` events to the Mission Control panel.

## D5 — Exact Sprint Time Math
- **Decision:** Compute `total_minutes = max(60, round((deadline - now) / 60))` and split into exact integer minutes using `10% / 50% / 15% / 15% / 10%` with any rounding remainder added to the Build phase so the sum of task durations equals `total_minutes` with zero floating-point drift. Mark the end of Test & Fix (cumulative 75%) as the **Feature Freeze** milestone.
- **Why:** Guarantees that a 24h deadline with any team size sums strictly to 24.0h (`1440` minutes) and displays a clear 75% feature freeze boundary.

## D6 — Visual Theme & Accessibility
- **Decision:** Use a dark Mission Control palette (`#0B101B` canvas, `#121A2B` cards, `#1A253D` elevated controls) with a single accent colour (Electric Cyan `#22D3EE` for dark surfaces / `#0891B2` fills with dark `#04111B` button text) meeting WCAG-AA contrast (`>= 4.5:1`), plus keyboard-navigable landmarks and plain-English labels.
- **Why:** High legibility during late-night hackathons without visual clutter or multiple competing accent colours.

## D7 — Windows-Safe Subprocess Isolation for `run_python`
- **Decision:** Pass a minimal allow-listed environment (`SYSTEMROOT` and `COMSPEC` on Windows, `PATH` stripped to Python's directory only; zero `.env` or user env vars) to `subprocess.run([sys.executable, "-I", script_path], cwd=tmpdir, timeout=10)` with `-I` isolated mode and 1 MB stdout/stderr cap.
- **Why:** Python on Windows requires `SYSTEMROOT` for socket/CRT initialization, while `-I` + stripped env guarantees `GEMINI_API_KEY`, `GITHUB_TOKEN`, and all user environment secrets are never exposed to executed code.

## D8 — Cross-Platform Launcher (`run.py`)
- **Decision:** Use `pathlib`, `sys.executable`, `shutil.which("npm.cmd" if windows else "npm")`, and automatic detection of `backend/.venv` so `python run.py` starts both FastAPI (`:8000`) and Vite (`:5173`) with zero bash dependencies.
- **Why:** Works identically on Windows PowerShell/CMD, macOS, and Linux from a clean checkout.
