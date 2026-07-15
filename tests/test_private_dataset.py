from __future__ import annotations

import io
from pathlib import Path
from zipfile import ZipFile

from research_private_dataset import extract_private_dataset_zip, private_dataset_payload


def test_private_dataset_payload_counts_groups(tmp_path: Path) -> None:
    epilepsy = tmp_path / "edf" / "epilepsy"
    no_epilepsy = tmp_path / "edf" / "no_epilepsy"
    epilepsy.mkdir(parents=True)
    no_epilepsy.mkdir(parents=True)
    (epilepsy / "ied_a.edf").write_bytes(b"")
    (no_epilepsy / "artifact_a.edf").write_bytes(b"")

    payload = private_dataset_payload(tmp_path, "validation_unit", "Validation Unit", "2026-07-15T00:00:00Z")

    assert payload["datasetId"] == "validation_unit"
    assert len(payload["cases"]) == 2
    assert {row["sourceGroup"] for row in payload["cases"]} == {"epilepsy", "no_epilepsy"}


def test_extract_private_dataset_zip_rejects_unsafe_path(tmp_path: Path) -> None:
    raw = io.BytesIO()
    with ZipFile(raw, "w") as archive:
        archive.writestr("../escape.edf", b"")

    try:
        extract_private_dataset_zip(raw.getvalue(), tmp_path)
    except ValueError as exc:
        assert "unsafe path" in str(exc)
    else:
        raise AssertionError("unsafe zip member was accepted")
