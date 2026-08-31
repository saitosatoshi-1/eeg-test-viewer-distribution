from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import app


def test_success_response_is_returned_only_after_result_json_is_written(tmp_path: Path) -> None:
    dataset_dir = tmp_path / "dataset"
    dataset_dir.mkdir()
    submitted_dir = tmp_path / "submitted_results"
    exported = json.dumps({
        "readerId": "reader-1",
        "assignment": {"formId": "A", "orderVersion": "A1"},
        "responses": [{"caseId": "ied-001", "rating": "てんかん性異常あり"}],
    }, ensure_ascii=False)

    with (
        patch.object(app, "SUBMITTED_RESULTS_DIR", submitted_dir),
        patch.object(app, "research_dataset_path", return_value=dataset_dir),
        patch.object(app, "load_research_dataset", return_value={"datasetId": "fixture"}),
        patch.object(app, "export_research_responses_json", return_value=exported),
    ):
        result = app.save_research_result_submission({
            "datasetPath": "private:fixture",
            "readerId": "reader-1",
            "filename": "reader-1.json",
        })

    saved = submitted_dir / result["submissionId"]
    assert result["ok"] is True
    assert result["filename"] == "reader-1.json"
    assert result["readerId"] == "reader-1"
    assert result["sizeBytes"] == len(exported.encode("utf-8"))
    assert saved.read_text(encoding="utf-8") == exported
