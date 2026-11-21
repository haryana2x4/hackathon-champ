from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import IdeaModel
from app.schemas import SubmissionGenerateRequest, SubmissionResponse
from app.services.gemini_service import GeminiAPIError, GeminiNotConfiguredError
from app.services.submission_service import (
    build_submission_download,
    generate_submission_kit,
    serialize_submission,
)

router = APIRouter(prefix="/api/submission", tags=["submission"])


@router.post("/generate", response_model=SubmissionResponse)
def post_generate_submission(
    payload: SubmissionGenerateRequest,
    db: Session = Depends(get_db),
) -> SubmissionResponse:
    try:
        return generate_submission_kit(payload.idea_id, db)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeminiNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except GeminiAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{idea_id}", response_model=SubmissionResponse | None)
def get_submission(idea_id: int, db: Session = Depends(get_db)) -> SubmissionResponse | None:
    idea = db.query(IdeaModel).filter(IdeaModel.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail=f"Idea {idea_id} not found.")
    return serialize_submission(idea)


@router.get("/{idea_id}/download")
def download_submission(
    idea_id: int,
    file: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> Response:
    try:
        data, media_type, filename = build_submission_download(idea_id, db, file_key=file)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
