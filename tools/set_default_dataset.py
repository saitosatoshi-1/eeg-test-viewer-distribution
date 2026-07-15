#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RENDER_URL = "https://eeg-test-viewer.onrender.com/"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text_if_changed(path: Path, text: str) -> bool:
    old = read_text(path)
    if old == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def private_path(dataset_id: str) -> str:
    return f"private:{dataset_id}"


def encoded_link(dataset_id: str) -> str:
    return f"{RENDER_URL}?dataset=private%3A{dataset_id}"


def update_static_app(dataset_id: str) -> bool:
    path = ROOT / "static" / "app.js"
    text = read_text(path)
    replacements = [
        (
            r'const DEFAULT_PUBLIC_TEST_DATASET_PATH = "private:[^"]+";',
            f'const DEFAULT_PUBLIC_TEST_DATASET_PATH = "private:{dataset_id}";',
        ),
        (
            r'const DEFAULT_PUBLIC_VALIDATION_DATASET_PATH = "private:[^"]+";',
            f'const DEFAULT_PUBLIC_VALIDATION_DATASET_PATH = "private:{dataset_id}";',
        ),
        (
            r'const DEFAULT_PUBLIC_DATASET_PATH = "private:[^"]+";',
            f'const DEFAULT_PUBLIC_DATASET_PATH = "private:{dataset_id}";',
        ),
    ]
    for pattern, value in replacements:
        text = re.sub(pattern, value, text)
    return write_text_if_changed(path, text)

def update_static_index(dataset_id: str, cache_tag: str) -> bool:
    path = ROOT / "static" / "index.html"
    text = read_text(path)
    text = re.sub(
        r'id="researchSetupDatasetPathInput" type="hidden" value="private:[^"]+"',
        f'id="researchSetupDatasetPathInput" type="hidden" value="private:{dataset_id}"',
        text,
    )
    if cache_tag:
        text = re.sub(r"/static/styles\.css\?v=[^\"']+", f"/static/styles.css?v={cache_tag}", text)
        text = re.sub(r"/static/app\.js\?v=[^\"']+", f"/static/app.js?v={cache_tag}", text)
    return write_text_if_changed(path, text)


def update_app_id(dataset_id: str) -> bool:
    path = ROOT / "APP_ID.json"
    payload = json.loads(read_text(path))
    payload["sharedTestLink"] = encoded_link(dataset_id)
    payload["dataset"] = private_path(dataset_id)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    return write_text_if_changed(path, text)


def update_common_docs(dataset_id: str) -> list[str]:
    changed: list[str] = []
    replacements = [
        (r"https://eeg-test-viewer\.onrender\.com/\?dataset=private%3A[A-Za-z0-9_.-]+", encoded_link(dataset_id)),
        (r"(?m)^private:[A-Za-z0-9_.-]+$", private_path(dataset_id)),
    ]
    for relative in ("README.md", "README_TEST_ONLY_JA.md", "AGENTS.md", "CODEX.md"):
        path = ROOT / relative
        text = read_text(path)
        for pattern, value in replacements:
            text = re.sub(pattern, value, text)
        if write_text_if_changed(path, text):
            changed.append(relative)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description="Set the default private dataset used by the Render test viewer.")
    parser.add_argument("--dataset-id", required=True, help="Example: validation_tuea_v2")
    parser.add_argument("--cache-tag", default="", help="Optional static asset cache tag, e.g. 20260629-dataset2")
    args = parser.parse_args()

    dataset_id = re.sub(r"[^A-Za-z0-9_.-]+", "_", args.dataset_id.strip()).strip("._-")
    if not dataset_id:
        raise SystemExit("dataset id is empty after sanitization")

    changed: list[str] = []
    if update_static_app(dataset_id):
        changed.append("static/app.js")
    if update_static_index(dataset_id, args.cache_tag.strip()):
        changed.append("static/index.html")
    if update_app_id(dataset_id):
        changed.append("APP_ID.json")
    changed.extend(update_common_docs(dataset_id))

    print(f"defaultDataset=private:{dataset_id}")
    print(f"sharedTestLink={encoded_link(dataset_id)}")
    if args.cache_tag:
        print(f"cacheTag={args.cache_tag}")
    if changed:
        print("changed:")
        for item in changed:
            print(f"- {item}")
    else:
        print("changed: none")


if __name__ == "__main__":
    main()
