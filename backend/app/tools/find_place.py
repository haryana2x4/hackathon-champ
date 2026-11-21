from __future__ import annotations

from sqlalchemy.orm import Session
from app.services.geocode_service import geocode_place


def find_place(query: str, db: Session) -> dict:
    """Resolve a place name to latitude/longitude using Nominatim (1 req/sec, cached in geocode_cache)."""
    return geocode_place(query, db)
