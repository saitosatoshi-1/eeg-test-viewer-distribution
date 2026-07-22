from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def app_source() -> str:
    return (ROOT / "static" / "app.js").read_text(encoding="utf-8")


def test_window_loading_aborts_superseded_requests() -> None:
    source = app_source()

    assert "function cancelActiveWindowLoad" in source
    assert "controller.abort();" in source
    assert "{ signal: controller.signal }" in source
    assert "requestId !== state.windowLoadRequestId" in source
    assert "windowLoadPending" not in source
    assert "windowLoadInFlight" not in source


def test_filter_and_timebase_controls_do_not_use_pointer_or_blur_reloads() -> None:
    source = app_source()
    controls = source[source.index("function bindControls()") : source.index("function bindResearchControls()")]

    assert 'el.addEventListener("input", schedule);' in controls
    assert 'el.addEventListener("change", schedule);' in controls
    assert 'el.addEventListener("pointerup", schedule);' not in controls
    assert 'el.addEventListener("touchend", schedule);' not in controls
    assert 'el.addEventListener("blur", schedule);' not in controls
    assert "duration-pointerup" not in controls
    assert "duration-keyup" not in controls
    assert "duration-window-focus" not in controls


def test_timebase_can_reuse_loaded_filtered_window() -> None:
    source = app_source()
    handler = source[
        source.index("function loadedWindowMatchesCurrentDisplay")
        : source.index("function scheduleFilterRefresh")
    ]

    assert "data.displayFilters" in handler
    assert "targetStart + targetDuration <= loadedStart + loadedDuration" in handler
    assert "loadedWindowMatchesCurrentDisplay(nextStart, nextDuration)" in handler
    assert "cancelActiveWindowLoad();" in handler
    assert "state.windowData.duration = nextDuration" not in handler
    assert "loadWindow({ activeMontageOnly: TEST_ONLY_DISTRIBUTION })" in handler


def test_active_only_window_requests_compact_payload_and_avoid_forced_repaints() -> None:
    source = app_source()

    assert 'compactActive: options.activeMontageOnly ? "1" : "0"' in source
    assert "params.compactActive" in source
    assert "forceViewerRepaint" not in source


def test_control_interactions_pause_and_resume_background_prefetch() -> None:
    source = app_source()

    assert "researchPrefetchControllers: new Set()" in source
    assert "schedulePrefetchAfterControlInteraction(delayMs = 400)" in source
    assert "for (const controller of state.researchPrefetchControllers) controller.abort();" in source
    assert "signal: controller.signal" in source


def test_filter_and_timebase_controls_reuse_cache_before_showing_loading() -> None:
    source = app_source()

    assert "function cachedWindowForParams(params)" in source
    assert "preferredResearchWindowMontages(params.montage)" in source
    assert "if (cached) {" in source
    assert "setWaveLoading(true);" in source
    assert source.index("if (cached) {") < source.index("setWaveLoading(true);")


def test_research_prefetch_limits_render_load() -> None:
    source = app_source()

    assert "const RESEARCH_PREFETCH_LOOKAHEAD = 2" in source
    assert "const montages = options.montages || montage" in source
    assert 'compactActive: options.compactActive === false ? "0" : "1"' in source
    assert "enqueueResearchPrefetchCases(rest)" not in source


def test_reader_display_settings_persist_between_epochs() -> None:
    source = app_source()

    assert "researchDisplaySettingsInitialized: false" in source
    assert "if (!state.researchDisplaySettingsInitialized)" in source
    assert "state.researchDisplaySettingsInitialized = true" in source
    assert "options.duration || els.durationSelect?.value || defaultResearchTimebaseSec()" in source
