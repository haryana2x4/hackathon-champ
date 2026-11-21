from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import ScaffoldRequest, ScaffoldResponse
from app.services.scaffold_service import generate_scaffold

router = APIRouter(prefix="/api", tags=["scaffold"])


@router.post("/scaffold", response_model=ScaffoldResponse)
def create_scaffold(payload: ScaffoldRequest, db: Session = Depends(get_db)) -> ScaffoldResponse:
    try:
        return generate_scaffold(payload, db)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
