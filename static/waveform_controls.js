// Display-setting controller. / 表示設定変更の制御。
// Preserve debounce, cancellation, cache reuse and montage timing.
// 待機時間・中止処理・キャッシュ再利用・モンタージュ時間記録を維持する。
// Functions use shared state/els; no startup side effects.
// 共有state/elsを利用し、読み込み時に処理を開始しない。

function rememberControlValues() {
  state.lastMontageSelectValue = els.montageSelect?.value || "";
  state.lastDurationSelectValue = els.durationSelect?.value || "";
  state.lastFilterControlKey = filterControlKey();
}

function startControlValueWatcher() {
  if (state.controlWatchTimer) window.clearInterval(state.controlWatchTimer);
  state.controlWatchTimer = window.setInterval(() => {
    const montageValue = els.montageSelect?.value || "";
    const durationValue = els.durationSelect?.value || "";
    const filterKey = filterControlKey();
    if (montageValue && montageValue !== state.lastMontageSelectValue) {
      state.lastMontageSelectValue = montageValue;
      handleMontageControlChange("watcher");
    }
    if (durationValue && durationValue !== state.lastDurationSelectValue) {
      state.lastDurationSelectValue = durationValue;
      handleDurationControlChange("watcher");
    }
    if (filterKey !== state.lastFilterControlKey) {
      state.lastFilterControlKey = filterKey;
      handleFilterControlChange("watcher");
    }
  }, 250);
}

function scheduleDurationRefresh(source = "duration", options = {}) {
  if (!els.durationSelect) return;
  if (state.durationRefreshTimer) window.clearTimeout(state.durationRefreshTimer);
  state.durationRefreshTimer = window.setTimeout(() => {
    state.durationRefreshTimer = null;
    const value = els.durationSelect?.value || "";
    const changed = value && value !== state.lastDurationSelectValue;
    if (changed) {
      handleDurationControlChange(source);
    }
  }, options.delayMs ?? 40);
}

function commitDurationSelection(source = "duration") {
  scheduleDurationRefresh(source, { delayMs: 20 });
}

function filterControlKey() {
  return [
    els.tcSelect?.value || "",
    els.hfSelect?.value || "",
    FIXED_AC_FILTER,
    els.ecgToggle?.checked ? "1" : "0",
  ].join("|");
}

function preferredWindowMontages(activeMontage = activeMontageValue()) {
  return [...new Set([activeMontage, ...DEFAULT_MULTI_MONTAGES].filter(Boolean))].slice(0, 4);
}

function preferredResearchWindowMontages(activeMontage = activeMontageValue()) {
  const candidates = isMobileViewport()
    ? [activeMontage, "conventional", "longitudinal", "a1a2"]
    : [activeMontage, ...RESEARCH_PREFETCH_MONTAGES];
  return [...new Set(candidates.filter(Boolean))];
}

function windowMaxPoints() {
  if (!isMobileViewport()) return DESKTOP_WINDOW_MAX_POINTS;
  if (els.hfSelect?.value === "OFF") return MOBILE_HF_OFF_WINDOW_MAX_POINTS;
  return isMultiMontageMode() ? MOBILE_MULTI_MONTAGE_MAX_POINTS : MOBILE_WINDOW_MAX_POINTS;
}

function cancelActiveWindowLoad(options = {}) {
  const controller = state.windowLoadController;
  if (!controller) return false;
  state.windowLoadRequestId += 1;
  state.windowLoadController = null;
  state.windowLoadPromise = null;
  controller.abort();
  if (options.hideLoading !== false) setWaveLoading(false);
  return true;
}

async function handleMontageControlChange(source = "change") {
  if (!els.montageSelect) return;
  resetResearchPrefetch();
  state.lastMontageSelectValue = els.montageSelect.value || "";
  state.activeMontage = state.lastMontageSelectValue || state.activeMontage;
  updateResearchMontageTiming();
  renderStatus();
  const synced = syncActiveMontageData({ requireExact: true });
  if (synced && loadedWindowMatchesCurrentDisplay(state.start, visibleDuration())) {
    cancelActiveWindowLoad();
    draw();
    setStatus("Ready");
    schedulePrefetchAfterControlInteraction();
    return;
  }
  setStatus(`Loading montage ${state.activeMontage} / ${labelForMontage()}...`, { busy: true, progress: 70 });
  await loadWindow({ activeMontageOnly: TEST_ONLY_DISTRIBUTION });
  schedulePrefetchAfterControlInteraction();
  draw();
}

