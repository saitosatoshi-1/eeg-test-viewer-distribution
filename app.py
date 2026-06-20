#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.util
import json
import math
import mimetypes
import os
import re
import random
import shutil
import sys
import secrets
import shlex
import threading
import zipfile

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
import traceback
import unicodedata
import uuid
import webbrowser
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape as html_escape
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

import numpy as np

os.environ.setdefault("MPLCONFIGDIR", "/private/tmp/mpl")
os.environ.setdefault("NUMBA_CACHE_DIR", "/private/tmp/numba")

mne = None
signal = None
_MNE_IMPORT_ATTEMPTED = False
_SCIPY_IMPORT_ATTEMPTED = False


def package_available(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def ensure_mne():
    global mne, _MNE_IMPORT_ATTEMPTED
    if not _MNE_IMPORT_ATTEMPTED:
        _MNE_IMPORT_ATTEMPTED = True
        try:
            import mne as imported_mne
            mne = imported_mne
        except Exception:
            mne = None
    return mne


def ensure_signal():
    global signal, _SCIPY_IMPORT_ATTEMPTED
    if not _SCIPY_IMPORT_ATTEMPTED:
        _SCIPY_IMPORT_ATTEMPTED = True
        try:
            from scipy import signal as imported_signal
            signal = imported_signal
        except Exception:
            signal = None
    return signal


APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
USER_DATA_DIR = Path(os.environ.get("EEG_VIEWER_DATA_DIR") or (Path.home() / "Library" / "Application Support" / "EEG Viewer")).expanduser()
ANNOTATION_DIR = USER_DATA_DIR / "annotations"
RESEARCH_DIR = USER_DATA_DIR / "research"
RESEARCH_DATASET_DIR = RESEARCH_DIR / "datasets"
REMOTE_DATASET_CACHE_DIR = RESEARCH_DIR / "remote_cache"
SUBMITTED_RESULTS_DIR = RESEARCH_DIR / "submitted_results"
PRIVATE_DATASET_DIR = RESEARCH_DIR / "private_datasets"
USER_FILES_PATH = USER_DATA_DIR / "user_files.json"
DESKTOP_EXPORT_DIR = Path.home() / "Desktop"
DEFAULT_FDS_DIR = Path.home() / "Desktop" / "女子医ハンズオン_0606" / "FDS"
SERVER_TOKEN = secrets.token_urlsafe(32)
LOCAL_HOSTNAMES = {"127.0.0.1", "localhost", "::1"}
PUBLIC_MODE = os.environ.get("EEG_VIEWER_PUBLIC_MODE", "").lower() in {"1", "true", "yes", "on"}
ACCESS_USER = os.environ.get("EEG_VIEWER_ACCESS_USER", "viewer")
ACCESS_PASSWORD = os.environ.get("EEG_VIEWER_ACCESS_PASSWORD", "")
ACCESS_CODE = os.environ.get("EEG_VIEWER_ACCESS_CODE", ACCESS_PASSWORD)
ALLOW_UNPROTECTED_PUBLIC = os.environ.get("EEG_VIEWER_ALLOW_UNPROTECTED_PUBLIC", "").lower() in {"1", "true", "yes", "on"}
MAX_WINDOW_DURATION_SEC = 120.0
MAX_POST_BODY_BYTES = 20 * 1024 * 1024
MAX_EXPORT_POST_BODY_BYTES = 150 * 1024 * 1024
MAX_REMOTE_DATASET_BYTES = 20 * 1024 * 1024
MAX_REMOTE_EEG_BYTES = 2 * 1024 * 1024 * 1024
RESEARCH_GROUP_SCAN_MAX_DEPTH = 8
RESEARCH_GROUP_SCAN_LIMIT = 2000
PUBLIC_TEST_QUESTION_COUNT = 20
ALLOWED_RESEARCH_WRITE_ROOTS = (
    RESEARCH_DATASET_DIR,
    PRIVATE_DATASET_DIR,
    DESKTOP_EXPORT_DIR,
    Path.home() / "Documents",
    Path.home() / "Downloads",
)
TOKEN_EXEMPT_GET_PATHS = {"/api/health"}
MUTATING_PATHS = {
    "/api/open-file",
    "/api/annotations",
    "/api/export-file",
    "/api/save-desktop",
    "/api/research/dataset/create",
    "/api/research/dataset/item",
    "/api/research/dataset/cut",
    "/api/research/test/response",
    "/api/research/test/response/undo",
    "/api/research/test/export-file",
    "/api/research/test/submit-result",
    "/api/admin/private-dataset/upload",
    "/api/research/validation/response",
    "/api/research/validation/response/undo",
    "/api/research/validation/export-file",
}
LOGIN_PATH = "/login"

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

# Derived from Nihon Kohden Default.ecd polar electrode coordinates by taking
# the four nearest displayed 10-20 scalp electrodes for each channel.
LAPLACIAN_NEIGHBORS = {
    "Fp1": ("F3", "Fz", "F7", "Fp2"),
    "F7": ("F3", "Fp1", "T7", "C3"),
    "T7": ("C3", "F7", "P7", "F3"),
    "P7": ("P3", "O1", "T7", "C3"),
    "Fp2": ("F4", "Fz", "F8", "Fp1"),
    "F8": ("F4", "Fp2", "T8", "C4"),
    "T8": ("C4", "F8", "P8", "F4"),
    "P8": ("P4", "O2", "T8", "C4"),
    "F3": ("F7", "Fz", "Fp1", "C3"),
    "C3": ("Cz", "T7", "F3", "P3"),
    "P3": ("P7", "Pz", "O1", "C3"),
    "O1": ("P3", "Pz", "P7", "O2"),
    "F4": ("F8", "Fz", "Fp2", "C4"),
    "C4": ("Cz", "T8", "F4", "P4"),
    "P4": ("P8", "Pz", "O2", "C4"),
    "O2": ("P4", "Pz", "P8", "O1"),
    "Fz": ("F3", "F4", "Cz", "Fp1"),
    "Cz": ("C3", "C4", "Fz", "Pz"),
    "Pz": ("P3", "P4", "Cz", "O1"),
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
TUEV_EVENT_LABELS = {
    "1": "SPSW",
    "2": "GPED",
    "3": "PLED",
    "4": "EYEM",
    "5": "ARTF",
    "6": "BCKG",
}
ATTENUATION_EVENT_MAX_SEC = 3.0
ATTENUATION_BASELINE_SEC = 3.0
ATTENUATION_BAND_LOW_HZ = 0.0
ATTENUATION_BAND_HIGH_HZ = 120.0
ATTENUATION_DB_MIN = -15.0
ATTENUATION_DB_MAX = 6.0
ATTENUATION_Z_MIN = -3.0
ATTENUATION_Z_MAX = 3.0
APP_ROOT = Path(__file__).resolve().parent


def app_build_info() -> dict[str, str]:
    info = {
        "version": "",
        "build": "",
        "renderGitCommit": os.environ.get("RENDER_GIT_COMMIT", ""),
        "renderServiceName": os.environ.get("RENDER_SERVICE_NAME", ""),
        "renderServiceId": os.environ.get("RENDER_SERVICE_ID", ""),
    }
    path = APP_ROOT / "build_info.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return info
    if isinstance(payload, dict):
        info.update({key: str(value or "") for key, value in payload.items()})
    return info


def app_fingerprint() -> str:
    digest = hashlib.sha256()
    for rel in ("app.py", "static/index.html", "static/styles.css", "static/app.js", "build_info.json"):
        path = APP_ROOT / rel
        try:
            digest.update(rel.encode("utf-8") + b"\0")
            digest.update(path.read_bytes())
        except OSError:
            digest.update(rel.encode("utf-8") + b":missing\0")
    return digest.hexdigest()
SPIKE_BAND_LOW_HZ = 14.0
SPIKE_BAND_HIGH_HZ = 70.0
SCWT_LI_LEFT_ROI = ("Fp1", "F3", "F7")
SCWT_LI_RIGHT_ROI = ("Fp2", "F4", "F8")
SCWT_LI_BANDS = (
    ("20-50 Hz", "primary", 20.0, 50.0),
    ("10-50 Hz", "sensitivity", 10.0, 50.0),
    ("20-80 Hz", "sensitivity", 20.0, 80.0),
)
SCWT_LI_EVENT_HALF_WINDOW_SEC = 0.010
SCWT_LI_MAX_SAMPLES = 8192


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


def json_safe(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def normalize_path_input(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if text.startswith("file://"):
        parsed = urlparse(text)
        if parsed.scheme == "file":
            text = unquote(parsed.path or "")
    try:
        parts = shlex.split(text)
    except ValueError:
        parts = []
    if len(parts) == 1:
        return parts[0]
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        return text[1:-1]
    return text


def is_http_url(value: Any) -> bool:
    parsed = urlparse(str(value or "").strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def normalize_github_url(value: str) -> str:
    text = str(value or "").strip()
    parsed = urlparse(text)
    if parsed.scheme in {"http", "https"} and parsed.netloc.lower() == "github.com":
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 5 and parts[2] == "blob":
            owner, repo, _, branch = parts[:4]
            rest = "/".join(parts[4:])
            return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{rest}"
    return text


def url_cache_key(value: str) -> str:
    return hashlib.sha256(normalize_github_url(value).encode("utf-8")).hexdigest()


def remote_cache_filename(url: str, fallback: str = "download.dat") -> str:
    parsed = urlparse(url)
    name = Path(unquote(parsed.path or "")).name or fallback
    safe = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in name).strip("._")
    return safe or fallback


def remote_file_cache_path(url: str) -> Path:
    normalized = normalize_github_url(url)
    suffix_name = remote_cache_filename(normalized)
    return REMOTE_DATASET_CACHE_DIR / "files" / url_cache_key(normalized)[:16] / suffix_name


def download_remote_url(url: str, target: Path, max_bytes: int) -> Path:
    normalized = normalize_github_url(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 0:
        return target
    request = Request(normalized, headers={"User-Agent": "EEG-Test-Viewer/1.0"})
    tmp = target.with_suffix(target.suffix + ".part")
    total = 0
    with urlopen(request, timeout=60) as response, tmp.open("wb") as out:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise ValueError(f"Remote file is too large: {normalized}")
            out.write(chunk)
    tmp.replace(target)
    return target


def read_remote_text(url: str, max_bytes: int = MAX_REMOTE_DATASET_BYTES) -> str:
    normalized = normalize_github_url(url)
    request = Request(normalized, headers={"User-Agent": "EEG-Test-Viewer/1.0"})
    with urlopen(request, timeout=30) as response:
        raw = response.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError(f"Remote dataset is too large: {normalized}")
    return raw.decode("utf-8")


def cached_remote_eeg_path(url: str) -> Path:
    return download_remote_url(url, remote_file_cache_path(url), MAX_REMOTE_EEG_BYTES)


def path_candidates_from_input(value: Any) -> list[Path]:
    text = normalize_path_input(value)
    if not text:
        return []
    variants: list[str] = []
    for candidate in (
        text,
        unquote(text),
        unicodedata.normalize("NFC", text),
        unicodedata.normalize("NFD", text),
        unicodedata.normalize("NFKC", text),
    ):
        if candidate and candidate not in variants:
            variants.append(candidate)
    return [Path(candidate).expanduser() for candidate in variants]


def resolve_path_input(value: Any) -> Path:
    candidates = path_candidates_from_input(value)
    if not candidates:
        return Path("")
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    for candidate in candidates:
        matched = resolve_path_by_normalized_components(candidate)
        if matched is not None:
            return matched.resolve()
    return candidates[0].resolve()


def resolve_path_by_normalized_components(path: Path) -> Path | None:
    expanded = path.expanduser()
    if expanded.exists():
        return expanded
    parts = expanded.parts
    if not parts:
        return None
    current = Path(parts[0])
    if not current.exists():
        return None
    for part in parts[1:]:
        direct = current / part
        if direct.exists():
            current = direct
            continue
        try:
            entries = list(current.iterdir())
        except OSError:
            return None
        wanted = normalized_path_key(part)
        match = next((entry for entry in entries if normalized_path_key(entry.name) == wanted), None)
        if match is None:
            return None
        current = match
    return current if current.exists() else None


def normalized_path_key(value: str) -> str:
    return unicodedata.normalize("NFKC", value).casefold()


def load_user_files() -> list[Path]:
    if not USER_FILES_PATH.exists():
        return []
    try:
        payload = json.loads(USER_FILES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    files: list[Path] = []
    for item in payload:
        if not isinstance(item, str) or not item:
            continue
        files.append(Path(item).expanduser())
    return files


def save_user_files(paths: list[Path]) -> None:
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    USER_FILES_PATH.write_text(
        json.dumps([str(path) for path in paths], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def read_ini_sections(path: Path) -> dict[str, dict[str, str]]:
    sections: dict[str, dict[str, str]] = {}
    current = ""
    if not path.exists() or not path.is_file():
        return sections
    # NKT sidecars are mostly ASCII/Shift-JIS compatible for keys. Ignore
    # undecodable comments and preserve values where possible.
    text = path.read_text(encoding="cp932", errors="ignore")
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(("//", "#", ";")):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1]
            sections.setdefault(current, {})
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            sections.setdefault(current, {})[key.strip()] = value.strip()
    return sections


NKT_LOG_TIME_RE = re.compile(r"^(\d{6})\((\d{12})\)$")
NKT_ABSOLUTE_TIME_RE = re.compile(r"(20\d{12})")
EDF_ONSET_MARKER_RE = re.compile(r"^[+-]\d+(?:\.\d+)?$")


def nkt_clock_to_seconds(value: str) -> float:
    if len(value) != 6 or not value.isdigit():
        raise ValueError(f"Invalid NKT clock value: {value}")
    return float(int(value[:2]) * 3600 + int(value[2:4]) * 60 + int(value[4:6]))


def parse_nkt_absolute_timestamp(value: str) -> datetime | None:
    match = NKT_ABSOLUTE_TIME_RE.search(value or "")
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y%m%d%H%M%S")
    except ValueError:
        return None


def decode_nkt_string_runs(path: Path) -> list[str]:
    if not path.exists() or not path.is_file():
        return []
    try:
        data = path.read_bytes()
    except OSError:
        return []
    runs = re.findall(rb"[\x09\x0a\x0d\x20-\x7e\x80-\xfc]{3,}", data)
    decoded: list[str] = []
    for run in runs:
        text = run.decode("cp932", errors="ignore").replace("\x00", "\n")
        for line in text.splitlines():
            clean = " ".join(line.strip().split())
            if clean:
                decoded.append(clean)
    return decoded


def is_nkt_system_string(value: str) -> bool:
    upper = value.upper()
    if not value:
        return True
    if upper.startswith("EEG-1200") or upper.startswith("JE-"):
        return True
    if upper in {"-REC START T", "C EEG"}:
        return True
    if re.fullmatch(r"\d{14,}", value):
        return True
    if re.fullmatch(r"\d{6}\(\d{12}\)", value):
        return True
    return False


def normalize_annotation_label(value: Any) -> str:
    text = str(value or "").replace("\x00", " ").strip()
    text = " ".join(text.split())
    if not text:
        return "file annotation"
    shorthand_pairs = {
        r"T3\s*[・,/]\s*5": "T7/P7",
        r"T4\s*[・,/]\s*6": "T8/P8",
    }
    for pattern, replacement in shorthand_pairs.items():
        text = re.sub(rf"(?<![A-Za-z0-9]){pattern}(?![A-Za-z0-9])", replacement, text)
    for old, new in LEGACY_LABELS.items():
        text = re.sub(rf"(?<![A-Za-z0-9]){re.escape(old)}(?![A-Za-z0-9])", new, text)
    return text


def edf_onset_marker_seconds(label: str) -> float | None:
    text = str(label or "").strip()
    if not EDF_ONSET_MARKER_RE.fullmatch(text):
        return None
    try:
        return max(0.0, float(text))
    except ValueError:
        return None


def nkt_source_annotation(
    record_id: str,
    source: str,
    idx: int,
    onset_sec: float,
    label: str,
    note: str = "",
) -> dict[str, Any]:
    source_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"eeg-viewer-source:{record_id}:{source}:{idx}:{onset_sec}:{label}:{note}"))
    return {
        "id": source_id,
        "recordingId": record_id,
        "label": label,
        "onset": round(max(0.0, onset_sec), 6),
        "duration": 0.0,
        "channel": "file",
        "note": note,
        "source": source,
        "readOnly": True,
    }


def parse_nkt_log_annotations(record_id: str, path: Path) -> tuple[list[dict[str, Any]], dict[str, float]]:
    strings = decode_nkt_string_runs(path)
    rows: list[dict[str, Any]] = []
    absolute_to_onset: dict[str, float] = {}
    pending_onset: float | None = None
    pending_clock = ""
    for item in strings:
        time_match = NKT_LOG_TIME_RE.match(item)
        if time_match:
            pending_clock = time_match.group(1)
            try:
                pending_onset = nkt_clock_to_seconds(pending_clock)
            except ValueError:
                pending_onset = None
            absolute_to_onset[time_match.group(2)] = pending_onset or 0.0
            continue
        if pending_onset is None or is_nkt_system_string(item):
            continue
        rows.append(nkt_source_annotation(record_id, "nkt-log", len(rows), pending_onset, item))
        pending_onset = None
        pending_clock = ""
    return rows, absolute_to_onset


def parse_nkt_cmt_annotations(record_id: str, path: Path, absolute_to_onset: dict[str, float]) -> list[dict[str, Any]]:
    strings = decode_nkt_string_runs(path)
    rows: list[dict[str, Any]] = []
    current_time: datetime | None = None
    current_onset: float | None = None
    note_lines: list[str] = []

    def flush() -> None:
        nonlocal current_time, current_onset, note_lines
        if current_onset is None or not note_lines:
            current_time = None
            current_onset = None
            note_lines = []
            return
        note = "\n".join(note_lines).strip()
        if note:
            label = note_lines[0].strip() or "Comment"
            rows.append(nkt_source_annotation(record_id, "nkt-cmt", len(rows), current_onset, label, note))
        current_time = None
        current_onset = None
        note_lines = []

    for item in strings:
        timestamp = parse_nkt_absolute_timestamp(item)
        if timestamp is not None:
            flush()
            compact = timestamp.strftime("%y%m%d%H%M%S")
            current_time = timestamp
            current_onset = absolute_to_onset.get(compact)
            if current_onset is None and absolute_to_onset:
                first_abs = min(absolute_to_onset)
                try:
                    first_time = datetime.strptime(first_abs, "%y%m%d%H%M%S")
                    current_onset = max(0.0, (timestamp - first_time).total_seconds())
                except ValueError:
                    current_onset = None
            continue
        if current_time is None or current_onset is None:
            continue
        if is_nkt_system_string(item):
            continue
        note_lines.append(item)
    flush()
    return rows


def tuev_source_annotation(
    record_id: str,
    source: str,
    idx: int,
    onset_sec: float,
    duration_sec: float,
    label: str,
    channel: str,
    note: str = "",
) -> dict[str, Any]:
    source_id = str(
        uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"eeg-viewer-source:{record_id}:{source}:{idx}:{onset_sec}:{duration_sec}:{label}:{channel}:{note}",
        )
    )
    return {
        "id": source_id,
        "recordingId": record_id,
        "label": label,
        "onset": round(max(0.0, onset_sec), 6),
        "duration": round(max(0.0, duration_sec), 6),
        "channel": channel or "file",
        "note": note,
        "source": source,
        "readOnly": True,
    }


def parse_tuev_rec_annotations(record_id: str, path: Path, ch_names: list[str]) -> list[dict[str, Any]]:
    groups: dict[tuple[float, float, str], dict[str, Any]] = {}
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return []
    for line_no, line in enumerate(lines, start=1):
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 4:
            continue
        try:
            channel_index = int(float(parts[0]))
            start = float(parts[1])
            stop = float(parts[2])
        except ValueError:
            continue
        label = TUEV_EVENT_LABELS.get(parts[3], parts[3].upper() or "TUEV")
        if stop < start:
            stop = start
        if 0 <= channel_index < len(ch_names):
            channel = normalize_label(ch_names[channel_index])
        else:
            channel = f"ch{channel_index}"
        duration = stop - start
        key = (round(start, 6), round(duration, 6), label)
        if key not in groups:
            groups[key] = {"start": start, "duration": duration, "label": label, "channels": [], "firstLine": line_no}
        groups[key]["channels"].append(channel)

    rows: list[dict[str, Any]] = []
    for group in sorted(groups.values(), key=lambda item: (item["start"], item["label"])):
        channels = sorted(set(group["channels"]), key=lambda name: (SCALP_ORDER.index(name) if name in SCALP_ORDER else 999, name))
        channel_list = ", ".join(channels)
        channel_text = channel_list if len(channels) <= 6 else f"{len(channels)} channels"
        rows.append(
            tuev_source_annotation(
                record_id,
                "tuev-rec",
                int(group["firstLine"]),
                float(group["start"]),
                float(group["duration"]),
                str(group["label"]),
                channel_text,
                note=f"Imported from {path.name}; channels: {channel_list}.",
            )
        )
    return rows


def parse_tuev_lab_annotations(record_id: str, path: Path, channel: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return rows
    for line_no, line in enumerate(lines, start=1):
        parts = line.split()
        if len(parts) < 3:
            continue
        try:
            # TUEV .lab files use 100 ns ticks.
            start = float(parts[0]) / 10_000_000.0
            stop = float(parts[1]) / 10_000_000.0
        except ValueError:
            continue
        label = parts[2].upper()
        if stop < start:
            stop = start
        rows.append(
            tuev_source_annotation(
                record_id,
                "tuev-lab",
                line_no,
                start,
                stop - start,
                label,
                channel,
                note=f"Imported from {path.name}.",
            )
        )
    return rows


def parse_tuev_sidecar_annotations(record_id: str, edf_path: Path, ch_names: list[str]) -> list[dict[str, Any]]:
    rec_path = edf_path.with_suffix(".rec")
    if rec_path.exists():
        return parse_tuev_rec_annotations(record_id, rec_path, ch_names)

    rows: list[dict[str, Any]] = []
    for lab_path in sorted(edf_path.parent.glob(edf_path.stem + "__ch*.lab")):
        match = re.search(r"__ch(\d+)\.lab$", lab_path.name, flags=re.IGNORECASE)
        if match:
            channel_index = int(match.group(1))
            channel = normalize_label(ch_names[channel_index]) if 0 <= channel_index < len(ch_names) else f"ch{channel_index}"
        else:
            channel = "file"
        rows.extend(parse_tuev_lab_annotations(record_id, lab_path, channel))
    groups: dict[tuple[float, float, str], dict[str, Any]] = {}
    for idx, row in enumerate(rows):
        key = (
            round(float(row.get("onset", 0) or 0), 6),
            round(float(row.get("duration", 0) or 0), 6),
            str(row.get("label", "")),
        )
        if key not in groups:
            groups[key] = {**row, "channels": [], "firstIndex": idx}
        groups[key]["channels"].append(str(row.get("channel", "")))
    out: list[dict[str, Any]] = []
    for group in sorted(groups.values(), key=lambda item: (float(item.get("onset", 0) or 0), str(item.get("label", "")))):
        channels = sorted(set(ch for ch in group.pop("channels", []) if ch), key=lambda name: (SCALP_ORDER.index(name) if name in SCALP_ORDER else 999, name))
        group.pop("firstIndex", None)
        channel_list = ", ".join(channels)
        group["channel"] = channel_list if len(channels) <= 6 else f"{len(channels)} channels"
        group["note"] = f"Imported from TUEV .lab sidecars; channels: {channel_list or 'file'}."
        out.append(group)
    return out


def safe_id(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in value.strip())
    return cleaned.strip("_") or "recording"


def safe_export_filename(value: str) -> str:
    name = Path(str(value or "eeg_export")).name
    stem = Path(name).stem or "eeg_export"
    suffix = Path(name).suffix.lower()
    if suffix not in {".json", ".jpg", ".jpeg"}:
        suffix = ".dat"
    safe_stem = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in stem).strip("._")
    return f"{safe_stem or 'eeg_export'}{suffix}"


def unique_desktop_export_path(filename: str) -> Path:
    DESKTOP_EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    target = DESKTOP_EXPORT_DIR / safe_export_filename(filename)
    if not target.exists():
        return target
    stem = target.stem
    suffix = target.suffix
    for index in range(2, 1000):
        candidate = target.with_name(f"{stem}_{index}{suffix}")
        if not candidate.exists():
            return candidate
    raise ValueError("Could not create a unique Desktop export filename")


def save_desktop_export(payload: dict[str, Any]) -> dict[str, Any]:
    filename = safe_export_filename(str(payload.get("filename") or "eeg_export.dat"))
    content_b64 = str(payload.get("contentBase64") or "")
    if not content_b64:
        raise ValueError("Export content is empty")
    raw = base64.b64decode(content_b64, validate=True)
    if len(raw) > 100 * 1024 * 1024:
        raise ValueError("Export file is too large")
    target = unique_desktop_export_path(filename)
    target.write_bytes(raw)
    return {"ok": True, "path": str(target), "filename": target.name, "sizeBytes": len(raw)}


def save_desktop_text_export(filename: str, text: str) -> dict[str, Any]:
    raw = text.encode("utf-8")
    if len(raw) > 100 * 1024 * 1024:
        raise ValueError("Export file is too large")
    target = unique_desktop_export_path(filename)
    target.write_text(text, encoding="utf-8")
    return {"ok": True, "path": str(target), "filename": target.name, "sizeBytes": len(raw)}


def iso_or_empty(value: datetime | None) -> str:
    return value.isoformat(sep=" ") if value else ""


def discover_edf_paths(roots: list[Path], max_depth: int = 8, limit: int = 500) -> list[Path]:
    paths: list[Path] = []
    seen: set[Path] = set()
    skip_dirs = {
        ".git",
        ".Trash",
        "__pycache__",
        "node_modules",
        "Library",
        "Applications",
        "Movies",
        "Music",
        "Pictures",
    }
    for root in roots:
        if not root.exists() or not root.is_dir():
            continue
        root = root.resolve()
        for current, dirs, files in os.walk(root):
            current_path = Path(current)
            try:
                depth = len(current_path.relative_to(root).parts)
            except ValueError:
                depth = 0
            if depth >= max_depth:
                dirs[:] = []
            else:
                dirs[:] = [d for d in dirs if not d.startswith(".") and d not in skip_dirs]
            for name in files:
                if not name.lower().endswith(".edf"):
                    continue
                path = (current_path / name).resolve()
                if path in seen:
                    continue
                seen.add(path)
                paths.append(path)
                if len(paths) >= limit:
                    return sorted(paths, key=lambda p: str(p).lower())
    return sorted(paths, key=lambda p: str(p).lower())


def research_group_edf_paths(path: Path) -> list[Path]:
    if not path.exists():
        raise FileNotFoundError(f"Path not found: {path}")
    if path.is_file():
        if path.suffix.lower() != ".edf":
            raise ValueError(f"Research test path is not an EDF file: {path}")
        return [path.resolve()]
    if not path.is_dir():
        raise ValueError(f"Research test path is not a folder or EDF file: {path}")
    edf_paths = discover_edf_paths(
        [path],
        max_depth=RESEARCH_GROUP_SCAN_MAX_DEPTH,
        limit=RESEARCH_GROUP_SCAN_LIMIT + 1,
    )
    if len(edf_paths) > RESEARCH_GROUP_SCAN_LIMIT:
        raise ValueError(
            f"Too many EDF files in {path}. "
            f"Choose a smaller folder with {RESEARCH_GROUP_SCAN_LIMIT} files or fewer."
        )
    return edf_paths


def discover_nkt_paths(roots: list[Path], max_depth: int = 8, limit: int = 500) -> list[Path]:
    paths: list[Path] = []
    seen: set[Path] = set()
    skip_dirs = {
        ".git",
        ".Trash",
        "__pycache__",
        "node_modules",
        "Library",
        "Applications",
        "Movies",
        "Music",
        "Pictures",
    }
    for root in roots:
        if not root.exists() or not root.is_dir():
            continue
        root = root.resolve()
        for current, dirs, files in os.walk(root):
            current_path = Path(current)
            try:
                depth = len(current_path.relative_to(root).parts)
            except ValueError:
                depth = 0
            if depth >= max_depth:
                dirs[:] = []
            else:
                dirs[:] = [d for d in dirs if not d.startswith(".") and d not in skip_dirs]
            for name in files:
                if not name.lower().endswith(".eeg"):
                    continue
                path = (current_path / name).resolve()
                if path in seen:
                    continue
                seen.add(path)
                paths.append(path)
                if len(paths) >= limit:
                    return sorted(paths, key=lambda p: str(p).lower())
    return sorted(paths, key=lambda p: str(p).lower())


def discover_eeg_paths(root: Path, limit: int = 500) -> list[Path]:
    paths: list[Path] = []
    seen: set[Path] = set()
    if not root.exists() or not root.is_dir():
        return []
    for path in root.rglob("*"):
        if len(paths) >= limit:
            break
        if not path.is_file() or path.suffix.lower() not in {".eeg", ".edf"}:
            continue
        resolved = path.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        paths.append(resolved)
    return sorted(paths, key=lambda p: (p.suffix.lower() != ".eeg", str(p).lower()))


def path_is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        path_text = unicodedata.normalize("NFC", str(path.resolve()))
        root_text = unicodedata.normalize("NFC", str(root.resolve()).rstrip(os.sep))
        return path_text == root_text or path_text.startswith(root_text + os.sep)


def clamp_duration(value: Any, default: float, minimum: float, maximum: float) -> float:
    try:
        duration = float(value)
    except (TypeError, ValueError):
        duration = default
    if not math.isfinite(duration):
        duration = default
    return max(minimum, min(maximum, duration))


def ensure_allowed_research_write_path(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    for root in ALLOWED_RESEARCH_WRITE_ROOTS:
        if path_is_relative_to(resolved, root):
            return resolved
    allowed = ", ".join(str(root) for root in ALLOWED_RESEARCH_WRITE_ROOTS)
    raise PermissionError(f"Research outputs must be saved under one of: {allowed}")


@dataclass
class Recording:
    record_id: str
    eeg_path: Path
    base_name: str
    sidecars: dict[str, Path]
    file_format: str = "nkt"


@dataclass
class DirectNktInfo:
    available: bool
    data_start: int = 0
    frame_channels: int = 0
    sfreq: float = 1000.0
    n_samples: int = 0
    ch_names: list[str] | None = None
    reason: str = ""


class RecordingStore:
    def __init__(self, fds_dir: Path, edf_dirs: list[Path] | None = None):
        self.fds_dir = fds_dir
        self.nkt_dir = fds_dir / "NKT" / "EEG2100"
        self.edf_dirs = edf_dirs or []
        self.user_files: list[Path] = load_user_files()
        self._raw_cache: dict[str, Any] = {}
        self._direct_cache: dict[str, DirectNktInfo] = {}
        self._source_annotation_cache: dict[str, list[dict[str, Any]]] = {}
        self._recordings: dict[str, Recording] = {}
        self._last_refresh_at = 0.0
        self._lock = threading.RLock()
        self.refresh()

    def refresh(self) -> None:
        with self._lock:
            self._recordings = {}
            seen_paths: set[Path] = set()
            if not self.nkt_dir.exists():
                pass
            else:
                for eeg_path in sorted(self.nkt_dir.glob("*.EEG")):
                    path = eeg_path.resolve()
                    seen_paths.add(path)
                    self._insert_recording(path, "nkt", eeg_path.stem)

            user_dirs = [path.expanduser().resolve() for path in self.user_files if path.expanduser().is_dir()]
            for eeg_path in discover_nkt_paths(user_dirs):
                path = eeg_path.resolve()
                if path in seen_paths:
                    continue
                seen_paths.add(path)
                self._insert_recording(path, "nkt", safe_id(eeg_path.stem))

            for edf_path in discover_edf_paths([self.fds_dir, *self.edf_dirs, *user_dirs]):
                path = edf_path.resolve()
                if path in seen_paths:
                    continue
                seen_paths.add(path)
                self._insert_recording(path, "edf", f"EDF_{safe_id(path.stem)}")

            for user_path in list(self.user_files):
                path = user_path.expanduser().resolve()
                if not path.exists() or not path.is_file():
                    continue
                if path in seen_paths:
                    continue
                seen_paths.add(path)
                fmt = self.format_for_path(path)
                self._insert_recording(path, fmt, f"{fmt.upper()}_{safe_id(path.stem)}" if fmt == "edf" else safe_id(path.stem))
            self._last_refresh_at = time.monotonic()

    def refresh_if_stale(self, max_age_sec: float = 30.0) -> None:
        with self._lock:
            if self._recordings and time.monotonic() - self._last_refresh_at < max_age_sec:
                return
        self.refresh()

    def _insert_recording(self, path: Path, file_format: str, preferred_id: str) -> Recording:
        sidecars: dict[str, Path] = {}
        if file_format == "nkt":
            sidecars = {
                ext.lower(): path.with_suffix(ext)
                for ext in [".21E", ".11D", ".CMT", ".CN3", ".LOG", ".pnt", ".EGF", ".VF2"]
                if path.with_suffix(ext).exists()
            }
        record_id = self.unique_record_id(preferred_id)
        rec = Recording(record_id, path, path.stem, sidecars, file_format)
        self._recordings[record_id] = rec
        return rec

    def invalidate_recording_cache(self, record_id: str) -> None:
        with self._lock:
            self._raw_cache.pop(record_id, None)
            self._direct_cache.pop(record_id, None)
            self._source_annotation_cache.pop(record_id, None)

    def format_for_path(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix == ".edf":
            return "edf"
        if suffix == ".eeg":
            return "nkt"
        raise ValueError("Supported EEG files are .edf and .EEG")

    def recordings_under(self, root: Path) -> list[Recording]:
        if root.is_file():
            found = self.find_by_path(root)
            return [found] if found else []
        try:
            resolved = root.expanduser().resolve()
        except OSError:
            return []
        matches: list[Recording] = []
        for rec in self.recordings:
            if not path_is_relative_to(rec.eeg_path, resolved):
                continue
            matches.append(rec)
        return sorted(matches, key=lambda rec: rec.base_name.lower())

    def find_by_path(self, path: Path) -> Recording | None:
        resolved = path.expanduser().resolve()
        for rec in self._recordings.values():
            if rec.eeg_path.resolve() == resolved:
                return rec
        return None

    def add_file(self, file_path: str) -> Recording:
        with self._lock:
            path = resolve_path_input(file_path)
            if not path.exists() or not path.is_file():
                raise FileNotFoundError(f"EEG file not found: {path}")
            self.format_for_path(path)
            existing = self.find_by_path(path)
            if path not in self.user_files:
                self.user_files.append(path)
                save_user_files(self.user_files)
            if existing:
                return existing
            self.refresh()
            rec = self.find_by_path(path)
            if rec is None:
                raise RuntimeError(f"Could not add EEG file: {path}")
            self.invalidate_recording_cache(rec.record_id)
            return rec

    def add_path(self, path_text: str) -> dict[str, Any]:
        with self._lock:
            if not str(path_text or "").strip():
                raise ValueError("Path is required.")
            if is_http_url(path_text):
                cached_path = cached_remote_eeg_path(str(path_text))
                rec = self.add_file(str(cached_path))
                return {"id": rec.record_id, "recordings": [recording_payload(rec)], "path": str(cached_path), "sourceUrl": normalize_github_url(str(path_text)), "kind": "file"}
            path = resolve_path_input(path_text)
            if not path.exists():
                raise FileNotFoundError(f"Path not found: {path}")
            if path.is_file():
                rec = self.add_file(str(path))
                return {"id": rec.record_id, "recordings": [recording_payload(rec)], "path": str(path), "kind": "file"}
            if not path.is_dir():
                raise FileNotFoundError(f"Path is not a file or folder: {path}")
            if path not in self.user_files:
                self.user_files.append(path)
                save_user_files(self.user_files)
            self.refresh()
            discovered_paths = discover_eeg_paths(path)
            if not discovered_paths:
                discovered_paths = [*discover_nkt_paths([path]), *discover_edf_paths([path])]
            matches: list[Recording] = []
            for discovered in discovered_paths:
                rec = self.find_by_path(discovered)
                if rec is None:
                    fmt = self.format_for_path(discovered)
                    rec = self._insert_recording(
                        discovered,
                        fmt,
                        f"{fmt.upper()}_{safe_id(discovered.stem)}" if fmt == "edf" else safe_id(discovered.stem),
                    )
                matches.append(rec)
            if not matches:
                matches = self.recordings_under(path)
            if not matches:
                raise FileNotFoundError(f"No .EEG or .EDF files found inside: {path}")
            matches = sorted(
                {rec.record_id: rec for rec in matches}.values(),
                key=lambda rec: rec.base_name.lower(),
            )
            return {
                "id": matches[0].record_id,
                "recordings": [recording_payload(rec) for rec in matches],
                "path": str(path),
                "kind": "folder",
            }

    def unique_record_id(self, preferred: str) -> str:
        record_id = preferred
        counter = 2
        while record_id in self._recordings:
            record_id = f"{preferred}_{counter}"
            counter += 1
        return record_id

    @property
    def recordings(self) -> list[Recording]:
        with self._lock:
            return list(self._recordings.values())

    def get(self, record_id: str) -> Recording:
        with self._lock:
            if record_id not in self._recordings:
                raise KeyError(f"Unknown recording: {record_id}")
            return self._recordings[record_id]

    def metadata(self, record_id: str) -> dict[str, Any]:
        rec = self.get(record_id)
        sections = read_ini_sections(rec.sidecars.get(".21e", Path()))
        electrodes = sections.get("ELECTRODE", {})
        references = sections.get("REFERENCE", {})
        system_setup = sections.get("SYSTEM_SETUP", {})
        last_pattern = sections.get("LASTPATTERN", {})

        raw_summary, warnings = self.raw_summary(record_id)
        direct = self.direct_info(record_id)
        pure_viewer = self.fds_dir / "system" / "PortaViewReview.exe"
        e12_viewer = self.fds_dir / "system" / "E12Rev.exe"

        aux = [
            name
            for name in electrodes.values()
            if is_ecg_channel_name(name) or name in {"Pulse", "SpO2", "EtCO2", "CO2Wave"}
        ]
        return {
            "id": rec.record_id,
            "baseName": rec.base_name,
            "format": rec.file_format,
            "eegPath": str(rec.eeg_path),
            "nktDir": str(self.nkt_dir),
            "fileSizeBytes": rec.eeg_path.stat().st_size,
            "sidecars": {k: str(v) for k, v in rec.sidecars.items()},
            "electrodes": electrodes,
            "references": references,
            "systemReference": system_setup.get("SystemReference", ""),
            "deviceName": system_setup.get("DeviceName", ""),
            "lastPattern": last_pattern,
            "auxiliaryChannels": aux,
            "viewer": {
                "portaViewReview": str(pure_viewer),
                "portaViewReviewExists": pure_viewer.exists(),
                "e12Review": str(e12_viewer),
                "e12ReviewExists": e12_viewer.exists(),
            },
            "directReader": {
                "available": direct.available,
                "channels": direct.ch_names or [],
                "sfreq": direct.sfreq,
                "durationSec": direct.n_samples / direct.sfreq if direct.available else 0,
                "dataStart": direct.data_start,
                "frameChannels": direct.frame_channels,
                "reason": direct.reason,
            },
            "raw": raw_summary,
            "warnings": warnings,
        }

    def raw_summary(self, record_id: str) -> tuple[dict[str, Any], list[str]]:
        warnings: list[str] = []
        rec = self.get(record_id)
        direct = self.direct_info(record_id)
        if rec.file_format == "nkt" and direct.available:
            return {
                "available": True,
                "reader": "direct-nkt",
                "channels": direct.ch_names or [],
                "sfreq": direct.sfreq,
                "nTimes": direct.n_samples,
                "durationSec": direct.n_samples / direct.sfreq,
                "measDate": "",
            }, warnings

        raw = self.raw(record_id)
        if raw is None:
            return {"available": False, "channels": [], "sfreq": None, "durationSec": 0}, [
                "MNE is not available or could not read this file."
            ]
        duration = float(raw.n_times / raw.info["sfreq"]) if raw.info["sfreq"] else 0.0
        if rec.file_format == "nkt" and (len(raw.ch_names) <= 1 or duration <= 1.1):
            warnings.append(
                "MNE read_raw_nihon opened this file, but the decoded signal is incomplete "
                f"({len(raw.ch_names)} channel, {duration:.2f} s). Use the pure viewer as a reference "
                "and consider EDF export/direct NKT decoding for full review."
            )
        return {
            "available": True,
            "reader": "mne-read_raw_edf" if rec.file_format == "edf" else "mne-read_raw_nihon",
            "channels": [normalize_label(ch) for ch in raw.ch_names],
            "sfreq": float(raw.info["sfreq"]),
            "nTimes": int(raw.n_times),
            "durationSec": duration,
            "measDate": str(raw.info.get("meas_date")) if raw.info.get("meas_date") else "",
        }, warnings

    def raw(self, record_id: str):
        if record_id in self._raw_cache:
            return self._raw_cache[record_id]
        if ensure_mne() is None:
            self._raw_cache[record_id] = None
            return None
        rec = self.get(record_id)
        if rec.file_format == "edf":
            raw = None
            for kwargs in (
                {"infer_types": True},
                {"infer_types": True, "encoding": "cp932"},
                {"infer_types": True, "encoding": "latin1"},
                {"encoding": "cp932"},
                {"encoding": "latin1"},
                {},
            ):
                try:
                    raw = mne.io.read_raw_edf(rec.eeg_path, preload=False, verbose="ERROR", **kwargs)
                    break
                except TypeError:
                    try:
                        fallback_kwargs = {k: v for k, v in kwargs.items() if k != "infer_types"}
                        raw = mne.io.read_raw_edf(
                            rec.eeg_path, preload=False, verbose="ERROR", **fallback_kwargs
                        )
                        break
                    except Exception:
                        raw = None
                except Exception:
                    raw = None
        else:
            try:
                raw = mne.io.read_raw_nihon(rec.eeg_path, preload=False, encoding="cp932", verbose="ERROR")
            except TypeError:
                raw = mne.io.read_raw_nihon(rec.eeg_path, preload=False, verbose="ERROR")
            except Exception:
                traceback.print_exc()
                raw = None
        self._raw_cache[record_id] = raw
        return raw

    def source_annotations(self, record_id: str) -> list[dict[str, Any]]:
        if record_id in self._source_annotation_cache:
            return self._source_annotation_cache[record_id]
        rec = self.get(record_id)
        raw = self.raw(record_id)
        rows: list[dict[str, Any]] = []
        annotations = getattr(raw, "annotations", None) if raw is not None else None
        if annotations is not None:
            descriptions = list(getattr(annotations, "description", []))
            onsets = list(getattr(annotations, "onset", []))
            durations = list(getattr(annotations, "duration", []))
            pending_edf_marker_onset: float | None = None
            for idx, onset in enumerate(onsets):
                try:
                    onset_sec = float(onset)
                except (TypeError, ValueError):
                    continue
                try:
                    duration_sec = float(durations[idx]) if idx < len(durations) else 0.0
                except (TypeError, ValueError):
                    duration_sec = 0.0
                raw_label = str(descriptions[idx]) if idx < len(descriptions) else "file annotation"
                marker_onset = edf_onset_marker_seconds(raw_label) if rec.file_format == "edf" else None
                if marker_onset is not None:
                    pending_edf_marker_onset = marker_onset
                    continue
                if pending_edf_marker_onset is not None:
                    onset_sec = pending_edf_marker_onset
                    pending_edf_marker_onset = None
                label = normalize_annotation_label(raw_label)
                source_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"eeg-viewer-source:{record_id}:{idx}:{onset_sec}:{duration_sec}:{label}"))
                rows.append(
                    {
                        "id": source_id,
                        "recordingId": record_id,
                        "label": label,
                        "onset": round(onset_sec, 6),
                        "duration": round(max(0.0, duration_sec), 6),
                        "channel": "file",
                        "note": "Imported from the EEG file annotations.",
                        "source": "file",
                        "readOnly": True,
                    }
                )
        if rec.file_format == "nkt":
            log_rows: list[dict[str, Any]] = []
            absolute_to_onset: dict[str, float] = {}
            log_path = rec.sidecars.get(".log")
            if log_path:
                log_rows, absolute_to_onset = parse_nkt_log_annotations(record_id, log_path)
                rows.extend(log_rows)
            cmt_path = rec.sidecars.get(".cmt")
            if cmt_path:
                rows.extend(parse_nkt_cmt_annotations(record_id, cmt_path, absolute_to_onset))
        elif rec.file_format == "edf":
            ch_names = []
            raw_summary, _raw_warnings = self.raw_summary(record_id)
            for ch in raw_summary.get("channels", []) if isinstance(raw_summary, dict) else []:
                ch_names.append(normalize_label(str(ch)))
            rows.extend(parse_tuev_sidecar_annotations(record_id, rec.eeg_path, ch_names))
        deduped: list[dict[str, Any]] = []
        seen: set[tuple[float, float, str, str]] = set()
        for row in rows:
            key = (
                round(float(row.get("onset", 0) or 0), 3),
                round(float(row.get("duration", 0) or 0), 3),
                str(row.get("label", "")),
                str(row.get("channel", "")),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(row)
        rows = deduped
        rows.sort(key=lambda row: float(row.get("onset", 0) or 0))
        self._source_annotation_cache[record_id] = rows
        return rows

    def display_annotations(self, record_id: str) -> list[dict[str, Any]]:
        rows = [*load_annotations(record_id), *self.source_annotations(record_id)]
        rows.sort(key=lambda row: float(row.get("onset", 0) or 0))
        return rows

    def direct_info(self, record_id: str) -> DirectNktInfo:
        if record_id in self._direct_cache:
            return self._direct_cache[record_id]

        rec = self.get(record_id)
        if rec.file_format != "nkt":
            info = DirectNktInfo(False, reason="direct frame reader is only used for Nihon Kohden EEG files")
            self._direct_cache[record_id] = info
            return info

        sections = read_ini_sections(rec.sidecars.get(".21e", Path()))
        electrodes = sections.get("ELECTRODE", {})
        ch_names = [normalize_label(electrodes.get(f"{idx:04d}", f"CH{idx + 1}")) for idx in range(37)]
        try:
            with rec.eeg_path.open("rb") as fid:
                blob = fid.read(64 * 1024)
                intel_positions = []
                start = 0
                while True:
                    pos = blob.find(b"EEG-1200INTEL", start)
                    if pos < 0:
                        break
                    intel_positions.append(pos)
                    start = pos + 1
                if len(intel_positions) < 2:
                    info = DirectNktInfo(False, reason="continuous EEG-1200 frame pointer was not found")
                else:
                    pos = intel_positions[-1]
                    page_bytes = blob[pos + 0x13 : pos + 0x17]
                    if len(page_bytes) != 4:
                        info = DirectNktInfo(False, reason="continuous frame pointer is truncated")
                    else:
                        page = int.from_bytes(page_bytes, "little")
                        data_start = (page << 8) + 3
                        frame_channels = 37
                        frame_size = frame_channels * 2
                        file_size = rec.eeg_path.stat().st_size
                        payload = file_size - data_start
                        if data_start <= 0 or payload <= 0 or payload % frame_size:
                            info = DirectNktInfo(
                                False,
                                reason=(
                                    f"unexpected continuous frame layout: start={data_start}, "
                                    f"payload={payload}, frame={frame_size}"
                                ),
                            )
                        else:
                            info = DirectNktInfo(
                                True,
                                data_start=data_start,
                                frame_channels=frame_channels,
                                sfreq=1000.0,
                                n_samples=payload // frame_size,
                                ch_names=ch_names,
                                reason="EEG-1200 continuous 37-channel frame area detected",
                            )
        except Exception as exc:
            info = DirectNktInfo(False, reason=str(exc))

        self._direct_cache[record_id] = info
        return info

    def direct_window(self, record_id: str, start_sec: float, duration_sec: float) -> tuple[np.ndarray, list[str], float, float, float]:
        rec = self.get(record_id)
        info = self.direct_info(record_id)
        if not info.available:
            raise RuntimeError(info.reason or "direct NKT reader is unavailable")
        sfreq = info.sfreq
        start = max(0, int(round(start_sec * sfreq)))
        stop = min(info.n_samples, int(round((start_sec + duration_sec) * sfreq)))
        if stop <= start:
            start = 0
            stop = min(info.n_samples, int(round(duration_sec * sfreq)))
        n_samples = stop - start
        frame_size = info.frame_channels * 2
        offset = info.data_start + start * frame_size
        with rec.eeg_path.open("rb") as fid:
            fid.seek(offset)
            raw = np.fromfile(fid, dtype="<u2", count=n_samples * info.frame_channels)
        if raw.size != n_samples * info.frame_channels:
            n_samples = raw.size // info.frame_channels
            raw = raw[: n_samples * info.frame_channels]
        data = raw.reshape(n_samples, info.frame_channels).T.astype(np.float64)
        # EEG-1200 samples are centered at 0x8000. This scale matches the
        # MNE Nihon conversion closely enough for display review in microvolts.
        data = (data - 32768.0) * (6400.0 / 65535.0)
        return data, list(info.ch_names or []), sfreq, start / sfreq, n_samples / sfreq

    def window(
        self,
        record_id: str,
        start_sec: float,
        duration_sec: float,
        montage: str,
        tc: str,
        hf: str,
        ac: str,
        include_ecg: bool,
        ecg_filter: bool = False,
        include_topomap: bool = True,
    ) -> dict[str, Any]:
        duration_sec = clamp_duration(duration_sec, 10.0, 0.1, MAX_WINDOW_DURATION_SEC)
        metadata = self.metadata(record_id)
        warnings = list(metadata["warnings"])
        direct = self.direct_info(record_id)
        if direct.available:
            data, ch_names, sfreq, actual_start, actual_duration = self.direct_window(
                record_id, start_sec, duration_sec
            )
            start = int(round(actual_start * sfreq))
            stop = start + data.shape[1]
            warnings.append("Using direct EEG-1200 37-channel frame reader; MNE preview is bypassed.")
        else:
            raw = self.raw(record_id)
            if raw is None:
                return {
                    "id": record_id,
                    "sfreq": 0,
                    "start": start_sec,
                    "duration": duration_sec,
                    "times": [],
                    "traces": [],
                    "annotations": self.display_annotations(record_id),
                    "warnings": warnings,
                }

            sfreq = float(raw.info["sfreq"])
            start = max(0, int(round(start_sec * sfreq)))
            stop = min(raw.n_times, int(round((start_sec + duration_sec) * sfreq)))
            if stop <= start:
                start = 0
                stop = min(raw.n_times, int(round(duration_sec * sfreq)))
            picks = list(range(len(raw.ch_names)))
            data = raw.get_data(picks=picks, start=start, stop=stop) * 1e6
            ch_names = [normalize_label(ch) for ch in raw.ch_names]
        data, ch_names = apply_display_filters(data, ch_names, sfreq, tc, hf, ac, warnings)
        if ecg_filter:
            data = apply_ecg_artifact_filter(data, ch_names, sfreq, warnings)

        traces = build_montage_traces(data, ch_names, montage, include_ecg, warnings, sfreq)
        max_points = 1800
        n_samples = data.shape[1]
        stride = max(1, math.ceil(n_samples / max_points))
        topomap = {"channels": []}
        rel_times = (np.arange(start, stop, stride) / sfreq).astype(float)
        for trace in traces:
            trace["values"] = trace["values"][::stride].astype(float).round(3).tolist()
        return {
            "id": record_id,
            "sfreq": sfreq,
            "start": float(start / sfreq),
            "duration": float((stop - start) / sfreq),
            "times": rel_times.round(4).tolist(),
            "traces": traces,
            "topomap": topomap,
            "annotations": self.display_annotations(record_id),
            "warnings": warnings,
            "metadata": metadata,
        }


    def window_multi(
        self,
        record_id: str,
        start_sec: float,
        duration_sec: float,
        active_montage: str,
        tc: str,
        hf: str,
        ac: str,
        include_ecg: bool,
        ecg_filter: bool = False,
        montages: list[str] | None = None,
        include_topomap: bool = True,
    ) -> dict[str, Any]:
        duration_sec = clamp_duration(duration_sec, 10.0, 0.1, MAX_WINDOW_DURATION_SEC)
        metadata = self.metadata(record_id)
        warnings = list(metadata["warnings"])
        direct = self.direct_info(record_id)
        if direct.available:
            data, ch_names, sfreq, actual_start, actual_duration = self.direct_window(
                record_id, start_sec, duration_sec
            )
            start = int(round(actual_start * sfreq))
            stop = start + data.shape[1]
            warnings.append("Using direct EEG-1200 37-channel frame reader; MNE preview is bypassed.")
        else:
            raw = self.raw(record_id)
            if raw is None:
                return {
                    "id": record_id,
                    "sfreq": 0,
                    "start": start_sec,
                    "duration": duration_sec,
                    "times": [],
                    "traces": [],
                    "montage": active_montage,
                    "montageViews": [],
                    "annotations": self.display_annotations(record_id),
                    "warnings": warnings,
                }

            sfreq = float(raw.info["sfreq"])
            start = max(0, int(round(start_sec * sfreq)))
            stop = min(raw.n_times, int(round((start_sec + duration_sec) * sfreq)))
            if stop <= start:
                start = 0
                stop = min(raw.n_times, int(round(duration_sec * sfreq)))
            picks = list(range(len(raw.ch_names)))
            data = raw.get_data(picks=picks, start=start, stop=stop) * 1e6
            ch_names = [normalize_label(ch) for ch in raw.ch_names]
        data, ch_names = apply_display_filters(data, ch_names, sfreq, tc, hf, ac, warnings)
        if ecg_filter:
            data = apply_ecg_artifact_filter(data, ch_names, sfreq, warnings)

        max_points = 1800
        n_samples = data.shape[1]
        stride = max(1, math.ceil(n_samples / max_points))
        topomap = {"channels": []}
        rel_times = (np.arange(start, stop, stride) / sfreq).astype(float)
        montage_labels = {
            "longitudinal": "縦双極誘導",
            "a1a2": "耳朶参照基準2",
            "conventional": "耳朶参照基準1",
            "conventional_average": "平均参照基準1",
            "average": "平均参照基準2",
            "cz": "Cz参照基準",
            "transverse": "横双極誘導",
            "c3c4": "C3/C4参照基準",
            "laplacian": "SD参照基準",
        }
        requested = [m for m in (montages or []) if m in montage_labels]
        if not requested:
            requested = ["conventional", "conventional_average", "longitudinal"]
        requested = requested[:4]
        view_defs = [(montage, montage_labels[montage]) for montage in requested]
        active = active_montage if active_montage in requested else requested[0]
        montage_views: list[dict[str, Any]] = []
        active_traces: list[dict[str, Any]] = []
        for montage, label in view_defs:
            traces = build_montage_traces(data, ch_names, montage, include_ecg, warnings, sfreq)
            if montage == "laplacian":
                traces = [trace for trace in traces if str(trace.get("label", "")).split("-", 1)[0] != "Pz"]
            for trace in traces:
                trace["values"] = trace["values"][::stride].astype(float).round(3).tolist()
            view = {"montage": montage, "label": label, "traces": traces}
            montage_views.append(view)
            if montage == active:
                active_traces = traces
        return {
            "id": record_id,
            "sfreq": sfreq,
            "start": float(start / sfreq),
            "duration": float((stop - start) / sfreq),
            "times": rel_times.round(4).tolist(),
            "traces": active_traces,
            "montage": active,
            "montageViews": montage_views,
            "topomap": topomap,
            "annotations": self.display_annotations(record_id),
            "warnings": warnings,
            "metadata": metadata,
        }


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


def channel_group(ch_name: str) -> str:
    for group, names in CHANNEL_GROUPS.items():
        if ch_name in names:
            return group
    return ""


def apply_display_filters(
    data: np.ndarray, ch_names: list[str], sfreq: float, tc: str, hf: str, ac: str, warnings: list[str]
) -> tuple[np.ndarray, list[str]]:
    if data.shape[1] < 16 or ensure_signal() is None:
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
            sos = signal.butter(2, hp, btype="highpass", fs=sfreq, output="sos")
            filtered[non_ecg_indices] = signal.sosfiltfilt(sos, filtered[non_ecg_indices], axis=1)
        if lp and lp < sfreq / 2 and non_ecg_indices:
            sos = signal.butter(4, lp, btype="lowpass", fs=sfreq, output="sos")
            filtered[non_ecg_indices] = signal.sosfiltfilt(sos, filtered[non_ecg_indices], axis=1)
        ecg_hp = tc_to_highpass(str(ECG_TC_SECONDS))
        if ecg_indices and ecg_hp and ecg_hp < sfreq / 2:
            sos = signal.butter(2, ecg_hp, btype="highpass", fs=sfreq, output="sos")
            filtered[ecg_indices] = signal.sosfiltfilt(sos, filtered[ecg_indices], axis=1)
        if ecg_indices and ECG_LOWPASS_HZ < sfreq / 2:
            sos = signal.butter(4, ECG_LOWPASS_HZ, btype="lowpass", fs=sfreq, output="sos")
            filtered[ecg_indices] = signal.sosfiltfilt(sos, filtered[ecg_indices], axis=1)
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
                b, a = signal.iirnotch(freq, Q=30.0, fs=sfreq)
                filtered = signal.filtfilt(b, a, filtered, axis=1)
    except Exception as exc:
        warnings.append(f"Display filter skipped: {exc}")
        return data, ch_names
    return filtered, ch_names


def apply_ecg_artifact_filter(data: np.ndarray, ch_names: list[str], sfreq: float, warnings: list[str]) -> np.ndarray:
    ecg_indices = ecg_channel_indices(ch_names)
    if not ecg_indices:
        warnings.append("ECG artifact filter skipped: no ECG channel was found.")
        return data
    if data.shape[1] < 16:
        warnings.append("ECG artifact filter skipped: the visible window is too short.")
        return data

    ecg_index = ecg_indices[0]
    ecg = np.asarray(data[ecg_index], dtype=float)
    ecg = ecg - np.nanmean(ecg)
    ecg_std = float(np.nanstd(ecg))
    if not np.isfinite(ecg_std) or ecg_std <= 1e-9:
        warnings.append("ECG artifact filter skipped: ECG channel is flat.")
        return data
    ecg = ecg / ecg_std

    lag_ms = [-80, -60, -40, -20, 0, 20, 40, 60, 80, 120]
    lag_samples = sorted({int(round(ms * sfreq / 1000.0)) for ms in lag_ms})
    basis_rows: list[np.ndarray] = []
    for lag in lag_samples:
        shifted = np.zeros_like(ecg)
        if lag > 0:
            shifted[lag:] = ecg[:-lag]
        elif lag < 0:
            shifted[:lag] = ecg[-lag:]
        else:
            shifted = ecg.copy()
        shifted = shifted - np.nanmean(shifted)
        std = float(np.nanstd(shifted))
        if np.isfinite(std) and std > 1e-9:
            basis_rows.append(shifted / std)
    derivative = np.gradient(ecg)
    derivative = derivative - np.nanmean(derivative)
    derivative_std = float(np.nanstd(derivative))
    if np.isfinite(derivative_std) and derivative_std > 1e-9:
        basis_rows.append(derivative / derivative_std)
    if not basis_rows:
        warnings.append("ECG artifact filter skipped: ECG regression basis is empty.")
        return data

    design = np.vstack(basis_rows).T
    design = np.column_stack([design, np.ones(design.shape[0])])
    xtx = design.T @ design
    ridge = 1e-3 * float(np.trace(xtx) / max(1, xtx.shape[0]))
    xtx[:-1, :-1] += np.eye(xtx.shape[0] - 1) * ridge
    try:
        pinv = np.linalg.solve(xtx, design.T)
    except np.linalg.LinAlgError:
        pinv = np.linalg.pinv(design)

    filtered = data.copy()
    removed = 0
    for idx, name in enumerate(ch_names):
        if idx == ecg_index or is_ecg_channel_name(name):
            continue
        signal_values = np.asarray(filtered[idx], dtype=float)
        coeff = pinv @ signal_values
        if not np.all(np.isfinite(coeff)):
            continue
        artifact = design[:, :-1] @ coeff[:-1]
        filtered[idx] = signal_values - artifact
        removed += 1
    if removed:
        min_lag = min(lag_ms)
        max_lag = max(lag_ms)
        warnings.append(
            f"ECG artifact multi-lag regression filter applied to {removed} EEG channels "
            f"({min_lag} to +{max_lag} ms)."
        )
    return filtered


def compute_local_laplacian_display(
    data: np.ndarray, ch_names: list[str], warnings: list[str]
) -> list[tuple[str, np.ndarray]]:
    index = {name: idx for idx, name in enumerate(ch_names)}
    traces: list[tuple[str, np.ndarray]] = []
    skipped: list[str] = []
    for ch in SCALP_ORDER:
        if ch not in index:
            continue
        neighbors = [name for name in LAPLACIAN_NEIGHBORS.get(ch, ()) if name in index]
        if len(neighbors) < 2:
            skipped.append(ch)
            continue
        neighbor_values = data[[index[name] for name in neighbors]]
        traces.append((ch, data[index[ch]] - np.nanmean(neighbor_values, axis=0)))
    if traces:
        warnings.append("Laplacian source: local montage using nearest neighbors derived from Nihon Kohden Default.ecd electrode coordinates; not guaranteed identical to Japanese Kohden viewer internals.")
        if skipped:
            warnings.append(f"Laplacian skipped channels with too few neighbors: {', '.join(skipped)}.")
    else:
        warnings.append("Laplacian unavailable: no channels had at least 2 neighboring 10-20 electrodes; showing raw channels.")
    return traces




def build_montage_traces(
    data: np.ndarray,
    ch_names: list[str],
    montage: str,
    include_ecg: bool,
    warnings: list[str],
    sfreq: float | None = None,
) -> list[dict[str, Any]]:
    index = {name: idx for idx, name in enumerate(ch_names)}
    traces: list[dict[str, Any]] = []

    def add(name: str, values: np.ndarray, role: str = "eeg", group: str = "") -> None:
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
            ("F7", "F3", "left_temporal"),
            ("F3", "Fz", "left_parasagittal"),
            ("Fz", "F4", "right_parasagittal"),
            ("F4", "F8", "right_temporal"),
            ("A1", "T7", "left_temporal"),
            ("T7", "C3", "left_temporal"),
            ("C3", "Cz", "left_parasagittal"),
            ("Cz", "C4", "right_parasagittal"),
            ("C4", "T8", "right_temporal"),
            ("T8", "A2", "right_temporal"),
            ("P7", "P3", "left_temporal"),
            ("P3", "Pz", "left_parasagittal"),
            ("Pz", "P4", "right_parasagittal"),
            ("P4", "P8", "right_temporal"),
            ("Fp1", "A1", "left_temporal"),
            ("Fp2", "A2", "right_temporal"),
            ("O1", "A1", "left_parasagittal"),
            ("O2", "A2", "right_parasagittal"),
        ]:
            diff(a, b, group)
    elif montage == "average":
        scalp = [ch for ch in SCALP_ORDER if ch in index]
        if scalp:
            avg = data[[index[ch] for ch in scalp]].mean(axis=0)
            for ch in scalp:
                if ch == "Pz":
                    continue
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
        ]
        for a, b, group in pairs:
            diff(a, b, group)
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
                diff(a, b, group)
    elif montage == "cz":
        for ch in [c for c in SCALP_ORDER if c in index and c != "Cz"]:
            diff(ch, "Cz", channel_group(ch))
    elif montage == "c3c4":
        refs = [ch for ch in ("C3", "C4") if ch in index]
        if refs:
            ref = data[[index[ch] for ch in refs]].mean(axis=0)
            for ch in [c for c in SCALP_ORDER if c in index and c not in refs]:
                add(f"{ch}-C3/C4", data[index[ch]] - ref, group=channel_group(ch))
    elif montage == "laplacian":
        laplacian = compute_local_laplacian_display(data, ch_names, warnings)
        for ch, values in laplacian:
            add(f"{ch}-Lap", values, group=channel_group(ch))

    if not traces:
        warnings.append(f"Montage '{montage}' could not be derived from decoded channels; showing raw or pre-montaged EEG channels.")
        for ch in ch_names:
            if is_fallback_eeg_channel_name(ch):
                add(ch, data[index[ch]], group=channel_group(ch))
        if not traces:
            warnings.append("No displayable EEG channels were found after excluding non-EEG auxiliary channels.")

    if include_ecg:
        ecg_indices = ecg_channel_indices(ch_names)
        if ecg_indices:
            ch = ch_names[ecg_indices[0]]
            add(f"ECG ({ch})", data[index[ch]], role="ecg", group="ecg")
    return traces


def annotation_path(record_id: str) -> Path:
    ANNOTATION_DIR.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in record_id)
    return ANNOTATION_DIR / f"{safe}.annotations.json"


def load_annotations(record_id: str) -> list[dict[str, Any]]:
    path = annotation_path(record_id)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return normalize_annotations(record_id, payload if isinstance(payload, list) else [])
    except Exception:
        return []


def normalize_annotations(record_id: str, annotations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for idx, row in enumerate(annotations):
        if not isinstance(row, dict):
            continue
        annotation = dict(row)
        if not annotation.get("id"):
            stable_parts = [
                record_id,
                str(idx),
                str(annotation.get("onset", "")),
                str(annotation.get("duration", "")),
                str(annotation.get("label", "")),
                str(annotation.get("channel", "")),
                str(annotation.get("note", "")),
            ]
            annotation["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, "eeg-viewer:" + "|".join(stable_parts)))
        annotation.setdefault("recordingId", record_id)
        normalized.append(annotation)
    return normalized


def save_annotations(record_id: str, annotations: list[dict[str, Any]]) -> None:
    annotations = normalize_annotations(record_id, annotations)
    annotation_path(record_id).write_text(
        json.dumps(annotations, ensure_ascii=False, indent=2, default=json_safe) + "\n",
        encoding="utf-8",
    )


def annotation_export_rows(
    store: RecordingStore | None, record_id: str
) -> list[dict[str, Any]]:
    rows = []
    for row in load_annotations(record_id):
        out_row = dict(row)
        for key in ("onset", "duration"):
            if key in out_row and out_row[key] not in (None, ""):
                value = precise_float(out_row[key])
                out_row[key] = f"{value:.6f}"
        rows.append(out_row)
    return rows


def precise_float(value: Any) -> float:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    return round(number, 6)


def recording_payload(rec: Recording) -> dict[str, Any]:
    return {
        "id": rec.record_id,
        "baseName": rec.base_name,
        "format": rec.file_format.upper(),
        "eegPath": str(rec.eeg_path),
        "sizeMb": round(rec.eeg_path.stat().st_size / (1024 * 1024), 1),
    }




RESEARCH_VERSION = "2026-06-09.1"
RESEARCH_INCLUDED_LABELS = {
    "SPSW": "epileptiform",
    "ARTF": "non_epileptiform",
    "EYEM": "non_epileptiform",
    "BCKG": "non_epileptiform",
}
RESEARCH_EXCLUDED_LABELS = {"PLED", "GPED"}
RESEARCH_ALL_LABELS = set(RESEARCH_INCLUDED_LABELS) | RESEARCH_EXCLUDED_LABELS
RESEARCH_RATING_NEGATIVE = "てんかん性異常なし"
RESEARCH_RATING_UNKNOWN = "判断困難"
RESEARCH_RATING_POSITIVE = "てんかん性異常あり"
RESEARCH_RATINGS = {RESEARCH_RATING_NEGATIVE, RESEARCH_RATING_UNKNOWN, RESEARCH_RATING_POSITIVE}
RESEARCH_RATING_ALIASES = {
    "epileptiform eventなし": RESEARCH_RATING_NEGATIVE,
    "epileptiform eventあり": RESEARCH_RATING_POSITIVE,
    "ied absent": RESEARCH_RATING_NEGATIVE,
    "ieds absent": RESEARCH_RATING_NEGATIVE,
    "ied present": RESEARCH_RATING_POSITIVE,
    "ieds present": RESEARCH_RATING_POSITIVE,
    "judgment difficult": RESEARCH_RATING_UNKNOWN,
    "uncertain": RESEARCH_RATING_UNKNOWN,
    "判断困難": RESEARCH_RATING_UNKNOWN,
    "判定困難": RESEARCH_RATING_UNKNOWN,
    "てんかん性異常なし": RESEARCH_RATING_NEGATIVE,
    "てんかん性異常あり": RESEARCH_RATING_POSITIVE,
}
RESEARCH_MONTAGE_KEYS = ["longitudinal", "a1a2", "conventional", "conventional_average", "average", "cz", "transverse", "c3c4", "laplacian"]
RESEARCH_PHASE1_SAMPLE_TOTAL = 20
RESEARCH_PHASE1_SAMPLE_PER_GROUP = 20


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_read(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def json_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=json_safe), encoding="utf-8")
    tmp.replace(path)


def safe_research_id(value: str) -> str:
    cleaned = unicodedata.normalize("NFKC", str(value or "")).strip()
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", cleaned).strip("._-")
    return cleaned[:80] or "dataset"


def safe_filename_part(value: str, fallback: str = "epoch") -> str:
    cleaned = unicodedata.normalize("NFKC", str(value or "")).strip()
    cleaned = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in cleaned).strip("._-")
    return cleaned[:120] or fallback


def unique_file_path(path: Path) -> Path:
    if not path.exists():
        return path
    for index in range(2, 10000):
        candidate = path.with_name(f"{path.stem}_{index}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise FileExistsError(f"Could not find unique output filename for {path}")


def edf_duration_seconds(edf_path: Path, default: float = 10.0) -> float:
    imported_mne = ensure_mne()
    if imported_mne is None:
        return default
    try:
        raw = imported_mne.io.read_raw_edf(str(edf_path), preload=False, verbose="ERROR")
        sfreq = float(raw.info.get("sfreq") or 0.0)
        if sfreq > 0 and getattr(raw, "n_times", 0):
            return max(0.001, round(float(raw.n_times) / sfreq, 6))
        if len(getattr(raw, "times", []) or []):
            return max(0.001, round(float(raw.times[-1]), 6))
    except Exception:
        return default
    return default


def research_cut_target(output_value: Any, edf_path: Path, epoch_start: float, duration: float) -> tuple[Path, Path]:
    raw_output = normalize_path_input(output_value)
    if not raw_output:
        raise ValueError("outputPath is required.")
    output_path = Path(raw_output).expanduser()
    if output_path.suffix.lower() == ".edf":
        output_dir = output_path.parent
        target = output_path
    else:
        output_dir = output_path
        stem = safe_filename_part(edf_path.stem, "edf")
        filename = f"{stem}_start{epoch_start:010.3f}_dur{duration:07.3f}.edf"
        target = output_dir / filename
    output_dir = ensure_allowed_research_write_path(output_dir)
    target = ensure_allowed_research_write_path(target)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir, unique_file_path(target)


def export_research_epoch_edf(payload: dict[str, Any]) -> dict[str, Any]:
    edf_raw = normalize_path_input(payload.get("edfPath"))
    if not edf_raw:
        raise ValueError("edfPath is required.")
    edf_path = Path(edf_raw).expanduser().resolve()
    if not edf_path.exists() or not edf_path.is_file():
        raise FileNotFoundError(f"EDF file not found: {edf_path}")
    if edf_path.suffix.lower() != ".edf":
        raise ValueError("Save Epoch currently exports only from EDF source files.")
    epoch_start = max(0.0, float(payload.get("epochStart") or 0.0))
    duration = max(0.001, float(payload.get("durationSec") or 10.0))
    output_dir, target = research_cut_target(payload.get("outputPath"), edf_path, epoch_start, duration)
    imported_mne = ensure_mne()
    if imported_mne is None:
        raise RuntimeError("MNE is required to export EDF epochs.")
    try:
        raw = imported_mne.io.read_raw_edf(str(edf_path), preload=False, verbose="ERROR")
        sfreq = float(raw.info.get("sfreq") or 0.0)
        total_duration = float(raw.n_times) / sfreq if sfreq > 0 else duration
        tmin = min(max(0.0, epoch_start), max(0.0, total_duration - 0.001))
        tmax = min(total_duration, tmin + duration)
        if tmax <= tmin:
            raise ValueError("Selected epoch is outside the EDF duration.")
        raw.crop(tmin=tmin, tmax=tmax, include_tmax=False)
        raw.load_data()
        raw.export(str(target), fmt="edf", overwrite=False)
    except ImportError as exc:
        raise RuntimeError("EDF export requires the edfio package. Please install/update the EEG Viewer runtime.") from exc
    return {
        "outputPath": str(target),
        "outputDir": str(output_dir),
        "filename": target.name,
        "sourcePath": str(edf_path),
        "recordingId": str(payload.get("recordingId") or edf_path.stem),
        "epochStart": round(epoch_start, 6),
        "durationSec": round(duration, 6),
        "eventTime": round(float(payload.get("eventTime") or (epoch_start + duration / 2.0)), 6),
        "labelGroup": str(payload.get("labelGroup") or ""),
    }


def research_dataset_path(value: str | None) -> Path:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Dataset path is required.")
    if is_http_url(raw):
        return remote_research_dataset_dir(raw)
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = RESEARCH_DATASET_DIR / safe_research_id(raw)
    return ensure_allowed_research_write_path(path)


def remote_research_dataset_dir(url: str) -> Path:
    normalized = normalize_github_url(url)
    return RESEARCH_DATASET_DIR / f"remote_{url_cache_key(normalized)[:16]}"


def private_dataset_path(value: str) -> Path | None:
    text = str(value or "").strip()
    if text.startswith("private:"):
        dataset_id = safe_research_id(text.split(":", 1)[1])
        return PRIVATE_DATASET_DIR / dataset_id
    return None


def private_dataset_payload(dataset_dir: Path, dataset_id: str, name: str = "") -> dict[str, Any]:
    cases: list[dict[str, Any]] = []
    group_specs = [
        ("epilepsy", "epileptiform", "IED_PRESENT"),
        ("no_epilepsy", "non_epileptiform", "IED_ABSENT"),
    ]
    for folder_name, label_group, reference_label in group_specs:
        search_dirs = [dataset_dir / "edf" / folder_name, dataset_dir / folder_name]
        edf_paths: list[Path] = []
        for search_dir in search_dirs:
            if search_dir.exists():
                edf_paths.extend(sorted(search_dir.glob("*.edf")))
        for index, edf_path in enumerate(sorted(set(edf_paths)), start=1):
            case_hash = hashlib.sha1(str(edf_path.relative_to(dataset_dir)).encode("utf-8")).hexdigest()[:8]
            cases.append({
                "caseId": f"{dataset_id}_{folder_name}_{index:03d}_{case_hash}",
                "edfPath": str(edf_path.resolve()),
                "recordingId": edf_path.stem,
                "labelGroup": label_group,
                "referenceLabel": reference_label,
                "include": True,
                "phase1Montage": "conventional",
                "sourceGroup": folder_name,
                "sourceAnnotation": dataset_id,
            })
    if not cases:
        raise ValueError("Private dataset zip must contain EDF files under epilepsy/ and no_epilepsy/ folders.")
    return {
        "datasetId": dataset_id,
        "name": name or dataset_id,
        "datasetPath": str(dataset_dir),
        "createdAt": utc_now_iso(),
        "settings": {
            "phase1TotalSampleCount": 20,
            "phase1Montage": "conventional",
            "epochDurationSec": 10,
        },
        "cases": cases,
    }


def safe_zip_extract(zip_path: Path, target_dir: Path) -> None:
    target_root = target_dir.resolve()
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            member_path = target_root / member.filename
            resolved = member_path.resolve()
            if not path_is_relative_to(resolved, target_root):
                raise ValueError(f"Unsafe zip path: {member.filename}")
            resolved.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as src, resolved.open("wb") as dst:
                shutil.copyfileobj(src, dst)


def upload_private_dataset(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_id = safe_research_id(str(payload.get("datasetId") or "private_dataset"))
    name = str(payload.get("name") or dataset_id).strip()
    content_b64 = str(payload.get("contentBase64") or "")
    if not content_b64:
        raise ValueError("Upload content is empty.")
    raw = base64.b64decode(content_b64, validate=True)
    if len(raw) > MAX_EXPORT_POST_BODY_BYTES:
        raise ValueError("Private dataset upload is too large.")
    dataset_dir = PRIVATE_DATASET_DIR / dataset_id
    tmp_dir = PRIVATE_DATASET_DIR / f".{dataset_id}.upload"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    zip_path = tmp_dir / "dataset.zip"
    zip_path.write_bytes(raw)
    extract_dir = tmp_dir / "extract"
    extract_dir.mkdir()
    safe_zip_extract(zip_path, extract_dir)
    if dataset_dir.exists():
        shutil.rmtree(dataset_dir)
    dataset_dir.parent.mkdir(parents=True, exist_ok=True)
    dataset_dir.mkdir()
    for child in extract_dir.iterdir():
        shutil.move(str(child), str(dataset_dir / child.name))
    dataset = private_dataset_payload(dataset_dir, dataset_id, name)
    json_write(dataset_dir / "dataset.json", dataset)
    shutil.rmtree(tmp_dir, ignore_errors=True)
    return {
        "ok": True,
        "datasetId": dataset_id,
        "datasetPath": f"private:{dataset_id}",
        "caseCount": len(dataset.get("cases") or []),
        "epilepsyCount": sum(1 for row in dataset.get("cases") or [] if row.get("labelGroup") == "epileptiform"),
        "noEpilepsyCount": sum(1 for row in dataset.get("cases") or [] if row.get("labelGroup") == "non_epileptiform"),
    }


def resolve_remote_case_url(dataset_url: str, value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if is_http_url(text):
        return normalize_github_url(text)
    return normalize_github_url(urljoin(normalize_github_url(dataset_url), text))


def load_remote_research_dataset(url: str) -> dict[str, Any]:
    normalized = normalize_github_url(url)
    dataset_dir = remote_research_dataset_dir(normalized)
    payload = json.loads(read_remote_text(normalized))
    if not isinstance(payload, dict):
        raise ValueError("Remote dataset must be a JSON object.")
    dataset_dir.mkdir(parents=True, exist_ok=True)
    payload.setdefault("datasetId", safe_research_id(f"remote_{remote_cache_filename(normalized, 'dataset')}"))
    payload.setdefault("name", Path(unquote(urlparse(normalized).path or "")).stem or "Remote dataset")
    payload["datasetPath"] = str(dataset_dir)
    payload["sourceDatasetUrl"] = normalized
    payload.setdefault("cases", [])
    cases = payload.get("cases") if isinstance(payload.get("cases"), list) else []
    for row in cases:
        if not isinstance(row, dict):
            continue
        edf_url = resolve_remote_case_url(normalized, row.get("edfUrl") or row.get("edfPath"))
        if edf_url:
            row["edfUrl"] = edf_url
            row["edfPath"] = edf_url
        row.setdefault("sourceDatasetUrl", normalized)
    json_write(dataset_dir / "dataset.json", payload)
    return payload


def load_research_dataset(path_value: str | None) -> dict[str, Any]:
    private_path = private_dataset_path(str(path_value or ""))
    if private_path is not None:
        payload = json_read(private_path / "dataset.json", None)
        if not isinstance(payload, dict):
            raise FileNotFoundError(f"Private dataset not found: {path_value}")
        payload.setdefault("datasetPath", str(private_path))
        payload.setdefault("cases", [])
        return payload
    if is_http_url(path_value):
        return load_remote_research_dataset(str(path_value))
    dataset_dir = research_dataset_path(path_value)
    payload = json_read(dataset_dir / "dataset.json", None)
    if not isinstance(payload, dict):
        payload = create_validation_dataset_from_edf_folder(dataset_dir)
    payload.setdefault("datasetPath", str(dataset_dir))
    payload.setdefault("cases", [])
    return payload


def infer_validation_label_group_from_path(path: Path) -> str:
    name = path.name.lower()
    parent = path.parent.name.lower()
    text = f"{parent}/{name}"
    negative_markers = ("no_epilepsy", "non_epilepsy", "nonepilepsy", "non-epilepsy", "iedなし", "なし", "absent", "negative", "normal")
    if any(marker in text for marker in negative_markers):
        return "non_epileptiform"
    return "epileptiform"


def create_validation_dataset_from_edf_folder(source_path: Path) -> dict[str, Any]:
    source = source_path.expanduser().resolve()
    if not source.exists():
        raise FileNotFoundError(f"dataset.json not found: {source_path}")
    edf_paths = research_group_edf_paths(source)
    if not edf_paths:
        raise FileNotFoundError(f"dataset.json not found and no EDF files were found: {source}")
    label_group = infer_validation_label_group_from_path(source)
    source_hash = hashlib.sha1(str(source).encode("utf-8")).hexdigest()[:12]
    dataset_id = safe_research_id(f"validation_{source.name}_{source_hash}")
    dataset_dir = RESEARCH_DATASET_DIR / dataset_id
    dataset_file = dataset_dir / "dataset.json"
    existing = json_read(dataset_file, None)
    if isinstance(existing, dict):
        existing.setdefault("datasetPath", str(dataset_dir))
        existing.setdefault("cases", [])
        return existing
    cases: list[dict[str, Any]] = []
    for file_index, edf_path in enumerate(edf_paths, start=1):
        try:
            duration = edf_duration_seconds(edf_path)
        except Exception:
            duration = 10.0
        reference_label = "MANUAL_EPI" if label_group == "epileptiform" else "MANUAL_NON"
        case_id_seed = f"{edf_path.resolve()}|validation|{label_group}|{file_index}"
        case_id = hashlib.sha1(case_id_seed.encode("utf-8")).hexdigest()[:16]
        cases.append({
            "caseId": case_id,
            "edfPath": str(edf_path.resolve()),
            "recordingId": edf_path.stem,
            "eventTime": round(duration / 2.0, 6),
            "epochStart": 0.0,
            "durationSec": round(duration, 6),
            "referenceLabel": reference_label,
            "labelGroup": label_group,
            "include": True,
            "excludeReason": "",
            "qualityNotes": "",
            "phase1Montage": "conventional",
            "sourceRoot": str(source),
            "sourceGroup": "epilepsy" if label_group == "epileptiform" else "no_epilepsy",
            "sourceAnnotation": "validation_input_folder",
        })
    dataset = {
        "datasetId": dataset_id,
        "name": source.name,
        "datasetPath": str(dataset_dir),
        "sourceRoot": str(source),
        "sourceRoots": [str(source)],
        "createdAt": utc_now_iso(),
        "settings": {"phase1TotalSampleCount": len(cases), "phase1SamplePerGroup": len(cases)},
        "cases": cases,
    }
    dataset_dir.mkdir(parents=True, exist_ok=True)
    json_write(dataset_file, dataset)
    return dataset


def research_case_rows(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    rows = list(dataset.get("cases") or [])
    rows.sort(key=lambda row: (str(row.get("recordingId", "")), float(row.get("epochStart", 0) or 0), str(row.get("caseId", ""))))
    return rows


def save_research_group_exports(dataset_dir: Path, dataset: dict[str, Any]) -> None:
    group_dirs = {
        "epileptiform": "IEDs_present",
        "non_epileptiform": "IEDs_absent",
    }
    for group, folder_name in group_dirs.items():
        group_dir = dataset_dir / folder_name
        group_dir.mkdir(parents=True, exist_ok=True)
        group_cases = [row for row in research_case_rows(dataset) if row.get("labelGroup") == group]
        group_dataset = {**dataset, "cases": group_cases}
        json_write(group_dir / "dataset.json", group_dataset)


def save_research_dataset(dataset_dir: Path, dataset: dict[str, Any]) -> None:
    dataset_dir.mkdir(parents=True, exist_ok=True)
    (dataset_dir / "responses").mkdir(exist_ok=True)
    (dataset_dir / "exports").mkdir(exist_ok=True)
    dataset["datasetPath"] = str(dataset_dir)
    json_write(dataset_dir / "dataset.json", dataset)
    save_research_group_exports(dataset_dir, dataset)


def parse_tuev_sidecar(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return events
    for line in lines:
        upper = line.upper()
        label = next((item for item in RESEARCH_ALL_LABELS if re.search(rf"\b{re.escape(item)}\b", upper)), "")
        if not label:
            continue
        numbers = []
        for match in re.finditer(r"[-+]?\d+(?:\.\d+)?", line):
            try:
                numbers.append(float(match.group(0)))
            except ValueError:
                pass
        if not numbers:
            continue
        start = max(0.0, numbers[0])
        stop = numbers[1] if len(numbers) > 1 else start
        if stop < start:
            stop = start
        event_time = (start + stop) / 2.0 if stop > start else start
        events.append({"label": label, "eventTime": event_time, "sourceAnnotation": str(path)})
    return events


def read_mne_events_from_edf(edf_path: Path) -> list[dict[str, Any]]:
    imported_mne = ensure_mne()
    if imported_mne is None:
        return []
    try:
        raw = imported_mne.io.read_raw_edf(str(edf_path), preload=False, verbose=False)
    except Exception:
        return []
    events = []
    for ann in getattr(raw, "annotations", []) or []:
        desc = str(getattr(ann, "description", "") or "").upper()
        label = next((item for item in RESEARCH_ALL_LABELS if re.search(rf"\b{re.escape(item)}\b", desc)), "")
        if label:
            events.append({"label": label, "eventTime": float(getattr(ann, "onset", 0.0) or 0.0), "sourceAnnotation": "edf"})
    return events


def research_events_for_edf(edf_path: Path) -> list[dict[str, Any]]:
    sidecars = []
    for suffix in (".rec", ".tse", ".lbl", ".csv", ".txt"):
        sidecars.extend(sorted(edf_path.parent.glob(edf_path.stem + "*" + suffix)))
    events: list[dict[str, Any]] = []
    for sidecar in sidecars:
        events.extend(parse_tuev_sidecar(sidecar))
    if events:
        return events
    return read_mne_events_from_edf(edf_path)


def create_research_dataset(payload: dict[str, Any]) -> dict[str, Any]:
    source_raw = str(payload.get("sourceRoot") or "").strip()
    source_root = Path(source_raw).expanduser().resolve() if source_raw else None
    group_paths_payload = payload.get("groupPaths") if isinstance(payload.get("groupPaths"), dict) else {}
    phase1_montage = str(payload.get("phase1Montage") or "conventional")
    phase1_total_count = max(1, int(float(payload.get("phase1TotalSampleCount") or RESEARCH_PHASE1_SAMPLE_TOTAL)))
    if source_root is not None and not source_root.exists():
        raise FileNotFoundError(f"Source root not found: {source_root}")
    name = str(payload.get("name") or (source_root.name if source_root else "manual_dataset") or "dataset")
    requested_id = str(payload.get("datasetId") or "").strip()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_raw = str(payload.get("outputPath") or payload.get("datasetPath") or "").strip()
    if output_raw:
        dataset_dir = research_dataset_path(output_raw)
        dataset_id = safe_research_id(requested_id or dataset_dir.name or f"{stamp}_{name}")
    else:
        dataset_id = safe_research_id(requested_id or f"{stamp}_{name}")
        dataset_dir = RESEARCH_DATASET_DIR / dataset_id
    if not output_raw and dataset_dir.exists():
        dataset_id = safe_research_id(f"{dataset_id}_{uuid.uuid4().hex[:6]}")
        dataset_dir = RESEARCH_DATASET_DIR / dataset_id
    cases: list[dict[str, Any]] = []
    source_roots: list[str] = []
    if group_paths_payload:
        for label_group in ("epileptiform", "non_epileptiform"):
            folder_value = str(group_paths_payload.get(label_group) or "").strip()
            if not folder_value:
                raise ValueError("Both IEDs-present and IEDs-absent EDF files or folders are required.")
            group_path = Path(folder_value).expanduser().resolve()
            source_roots.append(str(group_path))
            edf_paths = research_group_edf_paths(group_path)
            for file_index, edf_path in enumerate(edf_paths, start=1):
                duration = edf_duration_seconds(edf_path)
                event_time = duration / 2.0
                reference_label = "MANUAL_EPI" if label_group == "epileptiform" else "MANUAL_NON"
                case_id_seed = f"{edf_path.resolve()}|{label_group}|{file_index}"
                case_id = hashlib.sha1(case_id_seed.encode("utf-8")).hexdigest()[:16]
                cases.append({
                    "caseId": case_id,
                    "edfPath": str(edf_path.resolve()),
                    "recordingId": edf_path.stem,
                    "eventTime": round(event_time, 6),
                    "epochStart": 0.0,
                    "durationSec": round(duration, 6),
                    "referenceLabel": reference_label,
                    "labelGroup": label_group,
                    "include": True,
                    "excludeReason": "",
                    "qualityNotes": "",
                    "phase1Montage": phase1_montage,
                    "sourceGroup": "epilepsy" if label_group == "epileptiform" else "no_epilepsy",
                    "sourceAnnotation": "manual_group_folder",
                })
        if not cases:
            raise ValueError("No EDF files found in the IEDs-present or IEDs-absent folders.")
    else:
        edf_paths = sorted({*source_root.rglob("*.edf"), *source_root.rglob("*.EDF")}) if source_root is not None else []
        for edf_path in edf_paths:
            events = research_events_for_edf(edf_path)
            recording_id = edf_path.stem
            for event_index, event in enumerate(events, start=1):
                label = str(event.get("label") or "").upper()
                if label in RESEARCH_EXCLUDED_LABELS:
                    continue
                label_group = RESEARCH_INCLUDED_LABELS.get(label)
                if not label_group:
                    continue
                event_time = float(event.get("eventTime", 0.0) or 0.0)
                epoch_start = max(0.0, event_time - 5.0)
                case_id_seed = f"{edf_path.resolve()}|{event_time:.6f}|{label}|{event_index}"
                case_id = hashlib.sha1(case_id_seed.encode("utf-8")).hexdigest()[:16]
                cases.append({
                    "caseId": case_id,
                    "edfPath": str(edf_path.resolve()),
                    "recordingId": recording_id,
                    "eventTime": round(event_time, 6),
                    "epochStart": round(epoch_start, 6),
                    "durationSec": 10,
                    "referenceLabel": label,
                    "labelGroup": label_group,
                    "include": True,
                    "excludeReason": "",
                    "qualityNotes": "",
                    "phase1Montage": phase1_montage,
                    "sourceAnnotation": event.get("sourceAnnotation", ""),
                })
    dataset = {
        "datasetId": dataset_id,
        "name": name,
        "datasetPath": str(dataset_dir),
        "sourceRoot": str(source_root) if source_root is not None else "",
        "sourceRoots": source_roots,
        "createdAt": utc_now_iso(),
        "version": RESEARCH_VERSION,
        "cases": cases,
        "settings": {
            "epochDurationSec": 10,
            "phase1Montage": phase1_montage,
            "phase1TotalSampleCount": phase1_total_count,
            "phase1SamplePerGroup": phase1_total_count,
        },
    }
    manifest = {"datasetId": dataset_id, "name": name, "createdAt": dataset["createdAt"], "sourceRoot": dataset["sourceRoot"], "version": RESEARCH_VERSION}
    save_research_dataset(dataset_dir, dataset)
    json_write(dataset_dir / "manifest.json", manifest)
    return {"datasetPath": str(dataset_dir), "dataset": dataset, "manifest": manifest, "caseCount": len(cases)}


def add_research_dataset_cut(payload: dict[str, Any]) -> dict[str, Any]:
    return export_research_epoch_edf(payload)


def update_research_dataset_item(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("path"))
    dataset = load_research_dataset(str(dataset_dir))
    case_id = str(payload.get("caseId") or "")
    updates = dict(payload.get("updates") or {})
    allowed = {
        "include", "excludeReason", "qualityNotes", "phase1Montage", "phase1SamplePerGroup", "phase1TotalSampleCount",
    }
    found = None
    settings_keys = {"phase1SamplePerGroup", "phase1TotalSampleCount"}
    if "phase1TotalSampleCount" in updates:
        settings = dataset.setdefault("settings", {})
        settings["phase1TotalSampleCount"] = max(1, int(float(updates.get("phase1TotalSampleCount") or RESEARCH_PHASE1_SAMPLE_TOTAL)))
    if "phase1SamplePerGroup" in updates:
        settings = dataset.setdefault("settings", {})
        settings["phase1SamplePerGroup"] = max(1, int(float(updates.get("phase1SamplePerGroup") or RESEARCH_PHASE1_SAMPLE_PER_GROUP)))
    if case_id:
        for row in dataset.get("cases") or []:
            if row.get("caseId") == case_id:
                for key, value in updates.items():
                    if key in allowed and key not in settings_keys:
                        row[key] = value
                found = row
                break
        if found is None:
            raise KeyError(f"Case not found: {case_id}")
    save_research_dataset(dataset_dir, dataset)
    return {"datasetPath": str(dataset_dir), "case": found, "dataset": dataset}


def research_reader_id(value: Any) -> str:
    reader = safe_filename_part(str(value or "reader"), "reader")
    if not reader:
        reader = "reader"
    return reader


def research_reader_json_filename(reader_id: str | None, profile: dict[str, Any] | None = None) -> str:
    if not reader_id:
        return "EEG_test_results.json"
    profile = profile if isinstance(profile, dict) else {}
    name = safe_filename_part(
        str(profile.get("readerName") or profile.get("doctorName") or reader_id),
        "reader",
    )
    return f"{name}.json"


def research_response_path(dataset_dir: Path, reader_id: str) -> Path:
    return dataset_dir / "responses" / f"{research_reader_id(reader_id)}.json"


def research_output_dir(dataset_dir: Path, value: Any) -> Path | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = dataset_dir / "exports" / safe_research_id(raw)
    return ensure_allowed_research_write_path(path)


def load_research_responses(dataset_dir: Path, reader_id: str) -> list[dict[str, Any]]:
    payload = json_read(research_response_path(dataset_dir, reader_id), {"responses": []})
    if isinstance(payload, dict):
        return list(payload.get("responses") or [])
    if isinstance(payload, list):
        return payload
    return []


def save_research_responses(dataset_dir: Path, reader_id: str, responses: list[dict[str, Any]], output_path: Any = None, reader_profile: dict[str, Any] | None = None) -> None:
    if reader_profile is None:
        reader_profile = response_reader_profile(*responses)
    payload = {
        "readerId": research_reader_id(reader_id),
        "updatedAt": utc_now_iso(),
        "readerProfile": reader_profile or {},
        "responses": responses,
    }
    json_write(research_response_path(dataset_dir, reader_id), payload)
    output_dir = research_output_dir(dataset_dir, output_path)
    if output_dir is not None:
        json_write(output_dir / "responses" / f"{research_reader_id(reader_id)}.json", payload)


def active_research_responses(responses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in responses if not row.get("superseded") and not row.get("undoneAt")]


def active_response_map(responses: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    result: dict[tuple[str, str], dict[str, Any]] = {}
    for row in active_research_responses(responses):
        result[(str(row.get("caseId", "")), str(row.get("phase", "1")))] = row
    return result


def stable_research_sample(rows: list[dict[str, Any]], limit: int, seed_parts: tuple[str, ...]) -> list[dict[str, Any]]:
    seed = hashlib.sha256("|".join(seed_parts).encode("utf-8")).hexdigest()
    rng = random.Random(seed)
    sampled = list(rows)
    rng.shuffle(sampled)
    if limit > 0 and len(sampled) > limit:
        sampled = sampled[:limit]
    return sampled


def research_phase1_total_count(settings: dict[str, Any]) -> int:
    if PUBLIC_MODE:
        return PUBLIC_TEST_QUESTION_COUNT
    if "phase1TotalSampleCount" in settings:
        return max(1, int(float(settings.get("phase1TotalSampleCount") or RESEARCH_PHASE1_SAMPLE_TOTAL)))
    if "phase1SamplePerGroup" in settings:
        return max(1, int(float(settings.get("phase1SamplePerGroup") or RESEARCH_PHASE1_SAMPLE_PER_GROUP)) * 2)
    return RESEARCH_PHASE1_SAMPLE_TOTAL


def stable_balanced_research_order(rows: list[dict[str, Any]], seed_parts: tuple[str, ...]) -> list[dict[str, Any]]:
    seed = hashlib.sha256("|".join(seed_parts).encode("utf-8")).hexdigest()
    rng = random.Random(seed)
    grouped = {
        "epileptiform": [row for row in rows if row.get("labelGroup") == "epileptiform"],
        "non_epileptiform": [row for row in rows if row.get("labelGroup") == "non_epileptiform"],
    }
    other_rows = [row for row in rows if row.get("labelGroup") not in grouped]
    for group_rows in grouped.values():
        rng.shuffle(group_rows)
    rng.shuffle(other_rows)
    group_order = ["epileptiform", "non_epileptiform"]
    rng.shuffle(group_order)
    ordered: list[dict[str, Any]] = []
    while any(grouped[group] for group in group_order):
        for group in group_order:
            if grouped[group]:
                ordered.append(grouped[group].pop(0))
    ordered.extend(other_rows)
    return ordered


def research_phase1_sample(dataset: dict[str, Any], reader_id: str, excluded_case_ids: set[str] | None = None) -> list[dict[str, Any]]:
    settings = dataset.get("settings") if isinstance(dataset.get("settings"), dict) else {}
    total_count = research_phase1_total_count(settings)
    excluded = excluded_case_ids or set()
    included = [
        row for row in research_case_rows(dataset)
        if bool(row.get("include", True)) and str(row.get("caseId", "")) not in excluded
    ]
    sampled: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    group_limits = {
        "epileptiform": total_count // 2 + total_count % 2,
        "non_epileptiform": total_count // 2,
    }
    for group, limit in group_limits.items():
        rows = [row for row in included if row.get("labelGroup") == group]
        group_sample = stable_research_sample(rows, limit, (str(dataset.get("datasetId", "")), reader_id, "phase1", group))
        sampled.extend(group_sample)
        selected_ids.update(str(row.get("caseId", "")) for row in group_sample)
    remaining = total_count - len(sampled)
    if remaining > 0:
        fill_pool = [row for row in included if str(row.get("caseId", "")) not in selected_ids]
        sampled.extend(stable_research_sample(fill_pool, remaining, (str(dataset.get("datasetId", "")), reader_id, "phase1", "fill")))
    return stable_balanced_research_order(sampled, (str(dataset.get("datasetId", "")), reader_id, "phase1", "balanced-order"))


def research_is_epilepsy_sample_candidate(row: dict[str, Any]) -> bool:
    if str(row.get("labelGroup") or "") == "epileptiform":
        return True
    group_text = " ".join([
        str(row.get("sourceGroup") or ""),
        str(row.get("referenceLabel") or ""),
        str(row.get("edfPath") or ""),
    ]).lower()
    return "epilepsy" in group_text and "no_epilepsy" not in group_text


def research_sample_case(dataset: dict[str, Any], reader_id: str, phase: str, pool: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sample_pool = [row for row in pool if research_is_epilepsy_sample_candidate(row)]
    if not sample_pool:
        sample_pool = [row for row in pool if row.get("labelGroup") == "epileptiform"]
    sample = stable_research_sample(sample_pool, 1, (str(dataset.get("datasetId", "")), reader_id, phase, "sample"))
    return [
        {**row, "sampleEpoch": True, "samplePhase": phase, "sampleSourceGroup": "epilepsy", "originalCaseId": str(row.get("caseId", "")), "caseId": f"sample:{phase}:{row.get('caseId')}"}
        for row in sample
    ]


def research_phase_case_pool(dataset: dict[str, Any], reader_id: str, phase: str, active: dict[tuple[str, str], dict[str, Any]]) -> list[dict[str, Any]]:
    included = [row for row in research_case_rows(dataset) if bool(row.get("include", True))]
    sample = research_sample_case(dataset, reader_id, "phase1", included)
    sample_source_ids = {str(row.get("originalCaseId") or str(row.get("caseId", "")).split(":")[-1]) for row in sample}
    phase1_cases = research_phase1_sample(dataset, reader_id, sample_source_ids)
    return sample + phase1_cases


def research_phase_cases(dataset: dict[str, Any], reader_id: str, phase: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[tuple[str, str], dict[str, Any]]]:
    dataset_dir = research_dataset_path(dataset.get("datasetPath"))
    responses = load_research_responses(dataset_dir, reader_id)
    active = active_response_map(responses)
    included = research_phase_case_pool(dataset, reader_id, phase, active)
    included = [
        row for row in included
        if row.get("sampleEpoch") or not active.get((str(row.get("caseId")), phase))
    ]
    return included, responses, active


def research_session(payload: dict[str, Any]) -> dict[str, Any]:
    dataset = load_research_dataset(payload.get("datasetPath") or payload.get("dataset"))
    reader_id = research_reader_id(payload.get("readerId"))
    phase = "1"
    cases, responses, active = research_phase_cases(dataset, reader_id, phase)
    all_cases = research_phase_case_pool(dataset, reader_id, phase, active)
    active_rows = list(active.values())
    non_sample_cases = [row for row in all_cases if not row.get("sampleEpoch")]
    settings = dataset.get("settings") if isinstance(dataset.get("settings"), dict) else {}
    requested_total = research_phase1_total_count(settings)
    return {
        "datasetPath": dataset.get("datasetPath"),
        "datasetId": dataset.get("datasetId"),
        "name": dataset.get("name"),
        "readerId": reader_id,
        "phase": phase,
        "cases": cases,
        "responses": active_rows,
        "answeredCount": sum(1 for row in non_sample_cases if active.get((str(row.get("caseId")), phase))),
        "totalCount": len(non_sample_cases),
        "displayCount": len(cases),
        "requestedTotalCount": requested_total,
        "samplePerGroup": max(1, math.ceil(requested_total / 2)),
        "groupCounts": {group: sum(1 for row in non_sample_cases if row.get("labelGroup") == group) for group in ("epileptiform", "non_epileptiform")},
        "ratings": [RESEARCH_RATING_POSITIVE, RESEARCH_RATING_NEGATIVE, RESEARCH_RATING_UNKNOWN],
    }


def validation_response_path(dataset_dir: Path) -> Path:
    return dataset_dir / "validation" / "validation.json"


def load_validation_responses(dataset_dir: Path) -> list[dict[str, Any]]:
    payload = json_read(validation_response_path(dataset_dir), {"responses": []})
    if isinstance(payload, dict):
        return list(payload.get("responses") or [])
    if isinstance(payload, list):
        return payload
    return []


def save_validation_responses(dataset_dir: Path, responses: list[dict[str, Any]]) -> None:
    target = validation_response_path(dataset_dir)
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updatedAt": utc_now_iso(),
        "responses": responses,
    }
    json_write(target, payload)


def active_validation_map(responses: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    active: dict[str, dict[str, Any]] = {}
    for row in responses:
        if row.get("superseded") or row.get("undoneAt"):
            continue
        active[str(row.get("caseId", ""))] = row
    return active


def validation_expected_rating(case: dict[str, Any]) -> str:
    return RESEARCH_RATING_POSITIVE if case.get("labelGroup") == "epileptiform" else RESEARCH_RATING_NEGATIVE


def validation_case_rows(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    return [row for row in research_case_rows(dataset) if bool(row.get("include", True))]


def validation_session(payload: dict[str, Any]) -> dict[str, Any]:
    dataset = load_research_dataset(payload.get("datasetPath") or payload.get("dataset"))
    dataset_dir = research_dataset_path(dataset.get("datasetPath"))
    responses = load_validation_responses(dataset_dir)
    active = active_validation_map(responses)
    all_cases = validation_case_rows(dataset)
    remaining = [row for row in all_cases if str(row.get("caseId", "")) not in active]
    active_rows = sorted(active.values(), key=lambda row: (str(row.get("answeredAt", "")), str(row.get("caseId", ""))))
    return {
        "datasetPath": dataset.get("datasetPath"),
        "datasetId": dataset.get("datasetId"),
        "name": dataset.get("name"),
        "cases": remaining,
        "responses": active_rows,
        "answeredCount": len(active),
        "totalCount": len(all_cases),
        "displayCount": len(remaining),
        "ratings": [RESEARCH_RATING_POSITIVE, RESEARCH_RATING_NEGATIVE],
        "groupCounts": {group: sum(1 for row in all_cases if row.get("labelGroup") == group) for group in ("epileptiform", "non_epileptiform")},
    }


def save_validation_response(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("dataset"))
    dataset = load_research_dataset(str(dataset_dir))
    case_id = str(payload.get("caseId") or "")
    case = next((row for row in dataset.get("cases") or [] if row.get("caseId") == case_id), None)
    if not case:
        raise KeyError(f"Case not found: {case_id}")
    raw_rating = str(payload.get("rating") or "")
    rating = RESEARCH_RATING_ALIASES.get(raw_rating.strip().lower(), raw_rating) or validation_expected_rating(case)
    if rating not in (RESEARCH_RATING_POSITIVE, RESEARCH_RATING_NEGATIVE):
        raise ValueError("Validation rating must be epileptiform present or absent.")
    expected = validation_expected_rating(case)
    now = utc_now_iso()
    response_id = str(uuid.uuid4())
    responses = load_validation_responses(dataset_dir)
    for row in responses:
        if row.get("caseId") == case_id and not row.get("superseded") and not row.get("undoneAt"):
            row["superseded"] = True
            row["supersededAt"] = now
            row["replacedByResponseId"] = response_id
    dataset_consistent = rating == expected
    response = {
        "responseId": response_id,
        "caseId": case_id,
        "rating": rating,
        "expectedRating": expected,
        "datasetConsistent": dataset_consistent,
        "datasetValid": dataset_consistent,
        "validationMethod": payload.get("validationMethod") or ("enter_accept" if dataset_consistent else "manual_override"),
        "startedAt": payload.get("startedAt") or now,
        "answeredAt": payload.get("answeredAt") or now,
        "elapsedMs": int(float(payload.get("elapsedMs") or 0)),
        "labelGroup": case.get("labelGroup", ""),
        "referenceLabel": case.get("referenceLabel", ""),
        "usedMontage": payload.get("usedMontage") or "",
        "finalMontage": payload.get("finalMontage") or payload.get("usedMontage") or "",
        "sensitivity": payload.get("sensitivity") or "",
        "tc": payload.get("tc") or "",
        "hf": payload.get("hf") or "",
        "timebaseSec": payload.get("timebaseSec") or "",
        "superseded": False,
        "undoneAt": "",
        "replacedByResponseId": "",
    }
    responses.append(response)
    save_validation_responses(dataset_dir, responses)
    session = validation_session({"datasetPath": str(dataset_dir)})
    return {"response": response, "session": session}


def undo_validation_response(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("dataset"))
    response_id = str(payload.get("responseId") or "")
    responses = load_validation_responses(dataset_dir)
    candidates = [row for row in responses if not row.get("superseded") and not row.get("undoneAt")]
    target = None
    if response_id:
        target = next((row for row in candidates if row.get("responseId") == response_id), None)
    if target is None and candidates:
        target = max(candidates, key=lambda row: str(row.get("answeredAt") or ""))
    if target is None:
        raise ValueError("No active validation response to undo.")
    target["undoneAt"] = utc_now_iso()
    save_validation_responses(dataset_dir, responses)
    return {"undone": target, "session": validation_session({"datasetPath": str(dataset_dir)})}


def export_validation_results_json(dataset_dir: Path) -> str:
    dataset = load_research_dataset(str(dataset_dir))
    responses = load_validation_responses(dataset_dir)
    active = active_validation_map(responses)
    cases_payload = []
    reviewed = 0
    valid_count = 0
    invalid_count = 0
    for case in validation_case_rows(dataset):
        case_id = str(case.get("caseId", ""))
        response = active.get(case_id)
        expected = validation_expected_rating(case)
        is_reviewed = response is not None
        dataset_valid = response.get("datasetValid") if response else None
        if is_reviewed:
            reviewed += 1
            if dataset_valid:
                valid_count += 1
            else:
                invalid_count += 1
        case_payload = {
            "caseId": case_id,
            "edfFile": Path(str(case.get("edfPath", ""))).name if case.get("edfPath") else "",
            "recordingId": case.get("recordingId", ""),
            "sourceGroup": case.get("sourceGroup", ""),
            "referenceLabel": case.get("referenceLabel", ""),
            "labelGroup": case.get("labelGroup", ""),
            "expectedRatingFromDataset": expected,
            "reviewed": is_reviewed,
            "datasetValid": dataset_valid,
            "datasetConsistent": response.get("datasetConsistent") if response else None,
            "expertRating": response.get("rating") if response else "",
            "validationMethod": response.get("validationMethod") if response else "",
            "answeredAt": response.get("answeredAt") if response else "",
            "responseId": response.get("responseId") if response else "",
        }
        cases_payload.append(case_payload)
    payload = {
        "exportVersion": "compact-1",
        "exportedAt": utc_now_iso(),
        "dataset": research_compact_dataset_payload(dataset, dataset_dir),
        "summary": {
            "totalEpochs": len(cases_payload),
            "reviewedEpochs": reviewed,
            "validEpochs": valid_count,
            "invalidEpochs": invalid_count,
            "unreviewedEpochs": max(0, len(cases_payload) - reviewed),
            "invalidCaseIds": [row.get("caseId", "") for row in cases_payload if row.get("datasetValid") is False],
        },
        "cases": cases_payload,
    }
    json_text = json.dumps(payload, ensure_ascii=False, indent=2, default=json_safe) + "\n"
    return json_text


def save_validation_results_json_to_desktop(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("dataset"))
    json_text = export_validation_results_json(dataset_dir)
    filename = safe_export_filename(str(payload.get("filename") or "validation_results.json"))
    return save_desktop_text_export(filename, json_text)


def save_research_response(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("dataset"))
    dataset = load_research_dataset(str(dataset_dir))
    reader_id = research_reader_id(payload.get("readerId"))
    phase = "1"
    case_id = str(payload.get("caseId") or "")
    raw_rating = str(payload.get("rating") or "")
    rating = RESEARCH_RATING_ALIASES.get(raw_rating.strip().lower(), raw_rating)
    if rating not in RESEARCH_RATINGS:
        raise ValueError("Unsupported research rating.")
    case = next((row for row in dataset.get("cases") or [] if row.get("caseId") == case_id), None)
    if not case:
        raise KeyError(f"Case not found: {case_id}")
    responses = load_research_responses(dataset_dir, reader_id)
    reader_profile = payload.get("readerProfile") if isinstance(payload.get("readerProfile"), dict) else {}
    montage_durations = research_montage_duration_payload(payload.get("montageDurationsSec"))
    montage_order = research_montage_order_payload(payload.get("montageOrder"))
    montage_sequence = research_montage_sequence_payload(payload.get("montageSequence"))
    montage_usage = research_montage_sequence_payload(payload.get("montageUsage"))
    montage_timeline = research_montage_sequence_payload(payload.get("montageTimeline"))
    montage_switches = research_montage_sequence_payload(payload.get("montageSwitches"))
    if not montage_sequence and montage_switches:
        montage_sequence = [
            {
                "index": int(row.get("index") or index),
                "montage": str(row.get("to") or ""),
                "atSec": row.get("atSec", 0),
            }
            for index, row in enumerate(montage_switches, start=1)
            if str(row.get("to") or "").strip()
        ]
    if not montage_order and montage_sequence:
        montage_order = [str(row.get("montage") or "").strip() for row in montage_sequence if str(row.get("montage") or "").strip()]
    displayed_montages = [str(item) for item in payload.get("displayedMontages", []) if str(item or "").strip()] if isinstance(payload.get("displayedMontages"), list) else list(montage_durations.keys())
    now = utc_now_iso()
    response_id = str(uuid.uuid4())
    for row in responses:
        if row.get("caseId") == case_id and str(row.get("phase")) == phase and not row.get("superseded") and not row.get("undoneAt"):
            row["superseded"] = True
            row["supersededAt"] = now
            row["replacedByResponseId"] = response_id
    answer_order = 1 + sum(
        1
        for row in responses
        if str(row.get("phase")) == phase and not row.get("superseded") and not row.get("undoneAt")
    )
    response = {
        "responseId": response_id,
        "readerId": reader_id,
        "caseId": case_id,
        "phase": phase,
        "answerOrder": answer_order,
        "rating": rating,
        "startedAt": payload.get("startedAt") or now,
        "answeredAt": payload.get("answeredAt") or now,
        "elapsedMs": int(float(payload.get("elapsedMs") or 0)),
        "testStartedAt": payload.get("testStartedAt") or "",
        "testCompletedAt": payload.get("testCompletedAt") or payload.get("answeredAt") or now,
        "totalElapsedMs": int(float(payload.get("totalElapsedMs") or 0)),
        "totalElapsedSec": float(payload.get("totalElapsedSec") or 0),
        "displayMode": payload.get("displayMode") or "phase1_single",
        "usedMontage": payload.get("usedMontage") or "",
        "finalMontage": payload.get("finalMontage") or payload.get("usedMontage") or "",
        "displayedMontages": displayed_montages,
        "montageDurationsSec": montage_durations,
        "montageDurationSummary": research_montage_duration_summary(montage_durations),
        "montageOrder": montage_order,
        "montageSequence": montage_sequence,
        "montageUsage": montage_usage,
        "montageOrderSummary": payload.get("montageOrderSummary") or ";".join(f"{index}:{montage}" for index, montage in enumerate(montage_order, start=1)),
        "montageUsageSummary": payload.get("montageUsageSummary") or ";".join(
            f"{int(row.get('index') or row.get('order') or index)}:{row.get('montage', '')}:{row.get('startSec', 0)}-{row.get('endSec', 0)}s({row.get('durationSec', 0)}s)"
            for index, row in enumerate(montage_usage, start=1)
        ),
        "montageTimeline": montage_timeline,
        "montageSwitches": montage_switches,
        "montageTimelineSummary": payload.get("montageTimelineSummary") or "",
        "montageSwitchSummary": payload.get("montageSwitchSummary") or "",
        "sensitivity": payload.get("sensitivity") or "",
        "tc": payload.get("tc") or "",
        "hf": payload.get("hf") or "",
        "timebaseSec": payload.get("timebaseSec") or "",
        "spikeMontage": payload.get("spikeMontage") or "",
        "readerProfile": reader_profile,
        "superseded": False,
        "undoneAt": "",
        "replacedByResponseId": "",
    }
    responses.append(response)
    save_research_responses(dataset_dir, reader_id, responses, payload.get("outputPath"), reader_profile)
    session = research_session({"datasetPath": str(dataset_dir), "readerId": reader_id, "phase": phase})
    return {"response": response, "session": session}


def undo_research_response(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("dataset"))
    reader_id = research_reader_id(payload.get("readerId"))
    response_id = str(payload.get("responseId") or "")
    responses = load_research_responses(dataset_dir, reader_id)
    candidates = [row for row in responses if not row.get("superseded") and not row.get("undoneAt")]
    target = None
    if response_id:
        target = next((row for row in candidates if row.get("responseId") == response_id), None)
    if target is None and candidates:
        target = max(candidates, key=lambda row: str(row.get("answeredAt") or ""))
    if target is None:
        raise ValueError("No active response to undo.")
    target["undoneAt"] = utc_now_iso()
    save_research_responses(dataset_dir, reader_id, responses, payload.get("outputPath"))
    return {"undone": target, "session": research_session({"datasetPath": str(dataset_dir), "readerId": reader_id, "phase": target.get("phase", "1")})}


def research_rating_correct(rating: str, label_group: str) -> bool | str:
    if rating == RESEARCH_RATING_UNKNOWN or not rating:
        return ""
    expected = RESEARCH_RATING_POSITIVE if label_group == "epileptiform" else RESEARCH_RATING_NEGATIVE
    return rating == expected


def research_montage_duration_payload(value: Any) -> dict[str, float]:
    if not isinstance(value, dict):
        return {}
    out: dict[str, float] = {}
    for key, raw in value.items():
        montage = str(key or "").strip()
        if not montage:
            continue
        try:
            seconds = float(raw)
        except (TypeError, ValueError):
            continue
        if seconds < 0:
            continue
        out[montage] = round(seconds, 3)
    return out


def research_montage_duration_summary(value: dict[str, Any]) -> str:
    rows = []
    for montage, seconds in sorted(value.items()):
        try:
            rows.append(f"{montage}:{float(seconds):.3f}")
        except (TypeError, ValueError):
            continue
    return ";".join(rows)


def research_montage_order_payload(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for raw in value:
        montage = str(raw or "").strip()
        if montage:
            out.append(montage)
    return out


def research_montage_sequence_payload(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, Any]] = []
    for index, row in enumerate(value, start=1):
        if not isinstance(row, dict):
            continue
        item: dict[str, Any] = {"index": int(row.get("index") or row.get("order") or index)}
        if "order" in row:
            item["order"] = int(row.get("order") or item["index"])
        for key in ("montage", "from", "to"):
            if key in row:
                item[key] = str(row.get(key) or "")
        for key in ("atSec", "startSec", "endSec", "durationSec"):
            if key not in row or row.get(key) in (None, ""):
                continue
            try:
                item[key] = round(float(row.get(key)), 3)
            except (TypeError, ValueError):
                item[key] = row.get(key)
        out.append(item)
    return out


def response_reader_profile(*responses: dict[str, Any]) -> dict[str, Any]:
    for response in responses:
        profile = response.get("readerProfile") if isinstance(response, dict) else None
        if isinstance(profile, dict) and profile:
            return profile
    return {}


def profile_value(profile: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = profile.get(key)
        if value not in (None, ""):
            return value
    return ""


def research_json_case_payload(case: dict[str, Any]) -> dict[str, Any]:
    row = dict(case)
    for key in ("phase2Montages", "topomapTime", "epochStart", "eventTime", "durationSec"):
        row.pop(key, None)
    return row


def research_json_response_payload(response: dict[str, Any]) -> dict[str, Any] | None:
    if str(response.get("phase") or "1") == "2":
        return None
    row = dict(response)
    row["phase"] = "1"
    if row.get("displayMode") == "phase2_4montage_topomap":
        row["displayMode"] = "phase1_single"
    for key in (
        "epochStart", "eventTime", "durationSec",
        "spikeTime", "spikeSampleIndex", "spikeSfreq", "spikeChannel",
        "clickedElectrode", "clickedCanvasX", "clickedCanvasY", "clickedRowIndex",
        "spikeMontageChannel", "selectedWaveformStart", "selectedWaveformDuration",
    ):
        row.pop(key, None)
    return row


def research_json_dataset_payload(dataset: dict[str, Any]) -> dict[str, Any]:
    payload = dict(dataset)
    payload["cases"] = [research_json_case_payload(row) for row in dataset.get("cases") or []]
    settings = dict(payload.get("settings") or {})
    settings.pop("phase2SampleEnabled", None)
    settings.pop("phase2FalsePositiveEnabled", None)
    payload["settings"] = settings
    return payload


def research_compact_reader_profile(profile: dict[str, Any]) -> dict[str, Any]:
    return {
        key: profile.get(key, "")
        for key in (
            "readerName", "email", "affiliation", "specialty", "position",
            "epilepsySpecialist", "clinicalNeurophysEegSpecialist",
            "medicalPracticeYears", "eegReadsPerMonth",
            "epilepsyCenterTraining", "epilepsyCenterTrainingDuration",
            "usualMontage",
        )
    }


def research_compact_dataset_payload(dataset: dict[str, Any], dataset_dir: Path) -> dict[str, Any]:
    cases = [row for row in research_case_rows(dataset) if bool(row.get("include", True))]
    settings = dataset.get("settings") if isinstance(dataset.get("settings"), dict) else {}
    return {
        "datasetId": dataset.get("datasetId", ""),
        "name": dataset.get("name", ""),
        "createdAt": dataset.get("createdAt", ""),
        "version": dataset.get("version", ""),
        "questionCount": research_phase1_total_count(settings),
        "includedCaseCount": len(cases),
        "groupCounts": {
            group: sum(1 for row in cases if row.get("labelGroup") == group)
            for group in ("epileptiform", "non_epileptiform")
        },
        "settings": {
            "epochDurationSec": settings.get("epochDurationSec", 10),
            "phase1Montage": settings.get("phase1Montage", ""),
            "phase1TotalSampleCount": research_phase1_total_count(settings),
        },
    }


def research_compact_response_payload(response: dict[str, Any], case: dict[str, Any] | None) -> dict[str, Any] | None:
    row = research_json_response_payload(response)
    if row is None:
        return None
    label_group = str(case.get("labelGroup") if case else "")
    edf_path = str(case.get("edfPath", "") if case else "")
    rating = str(row.get("rating", ""))
    correct = research_rating_correct(rating, label_group) if label_group else ""
    montage_usage = row.get("montageUsage")
    if not isinstance(montage_usage, list) or not montage_usage:
        montage_usage = row.get("montageTimeline") if isinstance(row.get("montageTimeline"), list) else []
    return {
        "answerOrder": row.get("answerOrder", ""),
        "caseId": row.get("caseId", ""),
        "edfFile": Path(edf_path).name if edf_path else "",
        "recordingId": case.get("recordingId", "") if case else "",
        "sourceGroup": case.get("sourceGroup", "") if case else "",
        "labelGroup": label_group,
        "referenceLabel": case.get("referenceLabel", "") if case else "",
        "rating": rating,
        "correct": correct,
        "startedAt": row.get("startedAt", ""),
        "answeredAt": row.get("answeredAt", ""),
        "elapsedMs": row.get("elapsedMs", ""),
        "testStartedAt": row.get("testStartedAt", ""),
        "testCompletedAt": row.get("testCompletedAt", ""),
        "totalElapsedMs": row.get("totalElapsedMs", ""),
        "totalElapsedSec": row.get("totalElapsedSec", ""),
        "display": {
            "displayMode": row.get("displayMode", ""),
            "finalMontage": row.get("finalMontage") or row.get("usedMontage", ""),
            "displayedMontages": row.get("displayedMontages", []),
            "sensitivity": row.get("sensitivity", ""),
            "tc": row.get("tc", ""),
            "hf": row.get("hf", ""),
            "timebaseSec": row.get("timebaseSec", ""),
        },
        "montageUsage": montage_usage,
        "montageUsageSummary": row.get("montageUsageSummary", ""),
    }


def research_reader_timing_summary(responses: list[dict[str, Any]]) -> dict[str, Any]:
    starts = [str(row.get("testStartedAt") or "") for row in responses if str(row.get("testStartedAt") or "").strip()]
    completions = [str(row.get("testCompletedAt") or row.get("answeredAt") or "") for row in responses if str(row.get("testCompletedAt") or row.get("answeredAt") or "").strip()]
    elapsed_values = []
    for row in responses:
        try:
            value = int(float(row.get("totalElapsedMs") or 0))
        except (TypeError, ValueError):
            value = 0
        if value > 0:
            elapsed_values.append(value)
    total_elapsed_ms = max(elapsed_values) if elapsed_values else 0
    return {
        "testStartedAt": min(starts) if starts else "",
        "testCompletedAt": max(completions) if completions else "",
        "totalElapsedMs": total_elapsed_ms,
        "totalElapsedSec": round(total_elapsed_ms / 1000, 3) if total_elapsed_ms else 0,
    }


def research_reader_summary(responses: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(responses)
    correct_count = sum(1 for row in responses if row.get("correct") is True)
    incorrect_count = sum(1 for row in responses if row.get("correct") is False)
    unknown_count = sum(1 for row in responses if row.get("rating") == RESEARCH_RATING_UNKNOWN)
    return {
        "totalAnswered": total,
        "correct": correct_count,
        "incorrect": incorrect_count,
        "unknown": unknown_count,
        "accuracy": round(correct_count / total, 4) if total else None,
        "timing": research_reader_timing_summary(responses),
    }


def export_research_responses_json(dataset_dir: Path, reader_id: str | None = None) -> str:
    dataset = load_research_dataset(str(dataset_dir))
    reader_ids = [research_reader_id(reader_id)] if reader_id else [p.stem for p in (dataset_dir / "responses").glob("*.json")]
    case_by_id = {str(row.get("caseId", "")): row for row in research_case_rows(dataset)}
    readers = []
    for rid in reader_ids:
        responses = load_research_responses(dataset_dir, rid)
        active = active_response_map(responses)
        compact_responses = [
            row for row in (
                research_compact_response_payload(response, case_by_id.get(str(response.get("caseId", ""))))
                for response in active.values()
            )
            if row is not None
        ]
        compact_responses = sorted(
            compact_responses,
            key=lambda row: (int(row.get("answerOrder") or 0), str(row.get("answeredAt", "")), str(row.get("caseId", ""))),
        )
        profile = response_reader_profile(*active.values())
        readers.append({
            "readerId": rid,
            "readerProfile": research_compact_reader_profile(profile),
            "summary": research_reader_summary(compact_responses),
            "responses": compact_responses,
        })
    payload = {
        "exportVersion": "compact-1",
        "exportedAt": utc_now_iso(),
        "dataset": research_compact_dataset_payload(dataset, dataset_dir),
        "readers": readers,
    }
    json_text = json.dumps(payload, ensure_ascii=False, indent=2, default=json_safe) + "\n"
    return json_text


def save_research_responses_json_to_desktop(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("dataset"))
    reader_id = str(payload.get("readerId") or "").strip() or None
    json_text = export_research_responses_json(dataset_dir, reader_id)
    filename = str(payload.get("filename") or "").strip()
    if not filename:
        profile = {}
        if reader_id:
            responses = load_research_responses(dataset_dir, reader_id)
            profile = response_reader_profile(*responses)
        filename = research_reader_json_filename(reader_id, profile)
    return save_desktop_text_export(filename, json_text)


def unique_submission_path(dataset_id: str, filename: str) -> Path:
    dataset_part = safe_filename_part(dataset_id or "dataset", "dataset")
    target_dir = SUBMITTED_RESULTS_DIR / dataset_part
    target_dir.mkdir(parents=True, exist_ok=True)
    base_name = safe_export_filename(filename or "EEG_test_results.json")
    if not base_name.lower().endswith(".json"):
        base_name = f"{Path(base_name).stem or 'EEG_test_results'}.json"
    target = target_dir / base_name
    if not target.exists():
        return target
    stem = target.stem
    suffix = target.suffix
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = target.with_name(f"{stem}_{timestamp}{suffix}")
    if not candidate.exists():
        return candidate
    for index in range(2, 1000):
        candidate = target.with_name(f"{stem}_{timestamp}_{index}{suffix}")
        if not candidate.exists():
            return candidate
    raise ValueError("Could not create a unique submission filename")


def save_research_result_submission(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_dir = research_dataset_path(payload.get("datasetPath") or payload.get("dataset"))
    dataset = load_research_dataset(str(dataset_dir))
    reader_id = str(payload.get("readerId") or "").strip() or None
    json_text = export_research_responses_json(dataset_dir, reader_id)
    filename = str(payload.get("filename") or "").strip()
    if not filename:
        profile = {}
        if reader_id:
            responses = load_research_responses(dataset_dir, reader_id)
            profile = response_reader_profile(*responses)
        filename = research_reader_json_filename(reader_id, profile)
    target = unique_submission_path(str(dataset.get("datasetId") or dataset_dir.name), filename)
    target.write_text(json_text, encoding="utf-8")
    return {
        "ok": True,
        "submittedAt": utc_now_iso(),
        "submissionId": target.relative_to(SUBMITTED_RESULTS_DIR).as_posix(),
        "path": str(target),
        "filename": target.name,
        "sizeBytes": len(json_text.encode("utf-8")),
        "datasetId": dataset.get("datasetId", ""),
        "readerId": research_reader_id(reader_id or "reader"),
    }


def required(qs: dict[str, list[str]], name: str) -> str:
    value = qs.get(name, [""])[0]
    if value == "":
        raise ValueError(f"Missing required query parameter: {name}")
    return value

class EEGRequestHandler(BaseHTTPRequestHandler):
    store: RecordingStore

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def send_security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            "connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        )

    def send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=json_safe).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, content_type: str = "text/plain; charset=utf-8") -> None:
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def safe_return_path(self, value: str = "") -> str:
        raw = str(value or self.path or "/")
        parsed = urlparse(raw)
        if parsed.scheme or parsed.netloc:
            return "/"
        if parsed.path == LOGIN_PATH:
            return "/"
        path = parsed.path or "/"
        query = f"?{parsed.query}" if parsed.query else ""
        return f"{path}{query}"

    def login_page_html(self, message: str = "") -> str:
        next_path = self.safe_return_path()
        error_html = f"<p class='error'>{message}</p>" if message else ""
        return f"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EEG Test Viewer Login</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ margin:0; min-height:100vh; display:grid; place-items:center; font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f4f6f8; color:#162033; }}
  main {{ width:min(420px, calc(100vw - 32px)); background:#fff; border:1px solid #d7dde5; border-radius:8px; padding:28px; box-shadow:0 12px 32px rgba(20,31,47,.10); }}
  h1 {{ margin:0 0 8px; font-size:24px; }}
  p {{ margin:0 0 18px; color:#4d5a6a; line-height:1.5; }}
  label {{ display:block; font-size:13px; font-weight:700; color:#263241; margin-bottom:8px; }}
  input {{ width:100%; box-sizing:border-box; border:1px solid #b8c2cf; border-radius:6px; padding:12px; font-size:18px; }}
  button {{ width:100%; margin-top:16px; border:0; border-radius:6px; padding:12px 14px; background:#174ea6; color:white; font-weight:700; font-size:16px; cursor:pointer; }}
  button:hover {{ background:#123f86; }}
  .error {{ color:#b42318; background:#fff1f0; border:1px solid #ffccc7; border-radius:6px; padding:10px 12px; }}
</style>
<main>
  <h1>EEG Test Viewer</h1>
  <p>テストを開始するにはパスワードを入力してください。</p>
  {error_html}
  <form method="post" action="{LOGIN_PATH}">
    <input type="hidden" name="next" value="{html_escape(next_path)}">
    <label for="password">パスワード</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
    <button type="submit">開始する</button>
  </form>
</main>
"""

    def send_auth_required(self, message: str = "Password is required.") -> None:
        if self.path.startswith("/api/"):
            body = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
            content_type = "application/json; charset=utf-8"
        else:
            body = self.login_page_html("" if message == "Password is required." else message).encode("utf-8")
            content_type = "text/html; charset=utf-8"
        self.send_response(HTTPStatus.UNAUTHORIZED)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def cookie_value(self, name: str) -> str:
        raw = self.headers.get("Cookie", "")
        for part in raw.split(";"):
            key, sep, value = part.strip().partition("=")
            if sep and key == name:
                return unquote(value)
        return ""

    def access_code_from_query(self) -> str:
        return ""

    def redirect_without_access_code(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs.pop("access", None)
        qs.pop("code", None)
        clean_query = urlencode([(key, value) for key, values in qs.items() for value in values])
        clean_url = urlunparse(("", "", parsed.path or "/", "", clean_query, ""))
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", clean_url or "/")
        self.send_header("Set-Cookie", "eeg_viewer_access=ok; Path=/; HttpOnly; SameSite=Lax")
        self.send_security_headers()
        self.end_headers()

    def access_code_allowed(self) -> bool:
        if not ACCESS_CODE:
            return False
        query_code = self.access_code_from_query()
        if query_code and secrets.compare_digest(query_code, ACCESS_CODE):
            return True
        return secrets.compare_digest(self.cookie_value("eeg_viewer_access"), "ok")

    def access_allowed(self) -> tuple[bool, str]:
        if not PUBLIC_MODE:
            return True, ""
        if not ACCESS_CODE and not ACCESS_PASSWORD and not ALLOW_UNPROTECTED_PUBLIC:
            return False, "Public mode requires EEG_VIEWER_ACCESS_CODE."
        if self.access_code_allowed():
            return True, ""
        if not ACCESS_PASSWORD:
            if ALLOW_UNPROTECTED_PUBLIC:
                return True, ""
            return False, "Password is required."
        header = self.headers.get("Authorization", "")
        if not header.startswith("Basic "):
            return False, "Password is required."
        try:
            decoded = base64.b64decode(header.removeprefix("Basic ").strip(), validate=True).decode("utf-8")
        except Exception:
            return False, "Invalid authentication header."
        username, sep, password = decoded.partition(":")
        if not sep:
            return False, "Invalid authentication header."
        username_ok = not ACCESS_USER or secrets.compare_digest(username, ACCESS_USER)
        if not (username_ok and secrets.compare_digest(password, ACCESS_PASSWORD)):
            return False, "Invalid password."
        return True, ""

    def handle_access_link(self) -> bool:
        if not PUBLIC_MODE or not ACCESS_CODE:
            return False
        query_code = self.access_code_from_query()
        if query_code and secrets.compare_digest(query_code, ACCESS_CODE):
            self.redirect_without_access_code()
            return True
        return False

    def send_login_success(self, next_path: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", self.safe_return_path(next_path))
        self.send_header("Set-Cookie", "eeg_viewer_access=ok; Path=/; HttpOnly; SameSite=Lax")
        self.send_security_headers()
        self.end_headers()

    def handle_login_post(self) -> bool:
        parsed = urlparse(self.path)
        if parsed.path != LOGIN_PATH:
            return False
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length > 8192:
            return self.send_auth_required("Request is too large.") or True
        ctype = self.headers.get("Content-Type", "")
        raw = self.rfile.read(length).decode("utf-8", errors="replace") if length else ""
        if "application/json" in ctype:
            try:
                payload = json.loads(raw or "{}")
            except Exception:
                payload = {}
            password = str(payload.get("password") or payload.get("accessCode") or "")
            next_path = self.safe_return_path(str(payload.get("next") or "/"))
        else:
            form = parse_qs(raw, keep_blank_values=True)
            password = form.get("password", [""])[0]
            next_path = self.safe_return_path(form.get("next", ["/"])[0])
        expected = ACCESS_CODE or ACCESS_PASSWORD
        if expected and secrets.compare_digest(password, expected):
            self.send_login_success(next_path)
            return True
        body = self.login_page_html("パスワードが違います。").encode("utf-8")
        self.send_response(HTTPStatus.UNAUTHORIZED)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)
        return True

    def local_request_allowed(self) -> tuple[bool, str]:
        if PUBLIC_MODE:
            return True, ""
        client_host = str(self.client_address[0]) if self.client_address else ""
        if client_host not in {"127.0.0.1", "::1"}:
            return False, "API requests are limited to this Mac."
        origin = self.headers.get("Origin", "")
        if origin:
            parsed = urlparse(origin)
            origin_host = parsed.hostname or ""
            origin_port = parsed.port or (443 if parsed.scheme == "https" else 80)
            server_port = int(getattr(self.server, "server_port", 8765))
            if origin_host not in LOCAL_HOSTNAMES or origin_port != server_port:
                return False, "Cross-site request blocked."
        return True, ""

    def mutation_allowed(self, path: str) -> tuple[bool, str]:
        allowed, reason = self.local_request_allowed()
        if not allowed:
            return False, reason
        token = self.headers.get("X-EEG-Viewer-Token", "")
        if not secrets.compare_digest(token, SERVER_TOKEN):
            return False, "Missing or invalid request token. Reload EEG Viewer and try again."
        return True, ""

    def do_GET(self) -> None:
        try:
            if self.handle_access_link():
                return
            allowed, reason = self.access_allowed()
            if not allowed:
                return self.send_auth_required(reason)
            parsed = urlparse(self.path)
            path = unquote(parsed.path)
            qs = parse_qs(parsed.query)
            if path == "/":
                return self.serve_static(STATIC_DIR / "index.html")
            if path.startswith("/static/"):
                return self.serve_static(STATIC_DIR / path.removeprefix("/static/"))
            if path.startswith("/api/"):
                allowed, reason = self.local_request_allowed()
                if not allowed:
                    if path.startswith("/api/"):
                        return self.send_json({"error": reason}, status=403)
                    return self.send_error(HTTPStatus.FORBIDDEN, reason)
                if path not in TOKEN_EXEMPT_GET_PATHS:
                    token = self.headers.get("X-EEG-Viewer-Token", "")
                    if not secrets.compare_digest(token, SERVER_TOKEN):
                        return self.send_json({"error": "Missing or invalid request token. Reload EEG Viewer and try again."}, status=403)
            if path == "/api/health":
                return self.send_json(
                    {
                        "ok": True,
                        "mneAvailable": package_available("mne"),
                        "scipyAvailable": package_available("scipy"),
                        "fdsDir": str(self.store.fds_dir),
                        "appRoot": str(APP_ROOT),
                        "userDataDir": str(USER_DATA_DIR),
                        "researchDir": str(RESEARCH_DIR),
                        "privateDatasetDir": str(PRIVATE_DATASET_DIR),
                        "allowedResearchWriteRoots": [str(root) for root in ALLOWED_RESEARCH_WRITE_ROOTS],
                        "buildInfo": app_build_info(),
                        "appFingerprint": app_fingerprint(),
                    }
                )
            if path == "/api/recordings":
                if qs.get("refresh", ["0"])[0] == "1":
                    self.store.refresh()
                else:
                    self.store.refresh_if_stale()
                return self.send_json([recording_payload(rec) for rec in self.store.recordings])
            if path == "/api/recording":
                return self.send_json(self.store.metadata(required(qs, "id")))
            if path == "/api/window":
                return self.send_json(
                    self.store.window(
                        required(qs, "id"),
                        float(qs.get("start", ["0"])[0]),
                        float(qs.get("duration", ["10"])[0]),
                        qs.get("montage", ["longitudinal"])[0],
                        qs.get("tc", ["0.3"])[0],
                        qs.get("hf", ["120"])[0],
                        qs.get("ac", ["50"])[0],
                        qs.get("ecg", ["1"])[0] == "1",
                        qs.get("ecgFilter", ["0"])[0] == "1",
                        qs.get("topomap", ["1"])[0] != "0",
                    )
                )
            if path == "/api/research/dataset":
                dataset = load_research_dataset(qs.get("path", qs.get("dataset", [""]))[0])
                return self.send_json(dataset)
            if path == "/api/research/test/session":
                return self.send_json(research_session({
                    "datasetPath": qs.get("dataset", qs.get("path", [""]))[0],
                    "readerId": qs.get("readerId", ["reader"])[0],
                    "phase": qs.get("phase", ["1"])[0],
                }))
            if path == "/api/research/test/export.json":
                dataset_dir = research_dataset_path(qs.get("dataset", qs.get("path", [""]))[0])
                reader = qs.get("readerId", [""])[0] or None
                return self.send_text(export_research_responses_json(dataset_dir, reader), "application/json; charset=utf-8")
            if path == "/api/research/validation/session":
                return self.send_json(validation_session({
                    "datasetPath": qs.get("dataset", qs.get("path", [""]))[0],
                }))
            if path == "/api/research/validation/export.json":
                dataset_dir = research_dataset_path(qs.get("dataset", qs.get("path", [""]))[0])
                return self.send_text(export_validation_results_json(dataset_dir), "application/json; charset=utf-8")
            if path == "/api/annotations":
                return self.send_json(load_annotations(required(qs, "id")))
            if path == "/api/annotations.json":
                record_id = required(qs, "id")
                return self.send_json(annotation_export_rows(self.store, record_id))
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
        except Exception as exc:
            traceback.print_exc()
            self.send_json({"error": str(exc)}, status=500)

    def do_POST(self) -> None:
        try:
            if self.handle_access_link():
                return
            if self.handle_login_post():
                return
            allowed, reason = self.access_allowed()
            if not allowed:
                return self.send_auth_required(reason)
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            if parsed.path.startswith("/api/"):
                allowed, reason = self.mutation_allowed(parsed.path)
                if not allowed:
                    return self.send_json({"error": reason}, status=403)
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json({"error": "Invalid Content-Length."}, status=400)
            max_body = MAX_EXPORT_POST_BODY_BYTES if parsed.path in {"/api/export-file", "/api/save-desktop", "/api/admin/private-dataset/upload"} else MAX_POST_BODY_BYTES
            if length > max_body:
                return self.send_json({"error": "Request body is too large."}, status=413)
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            if parsed.path == "/api/open-file":
                return self.send_json(self.store.add_path(normalize_path_input(payload.get("path", ""))))
            if parsed.path in {"/api/export-file", "/api/save-desktop"}:
                return self.send_json(save_desktop_export(payload))
            if parsed.path == "/api/research/dataset/create":
                return self.send_json(create_research_dataset(payload))
            if parsed.path == "/api/research/dataset/item":
                return self.send_json(update_research_dataset_item(payload))
            if parsed.path == "/api/research/dataset/cut":
                return self.send_json(add_research_dataset_cut(payload))
            if parsed.path == "/api/research/test/response":
                return self.send_json(save_research_response(payload))
            if parsed.path == "/api/research/test/response/undo":
                return self.send_json(undo_research_response(payload))
            if parsed.path == "/api/research/test/export-file":
                return self.send_json(save_research_responses_json_to_desktop(payload))
            if parsed.path == "/api/research/test/submit-result":
                return self.send_json(save_research_result_submission(payload))
            if parsed.path == "/api/research/validation/response":
                return self.send_json(save_validation_response(payload))
            if parsed.path == "/api/research/validation/response/undo":
                return self.send_json(undo_validation_response(payload))
            if parsed.path == "/api/research/validation/export-file":
                return self.send_json(save_validation_results_json_to_desktop(payload))
            if parsed.path == "/api/admin/private-dataset/upload":
                return self.send_json(upload_private_dataset(payload))
            if parsed.path != "/api/annotations":
                return self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            record_id = required(qs, "id")
            annotations = load_annotations(record_id)
            action = payload.get("action", "add")
            if action == "add":
                annotation = dict(payload.get("annotation", {}))
                annotation.setdefault("id", str(uuid.uuid4()))
                annotation.setdefault("recordingId", record_id)
                annotation.setdefault("createdAt", datetime.now(timezone.utc).isoformat())
                annotations.append(annotation)
            elif action == "update":
                annotation = dict(payload.get("annotation", {}))
                annotations = [annotation if row.get("id") == annotation.get("id") else row for row in annotations]
            elif action == "delete":
                delete_id = payload.get("id")
                annotations = [row for row in annotations if row.get("id") != delete_id]
            elif action == "replace":
                annotations = normalize_annotations(record_id, list(payload.get("annotations", [])))
            else:
                raise ValueError(f"Unsupported annotation action: {action}")
            annotations = normalize_annotations(record_id, annotations)
            annotations.sort(key=lambda row: float(row.get("onset", 0) or 0))
            save_annotations(record_id, annotations)
            self.send_json(annotations)
        except Exception as exc:
            traceback.print_exc()
            self.send_json({"error": str(exc)}, status=500)

    def serve_static(self, path: Path) -> None:
        try:
            resolved = path.resolve()
        except OSError:
            return self.send_error(HTTPStatus.NOT_FOUND, "Not found")
        if not path_is_relative_to(resolved, STATIC_DIR):
            return self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
        if not resolved.exists() or not resolved.is_file():
            return self.send_error(HTTPStatus.NOT_FOUND, "Not found")
        ctype = mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
        if resolved == (STATIC_DIR / "index.html").resolve():
            body = resolved.read_text(encoding="utf-8").replace("__EEG_VIEWER_TOKEN__", SERVER_TOKEN).encode("utf-8")
            ctype = "text/html; charset=utf-8"
        else:
            body = resolved.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the EEG Viewer local server.")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8765")))
    parser.add_argument("--fds-dir", type=Path, default=DEFAULT_FDS_DIR)
    parser.add_argument("--edf-dir", action="append", type=Path, default=[])
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    fds_dir = Path(args.fds_dir).expanduser().resolve()
    edf_dirs = [Path(path).expanduser().resolve() for path in args.edf_dir]
    ANNOTATION_DIR.mkdir(parents=True, exist_ok=True)
    RESEARCH_DATASET_DIR.mkdir(parents=True, exist_ok=True)
    PRIVATE_DATASET_DIR.mkdir(parents=True, exist_ok=True)
    SUBMITTED_RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    store = RecordingStore(fds_dir, edf_dirs)
    store.refresh()
    EEGRequestHandler.store = store

    server = ThreadingHTTPServer((args.host, args.port), EEGRequestHandler)
    url = f"http://{args.host}:{args.port}/"
    print(f"EEG Viewer serving {url}", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
