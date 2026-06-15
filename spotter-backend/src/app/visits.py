"""Visitor notifier middleware.

Sends a Telegram message the first time each visitor (IP + user-agent) hits
the backend, optionally enriched with geolocation. Runs in a background
thread and is a no-op unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.
"""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
_ENABLED = os.getenv("VISIT_NOTIFY_ENABLED", "true").lower() == "true"
_GEO = os.getenv("VISIT_GEO_LOOKUP", "true").lower() == "true"
try:
    _THROTTLE = int(os.getenv("VISIT_NOTIFY_THROTTLE_SECONDS", "1800"))
except ValueError:
    _THROTTLE = 1800

_HTTP_TIMEOUT = 5

_SKIP_PREFIXES = ("/static/", "/favicon", "/health", "/__")

_seen: dict[str, float] = {}
_seen_lock = threading.Lock()


def _should_notify(key: str) -> bool:
    now = time.time()
    with _seen_lock:
        last = _seen.get(key, 0.0)
        if now - last < _THROTTLE:
            return False
        _seen[key] = now
        if len(_seen) > 10_000:
            cutoff = now - _THROTTLE
            for k in [k for k, t in _seen.items() if t < cutoff]:
                _seen.pop(k, None)
    return True


def _client_ip(meta: dict) -> str:
    forwarded = meta.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return meta.get("REMOTE_ADDR", "?")


def _geo(ip: str) -> str:
    if not _GEO or not ip or ip in ("?", "127.0.0.1", "::1"):
        return ""
    try:
        url = (
            f"http://ip-api.com/json/{urllib.parse.quote(ip)}"
            "?fields=status,country,city,isp"
        )
        with urllib.request.urlopen(url, timeout=_HTTP_TIMEOUT) as resp:
            data = json.load(resp)
        if data.get("status") != "success":
            return ""
        city = data.get("city", "")
        country = data.get("country", "")
        isp = data.get("isp", "")
        where = ", ".join(p for p in (city, country) if p)
        return f"{where} — {isp}" if isp else where
    except Exception:
        return ""


def _send_telegram(text: str) -> None:
    try:
        url = f"https://api.telegram.org/bot{_TOKEN}/sendMessage"
        payload = urllib.parse.urlencode(
            {"chat_id": _CHAT_ID, "text": text, "parse_mode": "HTML"}
        ).encode()
        req = urllib.request.Request(url, data=payload)
        urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT).read()
    except Exception:
        pass


def _notify(ip: str, ua: str, method: str, path: str) -> None:
    location = _geo(ip)
    ip_line = f"{ip} ({location})" if location else ip
    when = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    text = (
        "🚚 <b>New Spotter visitor</b>\n"
        f"IP: {ip_line}\n"
        f"Path: {method} {path}\n"
        f"Agent: {ua or '?'}\n"
        f"Time: {when}"
    )
    _send_telegram(text)


class VisitNotifierMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.active = _ENABLED and bool(_TOKEN) and bool(_CHAT_ID)

    def __call__(self, request):
        if self.active:
            try:
                self._maybe_notify(request)
            except Exception:
                pass
        return self.get_response(request)

    def _maybe_notify(self, request) -> None:
        if request.method == "OPTIONS":
            return
        path = request.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return

        meta = request.META
        ip = _client_ip(meta)
        ua = meta.get("HTTP_USER_AGENT", "")
        if not _should_notify(f"{ip}|{ua}"):
            return

        threading.Thread(
            target=_notify,
            args=(ip, ua, request.method, path),
            daemon=True,
        ).start()
