from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
WORKSPACE_OUT_DIR = PROJECT_ROOT / "workspace_out"
DEFAULT_ENV_PATH = PROJECT_ROOT / ".env"

DEFAULT_GEMINI_MODEL = "gemini-4-hydrogen"
KEY_MISSING_MESSAGE = "Add your Gemini key to .env"


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    github_token: str
    database_url: str
    env_path: Path
    workspace_out_dir: Path
    data_dir: Path

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())


def get_settings() -> Settings:
    env_override = os.environ.get("HACKATHON_CHAMP_ENV_FILE")
    env_path = Path(env_override) if env_override else DEFAULT_ENV_PATH
    file_vals = dotenv_values(env_path) if env_path.exists() else {}

    def _read(name: str, default: str = "") -> str:
        # Process env takes precedence when explicitly set (useful for CI/pytest);
        # otherwise read fresh from .env so pasting a key takes effect without restart.
        if name in os.environ:
            return os.environ[name].strip()
        val = file_vals.get(name)
        return (val or default).strip()

    db_url = os.environ.get("DATABASE_URL") or f"sqlite:///{(DATA_DIR / 'champ.db').as_posix()}"
    ws_override = os.environ.get("WORKSPACE_OUT_DIR")
    ws_dir = Path(ws_override).resolve() if ws_override else WORKSPACE_OUT_DIR.resolve()

    return Settings(
        gemini_api_key=_read("GEMINI_API_KEY", ""),
        gemini_model=_read("GEMINI_MODEL", DEFAULT_GEMINI_MODEL) or DEFAULT_GEMINI_MODEL,
        github_token=_read("GITHUB_TOKEN", ""),
        database_url=db_url,
        env_path=env_path,
        workspace_out_dir=ws_dir,
        data_dir=DATA_DIR,
    )
