from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import KEY_MISSING_MESSAGE, get_settings
from app.db import get_db
from app.models import ChatMessageModel
from app.schemas import ChatMessageResponse, ChatRequest, ToolLogEntry
from app.services.champ_agent import stream_champ_response

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/history", response_model=list[ChatMessageResponse])
def get_chat_history(db: Session = Depends(get_db)) -> list[ChatMessageResponse]:
    rows = db.query(ChatMessageModel).order_by(ChatMessageModel.id.asc()).all()
    out: list[ChatMessageResponse] = []
    for row in rows:
        logs = [ToolLogEntry(**item) for item in json.loads(row.tool_logs_json or "[]")]
        out.append(
            ChatMessageResponse(
                id=row.id,
                role=row.role,
                content=row.content,
                tool_logs=logs,
                created_at=row.created_at.isoformat(),
            )
        )
    return out


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat_history(db: Session = Depends(get_db)) -> Response:
    db.query(ChatMessageModel).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("")
def post_chat(payload: ChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    if not get_settings().gemini_configured:
        raise HTTPException(status_code=503, detail=KEY_MISSING_MESSAGE)

    return StreamingResponse(
        stream_champ_response(
            message=payload.message.strip(),
            allow_code_run=payload.allow_code_run,
            db=db,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
