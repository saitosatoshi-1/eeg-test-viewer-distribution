#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from pathlib import Path


def validate_admin_code(value: str) -> str:
    code = str(value or "").strip()
    if not code:
        raise SystemExit(
            "EEG_VIEWER_ADMIN_CODE is not set. Pass --admin-code or set the environment variable."
        )
    if code in {"<admin-code>", "<管理コード>", "管理コード"} or "管理" in code:
        raise SystemExit(
            "Replace <管理コード> with the actual EEG_VIEWER_ADMIN_CODE from Render Environment."
        )
    try:
        code.encode("latin-1")
    except UnicodeEncodeError as exc:
        raise SystemExit(
            "EEG_VIEWER_ADMIN_CODE must contain only ASCII/latin-1 characters. "
            "Copy the exact value from Render Environment, without Japanese placeholder text."
        ) from exc
    return code


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload a private EEG dataset zip to the deployed viewer.")
    parser.add_argument("--viewer-url", required=True, help="Example: https://eeg-test-viewer.onrender.com")
    parser.add_argument("--access-code", default="ncnp")
    parser.add_argument("--admin-code", default=os.environ.get("EEG_VIEWER_ADMIN_CODE", ""))
    parser.add_argument("--dataset-id", required=True)
    parser.add_argument("--name", default="")
    parser.add_argument("--zip", required=True, type=Path)
    args = parser.parse_args()

    admin_code = validate_admin_code(args.admin_code)
    base = args.viewer_url.rstrip("/")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    login_body = urllib.parse.urlencode({"password": args.access_code, "next": "/"}).encode("utf-8")
    login_request = urllib.request.Request(
        f"{base}/login",
        data=login_body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    opener.open(login_request).read()
    html = opener.open(f"{base}/").read().decode("utf-8")
    match = re.search(r'name="eeg-viewer-token" content="([^"]+)"', html)
    if not match:
        raise SystemExit("Could not find viewer token. Check access code and viewer URL.")
    token = match.group(1)
    payload = {
        "datasetId": args.dataset_id,
        "name": args.name or args.dataset_id,
        "contentBase64": base64.b64encode(args.zip.read_bytes()).decode("ascii"),
    }
    request = urllib.request.Request(
        f"{base}/api/admin/private-dataset/upload",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-EEG-Viewer-Token": token,
            "X-EEG-Viewer-Admin-Code": admin_code,
        },
    )
    try:
        response = opener.open(request).read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(body, file=sys.stderr)
        raise SystemExit(f"Upload failed: HTTP {exc.code}") from exc
    print(response)


if __name__ == "__main__":
    main()
