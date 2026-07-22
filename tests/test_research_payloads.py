from __future__ import annotations

from app import (
    research_compact_reader_profile,
    research_export_debriefing_payload,
    research_export_response_payload,
    research_montage_switch_payload,
    research_reader_timing_summary,
)


def test_research_montage_switch_payload_excludes_initial_and_same_montage_rows() -> None:
    rows = [
        {"index": 1, "atSec": 0, "from": "", "to": "conventional"},
        {"index": 2, "atSec": 1.2, "from": "conventional", "to": "conventional"},
        {"index": 3, "atSec": 2.4, "from": "conventional", "to": "longitudinal"},
    ]

    assert research_montage_switch_payload(rows) == [
        {"index": 1, "atSec": 2.4, "from": "conventional", "to": "longitudinal"}
    ]


def test_research_export_omits_redundant_profile_and_debriefing_fields() -> None:
    profile = research_compact_reader_profile({
        "readerName": "Test Reader",
        "dataProviderSharingAcknowledged": True,
    })
    debriefing = research_export_debriefing_payload({
        "continuedDataUseConsent": True,
        "individualFeedbackRequested": True,
    })

    assert profile["readerName"] == "Test Reader"
    assert "dataProviderSharingAcknowledged" not in profile
    assert debriefing == {"continuedDataUseConsent": True}


def test_research_export_omits_millisecond_timing_fields() -> None:
    response = research_export_response_payload({
        "caseId": "case-1",
        "elapsedMs": 921,
        "tutorialToTestCompletedMs": 64656,
        "totalElapsedMs": 64656,
        "display": {},
        "montageLog": {},
    })
    timing = research_reader_timing_summary([{
        "testStartedAt": "2026-07-22T00:00:00Z",
        "testCompletedAt": "2026-07-22T00:01:04.656Z",
        "tutorialCompletedAt": "2026-07-22T00:00:00Z",
        "tutorialToTestCompletedMs": 64656,
        "totalElapsedMs": 64656,
    }])

    assert "elapsedMs" not in response
    assert "tutorialToTestCompletedMs" not in response
    assert "totalElapsedMs" not in response
    assert "tutorialToTestCompletedMs" not in timing
    assert "totalElapsedMs" not in timing
    assert timing["tutorialToTestCompletedSec"] == 64.656
    assert timing["totalElapsedSec"] == 64.656
