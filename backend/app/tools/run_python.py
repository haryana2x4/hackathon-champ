from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

TIMEOUT_SECONDS = 10
MAX_OUTPUT_BYTES = 1024 * 1024  # 1 MB combined output cap


class CodeExecutionRefusedError(PermissionError):
    """Raised when run_python is invoked while allow_code_run toggle is OFF."""


def _minimal_safe_env() -> dict[str, str]:
    """Build a stripped environment that does NOT inherit .env secrets or user env vars."""
    env: dict[str, str] = {
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
    }
    # On Windows, Python runtime needs SystemRoot (and ComSpec) for CRT/winsock startup;
    # no API keys, tokens, or user secrets are ever passed.
    if os.name == "nt":
        for key in ("SYSTEMROOT", "COMSPEC"):
            if key in os.environ:
                env[key] = os.environ[key]
    return env


def _cap_bytes(raw: bytes, max_bytes: int) -> tuple[str, bool]:
    if len(raw) <= max_bytes:
        return raw.decode("utf-8", errors="replace"), False
    text = raw[:max_bytes].decode("utf-8", errors="ignore")
    return text + "\n...[output truncated at 1 MB cap]", True


def run_python(code: str, allow_code_run: bool) -> dict:
    """Run Python code in a temporary folder if allow_code_run is enabled. Not a full sandbox."""
    if not allow_code_run:
        raise CodeExecutionRefusedError(
            "Refused: Python execution is OFF. Enable the 'Allow Python execution' toggle in Champ UI to run code."
        )

    if not code or not code.strip():
        raise ValueError("Code cannot be empty.")

    with tempfile.TemporaryDirectory(prefix="champ_py_") as tmpdir:
        script_path = Path(tmpdir) / "snippet.py"
        script_path.write_text(code, encoding="utf-8")

        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(script_path)],
                cwd=tmpdir,
                env=_minimal_safe_env(),
                capture_output=True,
                timeout=TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            return {
                "returncode": -1,
                "timed_out": True,
                "stdout": "",
                "stderr": f"Execution timed out after {TIMEOUT_SECONDS} seconds.",
                "truncated": False,
            }

        stdout_bytes = proc.stdout or b""
        stderr_bytes = proc.stderr or b""
        remaining = max(0, MAX_OUTPUT_BYTES - len(stdout_bytes))
        stdout_text, out_trunc = _cap_bytes(stdout_bytes, MAX_OUTPUT_BYTES)
        stderr_text, err_trunc = _cap_bytes(stderr_bytes, remaining)

        return {
            "returncode": proc.returncode,
            "timed_out": False,
            "stdout": stdout_text,
            "stderr": stderr_text,
            "truncated": out_trunc or err_trunc,
        }
