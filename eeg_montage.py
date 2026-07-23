#!/usr/bin/env python3
from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

import numpy as np

_signal = None
_SIGNAL_IMPORT_ATTEMPTED = False
DISPLAY_FILTER_PADDING_SEC = 5.0


def ensure_signal():
    global _signal, _SIGNAL_IMPORT_ATTEMPTED
    if not _SIGNAL_IMPORT_ATTEMPTED:
        _SIGNAL_IMPORT_ATTEMPTED = True
        try:
            from scipy import signal as imported_signal
            _signal = imported_signal
        except Exception:
            _signal = None
    return _signal


SCALP_ORDER = [
    "Fp1",
    "F7",
    "T7",
    "P7",
    "Fp2",
    "F8",
    "T8",
    "P8",
    "F3",
    "C3",
    "P3",
    "O1",
    "F4",
    "C4",
    "P4",
    "O2",
    "Fz",
    "Cz",
    "Pz",
]
DISPLAY_EEG_LABELS = set(SCALP_ORDER) | {"A1", "A2", "T1", "T2"}

CHANNEL_GROUPS = {
    "left_temporal": {"Fp1", "F7", "T7", "P7"},
    "right_temporal": {"Fp2", "F8", "T8", "P8"},
    "left_parasagittal": {"F3", "C3", "P3", "O1"},
    "right_parasagittal": {"F4", "C4", "P4", "O2"},
    "midline": {"Fz", "Cz", "Pz"},
}

LEGACY_LABELS = {"T3": "T7", "T4": "T8", "T5": "P7", "T6": "P8"}
EAR_REFERENCE_LABELS = {
    "M1": "A1",
    "M2": "A2",
    "LE": "A1",
    "RE": "A2",
    "LPA": "A1",
    "RPA": "A2",
    "LEFTMASTOID": "A1",
    "RIGHTMASTOID": "A2",
    "LEFTAURICULAR": "A1",
    "RIGHTAURICULAR": "A2",
}
CANONICAL_CHANNEL_LABELS = {
    **{name.upper(): name for name in DISPLAY_EEG_LABELS},
    "FP1": "Fp1",
    "FP2": "Fp2",
    "FZ": "Fz",
    "CZ": "Cz",
    "PZ": "Pz",
    **EAR_REFERENCE_LABELS,
}
ECG_CANDIDATES = ("X5", "E", "ECG", "EKG")
ECG_EXACT_KEYS = {"X5", "E", "ECG", "EKG", "ECG1", "ECG2", "ECG3", "EKG1", "EKG2", "EKG3"}
ECG_PREFIX_KEYS = ("ECG", "EKG")
ECG_LOWPASS_HZ = 20.0
ECG_TC_SECONDS = 0.1


def tc_to_highpass(tc: str) -> float | None:
    if tc.upper() == "OFF":
        return None
    seconds = float(tc)
    if seconds <= 0:
        return None
    return 1.0 / (2.0 * math.pi * seconds)


def hf_to_lowpass(hf: str) -> float | None:
    if hf.upper() == "OFF":
        return None
    try:
        freq = float(hf)
    except ValueError:
        return None
    return freq if freq > 0 else None


def channel_key(name: str) -> str:
    clean = normalize_label(name)
    clean = unicodedata.normalize("NFKC", clean).upper()
    return re.sub(r"[^A-Z0-9]+", "", clean)


def is_ecg_channel_name(name: str) -> bool:
    key = channel_key(name)
    if key in ECG_EXACT_KEYS:
        return True
    return any(key.startswith(prefix) for prefix in ECG_PREFIX_KEYS)


def ecg_channel_sort_key(item: tuple[int, str]) -> tuple[int, int]:
    idx, name = item
    key = channel_key(name)
    priority = {"X5": 0, "E": 1, "ECG": 2, "EKG": 3}
    if key in priority:
        return priority[key], idx
    if key.startswith("ECG"):
        return 4, idx
    if key.startswith("EKG"):
        return 5, idx
    return 9, idx


