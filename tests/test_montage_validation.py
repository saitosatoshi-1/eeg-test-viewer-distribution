from __future__ import annotations

import numpy as np

from eeg_montage import (
    SCALP_ORDER,
    build_montage_traces,
    channel_configuration_payload,
    channel_validation_payload,
    montage_status_payload,
    volts_to_microvolts,
)
from research_sampling import balanced_research_sample_by_exposure, research_case_patient_key


def sample_data(ch_names: list[str]) -> np.ndarray:
    return np.vstack([
        np.full(8, float(index + 1), dtype=float)
        for index, _name in enumerate(ch_names)
    ])


def labels(traces: list[dict]) -> list[str]:
    return [str(trace.get("label")) for trace in traces if trace.get("role") != "ecg"]


def test_transverse_uses_tb_18_2_pairs() -> None:
    ch_names = list(SCALP_ORDER) + ["A1", "A2"]
    warnings: list[str] = []
    traces = build_montage_traces(sample_data(ch_names), ch_names, "transverse", False, warnings)
    trace_labels = labels(traces)

    assert trace_labels == [
        "Fp1-Fp2",
        "F7-F3",
        "F3-Fz",
        "Fz-F4",
        "F4-F8",
        "A1-T7",
        "T7-C3",
        "C3-Cz",
        "Cz-C4",
        "C4-T8",
        "T8-A2",
        "P7-P3",
        "P3-Pz",
        "Pz-P4",
        "P4-P8",
        "O1-O2",
        "Fz-Cz",
        "Cz-Pz",
    ]


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
    ch_names = [ch for ch in SCALP_ORDER if ch != "Pz"] + ["A1", "A2"]
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


def test_balanced_sampling_prefers_less_exposed_cases() -> None:
    rows = [
        {"caseId": "low_1", "recordingId": "patient_a_start000001"},
        {"caseId": "low_2", "recordingId": "patient_b_start000001"},
        {"caseId": "high_1", "recordingId": "patient_c_start000001"},
    ]
    sampled = balanced_research_sample_by_exposure(
        rows,
        2,
        {"low_1": 0, "low_2": 0, "high_1": 4},
        ("dataset", "reader", "phase1"),
    )

    assert {row["caseId"] for row in sampled} == {"low_1", "low_2"}


def test_balanced_sampling_avoids_same_patient_when_possible() -> None:
    rows = [
        {"caseId": "same_1", "recordingId": "patient_a_start000001"},
        {"caseId": "same_2", "recordingId": "patient_a_start000002"},
        {"caseId": "other_1", "recordingId": "patient_b_start000001"},
    ]
    sampled = balanced_research_sample_by_exposure(rows, 2, {}, ("dataset", "reader", "phase1"))

    assert len({research_case_patient_key(row) for row in sampled}) == 2


def test_volts_to_microvolts_is_single_scale_conversion() -> None:
    assert volts_to_microvolts(np.asarray([1e-6, -2e-6])).tolist() == [1.0, -2.0]
