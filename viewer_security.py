"""Server-only authorization helpers. / サーバー側の認可と症例アクセス管理。"""
from __future__ import annotations

import threading
import time
import hashlib
import hmac
import math
import secrets
from collections import deque
from pathlib import Path
from typing import Any


class CredentialAttemptLimiter:
    """Bound secret comparisons, not waveform requests. / 秘密コード照合だけを制限。"""

    def __init__(self, per_peer: int = 30, total: int = 120, period: int = 60, clock=time.monotonic):
        self.per_peer, self.total, self.period = per_peer, total, period
        self.clock = clock
        self._key = secrets.token_bytes(32)
        self._events = deque()
        self._lock = threading.RLock()

    def attempt(self, peer: str, verify) -> tuple[bool, int]:
        # Reserve before comparing; successful checks do not consume the failure budget.
        # 照合前に枠を確保し、成功分だけ取り消す。過去の失敗履歴は消さない。
        with self._lock:
            retry_after = self.reserve(peer)
            if retry_after:
                return False, retry_after
            matched = bool(verify())
            if matched:
                self._events.pop()
            return matched, 0

    def reserve(self, peer: str) -> int:
        # Keep only process-local, keyed hashes; never persist raw addresses.
        # IP原文は保持せず、プロセス内だけの鍵付きハッシュを期限付きで管理する。
        identity = hmac.new(self._key, peer.encode("utf-8"), hashlib.sha256).digest()
        with self._lock:
            now = self.clock()
            while self._events and self._events[0][0] <= now - self.period:
                self._events.popleft()
            own = [stamp for stamp, key in self._events if key == identity]
            oldest = []
            if len(self._events) >= self.total:
                oldest.append(self._events[0][0])
            if len(own) >= self.per_peer:
                oldest.append(own[0])
            if oldest:
                return max(1, math.ceil(max(oldest) + self.period - now))
            self._events.append((now, identity))
            return 0


class RecordingGrants:
    """Bind exact case paths to a signed browser session. / 症例をブラウザー単位に制限。"""

    def __init__(self, ttl: int = 86400):
        self.ttl = ttl
        self._rows: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    def set(self, identity: str, dataset: str, cases: list[dict[str, Any]]) -> None:
        if not identity:
            raise PermissionError("A signed browser session is required.")
        with self._lock:
            now = time.monotonic()
            self._rows = {key: row for key, row in self._rows.items() if row["expires"] > now}
            self._rows[identity] = {
                "dataset": dataset,
                "cases": [dict(row) for row in cases],
                "paths": {str(Path(row["edfPath"]).resolve()) for row in cases if row.get("edfPath")},
                "expires": now + self.ttl,
            }

    def cases(self, identity: str, dataset: str) -> list[dict[str, Any]]:
        with self._lock:
            row = self._rows.get(identity, {})
            if row.get("expires", 0) <= time.monotonic() or row.get("dataset") != dataset:
                return []
            return [dict(case) for case in row["cases"]]

    def allows(self, identity: str, path: Path) -> bool:
        with self._lock:
            row = self._rows.get(identity, {})
            return row.get("expires", 0) > time.monotonic() and str(path.resolve()) in row.get("paths", set())