def ecg_channel_indices(ch_names: list[str]) -> list[int]:
    detected = [(idx, name) for idx, name in enumerate(ch_names) if is_ecg_channel_name(name)]
    return [idx for idx, _ in sorted(detected, key=ecg_channel_sort_key)]

def canonical_channel_label(clean: str) -> str:
    key = re.sub(r"[^A-Z0-9]+", "", unicodedata.normalize("NFKC", clean).upper())
    legacy = LEGACY_LABELS.get(key)
    if legacy:
        return legacy
    return CANONICAL_CHANNEL_LABELS.get(key, clean)


def normalize_label(name: str) -> str:
    clean = str(name).strip()
    clean = clean.replace("EEG ", "").replace("EEG_", "")
    clean = clean.replace("POL ", "").replace("POL_", "")
    clean = clean.replace("-Ref", "").replace("-REF", "").replace("-ref", "")
    clean = clean.replace("–", "-").replace("—", "-")
    clean = unicodedata.normalize("NFKC", clean).strip()
    if "-" in clean:
        left, right = [part.strip() for part in clean.split("-", 1)]
        right_key = re.sub(r"[^A-Z0-9]+", "", right.upper())
        left_label = canonical_channel_label(left)
        right_label = canonical_channel_label(right)
        if right_key not in {"REF", "LE", "AV", "AVG"} and right_label in DISPLAY_EEG_LABELS:
            return f"{left_label}-{right_label}"
    upper = clean.upper()
    for suffix in ("-LE", "-REF", "-AV", "-AVG"):
        if upper.endswith(suffix):
            clean = clean[: -len(suffix)]
            break
    return canonical_channel_label(clean)


def volts_to_microvolts(data: np.ndarray) -> np.ndarray:
    return np.asarray(data, dtype=float) * 1e6


def is_display_eeg_channel_name(name: str) -> bool:
    return normalize_label(name) in DISPLAY_EEG_LABELS


def is_fallback_eeg_channel_name(name: str) -> bool:
    clean = normalize_label(name)
    key = channel_key(clean)
    if not key or is_ecg_channel_name(clean):
        return False
    if clean in DISPLAY_EEG_LABELS:
        return True
    if "-" in clean:
        left, right = [part.strip() for part in clean.split("-", 1)]
        if left in DISPLAY_EEG_LABELS and right in DISPLAY_EEG_LABELS:
            return True
    aux_prefixes = ("DC", "TRIG", "MARK", "EVENT", "STATUS", "PHOTIC", "RESP", "PULSE", "SPO2", "ETCO2")
    return not any(key.startswith(prefix) for prefix in aux_prefixes)


def classify_eeg_channel(name: str) -> str:
    clean = normalize_label(name)
    if is_ecg_channel_name(clean):
        return "ecg"
    if clean in DISPLAY_EEG_LABELS:
        return "referential"
    if "-" in clean:
        left, right = [part.strip() for part in clean.split("-", 1)]
        if left in DISPLAY_EEG_LABELS and right in DISPLAY_EEG_LABELS:
            return "bipolar"
    key = channel_key(clean)
    aux_prefixes = ("DC", "TRIG", "MARK", "EVENT", "STATUS", "PHOTIC", "RESP", "PULSE", "SPO2", "ETCO2")
    if any(key.startswith(prefix) for prefix in aux_prefixes):
        return "auxiliary"
    return "unknown"


