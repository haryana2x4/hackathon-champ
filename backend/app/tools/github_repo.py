from __future__ import annotations

import base64
import re
import httpx

from app.config import get_settings

GITHUB_API = "https://api.github.com"
MAX_CONTENT_BYTES = 200 * 1024  # 200 KB cap
NAME_RE = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "HackathonChamp/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = get_settings().github_token
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _check_rate_limit(resp: httpx.Response) -> None:
    if resp.status_code in {403, 429}:
        remaining = resp.headers.get("X-RateLimit-Remaining", "")
        body_lower = resp.text.lower()
        if remaining == "0" or "rate limit" in body_lower:
            raise RuntimeError(
                "GitHub API rate limit reached (60 unauthenticated requests/hour). "
                "Wait until reset or add an optional GITHUB_TOKEN to .env for 5,000 requests/hour."
            )


def _truncate_utf8(text: str, max_bytes: int = MAX_CONTENT_BYTES) -> tuple[str, bool]:
    encoded = text.encode("utf-8", errors="replace")
    if len(encoded) <= max_bytes:
        return text, False
    truncated = encoded[:max_bytes].decode("utf-8", errors="ignore")
    return truncated + "\n...[truncated at 200 KB cap]", True


def github_repo(owner: str, repo: str, path: str = "") -> dict:
    """Inspect a public GitHub repo (README + top-level tree, or a specific file/folder up to 200 KB)."""
    owner_clean = owner.strip()
    repo_clean = repo.strip().removesuffix(".git")
    path_clean = path.strip().lstrip("/")

    if not NAME_RE.match(owner_clean) or not NAME_RE.match(repo_clean):
        raise ValueError("Invalid GitHub owner or repository name.")
    if ".." in path_clean.split("/"):
        raise ValueError("Path traversal ('..') is not allowed in github_repo path.")

    with httpx.Client(timeout=10.0, headers=_headers()) as client:
        if path_clean:
            url = f"{GITHUB_API}/repos/{owner_clean}/{repo_clean}/contents/{path_clean}"
            resp = client.get(url)
            _check_rate_limit(resp)
            if resp.status_code == 404:
                raise ValueError(f"Path '{path_clean}' not found in {owner_clean}/{repo_clean}.")
            resp.raise_for_status()
            data = resp.json()

            if isinstance(data, list):
                entries = [
                    {"name": item.get("name"), "type": item.get("type"), "size": item.get("size", 0)}
                    for item in data[:120]
                ]
                return {
                    "repo": f"{owner_clean}/{repo_clean}",
                    "path": path_clean,
                    "type": "directory",
                    "entries": entries,
                }

            size = int(data.get("size") or 0)
            if size > MAX_CONTENT_BYTES:
                raise ValueError(
                    f"File '{path_clean}' is {size} bytes, exceeding the 200 KB cap."
                )

            raw_content = ""
            if data.get("encoding") == "base64" and data.get("content"):
                decoded = base64.b64decode(data["content"])
                raw_content = decoded.decode("utf-8", errors="replace")
            elif data.get("download_url"):
                raw_resp = client.get(data["download_url"])
                raw_resp.raise_for_status()
                raw_content = raw_resp.text

            content, truncated = _truncate_utf8(raw_content)
            return {
                "repo": f"{owner_clean}/{repo_clean}",
                "path": path_clean,
                "type": "file",
                "size": size,
                "truncated": truncated,
                "content": content,
            }

        # Default: repo metadata + top-level tree + README
        meta_resp = client.get(f"{GITHUB_API}/repos/{owner_clean}/{repo_clean}")
        _check_rate_limit(meta_resp)
        if meta_resp.status_code == 404:
            raise ValueError(f"GitHub repository '{owner_clean}/{repo_clean}' was not found.")
        meta_resp.raise_for_status()
        meta = meta_resp.json()

        tree_entries: list[dict] = []
        tree_resp = client.get(f"{GITHUB_API}/repos/{owner_clean}/{repo_clean}/contents")
        _check_rate_limit(tree_resp)
        if tree_resp.status_code == 200 and isinstance(tree_resp.json(), list):
            tree_entries = [
                {"name": item.get("name"), "type": item.get("type"), "size": item.get("size", 0)}
                for item in tree_resp.json()[:80]
            ]

        readme_text = ""
        readme_truncated = False
        readme_resp = client.get(f"{GITHUB_API}/repos/{owner_clean}/{repo_clean}/readme")
        _check_rate_limit(readme_resp)
        if readme_resp.status_code == 200:
            rd = readme_resp.json()
            if rd.get("encoding") == "base64" and rd.get("content"):
                decoded = base64.b64decode(rd["content"]).decode("utf-8", errors="replace")
                # Keep README concise for LLM context while respecting 200 KB hard cap
                readme_text, readme_truncated = _truncate_utf8(decoded, min(MAX_CONTENT_BYTES, 16_000))

        return {
            "repo": f"{owner_clean}/{repo_clean}",
            "description": meta.get("description") or "",
            "stars": meta.get("stargazers_count", 0),
            "language": meta.get("language") or "",
            "license": (meta.get("license") or {}).get("spdx_id") or "Unspecified",
            "default_branch": meta.get("default_branch") or "main",
            "html_url": meta.get("html_url") or f"https://github.com/{owner_clean}/{repo_clean}",
            "tree": tree_entries,
            "readme": readme_text,
            "readme_truncated": readme_truncated,
        }
