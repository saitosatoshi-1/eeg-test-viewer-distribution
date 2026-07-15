from __future__ import annotations

from research_validation import (
    active_validation_response_map,
    validation_case_rows_for_set,
    validation_set,
    validation_summary,
)


def test_validation_set_aliases() -> None:
    assert validation_set("no_epilepsy") == "artifact"
    assert validation_set("IED_ABSENT") == "artifact"
    assert validation_set("ied") == "ied"


def test_validation_case_rows_for_set_splits_ied_and_artifact() -> None:
    rows = [
        {"caseId": "ied_a", "sourceGroup": "epilepsy", "labelGroup": "epileptiform"},
        {"caseId": "artifact_a", "sourceGroup": "no_epilepsy", "labelGroup": "non_epileptiform"},
        {"caseId": "excluded", "sourceGroup": "epilepsy", "labelGroup": "epileptiform", "include": False},
    ]

    assert [row["caseId"] for row in validation_case_rows_for_set(rows, "ied")] == ["ied_a"]
    assert [row["caseId"] for row in validation_case_rows_for_set(rows, "artifact")] == ["artifact_a"]


def test_active_validation_response_map_excludes_replaced_or_undone_rows() -> None:
    active = active_validation_response_map([
        {"caseId": "a", "decision": "adopt"},
        {"caseId": "b", "decision": "exclude", "superseded": True},
        {"caseId": "c", "decision": "exclude", "undoneAt": "2026-07-15T00:00:00Z"},
    ])

    assert list(active) == ["a"]


def test_validation_summary_counts_reviewed_decisions() -> None:
    cases = [{"caseId": "a"}, {"caseId": "b"}, {"caseId": "c"}]
    summary = validation_summary(cases, {
        "a": {"caseId": "a", "decision": "adopt"},
        "b": {"caseId": "b", "decision": "exclude"},
    })

    assert summary == {
        "caseCount": 3,
        "reviewedCount": 2,
        "adoptedCount": 1,
        "excludedCount": 1,
        "remainingCount": 1,
    }
