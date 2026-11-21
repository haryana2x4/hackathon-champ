from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid
from sqlalchemy.orm import Session

from app.models import TaskModel
from app.schemas import PhaseSummary, SprintResponse, TaskResponse

PHASE_SPECS = [
    ("Setup", 10, False),
    ("Build", 50, False),
    ("Test and fix", 15, True),  # Ends at cumulative 75% -> Feature Freeze!
    ("Polish and demo", 15, False),
    ("Submit buffer", 10, False),
]

PHASE_TASK_TEMPLATES: dict[str, list[tuple[str, float]]] = {
    "Setup": [
        ("Lock scope, architecture sketch, and repo setup", 0.55),
        ("Provision environment, API keys, and shared dev contract", 0.45),
    ],
    "Build": [
        ("Build core backend API & data persistence", 0.35),
        ("Build primary frontend screens & core user flow", 0.35),
        ("Integrate AI / external APIs & end-to-end wiring", 0.30),
    ],
    "Test and fix": [
        ("Run end-to-end happy path & edge-case tests", 0.55),
        ("Fix blockers & lock FEATURE FREEZE (no new features after 75%)", 0.45),
    ],
    "Polish and demo": [
        ("UI polish, error states, and responsive check", 0.50),
        ("Record backup demo clip & rehearse 2-minute pitch", 0.50),
    ],
    "Submit buffer": [
        ("Complete Devpost story, README, and screenshots", 0.60),
        ("Submit early & verify live links and repo visibility", 0.40),
    ],
}


def parse_deadline(deadline_iso: str) -> datetime:
    raw = deadline_iso.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise ValueError("Invalid ISO deadline format. Example: 2026-11-22T09:00:00Z") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _owner_label(team_size: int, task_idx: int, phase: str) -> str:
    if team_size == 1:
        return "Solo builder"
    if phase in {"Setup", "Submit buffer"} and task_idx == 0:
        return f"All ({team_size} members)"
    role_hints = ["Backend / API", "Frontend / UI", "Integration / Pitch", "Data / QA", "Design / Docs"]
    member_num = (task_idx % team_size) + 1
    hint = role_hints[(member_num - 1) % len(role_hints)]
    return f"Member {member_num} ({hint})"


def _split_minutes_exact(total: int, weights: list[float]) -> list[int]:
    """Split an integer minute count across weighted buckets with zero rounding drift."""
    weight_sum = sum(weights)
    raw = [total * (w / weight_sum) for w in weights]
    floored = [int(v) for v in raw]
    remainder = total - sum(floored)
    # Distribute remainder to buckets with the largest fractional parts
    order = sorted(range(len(raw)), key=lambda i: raw[i] - floored[i], reverse=True)
    for idx in order[:remainder]:
        floored[idx] += 1
    return floored


def serialize_task(row: TaskModel) -> TaskResponse:
    return TaskResponse(
        id=row.id,
        sprint_id=row.sprint_id,
        deadline_iso=row.deadline_iso,
        team_size=row.team_size,
        phase=row.phase,
        title=row.title,
        owner=row.owner,
        duration_minutes=row.duration_minutes,
        duration_hours=round(row.duration_minutes / 60.0, 2),
        start_offset_minutes=row.start_offset_minutes,
        is_feature_freeze=row.is_feature_freeze,
        completed=row.completed,
        order_index=row.order_index,
    )


def build_sprint_response(tasks: list[TaskModel]) -> SprintResponse:
    ordered = sorted(tasks, key=lambda t: t.order_index)
    first = ordered[0]
    total_minutes = sum(t.duration_minutes for t in ordered)

    phase_minutes: dict[str, int] = {name: 0 for name, _, _ in PHASE_SPECS}
    for t in ordered:
        phase_minutes[t.phase] = phase_minutes.get(t.phase, 0) + t.duration_minutes

    phases: list[PhaseSummary] = []
    cum_pct = 0
    freeze_minutes = 0
    for name, pct, is_freeze_end in PHASE_SPECS:
        cum_pct += pct
        mins = phase_minutes.get(name, 0)
        if cum_pct <= 75:
            freeze_minutes += mins
        phases.append(
            PhaseSummary(
                phase=name,
                percent=pct,
                minutes=mins,
                hours=round(mins / 60.0, 2),
                cumulative_percent=cum_pct,
                is_feature_freeze_end=is_freeze_end,
            )
        )

    deadline_dt = parse_deadline(first.deadline_iso)
    sprint_start_dt = deadline_dt - timedelta(minutes=total_minutes)
    freeze_dt = sprint_start_dt + timedelta(minutes=freeze_minutes)

    return SprintResponse(
        sprint_id=first.sprint_id,
        deadline_iso=first.deadline_iso,
        team_size=first.team_size,
        total_minutes=total_minutes,
        total_hours=round(total_minutes / 60.0, 2),
        feature_freeze_minutes=freeze_minutes,
        feature_freeze_iso=freeze_dt.isoformat(),
        phases=phases,
        tasks=[serialize_task(t) for t in ordered],
    )


def generate_sprint(
    deadline_iso: str,
    team_size: int,
    db: Session,
    now: datetime | None = None,
) -> SprintResponse:
    deadline_dt = parse_deadline(deadline_iso)
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    delta_seconds = (deadline_dt - current).total_seconds()
    if delta_seconds < 600:
        raise ValueError("Deadline must be at least 10 minutes in the future.")

    total_minutes = max(10, round(delta_seconds / 60.0))
    phase_allocs = _split_minutes_exact(total_minutes, [pct for _, pct, _ in PHASE_SPECS])

    sprint_id = uuid.uuid4().hex[:12]
    canonical_deadline = deadline_dt.isoformat()

    created_rows: list[TaskModel] = []
    cursor_minutes = 0
    order_index = 0

    for (phase_name, _pct, is_freeze_end), p_minutes in zip(PHASE_SPECS, phase_allocs):
        templates = PHASE_TASK_TEMPLATES[phase_name]
        task_mins = _split_minutes_exact(p_minutes, [w for _, w in templates])

        for idx, ((title, _w), dur) in enumerate(zip(templates, task_mins)):
            is_last_in_phase = idx == len(templates) - 1
            row = TaskModel(
                sprint_id=sprint_id,
                deadline_iso=canonical_deadline,
                team_size=team_size,
                phase=phase_name,
                title=title,
                owner=_owner_label(team_size, order_index, phase_name),
                duration_minutes=dur,
                start_offset_minutes=cursor_minutes,
                is_feature_freeze=bool(is_freeze_end and is_last_in_phase),
                completed=False,
                order_index=order_index,
            )
            db.add(row)
            created_rows.append(row)
            cursor_minutes += dur
            order_index += 1

    db.commit()
    for row in created_rows:
        db.refresh(row)

    return build_sprint_response(created_rows)


def get_latest_sprint(db: Session) -> SprintResponse | None:
    latest = db.query(TaskModel).order_by(TaskModel.id.desc()).first()
    if not latest:
        return None
    rows = (
        db.query(TaskModel)
        .filter(TaskModel.sprint_id == latest.sprint_id)
        .order_by(TaskModel.order_index.asc())
        .all()
    )
    if not rows:
        return None
    return build_sprint_response(rows)
