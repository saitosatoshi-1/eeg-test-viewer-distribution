"""Cache byte accounting. / キャッシュのメモリ量管理。"""
from __future__ import annotations

import sys
from typing import Any

import numpy as np


def estimated_cache_bytes(value: Any, seen: set[int] | None = None) -> int:
    """キャッシュ値の概算メモリ量を返す。 / Estimate cache memory usage."""
    if seen is None:
        seen = set()
    value_id = id(value)
    if value_id in seen:
        return 0
    seen.add(value_id)
    if isinstance(value, np.ndarray):
        return int(value.nbytes)
    size = sys.getsizeof(value)
    if isinstance(value, dict):
        size += sum(estimated_cache_bytes(key, seen) + estimated_cache_bytes(item, seen) for key, item in value.items())
    elif isinstance(value, (list, tuple, set, frozenset)):
        size += sum(estimated_cache_bytes(item, seen) for item in value)
    return int(size)


def trim_cache_to_bytes(cache: dict[Any, Any], max_bytes: int) -> int:
    """古い項目から削除してメモリ上限内に収める。 / Trim oldest entries to a byte budget."""
    total = sum(estimated_cache_bytes(key) + estimated_cache_bytes(value) for key, value in cache.items())
    while cache and total > max_bytes:
        oldest = next(iter(cache))
        removed = cache.pop(oldest)
        total -= estimated_cache_bytes(oldest) + estimated_cache_bytes(removed)
    return max(0, total)