def duplicate_channel_payload(original_ch_names: list[str], normalized_ch_names: list[str]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for index, normalized_name in enumerate(normalized_ch_names):
        grouped.setdefault(normalized_name, []).append({
            "index": index,
            "originalName": original_ch_names[index] if index < len(original_ch_names) else normalized_name,
        })
    return [
        {
            "normalizedName": name,
            "sourceChannels": rows,
        }
        for name, rows in sorted(grouped.items())
        if name and len(rows) > 1
    ]


def channel_validation_payload(original_ch_names: list[str], normalized_ch_names: list[str]) -> dict[str, Any]:
    available_scalp = sorted(ch for ch in SCALP_ORDER if ch in normalized_ch_names)
    ear_channels = sorted(ch for ch in ("A1", "A2") if ch in normalized_ch_names)
    ecg_channels = [name for name in normalized_ch_names if is_ecg_channel_name(name)]
    bipolar_channels = [name for name in normalized_ch_names if classify_eeg_channel(name) == "bipolar"]
    unknown_channels = [name for name in normalized_ch_names if classify_eeg_channel(name) == "unknown"]
    return {
        "availableScalpChannels": available_scalp,
        "missingScalpChannels": [ch for ch in SCALP_ORDER if ch not in normalized_ch_names],
        "earChannels": ear_channels,
        "ecgChannels": ecg_channels,
        "bipolarChannels": bipolar_channels,
        "unknownChannels": unknown_channels,
        "duplicateChannels": duplicate_channel_payload(original_ch_names, normalized_ch_names),
    }


def channel_configuration_payload(channel_validation: dict[str, Any]) -> dict[str, Any]:
    referential_count = len(channel_validation.get("availableScalpChannels") or [])
    bipolar_count = len(channel_validation.get("bipolarChannels") or [])
    auxiliary_count = len(channel_validation.get("ecgChannels") or [])
    unknown_count = len(channel_validation.get("unknownChannels") or [])
    duplicate_count = len(channel_validation.get("duplicateChannels") or [])
    mixed = referential_count > 0 and bipolar_count > 0
    derivation_allowed = referential_count > 0 and bipolar_count == 0 and duplicate_count == 0 and not mixed
    return {
        "referentialCount": referential_count,
        "bipolarCount": bipolar_count,
        "auxiliaryCount": auxiliary_count,
        "unknownCount": unknown_count,
        "mixedConfiguration": mixed,
        "montageDerivationAllowed": derivation_allowed,
    }


def filter_padding_payload(start: int, stop: int, padded_start: int, padded_stop: int, sfreq: float) -> dict[str, Any]:
    requested = float(DISPLAY_FILTER_PADDING_SEC)
    before = max(0.0, float((start - padded_start) / sfreq)) if sfreq else 0.0
    after = max(0.0, float((padded_stop - stop) / sfreq)) if sfreq else 0.0
    return {
        "requestedSec": requested,
        "beforeSec": round(before, 3),
        "afterSec": round(after, 3),
        "complete": before >= requested and after >= requested,
    }


def peak_preserving_indices(values: np.ndarray, max_points: int) -> np.ndarray:
    n_samples = int(values.shape[0])
    if n_samples <= 0:
        return np.asarray([], dtype=int)
    if n_samples <= max_points:
        return np.arange(n_samples, dtype=int)
    bucket_count = max(1, max_points // 2)
    edges = np.linspace(0, n_samples, bucket_count + 1, dtype=int)
    selected: list[int] = []
    for start, stop in zip(edges[:-1], edges[1:]):
        if stop <= start:
            continue
        segment = np.asarray(values[start:stop], dtype=float)
        finite = np.where(np.isfinite(segment))[0]
        if finite.size == 0:
            selected.append(start)
            continue
        finite_values = segment[finite]
        min_idx = start + int(finite[int(np.argmin(finite_values))])
        max_idx = start + int(finite[int(np.argmax(finite_values))])
        selected.extend(sorted({min_idx, max_idx}))
    if selected[0] != 0:
        selected.insert(0, 0)
    if selected[-1] != n_samples - 1:
        selected.append(n_samples - 1)
    return np.asarray(sorted(set(selected)), dtype=int)


def decimate_traces_for_display(traces: list[dict[str, Any]], sample_start: int, sfreq: float, max_points: int) -> list[float]:
    arrays = [
        np.asarray(trace.get("values") if trace.get("values") is not None else [], dtype=float)
        for trace in traces
    ]
    if not arrays:
        return []
    n_samples = min((values.shape[0] for values in arrays), default=0)
    if n_samples <= 0:
        for trace in traces:
            trace["values"] = []
        return []
    arrays = [values[:n_samples] for values in arrays]
    eeg_arrays = [
        values
        for trace, values in zip(traces, arrays)
        if trace.get("role") != "ecg"
    ]
    source_arrays = eeg_arrays or arrays
    selected: set[int] = {0, n_samples - 1}
    for values in source_arrays:
        selected.update(int(index) for index in peak_preserving_indices(np.abs(values), max_points))
    indices = np.asarray(sorted(index for index in selected if 0 <= index < n_samples), dtype=int)
    if indices.size > max_points:
        score = np.nanmax(np.abs(np.vstack(source_arrays)), axis=0)
        reduced = peak_preserving_indices(score[indices], max_points)
        indices = indices[reduced]
    for trace, values in zip(traces, arrays):
        trace["values"] = values[indices].astype(float).round(3).tolist()
    return ((sample_start + indices) / sfreq).astype(float).round(4).tolist()


def channel_group(ch_name: str) -> str:
    for group, names in CHANNEL_GROUPS.items():
        if ch_name in names:
            return group
    return ""


def montage_trace_requirements(montage: str) -> tuple[list[str], set[str]]:
    if montage == "longitudinal":
        pairs = [
            ("Fp1", "F7"), ("F7", "T7"), ("T7", "P7"), ("P7", "O1"),
            ("Fp2", "F8"), ("F8", "T8"), ("T8", "P8"), ("P8", "O2"),
            ("Fp1", "F3"), ("F3", "C3"), ("C3", "P3"), ("P3", "O1"),
            ("Fp2", "F4"), ("F4", "C4"), ("C4", "P4"), ("P4", "O2"),
            ("Fz", "Cz"), ("Cz", "Pz"),
        ]
        return [f"{a}-{b}" for a, b in pairs], {item for pair in pairs for item in pair}
    if montage == "transverse":
        pairs = [
            ("Fp1", "Fp2"), ("F7", "F3"), ("F3", "Fz"), ("Fz", "F4"), ("F4", "F8"),
            ("A1", "T7"), ("T7", "C3"), ("C3", "Cz"), ("Cz", "C4"), ("C4", "T8"), ("T8", "A2"),
            ("P7", "P3"), ("P3", "Pz"), ("Pz", "P4"), ("P4", "P8"), ("O1", "O2"),
            ("Fz", "Cz"), ("Cz", "Pz"),
        ]
        return [f"{a}-{b}" for a, b in pairs], {item for pair in pairs for item in pair}
    if montage == "average":
        return [f"{ch}-AVG" for ch in SCALP_ORDER], set(SCALP_ORDER)
    if montage == "conventional_average":
        channels = ["Fp1", "Fp2", "F3", "F4", "C3", "C4", "P3", "P4", "O1", "O2", "F7", "F8", "T7", "T8", "P7", "P8", "Fz", "Cz", "Pz"]
        return [f"{ch}-AVG" for ch in channels], set(channels)
    if montage == "conventional":
        pairs = [
            ("Fp1", "A1"), ("Fp2", "A2"), ("F3", "A1"), ("F4", "A2"), ("C3", "A1"), ("C4", "A2"),
            ("P3", "A1"), ("P4", "A2"), ("O1", "A1"), ("O2", "A2"), ("F7", "A1"), ("F8", "A2"),
            ("T7", "A1"), ("T8", "A2"), ("P7", "A1"), ("P8", "A2"), ("Fz", "A1"), ("Cz", "A2"), ("Pz", "A1"),
        ]
        return [f"{a}-{b}" for a, b in pairs], {item for pair in pairs for item in pair}
    if montage == "a1a2":
        pairs = [
            ("Fp1", "A1"), ("F7", "A1"), ("T7", "A1"), ("P7", "A1"),
            ("Fp2", "A2"), ("F8", "A2"), ("T8", "A2"), ("P8", "A2"),
            ("F3", "A1"), ("C3", "A1"), ("P3", "A1"), ("O1", "A1"),
            ("F4", "A2"), ("C4", "A2"), ("P4", "A2"), ("O2", "A2"),
            ("Fz", "A2"), ("Cz", "A2"), ("Pz", "A2"),
        ]
        return [f"{a}-{b}" for a, b in pairs], {item for pair in pairs for item in pair}
    if montage == "cz":
        labels = [f"{ch}-Cz" for ch in SCALP_ORDER if ch != "Cz"]
        return labels, set(SCALP_ORDER)
    return [], set()


def montage_status_payload(montage: str, ch_names: list[str], traces: list[dict[str, Any]]) -> dict[str, Any]:
    expected_labels, required_channels = montage_trace_requirements(montage)
    available_channels = set(ch_names)
    actual_labels = [str(trace.get("label") or "") for trace in traces if trace.get("role") != "ecg"]
    actual_set = set(actual_labels)
    missing_traces = [label for label in expected_labels if label not in actual_set]
    missing_channels = sorted(ch for ch in required_channels if ch not in available_channels)
    expected_count = len(expected_labels)
    actual_count = sum(1 for label in actual_labels if not expected_labels or label in expected_labels)
    complete = bool(expected_count and not missing_traces and not missing_channels and actual_count >= expected_count)
    available = complete if expected_count else bool(actual_labels)
    return {
        "montage": montage,
        "available": available,
        "complete": complete,
        "expectedTraceCount": expected_count,
        "actualTraceCount": actual_count,
        "missingChannels": missing_channels,
        "missingTraces": missing_traces,
    }


def apply_display_filters(
    data: np.ndarray, ch_names: list[str], sfreq: float, tc: str, hf: str, ac: str, warnings: list[str]
) -> tuple[np.ndarray, list[str]]:
    sig = ensure_signal()
    if data.shape[1] < 16 or sig is None:
        if tc.upper() != "OFF" or hf.upper() != "OFF" or ac.upper() != "OFF":
            warnings.append("SciPy filter support is unavailable or the window is too short; filters skipped.")
        return data, ch_names

    filtered = data.copy()
    hp = tc_to_highpass(tc)
    lp = hf_to_lowpass(hf)
    ecg_indices = ecg_channel_indices(ch_names)
    try:
        non_ecg_indices = [idx for idx in range(filtered.shape[0]) if idx not in ecg_indices]
        if hp and hp < sfreq / 2 and non_ecg_indices:
            sos = sig.butter(2, hp, btype="highpass", fs=sfreq, output="sos")
            filtered[non_ecg_indices] = sig.sosfiltfilt(sos, filtered[non_ecg_indices], axis=1)
        if lp and lp < sfreq / 2 and non_ecg_indices:
            sos = sig.butter(4, lp, btype="lowpass", fs=sfreq, output="sos")
            filtered[non_ecg_indices] = sig.sosfiltfilt(sos, filtered[non_ecg_indices], axis=1)
        ecg_hp = tc_to_highpass(str(ECG_TC_SECONDS))
        if ecg_indices and ecg_hp and ecg_hp < sfreq / 2:
            sos = sig.butter(2, ecg_hp, btype="highpass", fs=sfreq, output="sos")
            filtered[ecg_indices] = sig.sosfiltfilt(sos, filtered[ecg_indices], axis=1)
        if ecg_indices and ECG_LOWPASS_HZ < sfreq / 2:
            sos = sig.butter(4, ECG_LOWPASS_HZ, btype="lowpass", fs=sfreq, output="sos")
            filtered[ecg_indices] = sig.sosfiltfilt(sos, filtered[ecg_indices], axis=1)
        notch_freqs: list[float] = []
        if ac == "50":
            notch_freqs = [50.0]
        elif ac == "60":
            notch_freqs = [60.0]
        elif ac == "50h":
            notch_freqs = [50.0, 100.0]
        elif ac == "60h":
            notch_freqs = [60.0, 120.0]
        for freq in notch_freqs:
            if freq < sfreq / 2:
                b, a = sig.iirnotch(freq, Q=30.0, fs=sfreq)
                filtered = sig.filtfilt(b, a, filtered, axis=1)
    except Exception as exc:
        warnings.append(f"Display filter skipped: {exc}")
        return data, ch_names
    return filtered, ch_names


def build_montage_traces(
    data: np.ndarray,
    ch_names: list[str],
    montage: str,
    include_ecg: bool,
    warnings: list[str],
    sfreq: float | None = None,
    allow_fallback: bool = True,
) -> list[dict[str, Any]]:
    index = {name: idx for idx, name in enumerate(ch_names)}
    traces: list[dict[str, Any]] = []

    def add(name: str, values: np.ndarray, role: str = "eeg", group: str = "") -> None:
        # EEG traces are converted to display polarity here: negative voltage is drawn upward by the frontend.
        display_values = -np.asarray(values, dtype=float) if role == "eeg" else np.asarray(values, dtype=float)
        traces.append({"label": name, "role": role, "group": group, "values": display_values})

    def diff(a: str, b: str, group: str = "") -> bool:
        if a in index and b in index:
            add(f"{a}-{b}", data[index[a]] - data[index[b]], group=group or channel_group(a))
            return True
        existing = f"{a}-{b}"
        if existing in index:
            add(existing, data[index[existing]], group=group or channel_group(a))
            return True
        return False

    def ear_reference(a: str, b: str, group: str = "") -> bool:
        if diff(a, b, group):
            return True
        if b in {"A1", "A2"} and not any("A1/A2 reference channels" in warning for warning in warnings):
            warnings.append("A1/A2 reference channels were not found; ear-reference montage could not be derived.")
        return False

    if montage == "longitudinal":
        pairs = [
            ("Fp1", "F7", "left_temporal"),
            ("F7", "T7", "left_temporal"),
            ("T7", "P7", "left_temporal"),
            ("P7", "O1", "left_temporal"),
            ("Fp2", "F8", "right_temporal"),
            ("F8", "T8", "right_temporal"),
            ("T8", "P8", "right_temporal"),
            ("P8", "O2", "right_temporal"),
            ("Fp1", "F3", "left_parasagittal"),
            ("F3", "C3", "left_parasagittal"),
            ("C3", "P3", "left_parasagittal"),
            ("P3", "O1", "left_parasagittal"),
            ("Fp2", "F4", "right_parasagittal"),
            ("F4", "C4", "right_parasagittal"),
            ("C4", "P4", "right_parasagittal"),
            ("P4", "O2", "right_parasagittal"),
            ("Fz", "Cz", "midline"),
            ("Cz", "Pz", "midline"),
        ]
        for a, b, group in pairs:
            diff(a, b, group)
    elif montage == "transverse":
        for a, b, group in [
            ("Fp1", "Fp2", "midline"),
            ("F7", "F3", "left_frontal"),
            ("F3", "Fz", "left_frontal"),
            ("Fz", "F4", "right_frontal"),
            ("F4", "F8", "right_frontal"),
            ("A1", "T7", "left_temporal"),
            ("T7", "C3", "left_central"),
            ("C3", "Cz", "left_central"),
            ("Cz", "C4", "right_central"),
            ("C4", "T8", "right_central"),
            ("T8", "A2", "right_temporal"),
            ("P7", "P3", "left_posterior"),
            ("P3", "Pz", "left_posterior"),
            ("Pz", "P4", "right_posterior"),
            ("P4", "P8", "right_posterior"),
            ("O1", "O2", "midline"),
            ("Fz", "Cz", "midline"),
            ("Cz", "Pz", "midline"),
        ]:
            diff(a, b, group)
    elif montage == "average":
        scalp = [ch for ch in SCALP_ORDER if ch in index]
        if scalp:
            avg = data[[index[ch] for ch in scalp]].mean(axis=0)
            for ch in scalp:
                add(f"{ch}-AVG", data[index[ch]] - avg, group=channel_group(ch))
    elif montage == "a1a2":
        pairs = [
            ("Fp1", "A1", "left_temporal"),
            ("F7", "A1", "left_temporal"),
            ("T7", "A1", "left_temporal"),
            ("P7", "A1", "left_temporal"),
            ("Fp2", "A2", "right_temporal"),
            ("F8", "A2", "right_temporal"),
            ("T8", "A2", "right_temporal"),
            ("P8", "A2", "right_temporal"),
            ("F3", "A1", "left_parasagittal"),
            ("C3", "A1", "left_parasagittal"),
            ("P3", "A1", "left_parasagittal"),
            ("O1", "A1", "left_parasagittal"),
            ("F4", "A2", "right_parasagittal"),
            ("C4", "A2", "right_parasagittal"),
            ("P4", "A2", "right_parasagittal"),
            ("O2", "A2", "right_parasagittal"),
            ("Fz", "A2", "midline"),
            ("Cz", "A2", "midline"),
            ("Pz", "A2", "midline"),
        ]
        for a, b, group in pairs:
            ear_reference(a, b, group)
    elif montage in {"conventional", "conventional_average"}:
        trace_channels = [
            ("Fp1", "A1", "left_temporal"),
            ("Fp2", "A2", "right_temporal"),
            ("F3", "A1", "left_parasagittal"),
            ("F4", "A2", "right_parasagittal"),
            ("C3", "A1", "left_parasagittal"),
            ("C4", "A2", "right_parasagittal"),
            ("P3", "A1", "left_parasagittal"),
            ("P4", "A2", "right_parasagittal"),
            ("O1", "A1", "left_parasagittal"),
            ("O2", "A2", "right_parasagittal"),
            ("F7", "A1", "left_temporal"),
            ("F8", "A2", "right_temporal"),
            ("T7", "A1", "left_temporal"),
            ("T8", "A2", "right_temporal"),
            ("P7", "A1", "left_temporal"),
            ("P8", "A2", "right_temporal"),
            ("Fz", "A1", "midline"),
            ("Cz", "A2", "midline"),
            ("Pz", "A1", "midline"),
        ]
        if montage == "conventional_average":
            scalp = [ch for ch in SCALP_ORDER if ch in index]
            if scalp:
                avg = data[[index[ch] for ch in scalp]].mean(axis=0)
                for ch, _ref, group in trace_channels:
                    if ch in index:
                        add(f"{ch}-AVG", data[index[ch]] - avg, group=group)
        else:
            for a, b, group in trace_channels:
                ear_reference(a, b, group)
    elif montage == "cz":
        for ch in [c for c in SCALP_ORDER if c in index and c != "Cz"]:
            diff(ch, "Cz", channel_group(ch))
    if not traces and allow_fallback:
        warnings.append(f"Montage '{montage}' could not be derived from decoded channels; showing raw or pre-montaged EEG channels.")
        for ch in ch_names:
            if is_fallback_eeg_channel_name(ch):
                add(ch, data[index[ch]], group=channel_group(ch))
        if not traces:
            warnings.append("No displayable EEG channels were found after excluding non-EEG auxiliary channels.")
    elif not traces:
        warnings.append(f"Montage '{montage}' could not be derived from decoded channels.")

    if include_ecg:
        ecg_indices = ecg_channel_indices(ch_names)
        if ecg_indices:
            ch = ch_names[ecg_indices[0]]
            add(f"ECG ({ch})", data[index[ch]], role="ecg", group="ecg")
    return traces
