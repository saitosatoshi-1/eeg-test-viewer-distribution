// Waveform acquisition and response cache. / 波形取得・応答キャッシュ。
// Uses shared state/els and calls rendering helpers; no startup side effects.
// 共有state/elsと描画関数を利用する。読み込み時に処理を開始しない。

function windowCacheKey(params) {
  return [
    params.id,
    Number(params.start || 0).toFixed(3),
    Number(params.duration || 0).toFixed(3),
    params.montage,
    params.montages || "",
    params.tc,
    params.hf,
    params.ac,
    params.ecg,
    params.maxPoints || "",
    params.strictMontage || "",
    params.compactActive || "",
  ].join("|");
}

function rememberWindowCache(key, data) {
  if (!key || !data) return;
  state.windowCache.set(key, data);
  while (state.windowCache.size > MAX_WINDOW_CACHE_ENTRIES) {
    const firstKey = state.windowCache.keys().next().value;
    state.windowCache.delete(firstKey);
  }
}

function cachedWindowForParams(params) {
  const exact = state.windowCache.get(windowCacheKey(params));
  if (exact || params.compactActive !== "1") return exact;
  // 現在モンタージュを含む全モンタージュ応答も、同じ表示条件なら再利用できる。
  const fullParams = {
    ...params,
    montages: preferredResearchWindowMontages(params.montage).join(","),
    compactActive: "0",
  };
  return state.windowCache.get(windowCacheKey(fullParams));
}

function clearWindowCacheForCurrentRecording() {
  const recordId = String(state.recordingId || "");
  if (!recordId) {
    state.windowCache.clear();
    return;
  }
  for (const key of Array.from(state.windowCache.keys())) {
    if (String(key).startsWith(`${recordId}|`)) state.windowCache.delete(key);
  }
}

function applyWindowData(data, requestedMontage, options = {}) {
  state.windowData = data;
  updateMontageAvailabilityFromWindow(data);
  if (TEST_ONLY_DISTRIBUTION && Array.isArray(data?.montageViews)) {
    const requestedView = data.montageViews.find((view) => view.montage === requestedMontage);
    if (requestedView?.available === false || !(requestedView?.traces || []).length) {
      const fallbackView = data.montageViews.find((view) => view.available !== false && (view.traces || []).length);
      if (fallbackView) {
        data.montage = fallbackView.montage;
        data.traces = fallbackView.traces || [];
        data.times = fallbackView.times || data.times || [];
        requestedMontage = fallbackView.montage;
      }
    }
  }
  state.activeMontage = data.montage || requestedMontage;
  const viewportStart = Number(options.viewportStart);
  state.start = Number.isFinite(viewportStart) ? viewportStart : (state.windowData.start || 0);
  renderStatus();
  updateWaveScrollbar();
  renderWarnings();
  draw();
}

function updateMontageAvailabilityFromWindow(data = state.windowData) {
  if (!els.montageSelect || !Array.isArray(data?.montageViews)) return;
  const availability = new Map(data.montageViews.map((view) => [view.montage, view.available !== false && (view.traces || []).length > 0]));
  for (const option of els.montageSelect.options || []) {
    option.disabled = TEST_ONLY_DISTRIBUTION && availability.has(option.value) && !availability.get(option.value);
  }
}

async function loadWindow(options = {}) {
  if (!state.recordingId) return;
  cancelActiveWindowLoad();
  const requestedMontage = activeMontageValue();
  const viewportStart = Number(state.start || 0);
  const viewportDuration = Number(els.durationSelect?.value || 10) || 10;
  const requestedMontages = options.activeMontageOnly
    ? [requestedMontage]
    : TEST_ONLY_DISTRIBUTION
      ? preferredResearchWindowMontages(requestedMontage)
      : preferredWindowMontages(requestedMontage);
  const params = {
    id: state.recordingId,
    start: viewportStart,
    duration: viewportDuration,
    montage: requestedMontage,
    montages: requestedMontages.join(","),
    tc: els.tcSelect.value,
    hf: els.hfSelect.value,
    ac: FIXED_AC_FILTER,
    ecg: els.ecgToggle.checked ? "1" : "0",
    maxPoints: windowMaxPoints(),
    strictMontage: TEST_ONLY_DISTRIBUTION ? "1" : "0",
    compactActive: options.activeMontageOnly ? "1" : "0",
  };
  const cacheKey = windowCacheKey(params);
  const cached = cachedWindowForParams(params);
  if (cached) {
    applyWindowData(cached, requestedMontage, { viewportStart });
    setStatus("Ready");
    return cached;
  }

  const controller = new AbortController();
  const requestId = state.windowLoadRequestId + 1;
  state.windowLoadRequestId = requestId;
  state.windowLoadController = controller;
  setWaveLoading(true);
  const promise = (async () => {
    const endpoint = "/api/window";
    try {
      setStatus("Loading waveform...", { busy: true, progress: 75 });
      const data = await fetchJson(`${endpoint}?${qs(params)}`, { signal: controller.signal });
      if (requestId !== state.windowLoadRequestId || controller.signal.aborted) return undefined;
      rememberWindowCache(cacheKey, data);
      applyWindowData(data, requestedMontage, { viewportStart });
      return data;
    } catch (err) {
      if (!isAbortError(err) && requestId === state.windowLoadRequestId) {
        setStatus(`Waveform failed: ${err.message}`, { error: true });
      }
      return undefined;
    } finally {
      if (requestId === state.windowLoadRequestId) {
        state.windowLoadController = null;
        state.windowLoadPromise = null;
        setWaveLoading(false);
      }
    }
  })();
  state.windowLoadPromise = promise;
  return promise;
}

