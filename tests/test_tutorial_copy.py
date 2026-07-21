from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_practice_one_target_message_uses_center_and_is_emphasized() -> None:
    index_html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    styles_css = (ROOT / "static" / "styles.css").read_text(encoding="utf-8")

    expected = "判定して頂きたい波形は、画面の中心にくるように表示してあります。"
    assert expected in index_html
    assert "画面の真ん中にくる" not in index_html
    assert 'class="research-tutorial-target-emphasis"' in index_html
    assert ".research-tutorial-target-emphasis" in styles_css
