from __future__ import annotations

from pathlib import Path

from app.config import get_settings

MAX_FILE_BYTES = 200 * 1024  # 200 KB cap


class UnsafePathError(ValueError):
    """Raised when create_file path attempts traversal or leaves workspace_out/."""


def create_file(path: str, content: str) -> dict:
    """Create a UTF-8 file strictly inside workspace_out/, rejecting path traversal and >200 KB."""
    raw_path = (path or "").strip()
    if not raw_path:
        raise UnsafePathError("File path cannot be empty.")

    # Reject Windows drive letters, UNC paths, absolute paths, and null bytes
    if "\x00" in raw_path or raw_path.startswith(("/", "\\")) or ":" in raw_path:
        raise UnsafePathError(f"Rejected unsafe path '{raw_path}': use a relative path inside workspace_out/.")

    normalized_parts = Path(raw_path.replace("\\", "/")).parts
    if not normalized_parts or any(part in {"..", ""} for part in normalized_parts):
        raise UnsafePathError(f"Rejected path traversal in '{raw_path}'. Files may only be written inside workspace_out/.")

    encoded = content.encode("utf-8")
    if len(encoded) > MAX_FILE_BYTES:
        raise ValueError(f"File content ({len(encoded)} bytes) exceeds the 200 KB maximum.")

    ws_root = get_settings().workspace_out_dir.resolve()
    ws_root.mkdir(parents=True, exist_ok=True)

    target = (ws_root / Path(*normalized_parts)).resolve()
    if target == ws_root or not target.is_relative_to(ws_root):
        raise UnsafePathError(f"Rejected path '{raw_path}': target resolves outside workspace_out/.")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(encoded)

    rel_posix = target.relative_to(ws_root).as_posix()
    return {
        "path": f"workspace_out/{rel_posix}",
        "bytes": len(encoded),
    }
