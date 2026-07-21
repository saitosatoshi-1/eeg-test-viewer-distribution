from __future__ import annotations

import numpy as np

import eeg_montage
from eeg_montage import (
    SCALP_ORDER,
    apply_display_filters,
    build_montage_traces,
    channel_configuration_payload,
    channel_validation_payload,
    montage_status_payload,
    volts_to_microvolts,
)
from research_sampling import (
    RESEARCH_FIXED_FORM_IDS,
    balanced_research_sample_by_exposure,
    fixed_research_form_assignment_slot,
    fixed_research_form_definitions,
    fixed_research_form_order,
    research_case_patient_key,
    research_max_consecutive_group_count,
)


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


def test_fixed_forms_are_balanced_connected_and_patient_unique() -> None:
    rows = []
    for index in range(30):
        patient_id = f"patient_{index:02d}"
        rows.extend([
            {"caseId": f"epi_{index:02d}", "patientId": patient_id, "labelGroup": "epileptiform"},
            {"caseId": f"non_{index:02d}", "patientId": patient_id, "labelGroup": "non_epileptiform"},
        ])

    forms = fixed_research_form_definitions(rows, "validation_v1")

    assert set(forms) == set(RESEARCH_FIXED_FORM_IDS)
    exposure_counts = {str(row["caseId"]): 0 for row in rows}
    for form_rows in forms.values():
        assert len(form_rows) == 20
        assert sum(row["labelGroup"] == "epileptiform" for row in form_rows) == 10
        assert sum(row["labelGroup"] == "non_epileptiform" for row in form_rows) == 10
        patients = [research_case_patient_key(row) for row in form_rows]
        assert len(patients) == len(set(patients))
        for row in form_rows:
            exposure_counts[str(row["caseId"])] += 1
    assert set(exposure_counts.values()) == {2}


def test_fixed_form_assignment_is_balanced_in_each_six_reader_block() -> None:
    assignments = [fixed_research_form_assignment_slot("validation_v1", index) for index in range(30)]

    for block_index in range(5):
        block = assignments[block_index * 6:(block_index + 1) * 6]
        assert {row["formId"] for row in block} == set(RESEARCH_FIXED_FORM_IDS)
        assert {row["orderVersion"][-1] for row in block} == {str(block_index + 1)}

    form_order_combinations = {
        (row["formId"], row["orderVersion"])
        for row in assignments
    }
    assert len(form_order_combinations) == 30
    for form_id in RESEARCH_FIXED_FORM_IDS:
        assert {
            row["orderVersion"]
            for row in assignments
            if row["formId"] == form_id
        } == {f"{form_id}{number}" for number in range(1, 6)}


def test_each_form_has_five_distinct_constrained_orders() -> None:
    rows = []
    for index in range(30):
        patient_id = f"patient_{index:02d}"
        rows.extend([
            {"caseId": f"epi_{index:02d}", "patientId": patient_id, "labelGroup": "epileptiform"},
            {"caseId": f"non_{index:02d}", "patientId": patient_id, "labelGroup": "non_epileptiform"},
        ])
    forms = fixed_research_form_definitions(rows, "validation_v1")

    for form_id, form_rows in forms.items():
        orders = [
            fixed_research_form_order(form_rows, "validation_v1", form_id, f"{form_id}{number}")
            for number in range(1, 6)
        ]
        assert len({tuple(str(row["caseId"]) for row in order) for order in orders}) == 5
        assert all(research_max_consecutive_group_count(order) <= 3 for order in orders)


def test_volts_to_microvolts_is_single_scale_conversion() -> None:
    assert volts_to_microvolts(np.asarray([1e-6, -2e-6])).tolist() == [1.0, -2.0]


def test_apply_display_filters_uses_loaded_signal_module() -> None:
    class FakeSignal:
        def __init__(self) -> None:
            self.calls: list[tuple[str, object]] = []

        def butter(self, *args, **kwargs):
            self.calls.append(("butter", kwargs.get("btype")))
            return ("sos", kwargs.get("btype"))

        def sosfiltfilt(self, sos, data, axis=1):
            self.calls.append(("sosfiltfilt", sos))
            return data + 1.0

        def iirnotch(self, freq, Q, fs):
            self.calls.append(("iirnotch", freq))
            return ("b", freq), ("a", freq)

        def filtfilt(self, b, a, data, axis=1):
            self.calls.append(("filtfilt", b[1]))
            return data + 1.0

    fake = FakeSignal()
    previous_signal = eeg_montage._signal
    previous_attempted = eeg_montage._SIGNAL_IMPORT_ATTEMPTED
    try:
        eeg_montage._signal = fake
        eeg_montage._SIGNAL_IMPORT_ATTEMPTED = True
        warnings: list[str] = []
        data = np.ones((2, 64), dtype=float)
        filtered, _ = apply_display_filters(data, ["Fp1", "Fp2"], 256.0, "0.3", "30", "60", warnings)
    finally:
        eeg_montage._signal = previous_signal
        eeg_montage._SIGNAL_IMPORT_ATTEMPTED = previous_attempted

    assert not warnings
    assert filtered.mean() > data.mean()
    assert ("butter", "highpass") in fake.calls
    assert ("butter", "lowpass") in fake.calls
    assert ("iirnotch", 60.0) in fake.calls
