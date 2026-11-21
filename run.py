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


def find_backend_python() -> str:
    """Prefer backend/.venv Python if present; fall back to current sys.executable."""
    candidates = [
        BACKEND_DIR / ".venv" / "Scripts" / "python.exe",
        BACKEND_DIR / ".venv" / "bin" / "python",
        ROOT / ".venv" / "Scripts" / "python.exe",
        ROOT / ".venv" / "bin" / "python",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return sys.executable


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
    python_exe = find_backend_python()
    npm_exe = find_npm()

    # Ensure runtime dirs exist
    (ROOT / "workspace_out").mkdir(parents=True, exist_ok=True)
    (BACKEND_DIR / "data").mkdir(parents=True, exist_ok=True)

    # Check if frontend node_modules exists
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

    print(f"[run.py] Starting backend on http://localhost:8000 using {python_exe}")
    print(f"[run.py] Starting frontend on http://localhost:5173 using {npm_exe}")
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
