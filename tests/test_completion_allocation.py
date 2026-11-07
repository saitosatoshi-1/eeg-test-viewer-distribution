"""Synthetic lifecycle tests. / 実参加者・実EDFを使わない割付試験。"""
import copy
import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import app
from research_allocation import allocation_counts, completed_submission_reader, next_completion_balanced_assignment


class CompletionAllocationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.dataset = self.root / "dataset"
        self.dataset.mkdir()
        cases = [{"caseId": f"case-{i}", "recordingId": f"patient-{i}", "patientId": f"patient-{i}",
                  "edfPath": str(self.dataset / f"synthetic-{i}.edf"),
                  "labelGroup": "epileptiform" if i < 30 else "non_epileptiform", "include": True}
                 for i in range(60)]
        app.json_write(self.dataset / "dataset.json", {"datasetId": "synthetic", "cases": cases,
                       "settings": {"phase1TotalSampleCount": 20}})
        self.patcher = patch.multiple(app, PUBLIC_MODE=False, SUBMITTED_RESULTS_DIR=self.root / "submitted",
                                     ALLOWED_RESEARCH_WRITE_ROOTS=(self.root,))
        self.patcher.start()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.patcher.stop)

    def session(self, name):
        return app.research_session({"dataset": str(self.dataset), "readerId": name})

    def assignments(self):
        return app.load_research_assignments(self.dataset)["assignments"]

    def complete(self, session, count=20, consent=True):
        cases = [row for row in session["allCases"] if not row.get("sampleEpoch")]
        responses = [{"readerId": session["readerId"], "caseId": case["caseId"], "phase": "1",
                      "rating": app.RESEARCH_RATING_POSITIVE, "answerOrder": i + 1,
                      "readerProfile": {"readerName": "Synthetic"}} for i, case in enumerate(cases[:count])]
        app.save_research_responses(self.dataset, session["readerId"], responses, {})
        current = app.load_research_response_payload(self.dataset, session["readerId"])
        current["postTestDebriefing"] = {"continuedDataUseConsent": consent,
                                       "completedAt": "2026-11-07T00:00:00Z", "montageSwitchIncreaseLikert": 3}
        app.json_write(app.research_response_path(self.dataset, session["readerId"]), current)
        return app.save_research_result_submission({"dataset": str(self.dataset), "readerId": session["readerId"]})

    def interrupt(self, reader):
        return app.change_research_reservation({"dataset": str(self.dataset), "assignmentId": f"{reader}|1",
                                              "expectedStatus": "active", "status": "interrupted"})

    def test_six_assignments_remain_balanced_and_active_is_reserved(self):
        sessions = [self.session(f"reader-{i}") for i in range(6)]
        self.assertEqual({row["formId"] for row in sessions}, set("ABCDEF"))
        counts = allocation_counts(self.assignments())
        self.assertTrue(all(row["active"] == 1 for row in counts.values()))
        self.assertTrue(all(row["completed"] == 0 for row in counts.values()))

    def test_confirmed_gap_is_replaced_and_late_resumption_keeps_original(self):
        sessions = [self.session(f"reader-{i}") for i in range(6)]
        gap = next(row for row in sessions if row["formId"] == "C")
        for row in sessions:
            if row is not gap:
                self.complete(row)
        self.interrupt(gap["readerId"])
        replacement = self.session("replacement")
        self.assertEqual(replacement["formId"], "C")
        self.assertEqual(replacement["assignment"]["assignmentKind"], "replacement")
        replacement_record = next(row for row in self.assignments() if row["readerId"] == "replacement")
        self.assertEqual(replacement_record["replacesAssignmentId"], f"{gap['readerId']}|1")
        self.assertNotIn("replacesAssignmentId", replacement["assignment"])
        self.assertEqual(allocation_counts(self.assignments())["C"]["active"], 1)
        resumed = self.session(gap["readerId"])
        self.assertEqual([row["caseId"] for row in resumed["allCases"] if not row.get("sampleEpoch")],
                         [row["caseId"] for row in gap["allCases"] if not row.get("sampleEpoch")])
        self.complete(resumed)
        self.complete(replacement)
        exported = app.export_research_responses_json(self.dataset, "replacement")
        self.assertNotIn(gap["readerId"], exported)
        self.assertEqual(allocation_counts(self.assignments())["C"]["completed"], 2)
        self.assertNotEqual(self.session("after-late-submit")["formId"], "C")

    def test_partial_missing_consent_and_repeated_submission(self):
        session = self.session("reader")
        form = session["formId"]
        self.complete(session, count=10)
        self.assertEqual(allocation_counts(self.assignments())[form]["completed"], 0)
        self.complete(session, consent=False)
        self.assertEqual(allocation_counts(self.assignments())[form]["completed"], 0)
        self.complete(session)
        self.complete(session)
        self.assertEqual(allocation_counts(self.assignments())[form]["completed"], 1)
        with self.assertRaises(ValueError):
            self.interrupt(session["readerId"])

    def test_saved_receipt_recovers_after_marker_loss(self):
        session = self.session("reader")
        self.complete(session)
        rows = self.assignments()
        rows[0].pop("completionReceipt")
        rows[0]["allocationStatus"] = "active"
        app.write_research_assignment_records(self.dataset, rows)
        recovered = app.reconcile_research_completions(self.dataset, "synthetic")
        self.assertEqual(allocation_counts(recovered)[session["formId"]]["completed"], 1)

    def test_failed_final_write_does_not_complete(self):
        session = self.session("reader")
        with patch.object(Path, "write_text", side_effect=OSError("synthetic disk failure")):
            with self.assertRaises(OSError):
                app.save_research_result_submission({"dataset": str(self.dataset), "readerId": session["readerId"]})
        self.assertEqual(allocation_counts(self.assignments())[session["formId"]]["completed"], 0)

    def test_concurrent_new_sessions_do_not_take_same_free_slot(self):
        with ThreadPoolExecutor(max_workers=6) as pool:
            sessions = list(pool.map(self.session, [f"parallel-{i}" for i in range(6)]))
        self.assertEqual({row["formId"] for row in sessions}, set("ABCDEF"))

    def test_long_run_balances_forms_and_orders(self):
        rows = []
        for index in range(180):
            design = next_completion_balanced_assignment("synthetic", rows)
            rows.append({**design, "assignmentId": f"synthetic-{index}|1", "completionReceipt": "synthetic.json"})
        self.assertEqual({row["completed"] for row in allocation_counts(rows).values()}, {30})
        for form in "ABCDEF":
            for order in (1, 2, 3):
                self.assertEqual(sum(row["orderVersion"] == f"{form}{order}" for row in rows), 10)

    def test_admin_compare_and_set_rejects_stale_status(self):
        self.session("reader")
        self.interrupt("reader")
        with self.assertRaises(ValueError):
            self.interrupt("reader")

    def test_wrong_dataset_or_case_ids_do_not_count_as_complete(self):
        session = self.session("reader")
        result = self.complete(session)
        path = app.SUBMITTED_RESULTS_DIR / result["submissionId"]
        document = json.loads(path.read_text())
        assignment = self.assignments()[0]
        self.assertTrue(completed_submission_reader(document, assignment, "synthetic"))
        wrong = copy.deepcopy(document)
        wrong["readers"][0]["responses"][0]["caseId"] = "not-assigned"
        self.assertFalse(completed_submission_reader(wrong, assignment, "synthetic"))
        self.assertFalse(completed_submission_reader(document, assignment, "other"))
        incomplete = copy.deepcopy(document)
        incomplete["readers"][0]["postTestDebriefing"].pop("montageSwitchIncreaseLikert")
        self.assertFalse(completed_submission_reader(incomplete, assignment, "synthetic"))
        answerless = copy.deepcopy(document)
        answerless["readers"][0]["responses"][0].pop("rating")
        self.assertFalse(completed_submission_reader(answerless, assignment, "synthetic"))
        for invalid in (1, {}, "bad", None):
            malformed = copy.deepcopy(document)
            malformed["readers"] = invalid
            self.assertFalse(completed_submission_reader(malformed, assignment, "synthetic"))
        malformed = copy.deepcopy(document)
        malformed["readers"][0]["responses"][0]["caseId"] = []
        self.assertFalse(completed_submission_reader(malformed, assignment, "synthetic"))

    def test_malformed_saved_json_does_not_block_allocation(self):
        self.session("reader")
        folder = app.SUBMITTED_RESULTS_DIR / "synthetic"
        folder.mkdir(parents=True)
        app.json_write(folder / "malformed.json", {"dataset": {"datasetId": "synthetic"}, "readers": 1})
        self.assertTrue(self.session("next-reader")["formId"])
