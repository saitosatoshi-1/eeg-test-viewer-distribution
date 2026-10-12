from __future__ import annotations

import unittest

from app import research_compact_reader_profile, research_export_debriefing_payload


class ElectronicConsentExportTests(unittest.TestCase):
    def test_identity_timestamp_version_and_explanation_survive_export(self) -> None:
        consent = {
            "participationAgreed": True,
            "agreedAt": "2026-10-12T12:00:00Z",
            "version": "2026-10-12-v1",
            "identity": {"readerName": "QA Reader", "email": "qa@example.invalid", "affiliation": "QA"},
            "explanationText": "説明文",
        }
        exported = research_compact_reader_profile({"electronicConsent": consent})
        self.assertEqual(exported["electronicConsent"], consent)

    def test_debrief_disclosure_and_withdrawal_opportunity_survive_export(self) -> None:
        disclosure = {
            "completedAt": "2026-10-12T12:10:00Z",
            "primaryEndpointDisclosure": "複数のモンタージュを確認する行動とIED判定エラーの関連",
            "operationLogDisclosure": "切替回数・表示時間・設定変更・総判読時間",
            "explanationVersion": "2026-10-12-v1",
            "omittedExplanationReason": "ホーソン効果を避けるため",
            "withdrawalOpportunityProvided": True,
            "continuedDataUseConsent": True,
        }
        self.assertEqual(research_export_debriefing_payload(disclosure), disclosure)


if __name__ == "__main__":
    unittest.main()
