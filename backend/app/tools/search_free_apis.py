from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from app.config import get_settings

STOPWORDS = {"a", "an", "the", "for", "of", "to", "in", "on", "with", "free", "public", "api", "apis"}
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


@lru_cache(maxsize=2)
def _load_entries(file_path_str: str) -> list[dict]:
    path = Path(file_path_str)
    if not path.exists():
        return []

    entries: list[dict] = []
    current_category = "General"

    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if line.startswith("### "):
            current_category = line[4:].strip()
            continue
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 5:
            continue
        if cells[0].lower() == "api" or set(cells[0]) <= {"-", ":", " "}:
            continue
        m = LINK_RE.search(cells[0])
        if not m:
            continue
        entries.append(
            {
                "category": current_category,
                "name": m.group(1).strip(),
                "url": m.group(2).strip(),
                "description": cells[1],
                "auth": cells[2].strip("` "),
                "https": cells[3],
                "cors": cells[4],
            }
        )
    return entries


def search_free_apis(query: str, limit: int = 10) -> dict:
    """Search the local public-apis README dataset stored in backend/data/public_apis.md."""
    cleaned = query.strip()
    if not cleaned:
        raise ValueError("Search query cannot be empty.")

    data_file = get_settings().data_dir / "public_apis.md"
    entries = _load_entries(str(data_file))
    if not entries:
        raise RuntimeError(f"Local public-apis dataset not found at {data_file}.")

    raw_tokens = [t for t in re.findall(r"[a-z0-9]+", cleaned.lower()) if t]
    tokens = [t for t in raw_tokens if t not in STOPWORDS] or raw_tokens
    phrase = " ".join(tokens)

    scored: list[tuple[int, dict]] = []
    for entry in entries:
        cat_l = entry["category"].lower()
        name_l = entry["name"].lower()
        desc_l = entry["description"].lower()

        score = 0
        if phrase in cat_l:
            score += 12
        if phrase in name_l:
            score += 10
        if phrase in desc_l:
            score += 6

        for tok in tokens:
            if tok in cat_l:
                score += 6
            if tok in name_l:
                score += 5
            if tok in desc_l:
                score += 3

        # Prefer keyless / no-auth & HTTPS APIs slightly when tied
        if score > 0:
            if entry["auth"].lower() in {"no", "none", ""}:
                score += 2
            if entry["https"].lower() == "yes":
                score += 1
            scored.append((score, entry))

    scored.sort(key=lambda pair: (-pair[0], pair[1]["name"].lower()))
    top_matches = [item for _, item in scored[: max(1, min(limit, 20))]]

    return {
        "query": cleaned,
        "total_matches": len(scored),
        "results": top_matches,
    }
