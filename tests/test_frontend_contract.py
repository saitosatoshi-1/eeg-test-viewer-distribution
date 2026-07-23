from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_average_reference_labels_are_displayed_as_av() -> None:
    viewer_utils = (ROOT / "static" / "viewer_utils.js").read_text(encoding="utf-8")
    app_js = (ROOT / "static" / "app.js").read_text(encoding="utf-8")

    assert '.replace(/-AVG$/i, "-AV")' in viewer_utils
    assert "nkLabel(state.windowData.traces[0].label)" in app_js
