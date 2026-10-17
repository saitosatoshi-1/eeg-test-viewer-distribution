from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_average_reference_labels_are_displayed_as_av() -> None:
    viewer_utils = (ROOT / "static" / "viewer_utils.js").read_text(encoding="utf-8")
    app_js = (ROOT / "static" / "app.js").read_text(encoding="utf-8")

    assert '.replace(/-AVG$/i, "-AV")' in viewer_utils
    assert "nkLabel(state.windowData.traces[0].label)" in app_js


def test_consent_screen_remains_without_in_test_explanation_button() -> None:
    """開始前の同意を維持し、テスト中の説明再表示だけを削除する。"""
    html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    source = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    assert 'id="researchIcExplanation"' in html
    assert 'id="researchIcConsentInput"' in html
    assert "researchExplanationOpenBtn" not in html + source
    assert "researchExplanationDialog" not in html + source
