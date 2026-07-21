from __future__ import annotations

from app import research_assignment_design_payload, research_export_case_payload


def test_assignment_json_includes_design_constraints_and_case_order() -> None:
    case_ids = [f"case_{index:02d}" for index in range(20)]
    assignment = research_assignment_design_payload({
        "designVersion": "fixed-forms-v4",
        "formId": "C",
        "orderVersion": "C2",
        "assignmentBlock": 2,
        "assignmentPosition": 4,
        "samplingMethod": "pre_generated_connected_balanced_forms",
        "formCount": 6,
        "orderVariantCount": 3,
        "assignmentCycleLength": 18,
        "casesPerForm": 20,
        "epileptiformCount": 10,
        "nonEpileptiformCount": 10,
        "caseAppearancesAcrossForms": 2,
        "maxConsecutiveSameLabel": 3,
        "caseIds": case_ids,
    })

    assert assignment["caseIds"] == case_ids
    assert assignment["formId"] == "C"
    assert assignment["orderVersion"] == "C2"
    assert assignment["orderVariantCount"] == 3
    assert assignment["maxConsecutiveSameLabel"] == 3


def test_export_cases_include_normalized_patient_key() -> None:
    cases = research_export_case_payload({
        "cases": [{
            "caseId": "ied_001",
            "recordingId": "EYEM_aaaaamhb_aaaaamhb_s006_t001_start001000.373_dur010.000",
            "edfPath": "/dataset/ied_001.edf",
            "sourceGroup": "no_epilepsy",
            "labelGroup": "non_epileptiform",
            "include": True,
        }],
    })

    assert cases == [{
        "caseId": "ied_001",
        "patientKey": "aaaaamhb",
        "edfFile": "ied_001.edf",
        "recordingId": "EYEM_aaaaamhb_aaaaamhb_s006_t001_start001000.373_dur010.000",
        "sourceGroup": "no_epilepsy",
        "labelGroup": "non_epileptiform",
        "sourceAnnotation": "",
    }]
