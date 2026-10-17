"""Offline result-client contracts. / 実サーバーに接続しない管理ツール試験。"""
import contextlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from tools import result_download_client as client
from tools import download_submitted_results as submitted
from tools import download_validation_results as validation


class Response:
    def __init__(self, body):
        self.body = body.encode("utf-8")

    def read(self):
        return self.body


class ResultDownloadClientTests(unittest.TestCase):
    def test_login_then_token_and_admin_headers(self):
        calls = []

        class Opener:
            def open(self, request):
                calls.append(request)
                return Response('' if len(calls) == 1 else '<meta name="eeg-viewer-token" content="synthetic-token">')

        opener = Opener()
        with patch.object(client, "secure_opener", return_value=opener):
            actual, token = client.viewer_opener("https://viewer.example.invalid", "synthetic-access")
        self.assertIs(actual, opener)
        self.assertEqual(token, "synthetic-token")
        self.assertEqual(calls[0].full_url, "https://viewer.example.invalid/login")
        self.assertEqual(calls[0].data, b"password=synthetic-access&next=%2F")
        self.assertEqual(calls[1], "https://viewer.example.invalid/")
        self.assertEqual(client.admin_headers(token, "synthetic-admin"), {
            "X-EEG-Viewer-Token": token, "X-EEG-Viewer-Admin-Code": "synthetic-admin",
        })

    def test_json_and_text_are_get_requests(self):
        calls = []

        class Opener:
            def open(self, request):
                calls.append(request)
                return Response('{"synthetic": true}')

        opener = Opener()
        self.assertEqual(client.get_json(opener, "https://viewer.example.invalid/list", "t", "a"), {"synthetic": True})
        self.assertEqual(client.get_text(opener, "https://viewer.example.invalid/item", "t", "a"), '{"synthetic": true}')
        for request in calls:
            self.assertEqual(request.get_method(), "GET")
            self.assertEqual(dict(request.header_items()), {"X-eeg-viewer-token": "t", "X-eeg-viewer-admin-code": "a"})

    def test_both_tools_share_client_but_keep_paths(self):
        for module in (submitted, validation):
            self.assertIs(module.viewer_opener, client.viewer_opener)
            self.assertIs(module.get_json, client.get_json)
            self.assertIs(module.get_text, client.get_text)
        with TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(submitted.safe_local_path(root, ""), root / "submitted_result.json")
            self.assertEqual(validation.safe_local_path(root, ""), root / "validation_result.json")
            for module in (submitted, validation):
                self.assertEqual(module.safe_local_path(root, "dataset/run.json"), root / "dataset/run.json")

    def test_missing_token_stops_and_remote_http_is_rejected(self):
        class Opener:
            def open(self, request):
                return Response("login failed")

        with patch.object(client, "secure_opener", return_value=Opener()):
            with self.assertRaises(SystemExit):
                client.viewer_opener("https://viewer.example.invalid", "synthetic")
        with self.assertRaises(ValueError):
            client.viewer_opener("http://viewer.example.invalid", "synthetic")

    def test_each_cli_keeps_endpoint_and_downloaded_bytes(self):
        for module, endpoint in ((submitted, "submitted-results"), (validation, "validation-results")):
            with self.subTest(endpoint=endpoint), TemporaryDirectory() as directory:
                output = io.StringIO()
                argv = ["tool", "--access-code", "synthetic", "--output", directory]
                text = '{"synthetic": "unchanged"}\n'
                with patch("sys.argv", argv), patch.object(module, "viewer_opener", return_value=(object(), "token")), \
                     patch.object(module, "get_json", return_value={"results": [{"submissionId": "dataset/run.json"}]}) as listing, \
                     patch.object(module, "get_text", return_value=text) as item, contextlib.redirect_stdout(output):
                    module.main()
                self.assertIn(f"/api/admin/{endpoint}/list", listing.call_args.args[1])
                self.assertIn(f"/api/admin/{endpoint}/item?id=dataset%2Frun.json", item.call_args.args[1])
                self.assertEqual((Path(directory) / "dataset/run.json").read_bytes(), text.encode("utf-8"))
                self.assertEqual(json.loads(output.getvalue())["downloadedCount"], 1)


if __name__ == "__main__":
    unittest.main()
