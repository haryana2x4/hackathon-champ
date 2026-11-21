from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import httpx

MAX_BYTES = 2 * 1024 * 1024  # 2 MB hard cap
TIMEOUT_SECONDS = 10.0
MAX_REDIRECTS = 5
MAX_TEXT_CHARS = 30_000
USER_AGENT = "HackathonChamp/1.0 (+https://localhost)"

BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata",
}


class UnsafeURLError(ValueError):
    """Raised when a URL violates SSRF or scheme safety policies."""


def _check_ip_allowed(ip_str: str) -> None:
    ip = ipaddress.ip_address(ip_str)
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise UnsafeURLError(
            f"Blocked by SSRF guard: '{ip_str}' is a private, loopback, link-local, or reserved address."
        )


def assert_safe_url(url: str) -> str:
    """Validate http/https scheme and ensure hostname does not resolve to localhost/private/link-local IPs."""
    cleaned = (url or "").strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeURLError(
            f"Blocked URL scheme '{parsed.scheme or 'none'}': only http and https URLs are allowed."
        )
    hostname = (parsed.hostname or "").strip().lower().rstrip(".")
    if not hostname:
        raise UnsafeURLError("URL is missing a valid hostname.")

    if (
        hostname in BLOCKED_HOSTNAMES
        or hostname.endswith(".localhost")
        or hostname.endswith(".local")
        or hostname.endswith(".internal")
    ):
        raise UnsafeURLError(
            f"Blocked by SSRF guard: '{hostname}' is a local or internal hostname."
        )

    # Check direct IP literal first
    try:
        _check_ip_allowed(hostname)
        return cleaned
    except ValueError as exc:
        if isinstance(exc, UnsafeURLError):
            raise
        # Not an IP literal; proceed to DNS resolution

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        infos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"Could not resolve hostname '{hostname}': {exc}") from exc

    if not infos:
        raise UnsafeURLError(f"Hostname '{hostname}' resolved to no addresses.")

    for info in infos:
        sockaddr = info[4]
        if sockaddr:
            _check_ip_allowed(sockaddr[0])

    return cleaned


def html_to_readable_text(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    if soup.title and soup.title.string:
        title = " ".join(soup.title.string.split())

    for tag in soup(["script", "style", "noscript", "svg", "iframe", "template"]):
        tag.decompose()

    lines: list[str] = []
    for raw_line in soup.get_text("\n", strip=True).splitlines():
        compact = " ".join(raw_line.split())
        if compact:
            lines.append(compact)

    text = "\n".join(lines)
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS] + "\n...[truncated]"
    return title, text


def fetch_url(url: str) -> dict:
    """Fetch a public http/https URL safely (SSRF guard, 10s timeout, 2 MB cap) and return readable text."""
    current_url = assert_safe_url(url)

    with httpx.Client(
        timeout=httpx.Timeout(TIMEOUT_SECONDS),
        follow_redirects=False,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8",
        },
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            with client.stream("GET", current_url) as resp:
                if resp.status_code in {301, 302, 303, 307, 308}:
                    loc = resp.headers.get("location")
                    if not loc:
                        break
                    current_url = assert_safe_url(urljoin(current_url, loc))
                    continue

                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "")
                chunks: list[bytes] = []
                total = 0
                for chunk in resp.iter_bytes():
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise ValueError(
                            f"Response exceeded the 2 MB size cap while fetching {current_url}."
                        )
                    chunks.append(chunk)

                raw_bytes = b"".join(chunks)
                encoding = resp.encoding or "utf-8"
                decoded = raw_bytes.decode(encoding, errors="replace")

                if "html" in content_type.lower() or "<html" in decoded[:500].lower():
                    title, text = html_to_readable_text(decoded)
                else:
                    title = ""
                    text = decoded[:MAX_TEXT_CHARS]

                return {
                    "url": current_url,
                    "status_code": resp.status_code,
                    "title": title,
                    "bytes": total,
                    "text": text,
                }

    raise ValueError(f"Too many redirects while fetching {url}.")
