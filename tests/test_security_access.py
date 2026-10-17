"""Synthetic-data isolation tests. / 実データを使わない認証・参加者分離テスト。"""
from __future__ import annotations

import hashlib
import hmac
import http.client
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode
from urllib.request import Request
from urllib.error import URLError

import app
from tools.viewer_transport import SameOriginRedirect, secure_viewer_url
from viewer_security import RecordingGrants


class PrivacyAccessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.dataset = self.root / "research/private_datasets/synthetic"
        self.dataset.mkdir(parents=True)
        self.cases = []
        for index in range(60):
            path = self.dataset / f"synthetic_{index:03d}.edf"
            path.write_bytes(b"Synthetic placeholder; never parsed as EEG")
            positive = index < 30
            self.cases.append({"caseId": f"case_{index:03d}", "edfPath": str(path), "recordingId": path.stem,
                               "labelGroup": "epileptiform" if positive else "non_epileptiform",
                               "sourceGroup": "epilepsy" if positive else "no_epilepsy", "include": True})
        (self.dataset / "dataset.json").write_text(json.dumps({"datasetId": "synthetic", "name": "Synthetic",
            "datasetPath": str(self.dataset), "settings": {"epochDurationSec": 10}, "cases": self.cases}))
        self.patcher = patch.multiple(app, PUBLIC_MODE=True, ACCESS_CODE="unit-test-access", ACCESS_PASSWORD="",
            ADMIN_CODE="unit-test-admin", VALIDATION_CODE="unit-test-reviewer", PUBLIC_DATASET_IDS=("synthetic",),
            USER_DATA_DIR=self.root, USER_FILES_PATH=self.root / "user_files.json",
            PRIVATE_DATASET_DIR=self.root / "research/private_datasets",
            VALIDATION_RESULTS_DIR=self.root / "research/validation_results",
            SUBMITTED_RESULTS_DIR=self.root / "research/submitted_results", RECORDING_GRANTS=RecordingGrants(),
            VALIDATION_WORKFLOW_ENABLED=True)
        self.patcher.start()
        store = app.RecordingStore(self.root / "missing")
        # Real request routing/authorization; synthetic waveform responses only. / 描画データは模擬値。
        store.metadata = lambda rid: {"id": rid, "raw": {"durationSec": 10}}
        store.window = lambda *args: {"id": args[0], "traces": [{"label": "Fz-Cz", "values": [0, 1]}]}
        store.window_multi = store.window
        class Handler(app.EEGRequestHandler):
            def log_message(self, *args):
                pass
        Handler.store = store
        self.server = app.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.cookie_a = self.login()
        self.cookie_b = self.login()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.patcher.stop()
        self.temp.cleanup()

    def request(self, path, payload=None, cookie=None, session="", extra=None, form=False):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)
        headers = {"X-EEG-Viewer-Token": app.SERVER_TOKEN}
        if cookie:
            headers["Cookie"] = cookie
        if session:
            headers["X-EEG-Research-Session"] = session
        headers.update(extra or {})
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
            body = urlencode(payload) if form else json.dumps(payload)
        conn.request("POST" if payload is not None else "GET", path, body, headers)
        response = conn.getresponse()
        status, response_headers, text = response.status, dict(response.getheaders()), response.read().decode()
        conn.close()
        try:
            data = json.loads(text)
        except ValueError:
            data = text
        return status, data, response_headers

    def login(self, reviewer=False):
        status, _, headers = self.request("/login", {"password": "unit-test-reviewer" if reviewer else "unit-test-access",
            "next": "/?mode=validation" if reviewer else "/"}, form=True)
        self.assertEqual(status, 302)
        return headers["Set-Cookie"].split(";", 1)[0]

    def session(self, reader="reader-a", cookie=None):
        status, data, _ = self.request("/api/research/test/session?" + urlencode({"dataset": "private:synthetic", "readerId": reader}), cookie=cookie or self.cookie_a)
        self.assertEqual(status, 200, data)
        return data

    def response_payload(self, session):
        case = next(row for row in session["cases"] if not row.get("sampleEpoch"))
        return {"datasetPath": session["datasetPath"], "readerId": session["readerId"], "caseId": case["caseId"],
                "sessionToken": session["sessionToken"], "rating": "てんかん性異常あり",
                "readerProfile": {"readerName": "Synthetic Reader", "email": "synthetic@example.invalid"}}

    def test_old_public_information_cannot_forge_signatures(self):
        session = self.session()
        digest = hashlib.sha256(self.cookie_a.split("=", 1)[1].encode()).hexdigest()
        issued = str(int(time.time()))
        message = f"{self.dataset}|reader-a|1|{digest}|{issued}".encode()
        forged = issued + "." + hmac.new(f"{app.SERVER_TOKEN}|{app.ACCESS_CODE}".encode(), message, hashlib.sha256).hexdigest()
        path = "/api/research/test/export.json?" + urlencode({"dataset": str(self.dataset), "readerId": "reader-a"})
        self.assertEqual(self.request(path, cookie=self.cookie_a, session=forged)[0], 403)
        self.assertEqual(self.request(path, cookie=self.cookie_a, session=session["sessionToken"])[0], 200)
        nonce = "synthetic-nonce"
        forged_cookie = f"{app.ACCESS_COOKIE_NAME}={issued}.{nonce}.reviewer." + hmac.new(
            f"{app.SERVER_TOKEN}|{app.ACCESS_CODE}".encode(), f"{issued}.{nonce}.reviewer".encode(), hashlib.sha256).hexdigest()
        self.assertEqual(self.request("/", cookie=forged_cookie)[0], 401)

    def test_cross_browser_read_write_and_owner_hash_spoof_are_denied(self):
        a = self.session()
        payload = self.response_payload(a)
        self.assertEqual(self.request("/api/research/test/response", payload, self.cookie_a)[0], 200)
        payload["accessCookieHash"] = hashlib.sha256(self.cookie_a.split("=", 1)[1].encode()).hexdigest()
        self.assertEqual(self.request("/api/research/test/response", payload, self.cookie_b)[0], 403)
        path = "/api/research/test/export.json?" + urlencode({"dataset": str(self.dataset), "readerId": a["readerId"]})
        self.assertEqual(self.request(path, cookie=self.cookie_b, session=a["sessionToken"])[0], 403)
        # Even a correctly signed token with a different owner must fail. / 所有者照合も独立検証。
        digest_b = hashlib.sha256(self.cookie_b.split("=", 1)[1].encode()).hexdigest()
        token_b = app.make_research_session_token(str(self.dataset), a["readerId"], "1", digest_b)
        self.assertEqual(self.request(path, cookie=self.cookie_b, session=token_b)[0], 403)
        self.assertEqual(self.request("/api/research/test/session?" + urlencode({"dataset": str(self.dataset), "readerId": "reader-a"}), cookie=self.cookie_b)[0], 403)
        status, result, headers = self.request(path, cookie=self.cookie_a, session=a["sessionToken"])
        self.assertEqual(status, 200)
        self.assertEqual(result["readers"][0]["readerProfile"]["readerName"], "Synthetic Reader")
        self.assertIn("no-store", headers["Cache-Control"])
        own_session_path = "/api/research/test/session?" + urlencode({"dataset": str(self.dataset), "readerId": "reader-a"})
        self.assertEqual(self.request(own_session_path, cookie=self.cookie_a)[0], 403)
        self.assertEqual(self.request(own_session_path, cookie=self.cookie_a, session=a["sessionToken"])[0], 200)

    def test_assigned_practice_prefetch_and_revisit_allowed_other_paths_denied(self):
        self.assertEqual(self.request("/api/research/dataset?path=private:synthetic", cookie=self.cookie_a)[1]["cases"], [])
        a = self.session()
        self.assertEqual(len(a["allCases"]), 22)
        for case in (a["allCases"][0], a["allCases"][1], a["allCases"][2]):
            status, opened, _ = self.request("/api/open-file", {"path": case["edfPath"]}, self.cookie_a, a["sessionToken"])
            self.assertEqual(status, 200, opened)
            rid = opened["id"]
            for suffix in ("/api/recording?id=" + rid, "/api/window?id=" + rid, "/api/window?montages=longitudinal&id=" + rid):
                self.assertEqual(self.request(suffix, cookie=self.cookie_a, session=a["sessionToken"])[0], 200)
                self.assertEqual(self.request(suffix, cookie=self.cookie_b, session=a["sessionToken"])[0], 403)
        # A second tab/run must not revoke the first run's recording grants. / 別tabでも同時利用を保つ。
        self.session("reader-another-tab")
        self.assertEqual(self.request("/api/window?id=" + rid, cookie=self.cookie_a, session=a["sessionToken"])[0], 200)
        allowed = {row["edfPath"] for row in a["allCases"]}
        other = next(row for row in self.cases if row["edfPath"] not in allowed)
        for path in (other["edfPath"], str(self.dataset.parent), "https://example.invalid/data.edf", str(self.dataset / ".." / "..")):
            self.assertEqual(self.request("/api/open-file", {"path": path}, self.cookie_a, a["sessionToken"])[0], 403)
        payload = self.response_payload(a)
        self.assertEqual(self.request("/api/research/test/response", payload, self.cookie_a)[0], 200)
        status, dataset, _ = self.request("/api/research/dataset?path=private:synthetic", cookie=self.cookie_a, session=a["sessionToken"])
        self.assertEqual(status, 200)
        self.assertIn(payload["caseId"], {row["caseId"] for row in dataset["cases"]})
        self.assertEqual(self.request("/api/recordings", cookie=self.cookie_b)[1], [])
        for value in ("private:not-approved", str(self.root), "https://example.invalid/dataset.json"):
            self.assertEqual(self.request("/api/research/dataset?" + urlencode({"path": value}), cookie=self.cookie_a)[0], 403)

    def test_validation_role_and_per_reviewer_ownership(self):
        query = urlencode({"dataset": "private:synthetic", "reviewerId": "reviewer-a", "validationSet": "ied"})
        for route in ("session", "export.json"):
            self.assertEqual(self.request("/api/research/validation/" + route + "?" + query, cookie=self.cookie_a)[0], 403)
        reviewer = self.login(True)
        other_reviewer = self.login(True)
        status, initial, _ = self.request("/api/research/validation/session?" + query, cookie=reviewer)
        self.assertEqual(status, 200, initial)
        payload = {"datasetPath": initial["datasetPath"], "reviewerId": "reviewer-a", "validationSet": "ied",
                   "caseId": initial["cases"][0]["caseId"], "decision": "adopt"}
        token = initial["sessionToken"]
        self.assertEqual(self.request("/api/research/validation/response", payload, reviewer, token)[0], 200)
        for action in ("response", "response/undo", "reset", "submit-result"):
            self.assertEqual(self.request("/api/research/validation/" + action, payload, other_reviewer, token)[0], 403)
        self.assertEqual(self.request("/api/research/validation/session?" + query, cookie=other_reviewer)[0], 403)
        self.assertEqual(self.request("/api/research/validation/export.json?" + query, cookie=other_reviewer, session=token)[0], 403)
        self.assertEqual(self.request("/api/research/validation/export.json?dataset=private:synthetic", cookie=reviewer, session=token)[0], 403)
        self.assertEqual(self.request("/api/research/validation/export.json?" + query, cookie=reviewer, session=token)[0], 200)
        self.assertEqual(self.request("/api/research/validation/response/undo", payload, reviewer, token)[0], 200)
        self.assertEqual(self.request("/api/research/validation/reset", payload, reviewer, token)[0], 200)
        self.assertEqual(self.request("/api/research/validation/submit-result", payload, reviewer, token)[0], 200)

    def test_legacy_validation_results_cannot_be_claimed_and_admin_download_still_works(self):
        legacy = app.validation_result_path("synthetic", "legacy-reviewer")
        app.json_write(legacy, {"responses": [], "legacy": "preserve"})
        cookie = self.login(True)
        query = urlencode({"dataset": "private:synthetic", "reviewerId": "legacy-reviewer"})
        self.assertEqual(self.request("/api/research/validation/session?" + query, cookie=cookie)[0], 403)
        self.assertEqual(app.json_read(legacy, {})["legacy"], "preserve")
        route = "/api/admin/validation-results/item?id=synthetic/legacy-reviewer.json"
        self.assertEqual(self.request(route, cookie=self.cookie_a)[0], 403)
        self.assertEqual(self.request(route, cookie=self.cookie_a, extra={"X-EEG-Viewer-Admin-Code": app.ADMIN_CODE})[0], 200)


