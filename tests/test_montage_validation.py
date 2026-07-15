from __future__ import annotations

import numpy as np

from app import (
    SCALP_ORDER,
    build_montage_traces,
    channel_configuration_payload,
    channel_validation_payload,
    montage_status_payload,
    research_case_patient_key,
    volts_to_microvolts,
)


def sample_data(ch_names: list[str]) -> np.ndarray:
    return np.vstack([
        np.full(8, float(index + 1), dtype=float)
        for index, _name in enumerate(ch_names)
    ])


def labels(traces: list[dict]) -> list[str]:
    return [str(trace.get("label")) for trace in traces if trace.get("role") != "ecg"]


def test_transverse_uses_only_scalp_pairs_and_includes_pz_pairs() -> None:
    ch_names = list(SCALP_ORDER)
    warnings: list[str] = []
    traces = build_montage_traces(sample_data(ch_names), ch_names, "transverse", False, warnings)
    trace_labels = labels(traces)

    assert "Fp1-Fp2" in trace_labels
    assert "P3-Pz" in trace_labels
    assert "Pz-P4" in trace_labels
    assert not any("A1" in label or "A2" in label for label in trace_labels)


def test_bipolar_difference_is_returned_in_backend_display_polarity() -> None:
    ch_names = ["Fp1", "F7"]
    data = np.vstack([np.full(4, 10.0), np.full(4, 3.0)])
    traces = build_montage_traces(data, ch_names, "longitudinal", False, [])

    fp1_f7 = next(trace for trace in traces if trace["label"] == "Fp1-F7")
    assert np.asarray(fp1_f7["values"]).tolist() == [-7.0, -7.0, -7.0, -7.0]


def test_pz_is_in_reference_montages() -> None:
    ch_names = list(SCALP_ORDER) + ["A1", "A2"]
    data = sample_data(ch_names)

    for montage, expected in [
        ("average", "Pz-AVG"),
        ("conventional_average", "Pz-AVG"),
        ("conventional", "Pz-A2"),
        ("a1a2", "Pz-A2"),
    ]:
        warnings: list[str] = []
        traces = build_montage_traces(data, ch_names, montage, False, warnings)
        assert expected in labels(traces)


def test_missing_pz_makes_transverse_incomplete() -> None:
    ch_names = [ch for ch in SCALP_ORDER if ch != "Pz"]
    warnings: list[str] = []
    traces = build_montage_traces(sample_data(ch_names), ch_names, "transverse", False, warnings, allow_fallback=False)
    status = montage_status_payload("transverse", ch_names, traces)

    assert status["available"] is False
    assert status["complete"] is False
    assert "Pz" in status["missingChannels"]
    assert "P3-Pz" in status["missingTraces"]
    assert "Pz-P4" in status["missingTraces"]


def test_duplicate_normalized_channels_are_reported() -> None:
    originals = ["EEG Fp1-REF", "Fp1", "Cz"]
    normalized = ["Fp1", "Fp1", "Cz"]
    validation = channel_validation_payload(originals, normalized)

    assert validation["duplicateChannels"] == [
        {
            "normalizedName": "Fp1",
            "sourceChannels": [
                {"index": 0, "originalName": "EEG Fp1-REF"},
                {"index": 1, "originalName": "Fp1"},
            ],
        }
    ]
    config = channel_configuration_payload(validation)
    assert config["montageDerivationAllowed"] is False


def test_bipolar_only_channels_do_not_allow_montage_derivation() -> None:
    channels = ["Fp1-F7", "F7-T7", "T7-P7"]
    validation = channel_validation_payload(channels, channels)
    config = channel_configuration_payload(validation)

    assert validation["bipolarChannels"] == channels
    assert config["referentialCount"] == 0
    assert config["bipolarCount"] == 3
    assert config["montageDerivationAllowed"] is False


def test_patient_key_uses_recording_name_before_epoch_start() -> None:
    row = {"recordingId": "CHEW_aaaaacyf_aaaaacyf_s007_t003_start000070.129_dur010.000"}
    assert research_case_patient_key(row) == "CHEW_aaaaacyf_aaaaacyf_s007_t003"


def test_volts_to_microvolts_is_single_scale_conversion() -> None:
    assert volts_to_microvolts(np.asarray([1e-6, -2e-6])).tolist() == [1.0, -2.0]
