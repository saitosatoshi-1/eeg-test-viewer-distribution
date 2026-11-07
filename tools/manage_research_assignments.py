#!/usr/bin/env python3
"""Inspect reservations or confirm interruption. / 管理者が予約・中断確定を管理する。"""
from __future__ import annotations

import argparse
import getpass
import json
import os
from urllib.parse import urlencode
from urllib.request import Request

if __package__:
    from .result_download_client import viewer_opener, admin_headers, get_json
    from .viewer_transport import access_code, secure_viewer_url
else:
    from result_download_client import viewer_opener, admin_headers, get_json
    from viewer_transport import access_code, secure_viewer_url


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--viewer-url", default="https://eeg-test-viewer.onrender.com")
    parser.add_argument("--dataset", required=True, help="Example: private:validation_v1")
    parser.add_argument("--action", choices=("list", "interrupt", "reactivate"), default="list")
    parser.add_argument("--assignment-id", default="")
    parser.add_argument("--confirm", action="store_true", help="Confirm status mutation / 状態変更を明示確認")
    args = parser.parse_args()
    if args.action != "list" and (not args.confirm or not args.assignment_id):
        parser.error("Status changes require --assignment-id and --confirm.")
    base = secure_viewer_url(args.viewer_url)
    opener, token = viewer_opener(base, access_code(os.environ.get("EEG_VIEWER_ACCESS_CODE", "")))
    admin = os.environ.get("EEG_VIEWER_ADMIN_CODE") or getpass.getpass("Admin code / 管理コード: ")
    overview = get_json(opener, f"{base}/api/admin/research-assignments?{urlencode({'dataset': args.dataset})}", token, admin)
    if args.action != "list":
        current = next((row for row in overview["assignments"] if row["assignmentId"] == args.assignment_id), None)
        if not current or current["status"] == "completed":
            raise SystemExit("Assignment missing or already completed. / 対象なし、または提出済みです。")
        payload = {"dataset": args.dataset, "assignmentId": args.assignment_id,
                   "expectedStatus": current["status"],
                   "status": "interrupted" if args.action == "interrupt" else "active"}
        request = Request(f"{base}/api/admin/research-assignments/status",
                          data=json.dumps(payload).encode("utf-8"),
                          headers={**admin_headers(token, admin), "Content-Type": "application/json"})
        overview = json.loads(opener.open(request).read().decode("utf-8"))
    print(json.dumps(overview, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
