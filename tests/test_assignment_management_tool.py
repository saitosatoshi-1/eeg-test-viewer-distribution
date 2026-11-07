"""Offline management CLI checks. / 本番に接続しない管理コマンド検査。"""
import contextlib
import io
import json
import unittest
from unittest.mock import patch

from tools import manage_research_assignments as tool


class AssignmentManagementToolTests(unittest.TestCase):
    def test_mutation_requires_confirmation_before_login(self):
        with patch("sys.argv", ["tool", "--dataset", "private:synthetic", "--action", "interrupt"]), patch.object(tool, "viewer_opener") as login:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                tool.main()
            login.assert_not_called()

    def test_status_change_uses_admin_header_and_expected_status(self):
        calls = []

        class Response:
            def read(self):
                return b'{"assignments": [], "counts": {}}'

        class Opener:
            def open(self, request):
                calls.append(request)
                return Response()

        argv = ["tool", "--dataset", "private:synthetic", "--action", "interrupt",
                "--assignment-id", "synthetic|1", "--confirm"]
        overview = {"assignments": [{"assignmentId": "synthetic|1", "status": "active"}]}
        with patch("sys.argv", argv), patch.dict("os.environ", {"EEG_VIEWER_ACCESS_CODE": "synthetic", "EEG_VIEWER_ADMIN_CODE": "synthetic-admin"}, clear=True), patch.object(tool, "viewer_opener", return_value=(Opener(), "token")), patch.object(tool, "get_json", return_value=overview), contextlib.redirect_stdout(io.StringIO()):
            tool.main()
        self.assertEqual(len(calls), 1)
        self.assertEqual(json.loads(calls[0].data)["expectedStatus"], "active")
        self.assertEqual(json.loads(calls[0].data)["status"], "interrupted")
        self.assertEqual(calls[0].get_header("X-eeg-viewer-admin-code"), "synthetic-admin")
