from __future__ import annotations

from app import research_montage_switch_payload


def test_research_montage_switch_payload_excludes_initial_and_same_montage_rows() -> None:
    rows = [
        {"index": 1, "atSec": 0, "from": "", "to": "conventional"},
        {"index": 2, "atSec": 1.2, "from": "conventional", "to": "conventional"},
        {"index": 3, "atSec": 2.4, "from": "conventional", "to": "longitudinal"},
    ]

    assert research_montage_switch_payload(rows) == [
        {"index": 1, "atSec": 2.4, "from": "conventional", "to": "longitudinal"}
    ]
