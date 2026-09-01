from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def app_source() -> str:
    return (ROOT / "static" / "app.js").read_text(encoding="utf-8")


def test_active_run_is_tab_scoped_and_restored_on_reload() -> None:
    source = app_source()

    assert 'const RESEARCH_ACTIVE_RUN_KEY = "eegViewerActiveResearchRun.v1"' in source
    assert "sessionStorage.setItem(RESEARCH_ACTIVE_RUN_KEY" in source
    assert "sessionStorage.getItem(RESEARCH_ACTIVE_RUN_KEY" in source
    assert "await resumeActiveResearchRun();" in source
    resume = source[source.index("async function resumeActiveResearchRun") : source.index("async function startResearchTest")]
    assert "/api/research/test/session?" in resume
    assert "readerId: activeRun.readerId" in resume
    assert "firstUnansweredResearchCaseIndex()" in resume


def test_public_profile_is_restored_only_from_active_tab_run() -> None:
    source = app_source()
    profile_helper = source[source.index("function storedResearchProfile") : source.index("function readPendingResearchResponses")]

    assert "if (PUBLIC_WEB_MODE) return readActiveResearchRun()?.profile || {};" in profile_helper
    assert "RESEARCH_ACTIVE_RUN_MAX_AGE_MS" in profile_helper
    assert "clearActiveResearchRun();" in source[source.index("function resetResearchProfileForm") : source.index("function updateEpilepsyCenterDurationRequirement")]


def test_tutorial_transition_rolls_back_when_next_epoch_fails() -> None:
    source = app_source()
    handler = source[source.index("async function saveResearchRating") : source.index("function showResearchToast")]

    assert "const advanced = await showResearchCase(nextIndex);" in handler
    assert "delete state.researchSampleCompletedPhases[phase][completedCaseId];" in handler
    assert "const restored = await showResearchCase(state.researchCaseIndex);" in handler
    assert "同じ回答をもう一度選択してください" in handler


def test_active_run_clears_only_after_confirmed_server_save() -> None:
    source = app_source()
    completion = source[source.index("async function completeResearchTest") : source.index("function renderResearchWaveProgress")]

    assert "if (result?.ok !== true)" in completion
    assert completion.index("state.researchResultAutoSubmitted = true;") < completion.index("clearActiveResearchRun();")
    assert "state.researchResultAutoSubmitted = false;" in completion
