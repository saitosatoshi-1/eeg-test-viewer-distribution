#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import io
from pathlib import Path
from typing import Any
from zipfile import ZipFile


def path_is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def private_dataset_payload(dataset_dir: Path, dataset_id: str, name: str = "", created_at: str = "") -> dict[str, Any]:
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
        "createdAt": created_at,
        "settings": {
            "phase1TotalSampleCount": 20,
            "phase1Montage": "conventional",
            "epochDurationSec": 10,
        },
        "cases": cases,
    }


def extract_private_dataset_zip(zip_bytes: bytes, target_dir: Path) -> None:
    with ZipFile(io.BytesIO(zip_bytes)) as archive:
        for member in archive.infolist():
            member_path = Path(member.filename)
            if member_path.is_absolute() or ".." in member_path.parts:
                raise ValueError("Private dataset zip contains an unsafe path.")
            destination = (target_dir / member.filename).resolve()
            if not path_is_relative_to(destination, target_dir.resolve()):
                raise ValueError("Private dataset zip contains an unsafe path.")
        archive.extractall(target_dir)
