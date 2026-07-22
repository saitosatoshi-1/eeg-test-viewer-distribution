from __future__ import annotations

import gzip
import threading
from unittest.mock import patch

import numpy as np

from app import RecordingStore, compact_active_window_payload, maybe_gzip_http_body


def test_maybe_gzip_http_body_compresses_large_json_losslessly() -> None:
    body = (b'{"samples":[' + b"1.234567," * 5000 + b"0]}")

    compressed, used = maybe_gzip_http_body(body, "gzip, deflate")

    assert used is True
    assert len(compressed) < len(body)
    assert gzip.decompress(compressed) == body


def test_filtered_window_data_reuses_same_filter_result() -> None:
    store = object.__new__(RecordingStore)
    store._lock = threading.RLock()
    store._filtered_window_cache = {}
    data = np.ones((2, 64), dtype=float)

    with patch("app.apply_display_filters", return_value=(data + 1.0, ["Fp1", "Fp2"])) as apply_filter:
        first = store.filtered_window_data(
            "record", 0.0, 10.0, data, ["Fp1", "Fp2"], 256.0, "0.3", "120", "60"
        )
        second = store.filtered_window_data(
            "record", 0.0, 10.0, data, ["Fp1", "Fp2"], 256.0, "0.3", "120", "60"
        )

    assert apply_filter.call_count == 1
    assert np.array_equal(first[0], second[0])


def test_compact_active_window_payload_removes_duplicate_waveform_container() -> None:
    payload = {
        "times": [0.0, 0.1],
        "traces": [{"label": "Fp1-A1", "values": [1.0, 2.0]}],
        "montageViews": [{"montage": "conventional", "times": [0.0, 0.1], "traces": [{"values": [1.0, 2.0]}]}],
        "metadata": {"raw": {"durationSec": 10}},
        "channelValidation": {"valid": True},
        "channelConfiguration": {"montageDerivationAllowed": True},
        "filterPadding": {"beforeSec": 5},
        "displayFilters": {"tc": "0.3", "hf": "120", "ac": "60"},
    }

    compact = compact_active_window_payload(payload, True)

    assert compact["compactActive"] is True
    assert compact["times"] == payload["times"]
    assert compact["traces"] == payload["traces"]
    for key in ("montageViews", "metadata", "channelValidation", "channelConfiguration", "filterPadding"):
        assert key not in compact
    assert compact_active_window_payload(payload, False) is payload
