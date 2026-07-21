from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_ac_filter_is_fixed_to_60_hz_and_not_rendered_as_a_control() -> None:
    index_html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    app_js = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
    app_py = (ROOT / "app.py").read_text(encoding="utf-8")

    assert 'id="acSelect"' not in index_html
    assert "ac-control" not in index_html
    assert 'const FIXED_AC_FILTER = "60";' in app_js
    assert "ac: FIXED_AC_FILTER" in app_js
    assert "els.acSelect" not in app_js
    assert "· AC" not in index_html
    assert "· AC" not in app_js
    assert 'FIXED_AC_FILTER = "60"' in app_py
    assert 'qs.get("ac"' not in app_py
