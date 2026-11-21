#!/usr/bin/env python3
"""Cross-platform launcher for Hackathon Champ (backend :8000 + frontend :5173)."""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"


def _venv_python(venv_dir: Path) -> Path:
    return venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _can_import_uvicorn(python_exe: str) -> bool:
    res = subprocess.run(
        [python_exe, "-c", "import uvicorn, fastapi"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return res.returncode == 0


def ensure_backend_python() -> str:
    """Use backend/.venv if present, or current Python if ready, else bootstrap backend/.venv."""
    venv_dir = BACKEND_DIR / ".venv"
    venv_py = _venv_python(venv_dir)
    if venv_py.exists() and _can_import_uvicorn(str(venv_py)):
        return str(venv_py)

    if _can_import_uvicorn(sys.executable):
        return sys.executable

    print("[run.py] Bootstrapping backend/.venv and installing pinned Python dependencies...")
    subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
    subprocess.run(
        [str(venv_py), "-m", "pip", "install", "-r", str(BACKEND_DIR / "requirements.txt")],
        check=True,
    )
    return str(venv_py)


def find_npm() -> str:
    """Resolve npm across Windows, macOS, and Linux."""
    names = ["npm.cmd", "npm"] if os.name == "nt" else ["npm"]
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    raise RuntimeError("npm was not found on PATH. Please install Node.js (v18+).")


def terminate_process(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def main() -> int:
    python_exe = ensure_backend_python()
    npm_exe = find_npm()

    (ROOT / "workspace_out").mkdir(parents=True, exist_ok=True)
    (BACKEND_DIR / "data").mkdir(parents=True, exist_ok=True)

    if not (FRONTEND_DIR / "node_modules").exists():
        print("[run.py] Installing frontend dependencies (npm install)...")
        subprocess.run([npm_exe, "install"], cwd=str(FRONTEND_DIR), check=True)

    backend_cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]
    frontend_cmd = [
        npm_exe,
        "run",
        "dev",
        "--",
        "--host",
        "localhost",
        "--port",
        "5173",
        "--strictPort",
    ]

    print(f"[run.py] Backend API:  http://localhost:8000  (docs: http://localhost:8000/docs)")
    print(f"[run.py] Frontend UI:  http://localhost:5173")
    print("[run.py] Press Ctrl+C to stop both servers.\n")

    backend_proc: subprocess.Popen | None = None
    frontend_proc: subprocess.Popen | None = None

    def _handle_signal(_signum, _frame):
        print("\n[run.py] Shutting down servers...")
        terminate_process(frontend_proc)
        terminate_process(backend_proc)
        sys.exit(0)

    signal.signal(signal.SIGINT, _handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _handle_signal)

    try:
        backend_env = os.environ.copy()
        backend_env["PYTHONPATH"] = str(BACKEND_DIR)
        backend_proc = subprocess.Popen(backend_cmd, cwd=str(BACKEND_DIR), env=backend_env)
        frontend_proc = subprocess.Popen(frontend_cmd, cwd=str(FRONTEND_DIR))

        while True:
            b_code = backend_proc.poll()
            f_code = frontend_proc.poll()
            if b_code is not None:
                print(f"[run.py] Backend exited unexpectedly with code {b_code}.")
                terminate_process(frontend_proc)
                return b_code or 1
            if f_code is not None:
                print(f"[run.py] Frontend exited unexpectedly with code {f_code}.")
                terminate_process(backend_proc)
                return f_code or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[run.py] Stopping Hackathon Champ...")
    finally:
        terminate_process(frontend_proc)
        terminate_process(backend_proc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
