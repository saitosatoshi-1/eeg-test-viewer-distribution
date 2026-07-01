#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path


def viewer_opener(base: str, access_code: str) -> tuple[urllib.request.OpenerDirector, str]:
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    login_body = urllib.parse.urlencode({"password": access_code, "next": "/"}).encode("utf-8")
    opener.open(urllib.request.Request(f"{base}/login", data=login_body, headers={"Content-Type": "application/x-www-form-urlencoded"})).read()
    html = opener.open(f"{base}/").read().decode("utf-8")
    match = re.search(r'name="eeg-viewer-token" content="([^"]+)"', html)
    if not match:
        raise SystemExit("Could not find viewer token. Check access code and viewer URL.")
    return opener, match.group(1)


def admin_headers(token: str, admin_code: str) -> dict[str, str]:
    return {"X-EEG-Viewer-Token": token, "X-EEG-Viewer-Admin-Code": admin_code}


def get_json(opener: urllib.request.OpenerDirector, url: str, token: str, admin_code: str) -> dict:
    return json.loads(opener.open(urllib.request.Request(url, headers=admin_headers(token, admin_code))).read().decode("utf-8"))


def get_text(opener: urllib.request.OpenerDirector, url: str, token: str, admin_code: str) -> str:
    return opener.open(urllib.request.Request(url, headers=admin_headers(token, admin_code))).read().decode("utf-8")


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
    parser.add_argument("--access-code", default="ncnp")
    parser.add_argument("--admin-code", default=os.environ.get("EEG_VIEWER_ADMIN_CODE", ""))
    parser.add_argument("--output", type=Path, default=Path.home() / "Downloads" / "eeg_validation_results")
    parser.add_argument("--list-only", action="store_true")
    parser.add_argument("--id", dest="submission_id", default="", help="Download one submissionId instead of all results.")
    args = parser.parse_args()

    base = args.viewer_url.rstrip("/")
    opener, token = viewer_opener(base, args.access_code)
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