function loadedWindowMatchesCurrentDisplay(start, duration) {
  const data = state.windowData;
  if (!data || data.id !== state.recordingId || !(data.traces || []).length) return false;
  const filters = data.displayFilters || {};
  if (String(filters.tc || "").toUpperCase() !== String(els.tcSelect?.value || "").toUpperCase()) return false;
  if (String(filters.hf || "").toUpperCase() !== String(els.hfSelect?.value || "").toUpperCase()) return false;
  if (String(filters.ac || "").toUpperCase() !== FIXED_AC_FILTER) return false;
  const activeMontage = activeMontageValue();
  if (Array.isArray(data.montageViews)) {
    const activeView = data.montageViews.find((view) => view.montage === activeMontage);
    if (!activeView || activeView.available === false || !(activeView.traces || []).length) return false;
  } else if (data.montage && data.montage !== activeMontage) {
    return false;
  }
  const loadedStart = Number(data.start);
  const loadedDuration = Number(data.duration);
  const targetStart = Number(start);
  const targetDuration = Number(duration);
  if (![loadedStart, loadedDuration, targetStart, targetDuration].every(Number.isFinite)) return false;
  const tolerance = 0.002;
  return targetStart >= loadedStart - tolerance
    && targetStart + targetDuration <= loadedStart + loadedDuration + tolerance;
}

async function handleDurationControlChange(source = "change") {
  if (!els.durationSelect) return;
  resetResearchPrefetch();
  state.lastDurationSelectValue = els.durationSelect.value || "";
  const nextDuration = Number(state.lastDurationSelectValue || 10) || 10;
  const researchCase = currentResearchCase();
  // 研究症例ではTimebase変更後も、注目波形の時刻を画面中央に保つ。
  // Keep the target waveform centered after Timebase changes in both desktop and mobile viewers.
  const nextStart = TEST_ONLY_DISTRIBUTION && researchCase
    ? centeredStartForResearchCase(researchCase, nextDuration)
    : clampStart(state.start, nextDuration);
  state.start = nextStart;
  updateWaveScrollbar();
  renderStatus();
  if (loadedWindowMatchesCurrentDisplay(nextStart, nextDuration)) {
    cancelActiveWindowLoad();
    syncActiveMontageData({ requireExact: true });
    draw();
    setStatus("Ready");
    schedulePrefetchAfterControlInteraction();
    return;
  }
  setStatus(`Loading timebase ${state.lastDurationSelectValue}s...`, { busy: true, progress: 70 });
  await loadWindow({ activeMontageOnly: TEST_ONLY_DISTRIBUTION });
  schedulePrefetchAfterControlInteraction();
}

function scheduleFilterRefresh(source = "filter", options = {}) {
  if (state.filterRefreshTimer) window.clearTimeout(state.filterRefreshTimer);
  state.filterRefreshTimer = window.setTimeout(() => {
    state.filterRefreshTimer = null;
    const filterKey = filterControlKey();
    const changed = filterKey !== state.lastFilterControlKey;
    if (changed || options.force) {
      handleFilterControlChange(source);
    }
  }, options.delayMs ?? 60);
}

async function handleFilterControlChange(source = "change") {
  state.lastFilterControlKey = filterControlKey();
  resetResearchPrefetch();
  renderStatus();
  setStatus(`Loading filters TC ${tcText()} / HF ${hfText()}...`, { busy: true, progress: 70 });
  // 現在表示中のモンタージュを先に更新し、残りは裏で再取得する。
  await loadWindow({ activeMontageOnly: TEST_ONLY_DISTRIBUTION });
  schedulePrefetchAfterControlInteraction();
}

async function onControlChange(ev) {
  saveSettings();
  if (ev.target === els.montageSelect) {
    await handleMontageControlChange("change");
    return;
  }
  if (ev.target === els.sensitivitySelect) {
    renderStatus();
    draw();
    return;
  }
  if (ev.target === els.durationSelect) {
    await handleDurationControlChange("change");
    return;
  }
  if (ev.target === els.recordingSelect) {
    state.recordingId = els.recordingSelect.value;
    state.start = 0;
    state.cursorTime = null;
    state.dragSelection = null;
    await loadMetadata();
  } else if ([els.tcSelect, els.hfSelect, els.ecgToggle].includes(ev.target)) {
    await handleFilterControlChange("change");
    return;
  }
  await loadWindow();
  scheduleLayoutRefresh();
}


