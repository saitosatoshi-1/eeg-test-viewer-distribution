#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.parse
from pathlib import Path

if __package__:
    from .viewer_transport import access_code as read_access_code, secure_viewer_url
    from .result_download_client import viewer_opener, admin_headers, get_json, get_text
else:
    from viewer_transport import access_code as read_access_code, secure_viewer_url
    from result_download_client import viewer_opener, admin_headers, get_json, get_text


def safe_local_path(output_dir: Path, submission_id: str) -> Path:
    parts = [part for part in submission_id.split("/") if part and part not in {".", ".."}]
    if not parts:
        parts = ["validation_result.json"]
    if not parts[-1].lower().endswith(".json"):
        parts[-1] = f"{parts[-1]}.json"
    return output_dir.joinpath(*parts)


def main() -> None:
    parser = argparse.ArgumentParser(description="List or download validation result JSON files.")
    parser.add_argument("--viewer-url", default="https://eeg-test-viewer.onrender.com")
    parser.add_argument("--access-code", default=os.environ.get("EEG_VIEWER_ACCESS_CODE", ""))
    parser.add_argument("--admin-code", default=os.environ.get("EEG_VIEWER_ADMIN_CODE", ""))
    parser.add_argument("--output", type=Path, default=Path.home() / "Downloads" / "eeg_validation_results")
    parser.add_argument("--list-only", action="store_true")
    parser.add_argument("--id", dest="submission_id", default="", help="Download one submissionId instead of all results.")
    args = parser.parse_args()

    base = secure_viewer_url(args.viewer_url)
    opener, token = viewer_opener(base, read_access_code(args.access_code))
    inventory = get_json(opener, f"{base}/api/admin/validation-results/list", token, args.admin_code)
    results = inventory.get("results") or []
    if args.list_only:
        print(json.dumps(inventory, ensure_ascii=False, indent=2))
        return
    if args.submission_id:
        results = [{"submissionId": args.submission_id}]
    args.output.mkdir(parents=True, exist_ok=True)
    downloaded = []
    for row in results:
        submission_id = str(row.get("submissionId") or "").strip()
        if not submission_id:
            continue
        url = f"{base}/api/admin/validation-results/item?{urllib.parse.urlencode({'id': submission_id})}"
        text = get_text(opener, url, token, args.admin_code)
        target = safe_local_path(args.output, submission_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        downloaded.append(str(target))
    print(json.dumps({"ok": True, "resultCount": len(results), "downloadedCount": len(downloaded), "output": str(args.output), "downloaded": downloaded}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
