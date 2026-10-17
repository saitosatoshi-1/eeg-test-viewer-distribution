"""Pure JSON formatters. / 入出力や認証を行わない結果JSON整形。"""
from __future__ import annotations

from typing import Any


def research_compact_reader_profile(profile: dict[str, Any]) -> dict[str, Any]:
    return {
        key: profile.get(key, "")
        for key in (
            "readerName", "email", "affiliation", "specialty", "position",
            "epilepsySpecialist", "clinicalNeurophysEegSpecialist",
            "medicalPracticeYears", "eegReadingCount", "eegReadingCountUnit",
            "monthlyEegReadingCount", "annualEegReadingCount",
            "videoEegReadingExperience", "videoEegReadingExperienceDuration",
            "usualMontage", "ethicsNoticeConfirmed", "electronicConsent",
        )
    }


def research_export_response_payload(response: dict[str, Any]) -> dict[str, Any]:
    payload = dict(response)
    for key in (
        "recordingId",
        "referenceLabel",
        "testDate",
        "testStartedAt",
        "testCompletedAt",
        "tutorialCompletedAt",
        "elapsedMs",
        "tutorialToTestCompletedMs",
        "tutorialToTestCompletedSec",
        "totalElapsedMs",
        "totalElapsedSec",
    ):
        payload.pop(key, None)
    for key in ("eventTime", "epochStart", "durationSec"):
        if payload.get(key) in ("", None):
            payload.pop(key, None)
    display = payload.pop("display", None) if isinstance(payload.get("display"), dict) else {}
    settings_at_answer = {
        "sensitivityUvPerMm": display.get("sensitivityUvPerMm", ""),
        "tcSec": display.get("tc", ""),
        "hfHz": display.get("hf", ""),
        "acFilter": display.get("ac", ""),
        "acFilterUsed": bool(display.get("acFilterUsed")),
        "timebaseSec": display.get("timebaseSec", ""),
    }
    payload["settingsAtAnswer"] = {
        key: value
        for key, value in settings_at_answer.items()
        if value not in ("", None, [])
    }
    montage_log = payload.get("montageLog") if isinstance(payload.get("montageLog"), dict) else {}

    def compact_usage_rows(rows: Any) -> list[dict[str, Any]]:
        if not isinstance(rows, list):
            return []
        out: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            out.append({
                key: value
                for key, value in {
                    "order": row.get("order", ""),
                    "montage": row.get("montage", ""),
                    "startSec": row.get("startSec", ""),
                    "endSec": row.get("endSec", ""),
                    "durationSec": row.get("durationSec", ""),
                }.items()
                if value not in ("", None, [])
            })
        return [row for row in out if row.get("montage")]

    payload["montageLog"] = {
        "totalSecByMontage": montage_log.get("totalSecByMontage", {}),
        "usage": compact_usage_rows(montage_log.get("usage")),
        "analysisTotalSecByMontage": montage_log.get("analysisTotalSecByMontage", {}),
        "analysisUsage": compact_usage_rows(montage_log.get("analysisUsage")),
        "montageConfirmationBehavior": bool(montage_log.get("montageConfirmationBehavior")),
    }
    if not payload["montageLog"]["usage"]:
        payload["montageLog"].pop("usage", None)
    if not payload["montageLog"]["analysisUsage"]:
        payload["montageLog"].pop("analysisUsage", None)
    if not payload["montageLog"]["analysisTotalSecByMontage"]:
        payload["montageLog"].pop("analysisTotalSecByMontage", None)
    return payload


def research_export_debriefing_payload(debriefing: Any) -> dict[str, Any]:
    if not isinstance(debriefing, dict):
        return {}
    keys = (
        "completedAt",
        "primaryEndpointDisclosure",
        "operationLogDisclosure",
        "explanationVersion",
        "omittedExplanationReason",
        "withdrawalOpportunityProvided",
        "montageSwitchIncreaseLikert",
        "behaviorChangeFreeText",
        "continuedDataUseConsent",
    )
    return {
        key: debriefing.get(key)
        for key in keys
        if debriefing.get(key) not in ("", None, [], {})
    }


