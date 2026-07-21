#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path
from typing import Any


RESEARCH_FIXED_FORM_IDS = ("A", "B", "C", "D", "E", "F")
RESEARCH_FIXED_FORM_DESIGN_VERSION = "fixed-forms-v1"
RESEARCH_FIXED_FORM_ORDER_VARIANTS = 4


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


def _stable_digest(*parts: object) -> str:
    return hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()


def fixed_research_form_definitions(
    rows: list[dict[str, Any]],
    dataset_id: str,
) -> dict[str, list[dict[str, Any]]]:
    """Build six fixed, connected forms while keeping patients unique per form.

    6つの固定セットを決定論的に作成し、各セット内の患者重複を防ぐ。
    Each of the 60 cases belongs to two forms; every form contains 10 cases from
    each label group. Pair slots connect all forms and make the design auditable.
    """
    included = [row for row in rows if bool(row.get("include", True))]
    groups = ("epileptiform", "non_epileptiform")
    grouped = {
        group: [row for row in included if str(row.get("labelGroup") or "") == group]
        for group in groups
    }
    invalid = {group: len(grouped[group]) for group in groups if len(grouped[group]) != 30}
    if invalid:
        counts = ", ".join(f"{group}={count}" for group, count in invalid.items())
        raise ValueError(
            "The fixed six-form design requires exactly 30 epileptiform and "
            f"30 non-epileptiform cases ({counts})."
        )

    pairs = [
        (left, right)
        for index, left in enumerate(RESEARCH_FIXED_FORM_IDS)
        for right in RESEARCH_FIXED_FORM_IDS[index + 1:]
    ]
    capacities = {group: {pair: 2 for pair in pairs} for group in groups}
    assignments: dict[str, tuple[str, str]] = {}
    used_forms_by_patient: dict[str, set[str]] = {}
    pending = [row for group in groups for row in grouped[group]]
    patient_frequency: dict[str, int] = {}
    for row in pending:
        patient = research_case_patient_key(row)
        patient_frequency[patient] = patient_frequency.get(patient, 0) + 1

    def case_key(row: dict[str, Any]) -> str:
        return str(row.get("caseId") or row.get("recordingId") or row.get("edfPath") or "")

    case_keys = [case_key(row) for row in pending]
    if any(not key for key in case_keys) or len(case_keys) != len(set(case_keys)):
        raise ValueError("Fixed-form cases require unique non-empty caseId values.")
    if any(count > 3 for count in patient_frequency.values()):
        raise ValueError("A patient may contribute at most three epochs to the six-form design.")

    def candidates(row: dict[str, Any]) -> list[tuple[str, str]]:
        group = str(row.get("labelGroup") or "")
        patient = research_case_patient_key(row)
        used = used_forms_by_patient.get(patient, set())
        available = [
            pair for pair, remaining in capacities[group].items()
            if remaining > 0 and not used.intersection(pair)
        ]
        return sorted(
            available,
            key=lambda pair: (
                -capacities[group][pair],
                _stable_digest(dataset_id, RESEARCH_FIXED_FORM_DESIGN_VERSION, case_key(row), *pair),
            ),
        )

    def assign(remaining: list[dict[str, Any]]) -> bool:
        if not remaining:
            return True
        ranked = sorted(
            remaining,
            key=lambda row: (
                len(candidates(row)),
                -patient_frequency.get(research_case_patient_key(row), 0),
                _stable_digest(dataset_id, RESEARCH_FIXED_FORM_DESIGN_VERSION, case_key(row)),
            ),
        )
        row = ranked[0]
        options = candidates(row)
        if not options:
            return False
        next_remaining = [candidate for candidate in remaining if candidate is not row]
        group = str(row.get("labelGroup") or "")
        patient = research_case_patient_key(row)
        key = case_key(row)
        for pair in options:
            capacities[group][pair] -= 1
            assignments[key] = pair
            used_forms_by_patient.setdefault(patient, set()).update(pair)
            if assign(next_remaining):
                return True
            capacities[group][pair] += 1
            assignments.pop(key, None)
            used_forms_by_patient[patient].difference_update(pair)
        return False

    if not assign(pending):
        raise ValueError(
            "Unable to create six patient-unique fixed forms from this dataset. "
            "Check whether one patient contributes too many epochs."
        )

    forms = {form_id: [] for form_id in RESEARCH_FIXED_FORM_IDS}
    for row in pending:
        for form_id in assignments[case_key(row)]:
            forms[form_id].append(row)
    for form_id, form_rows in forms.items():
        label_counts = {
            group: sum(1 for row in form_rows if str(row.get("labelGroup") or "") == group)
            for group in groups
        }
        patient_keys = [research_case_patient_key(row) for row in form_rows]
        if len(form_rows) != 20 or label_counts != {group: 10 for group in groups}:
            raise ValueError(f"Fixed form {form_id} is not balanced: {label_counts}.")
        if len(patient_keys) != len(set(patient_keys)):
            raise ValueError(f"Fixed form {form_id} contains duplicate patient epochs.")
        form_rows.sort(key=lambda row: case_key(row))
    return forms


def fixed_research_form_assignment_slot(dataset_id: str, assignment_index: int) -> dict[str, Any]:
    """Return a reproducible randomized-block form assignment. / 再現可能なブロック割付。"""
    index = max(0, int(assignment_index))
    block_index, block_position = divmod(index, len(RESEARCH_FIXED_FORM_IDS))
    form_ids = list(RESEARCH_FIXED_FORM_IDS)
    seed = _stable_digest(dataset_id, RESEARCH_FIXED_FORM_DESIGN_VERSION, "block", block_index)
    random.Random(seed).shuffle(form_ids)
    form_id = form_ids[block_position]
    order_number = (index // len(RESEARCH_FIXED_FORM_IDS)) % RESEARCH_FIXED_FORM_ORDER_VARIANTS + 1
    return {
        "designVersion": RESEARCH_FIXED_FORM_DESIGN_VERSION,
        "formId": form_id,
        "orderVersion": f"{form_id}{order_number}",
        "assignmentBlock": block_index + 1,
        "assignmentPosition": block_position + 1,
        "samplingMethod": "pre_generated_connected_balanced_forms",
    }


def fixed_research_form_order(
    rows: list[dict[str, Any]],
    dataset_id: str,
    form_id: str,
    order_version: str,
) -> list[dict[str, Any]]:
    """Create a stable constrained order for one form. / 固定セット内の均衡順序を作る。"""
    return stable_balanced_research_order(
        rows,
        (dataset_id, RESEARCH_FIXED_FORM_DESIGN_VERSION, form_id, order_version),
    )
