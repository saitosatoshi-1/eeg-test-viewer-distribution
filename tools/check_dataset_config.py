#!/usr/bin/env python3
"""Read-only dataset consistency check. / 公開設定のみを読む整合性検査。"""
from __future__ import annotations

import argparse
import ast
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]


def check_dataset_config(root: Path, expected_id: str = "", public_ids: str | None = None) -> dict:
    issues = []
    defaults = {}
    script = (root / "static/app.js").read_text(encoding="utf-8")
    for name in ("DEFAULT_PUBLIC_TEST_DATASET_PATH", "DEFAULT_PUBLIC_VALIDATION_DATASET_PATH"):
        match = re.search(rf'const {name} = "private:([^"\n]+)";', script)
        defaults[name] = match.group(1) if match else ""
    html = (root / "static/index.html").read_text(encoding="utf-8")
    match = re.search(r'id="researchSetupDatasetPathInput"[^>]*value="private:([^"\n]+)"', html)
    defaults["HTML"] = match.group(1) if match else ""
    identity = json.loads((root / "APP_ID.json").read_text(encoding="utf-8"))
    defaults["APP_ID.dataset"] = str(identity.get("dataset", "")).removeprefix("private:")
    defaults["APP_ID.sharedTestLink"] = parse_qs(urlparse(identity.get("sharedTestLink", "")).query).get("dataset", [""])[0].removeprefix("private:")
    expected_id = expected_id or defaults["DEFAULT_PUBLIC_TEST_DATASET_PATH"]
    if not expected_id:
        issues.append("Could not determine the expected dataset ID. / 既定IDを取得できません。")
    for name, value in defaults.items():
        if not value or value != expected_id:
            issues.append(f"{name}: expected {expected_id!r}, found {value!r}")

    # Parse the known literal env entry, not arbitrary YAML. Fail on unsupported syntax.
    # 現行の単純なvalue記法だけを検査し、不明な構文は成功扱いしない。
    render = (root / "render.yaml").read_text(encoding="utf-8")
    match = re.search(r'(?m)^\s*- key: EEG_VIEWER_PUBLIC_DATASET_IDS\s*\n\s+value: ([^\n#]+)', render)
    allowed = {"render.yaml": match.group(1).strip().strip("\"'") if match else ""}
    tree = ast.parse((root / "app.py").read_text(encoding="utf-8"))
    values = [node.args[1].value for node in ast.walk(tree)
              if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
              and node.func.attr == "get" and isinstance(node.func.value, ast.Attribute)
              and isinstance(node.func.value.value, ast.Name) and node.func.value.value.id == "os"
              and node.func.value.attr == "environ" and len(node.args) >= 2
              and isinstance(node.args[0], ast.Constant) and node.args[0].value == "EEG_VIEWER_PUBLIC_DATASET_IDS"
              and isinstance(node.args[1], ast.Constant)]
    allowed["app.py fallback"] = str(values[0]) if len(values) == 1 else ""
    if public_ids is not None:
        allowed["supplied deployment allowlist"] = public_ids
    for name, value in allowed.items():
        if not expected_id or expected_id not in {item.strip() for item in value.split(",") if item.strip()}:
            issues.append(f"{name}: dataset {expected_id!r} is not allowed")
    return {"ok": not issues, "datasetId": expected_id, "issues": issues,
            "scope": "Local public configuration only; Render state and EDF contents are not checked."}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-id", default="")
    parser.add_argument("--public-dataset-ids", default=None, help="Optional non-secret deployment allowlist / 本番の公開ID一覧")
    args = parser.parse_args()
    result = check_dataset_config(ROOT, args.expected_id, args.public_dataset_ids)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
