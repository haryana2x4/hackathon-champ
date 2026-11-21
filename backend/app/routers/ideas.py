from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import IdeaModel
from app.schemas import IdeaGenerateRequest, IdeaResponse
from app.services.gemini_service import GeminiAPIError, GeminiNotConfiguredError
from app.services.idea_service import generate_ideas_for_brief, lock_idea, serialize_idea

router = APIRouter(prefix="/api/ideas", tags=["ideas"])


@router.get("", response_model=list[IdeaResponse])
def list_ideas(
    brief_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[IdeaResponse]:
    q = db.query(IdeaModel)
    if brief_id is not None:
        q = q.filter(IdeaModel.brief_id == brief_id)
    rows = q.order_by(IdeaModel.is_locked.desc(), IdeaModel.created_at.desc(), IdeaModel.id.desc()).all()
    return [serialize_idea(r) for r in rows]


@router.post("/generate", response_model=list[IdeaResponse])
def post_generate_ideas(payload: IdeaGenerateRequest, db: Session = Depends(get_db)) -> list[IdeaResponse]:
    try:
        return generate_ideas_for_brief(payload.brief_id, db)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeminiNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except GeminiAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/{idea_id}/lock", response_model=IdeaResponse)
def post_lock_idea(idea_id: int, db: Session = Depends(get_db)) -> IdeaResponse:
    try:
        return lock_idea(idea_id, db)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
