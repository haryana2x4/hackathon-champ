from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import HackathonModel
from app.schemas import HackathonCreateRequest, HackathonResponse
from app.services.geocode_service import GeocodeError, geocode_place

router = APIRouter(prefix="/api/hackathons", tags=["hackathons"])


def _serialize(row: HackathonModel) -> HackathonResponse:
    return HackathonResponse(
        id=row.id,
        name=row.name,
        link=row.link,
        date=row.date,
        location=row.location,
        is_online=row.is_online,
        lat=row.lat,
        lon=row.lon,
        display_name=row.display_name,
        created_at=row.created_at.isoformat(),
    )


@router.get("", response_model=list[HackathonResponse])
def list_hackathons(db: Session = Depends(get_db)) -> list[HackathonResponse]:
    rows = db.query(HackathonModel).order_by(HackathonModel.created_at.desc(), HackathonModel.id.desc()).all()
    return [_serialize(r) for r in rows]


@router.post("", response_model=HackathonResponse, status_code=status.HTTP_201_CREATED)
def create_hackathon(payload: HackathonCreateRequest, db: Session = Depends(get_db)) -> HackathonResponse:
    loc_lower = payload.location.strip().lower()
    is_online = loc_lower in {"online", "virtual", "remote"}

    lat: float | None = None
    lon: float | None = None
    display_name = "Online"

    if not is_online:
        try:
            geo = geocode_place(payload.location, db)
            lat = geo["lat"]
            lon = geo["lon"]
            display_name = geo["display_name"]
        except GeocodeError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    row = HackathonModel(
        name=payload.name,
        link=payload.link,
        date=payload.date,
        location=payload.location,
        is_online=is_online,
        lat=lat,
        lon=lon,
        display_name=display_name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.delete("/{hackathon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hackathon(hackathon_id: int, db: Session = Depends(get_db)) -> Response:
    row = db.query(HackathonModel).filter(HackathonModel.id == hackathon_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Hackathon not found.")
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
