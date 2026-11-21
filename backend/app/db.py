from __future__ import annotations

from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _build_engine(database_url: str):
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args, future=True)


_settings = get_settings()
_settings.data_dir.mkdir(parents=True, exist_ok=True)
_settings.workspace_out_dir.mkdir(parents=True, exist_ok=True)

engine = _build_engine(_settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db(target_engine=None) -> None:
    from app import models  # noqa: F401 - register ORM models

    Base.metadata.create_all(bind=target_engine or engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
