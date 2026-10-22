"""Public configuration only. / 公開設定だけの整合性テスト。"""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from tools.check_dataset_config import ROOT, check_dataset_config


class DatasetConfigTests(unittest.TestCase):
    def test_current_configuration(self):
        self.assertTrue(check_dataset_config(ROOT)["ok"])

    def test_changed_frontend_without_allowlist_is_rejected(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("static/app.js", "static/index.html", "APP_ID.json", "app.py", "render.yaml"):
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                text = (ROOT / name).read_text(encoding="utf-8")
                if name in ("static/app.js", "static/index.html", "APP_ID.json"):
                    text = text.replace("validation_v1", "synthetic_next")
                target.write_text(text, encoding="utf-8")
            result = check_dataset_config(root)
            self.assertFalse(result["ok"])
            self.assertTrue(any("render.yaml" in issue for issue in result["issues"]))
            self.assertTrue(any("app.py fallback" in issue for issue in result["issues"]))

    def test_supplied_deployment_list_is_checked(self):
        result = check_dataset_config(ROOT, public_ids="synthetic_other")
        self.assertFalse(result["ok"])
        self.assertTrue(any("supplied deployment" in issue for issue in result["issues"]))


if __name__ == "__main__":
    unittest.main()
