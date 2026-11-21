from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BriefModel(Base):
    __tablename__ = "briefs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    theme: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    deadlines_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    prizes_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    sponsor_tech_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    rules_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    judging_criteria_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    source: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    ideas: Mapped[list["IdeaModel"]] = relationship(
        "IdeaModel", back_populates="brief", cascade="all, delete-orphan"
    )


class IdeaModel(Base):
    __tablename__ = "ideas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    brief_id: Mapped[int] = mapped_column(ForeignKey("briefs.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    one_liner: Mapped[str] = mapped_column(Text, nullable=False)
    problem: Mapped[str] = mapped_column(Text, nullable=False)
    solution: Mapped[str] = mapped_column(Text, nullable=False)
    tech_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    build_hours: Mapped[float] = mapped_column(Float, nullable=False)
    risks_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    scores_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    submission_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    brief: Mapped["BriefModel"] = relationship("BriefModel", back_populates="ideas")


class HackathonModel(Base):
    __tablename__ = "hackathons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    link: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    date: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    location: Mapped[str] = mapped_column(String(250), nullable=False)
    is_online: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    display_name: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class GeocodeCacheModel(Base):
    __tablename__ = "geocode_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_norm: Mapped[str] = mapped_column(String(300), nullable=False, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(400), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class TaskModel(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sprint_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    deadline_iso: Mapped[str] = mapped_column(String(64), nullable=False)
    team_size: Mapped[int] = mapped_column(Integer, nullable=False)
    phase: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    owner: Mapped[str] = mapped_column(String(120), nullable=False, default="Team")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    start_offset_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_feature_freeze: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tool_logs_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
