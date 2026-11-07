"""Completion-aware fixed-form allocation. / 提出完了と予約に基づくセット割付。"""
from __future__ import annotations

import random
from typing import Any

from research_sampling import (
    RESEARCH_FIXED_FORM_DESIGN_VERSION, RESEARCH_FIXED_FORM_IDS,
    fixed_research_form_assignment_slot,
)

ALLOCATION_POLICY = "completed_plus_active_reservations_v1"


def fixed_assignments(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if isinstance(row, dict)
            and row.get("designVersion") == RESEARCH_FIXED_FORM_DESIGN_VERSION
            and row.get("formId") in RESEARCH_FIXED_FORM_IDS]


def allocation_status(row: dict[str, Any]) -> str:
    if row.get("completionReceipt"):
        return "completed"
    return "interrupted" if row.get("allocationStatus") == "interrupted" else "active"


def allocation_counts(rows: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    counts = {form: {"completed": 0, "active": 0, "interrupted": 0} for form in RESEARCH_FIXED_FORM_IDS}
    for row in fixed_assignments(rows):
        counts[row["formId"]][allocation_status(row)] += 1
    return counts


def next_completion_balanced_assignment(dataset_id: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    fixed = fixed_assignments(rows)
    design = fixed_research_form_assignment_slot(dataset_id, len(fixed))
    counts = allocation_counts(fixed)
    effective = {form: row["completed"] + row["active"] for form, row in counts.items()}
    candidates = [form for form in RESEARCH_FIXED_FORM_IDS if effective[form] == min(effective.values())]
    # Preserve the previous block tie-break; fill confirmed gaps before advancing.
    # 同数時は従来のブロック順を優先し、予約がない不足セットを先に補充する。
    if design["formId"] not in candidates:
        random.Random(f"{dataset_id}|completion-balance|{len(fixed)}").shuffle(candidates)
        design["formId"] = candidates[0]
    form = design["formId"]
    orders = [f"{form}{number}" for number in (1, 2, 3)]
    order_counts = {order: sum(1 for row in fixed if row.get("orderVersion") == order
                              and allocation_status(row) != "interrupted") for order in orders}
    preferred = f"{form}{design['orderVersion'][-1]}"
    best = min(order_counts.values())
    design["orderVersion"] = preferred if order_counts[preferred] == best else next(order for order in orders if order_counts[order] == best)
    interrupted = next((row for row in fixed if row["formId"] == form
                        and allocation_status(row) == "interrupted" and not row.get("replacementAssignmentId")), None)
    design.update({
        "allocationPolicy": ALLOCATION_POLICY,
        "assignmentKind": "replacement" if interrupted else "regular",
        "replacesAssignmentId": interrupted.get("assignmentId", "") if interrupted else "",
        "allocationCountsBefore": counts,
    })
    return design


def completed_submission_reader(document: Any, assignment: dict[str, Any], dataset_id: str,
                                accepted_ratings: set[str] | None = None) -> bool:
    """Count only a complete, consented saved result. / 保存済み20問＋事後同意だけを数える。"""
    if not isinstance(document, dict) or not isinstance(document.get("dataset"), dict):
        return False
    if str(document["dataset"].get("datasetId") or "") != dataset_id:
        return False
    case_ids = assignment.get("caseIds")
    if not isinstance(case_ids, list) or not all(isinstance(value, str) and value for value in case_ids):
        return False
    expected = set(case_ids)
    if len(expected) != 20:
        return False
    readers = document.get("readers")
    if not isinstance(readers, list):
        return False
    if accepted_ratings is None:
        accepted_ratings = {"てんかん性放電あり", "てんかん性放電なし", "判断困難", "てんかん性異常あり", "てんかん性異常なし"}
    for reader in readers:
        if not isinstance(reader, dict) or reader.get("readerId") != assignment.get("readerId"):
            continue
        design = reader.get("assignment") or {}
        if not isinstance(design, dict) or any(design.get(key) != assignment.get(key) for key in ("formId", "orderVersion", "designVersion")):
            continue
        responses = reader.get("responses")
        if not isinstance(responses, list) or len(responses) != 20 or not all(isinstance(row, dict) for row in responses):
            continue
        if not all(isinstance(row.get("caseId"), str)
                   and isinstance(row.get("rating"), str)
                   and row["rating"].strip().lower() in accepted_ratings for row in responses):
            continue
        if {row.get("caseId") for row in responses} != expected:
            continue
        debrief = reader.get("postTestDebriefing") or {}
        if not isinstance(debrief, dict):
            continue
        likert = debrief.get("montageSwitchIncreaseLikert")
        if (debrief.get("continuedDataUseConsent") is True
                and isinstance(debrief.get("completedAt"), str) and debrief["completedAt"].strip()
                and isinstance(likert, int) and not isinstance(likert, bool) and 1 <= likert <= 5):
            return True
    return False
