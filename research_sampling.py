#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path
from typing import Any


def research_order_group(row: dict[str, Any]) -> str:
    return str(row.get("labelGroup") or "other")


def research_case_patient_key(row: dict[str, Any]) -> str:
    for key in ("patientId", "subjectId", "sourcePatientId", "sourceSubjectId"):
        value = str(row.get(key) or "").strip()
        if value:
            return value
    recording_id = str(row.get("recordingId") or "").strip()
    if not recording_id:
        edf_path = str(row.get("edfPath") or "").strip()
        recording_id = Path(edf_path).stem if edf_path else str(row.get("caseId") or "").strip()
    if "_start" in recording_id:
        recording_id = recording_id.split("_start", 1)[0]
    return recording_id or str(row.get("caseId") or "")


def research_max_consecutive_group_count(rows: list[dict[str, Any]]) -> int:
    max_count = 0
    last_group = None
    current_count = 0
    for row in rows:
        group = research_order_group(row)
        if group == last_group:
            current_count += 1
        else:
            last_group = group
            current_count = 1
        max_count = max(max_count, current_count)
    return max_count


def stable_balanced_research_order(rows: list[dict[str, Any]], seed_parts: tuple[str, ...]) -> list[dict[str, Any]]:
    seed = hashlib.sha256("|".join(seed_parts).encode("utf-8")).hexdigest()
    rng = random.Random(seed)
    shuffled = list(rows)
    if len(shuffled) <= 2:
        rng.shuffle(shuffled)
        return shuffled

    group_counts: dict[str, int] = {}
    for row in shuffled:
        group = research_order_group(row)
        group_counts[group] = group_counts.get(group, 0) + 1
    largest_group = max(group_counts.values(), default=0)
    other_count = max(0, len(shuffled) - largest_group)
    minimum_possible_run = math.ceil(largest_group / max(1, other_count + 1))
    max_consecutive = max(3, minimum_possible_run)

    for _ in range(500):
        rng.shuffle(shuffled)
        if research_max_consecutive_group_count(shuffled) <= max_consecutive:
            return shuffled

    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(research_order_group(row), []).append(row)
    for group_rows in grouped.values():
        rng.shuffle(group_rows)

    ordered: list[dict[str, Any]] = []
    while any(grouped.values()):
        recent_group = research_order_group(ordered[-1]) if ordered else None
        recent_count = 0
        for row in reversed(ordered):
            if research_order_group(row) != recent_group:
                break
            recent_count += 1

        candidates = [
            group for group, group_rows in grouped.items()
            if group_rows and not (group == recent_group and recent_count >= max_consecutive)
        ]
        if not candidates:
            candidates = [group for group, group_rows in grouped.items() if group_rows]
        max_remaining = max(len(grouped[group]) for group in candidates)
        candidates = [group for group in candidates if len(grouped[group]) == max_remaining]
        group = rng.choice(candidates)
        ordered.append(grouped[group].pop())
    return ordered


def balanced_research_sample_by_exposure(
    rows: list[dict[str, Any]],
    limit: int,
    exposure_counts: dict[str, int],
    seed_parts: tuple[str, ...],
    excluded_patient_keys: set[str] | None = None,
) -> list[dict[str, Any]]:
    seed = hashlib.sha256("|".join(seed_parts).encode("utf-8")).hexdigest()
    rng = random.Random(seed)
    buckets: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        count = int(exposure_counts.get(str(row.get("caseId", "")), 0))
        buckets.setdefault(count, []).append(row)
    excluded_patients = excluded_patient_keys if excluded_patient_keys is not None else set()
    selected: list[dict[str, Any]] = []
    deferred: list[dict[str, Any]] = []
    for count in sorted(buckets):
        bucket = list(buckets[count])
        rng.shuffle(bucket)
        for row in bucket:
            if limit > 0 and len(selected) >= limit:
                return selected
            patient_key = research_case_patient_key(row)
            if patient_key and patient_key in excluded_patients:
                deferred.append(row)
                continue
            selected.append(row)
            if patient_key:
                excluded_patients.add(patient_key)
    for row in deferred:
        if limit > 0 and len(selected) >= limit:
            break
        selected.append(row)
    return selected

