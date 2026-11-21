from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import Base, get_db
from app.main import create_app


@pytest.fixture()
def tmp_env_empty(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    env_file = tmp_path / ".env"
    env_file.write_text("GEMINI_API_KEY=\nGEMINI_MODEL=gemini-4-hydrogen\nGITHUB_TOKEN=\n", encoding="utf-8")
    monkeypatch.setenv("HACKATHON_CHAMP_ENV_FILE", str(env_file))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.setenv("WORKSPACE_OUT_DIR", str(tmp_path / "workspace_out"))
    (tmp_path / "workspace_out").mkdir(parents=True, exist_ok=True)
    return env_file


@pytest.fixture()
def db_session(tmp_path: Path) -> Generator[Session, None, None]:
    db_path = tmp_path / "test.db"
    test_engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(bind=test_engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        test_engine.dispose()


@pytest.fixture()
def client(db_session: Session, tmp_env_empty: Path) -> Generator[TestClient, None, None]:
    app = create_app()

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()
