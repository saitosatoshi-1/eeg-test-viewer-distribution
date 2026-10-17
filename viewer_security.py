"""Server-only authorization helpers. / サーバー側の認可と症例アクセス管理。"""
from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Any


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
