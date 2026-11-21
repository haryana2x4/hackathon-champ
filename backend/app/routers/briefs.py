from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import BriefModel
from app.schemas import BriefAnalyzeRequest, BriefResponse
from app.services.brief_service import analyze_brief, serialize_brief
from app.services.gemini_service import GeminiAPIError, GeminiNotConfiguredError
from app.tools.fetch_url import UnsafeURLError

router = APIRouter(prefix="/api/briefs", tags=["briefs"])


@router.get("", response_model=list[BriefResponse])
def list_briefs(db: Session = Depends(get_db)) -> list[BriefResponse]:
    rows = db.query(BriefModel).order_by(BriefModel.created_at.desc(), BriefModel.id.desc()).all()
    return [serialize_brief(r) for r in rows]


@router.post("/analyze", response_model=BriefResponse)
def post_analyze_brief(payload: BriefAnalyzeRequest, db: Session = Depends(get_db)) -> BriefResponse:
    try:
        return analyze_brief(payload, db)
    except GeminiNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch brief URL: {exc}") from exc
    except (GeminiAPIError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{brief_id}", response_model=BriefResponse)
def get_brief(brief_id: int, db: Session = Depends(get_db)) -> BriefResponse:
    row = db.query(BriefModel).filter(BriefModel.id == brief_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Brief not found.")
    return serialize_brief(row)
