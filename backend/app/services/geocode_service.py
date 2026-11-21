from __future__ import annotations

import threading
import time
import httpx
from sqlalchemy.orm import Session

from app.models import GeocodeCacheModel

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "HackathonChamp/1.0"
MIN_INTERVAL_SECONDS = 1.05

_rate_lock = threading.Lock()
_last_request_monotonic: float = 0.0


class GeocodeError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def normalize_query(query: str) -> str:
    return " ".join(query.strip().lower().split())


def geocode_place(query: str, db: Session) -> dict:
    """Resolve a place via Nominatim (<= 1 req/sec, cached in geocode_cache)."""
    global _last_request_monotonic

    cleaned = query.strip()
    if not cleaned:
        raise GeocodeError("Location query cannot be empty.", 422)

    norm = normalize_query(cleaned)
    cached = db.query(GeocodeCacheModel).filter(GeocodeCacheModel.query_norm == norm).first()
    if cached:
        return {
            "query": cleaned,
            "display_name": cached.display_name,
            "lat": cached.lat,
            "lon": cached.lon,
            "cached": True,
        }

    with _rate_lock:
        now = time.monotonic()
        elapsed = now - _last_request_monotonic
        if _last_request_monotonic > 0 and elapsed < MIN_INTERVAL_SECONDS:
            time.sleep(MIN_INTERVAL_SECONDS - elapsed)
        _last_request_monotonic = time.monotonic()

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(
                    NOMINATIM_URL,
                    params={"q": cleaned, "format": "json", "limit": 1},
                    headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                )
                resp.raise_for_status()
                results = resp.json()
        except httpx.HTTPError as exc:
            raise GeocodeError(
                f"Geocoding service temporarily unavailable ({exc}). Try again in a moment.",
                status_code=502,
            ) from exc

    if not results:
        raise GeocodeError(
            f"Could not find place '{cleaned}'. Try 'City, Country' (e.g., Pune, India) or enter 'online'.",
            status_code=422,
        )

    top = results[0]
    lat = float(top["lat"])
    lon = float(top["lon"])
    display_name = str(top.get("display_name") or cleaned)[:400]

    entry = GeocodeCacheModel(
        query_norm=norm,
        display_name=display_name,
        lat=lat,
        lon=lon,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "query": cleaned,
        "display_name": display_name,
        "lat": lat,
        "lon": lon,
        "cached": False,
    }