class TransferSecurityTests(unittest.TestCase):
    def test_remote_http_and_unsafe_urls_rejected_before_any_request(self):
        for url in ("http://example.invalid", "file:///tmp/viewer", "https://user:password@example.invalid", "https://example.invalid?secret=value"):
            with self.assertRaises(ValueError):
                secure_viewer_url(url)
        self.assertEqual(secure_viewer_url("https://example.invalid/"), "https://example.invalid")
        self.assertEqual(secure_viewer_url("http://127.0.0.1:8000/"), "http://127.0.0.1:8000")

    def test_redirects_cannot_forward_credentials_to_other_origin_or_http(self):
        handler = SameOriginRedirect("https://viewer.example.invalid")
        req = Request("https://viewer.example.invalid/", headers={"X-EEG-Viewer-Admin-Code": "synthetic"})
        for url in ("https://other.example.invalid/", "http://viewer.example.invalid/", "https://viewer.example.invalid:444/"):
            with self.assertRaises(URLError):
                handler.redirect_request(req, None, 302, "Found", {}, url)
        follow = handler.redirect_request(req, None, 302, "Found", {}, "https://viewer.example.invalid/login")
        self.assertEqual(follow.full_url, "https://viewer.example.invalid/login")


if __name__ == "__main__":
    unittest.main()
