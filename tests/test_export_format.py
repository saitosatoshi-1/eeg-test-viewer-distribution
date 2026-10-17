"""Synthetic JSON format contracts. / 合成データによるJSON整形の契約検証。"""
from copy import deepcopy
import unittest

from research_export_format import (
    research_compact_reader_profile,
    research_export_debriefing_payload,
    research_export_response_payload,
)


class ExportFormatTests(unittest.TestCase):
    def test_answer_settings_and_usage_are_preserved_without_mutation(self):
        row = {
            "caseId": "synthetic", "rating": "uncertain", "elapsedMs": 100,
            "display": {"sensitivityUvPerMm": 15, "tc": "0.1", "hf": "OFF",
                        "ac": "60", "acFilterUsed": True, "timebaseSec": 4},
            "montageLog": {"usage": [{"order": 1, "montage": "average", "montageLabel": "omit",
                                      "startSec": 0, "endSec": 2, "durationSec": 2}],
                           "totalSecByMontage": {"average": 2}, "montageConfirmationBehavior": False},
        }
        original = deepcopy(row)
        actual = research_export_response_payload(row)
        self.assertEqual(row, original)
        self.assertEqual(actual, {
            "caseId": "synthetic", "rating": "uncertain",
            "montageLog": {"totalSecByMontage": {"average": 2},
                           "usage": [{"order": 1, "montage": "average", "startSec": 0, "endSec": 2, "durationSec": 2}],
                           "montageConfirmationBehavior": False},
            "settingsAtAnswer": {"sensitivityUvPerMm": 15, "tcSec": "0.1", "hfHz": "OFF",
                                 "acFilter": "60", "acFilterUsed": True, "timebaseSec": 4},
        })

    def test_empty_and_invalid_usage_keep_existing_shape(self):
        self.assertEqual(research_export_response_payload({}), {
            "settingsAtAnswer": {"acFilterUsed": False},
            "montageLog": {"totalSecByMontage": {}, "montageConfirmationBehavior": False},
        })
        self.assertNotIn("usage", research_export_response_payload({"montageLog": {"usage": [None, {}]}})["montageLog"])

    def test_profile_and_debriefing_preserve_consent_and_false_values(self):
        consent = {"version": "synthetic", "participationAgreed": True}
        self.assertEqual(research_compact_reader_profile({"electronicConsent": consent})["electronicConsent"], consent)
        self.assertEqual(research_export_debriefing_payload({"continuedDataUseConsent": False, "extra": "omit"}),
                         {"continuedDataUseConsent": False})
        self.assertEqual(research_export_debriefing_payload(None), {})


if __name__ == "__main__":
    unittest.main()
