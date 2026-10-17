"""Shared read-only result client. / 結果取得専用の共通通信処理。

No upload or delete operations. / アップロードや削除処理は含めない。
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request

if __package__:
    from .viewer_transport import secure_opener, secure_viewer_url
else:
    from viewer_transport import secure_opener, secure_viewer_url


def viewer_opener(base: str, access_code: str) -> tuple[urllib.request.OpenerDirector, str]:
    base = secure_viewer_url(base)
    opener = secure_opener(base)
    login_body = urllib.parse.urlencode({"password": access_code, "next": "/"}).encode("utf-8")
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
    return opener, match.group(1)


def admin_headers(token: str, admin_code: str) -> dict[str, str]:
    return {"X-EEG-Viewer-Token": token, "X-EEG-Viewer-Admin-Code": admin_code}


def get_json(opener: urllib.request.OpenerDirector, url: str, token: str, admin_code: str) -> dict:
    request = urllib.request.Request(url, headers=admin_headers(token, admin_code))
    return json.loads(opener.open(request).read().decode("utf-8"))


def get_text(opener: urllib.request.OpenerDirector, url: str, token: str, admin_code: str) -> str:
    request = urllib.request.Request(url, headers=admin_headers(token, admin_code))
    return opener.open(request).read().decode("utf-8")


