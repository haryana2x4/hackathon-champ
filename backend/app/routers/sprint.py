from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TaskModel
from app.schemas import SprintCreateRequest, SprintResponse, TaskPatchRequest, TaskResponse
from app.services.sprint_service import generate_sprint, get_latest_sprint, serialize_task

router = APIRouter(prefix="/api", tags=["sprint"])


@router.get("/sprint", response_model=SprintResponse | None)
def read_latest_sprint(db: Session = Depends(get_db)) -> SprintResponse | None:
    return get_latest_sprint(db)


@router.post("/sprint", response_model=SprintResponse)
def create_sprint(payload: SprintCreateRequest, db: Session = Depends(get_db)) -> SprintResponse:
    try:
        return generate_sprint(payload.deadline_iso, payload.team_size, db)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, payload: TaskPatchRequest, db: Session = Depends(get_db)) -> TaskResponse:
    row = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found.")
    if payload.completed is not None:
        row.completed = payload.completed
    if payload.title is not None:
        row.title = payload.title.strip()
    if payload.owner is not None:
        row.owner = payload.owner.strip()
    db.commit()
    db.refresh(row)
    return serialize_task(row)
