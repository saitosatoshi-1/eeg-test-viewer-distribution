#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload a private EEG dataset zip to the deployed viewer.")
    parser.add_argument("--viewer-url", required=True, help="Example: https://eeg-test-viewer.onrender.com")
    parser.add_argument("--access-code", default="ncnp")
    parser.add_argument("--admin-code", default=os.environ.get("EEG_VIEWER_ADMIN_CODE", ""))
    parser.add_argument("--dataset-id", required=True)
    parser.add_argument("--name", default="")
    parser.add_argument("--zip", required=True, type=Path)
    args = parser.parse_args()

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
            "X-EEG-Viewer-Admin-Code": args.admin_code,
        },
    )
    response = opener.open(request).read().decode("utf-8")
    print(response)


if __name__ == "__main__":
    main()
