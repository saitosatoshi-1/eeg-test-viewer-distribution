#!/usr/bin/env python3
from __future__ import annotations

from typing import Any


VALIDATION_DECISION_ADOPT = "adopt"
VALIDATION_DECISION_EXCLUDE = "exclude"
VALIDATION_DECISIONS = {VALIDATION_DECISION_ADOPT, VALIDATION_DECISION_EXCLUDE}
VALIDATION_DECISION_LABELS = {
    VALIDATION_DECISION_ADOPT: "採用",
    VALIDATION_DECISION_EXCLUDE: "除外",
}
VALIDATION_DECISION_ALIASES = {
    "adopt": VALIDATION_DECISION_ADOPT,
    "accept": VALIDATION_DECISION_ADOPT,
    "採用": VALIDATION_DECISION_ADOPT,
    "include": VALIDATION_DECISION_ADOPT,
    "keep": VALIDATION_DECISION_ADOPT,
    "exclude": VALIDATION_DECISION_EXCLUDE,
    "除外": VALIDATION_DECISION_EXCLUDE,
    "reject": VALIDATION_DECISION_EXCLUDE,
    "drop": VALIDATION_DECISION_EXCLUDE,
}


def validation_set(value: Any) -> str:
    text = str(value or "ied").strip().lower()
    if text in {"artifact", "artifacts", "no_epilepsy", "non_epileptiform", "ied_absent"}:
        return "artifact"
    return "ied"


def validation_set_label(value: Any) -> str:
    return "アーチファクトデータセット" if validation_set(value) == "artifact" else "IEDデータセット"


def validation_case_in_set(row: dict[str, Any], selected: str) -> bool:
    source = str(row.get("sourceGroup") or "").lower()
    group = str(row.get("labelGroup") or "").lower()
    if validation_set(selected) == "artifact":
        return source in {"no_epilepsy", "artifact", "artifacts"} or group == "non_epileptiform"
    return (source == "epilepsy" or group == "epileptiform") and source != "no_epilepsy"


def validation_case_rows(case_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in case_rows if bool(row.get("include", True))]


def validation_case_rows_for_set(case_rows: list[dict[str, Any]], selected: str) -> list[dict[str, Any]]:
    normalized = validation_set(selected)
    return [row for row in validation_case_rows(case_rows) if validation_case_in_set(row, normalized)]


def active_validation_response_map(responses: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    active: dict[str, dict[str, Any]] = {}
    for row in responses:
        if row.get("superseded") or row.get("undoneAt"):
            continue
        case_id = str(row.get("caseId") or "")
        if case_id:
            active[case_id] = row
    return active


def validation_summary(cases: list[dict[str, Any]], active: dict[str, dict[str, Any]]) -> dict[str, Any]:
    reviewed = list(active.values())
    adopted = sum(1 for row in reviewed if row.get("decision") == VALIDATION_DECISION_ADOPT)
    excluded = sum(1 for row in reviewed if row.get("decision") == VALIDATION_DECISION_EXCLUDE)
    return {
        "caseCount": len(cases),
        "reviewedCount": len(reviewed),
        "adoptedCount": adopted,
        "excludedCount": excluded,
        "remainingCount": max(0, len(cases) - len(reviewed)),
    }
