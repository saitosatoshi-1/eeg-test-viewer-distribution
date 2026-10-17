// Background waveform prefetch. / 波形のバックグラウンド先読み。
// Retains current all-montage and next-two-case behavior.
// 現在症例の全モンタージュと次の2症例の先読み仕様を維持する。

function researchCasePrefetchCenterTime(item) {
  const event = Number(item?.eventTime);
  if (Number.isFinite(event)) return event;
  const epochStart = Number(item?.epochStart);
  const duration = Number(item?.durationSec);
  if (Number.isFinite(epochStart) && Number.isFinite(duration) && duration > 0) return epochStart + duration / 2;
  return Number.isFinite(epochStart) ? epochStart : 0;
}

function researchCasePrefetchStart(item, duration) {
  const safeDuration = Number.isFinite(Number(duration)) && Number(duration) > 0 ? Number(duration) : defaultResearchTimebaseSec();
  return Math.max(0, Number((researchCasePrefetchCenterTime(item) - safeDuration / 2).toFixed(3)));
}

function researchCasePrefetchMontage(item) {
  const profile = researchProfile();
  if (isValidationWorkflow()) return "longitudinal";
  if (isResearchPracticeCase(item)) return "conventional";
  return profile.usualMontage || item?.phase1Montage || activeMontageValue() || "conventional";
}

function researchWindowPrefetchParams(recordId, item, options = {}) {
  const duration = Number(options.duration || els.durationSelect?.value || defaultResearchTimebaseSec()) || defaultResearchTimebaseSec();
  const montage = options.montage || researchCasePrefetchMontage(item);
  const montages = options.montages || montage;
  return {
    id: recordId,
    start: options.start ?? researchCasePrefetchStart(item, duration),
    duration,
    montage,
    montages,
    tc: options.tc ?? els.tcSelect?.value ?? "0.3",
    hf: options.hf ?? els.hfSelect?.value ?? "120",
    ac: FIXED_AC_FILTER,
    ecg: options.ecg ?? (els.ecgToggle?.checked ? "1" : "0"),
    maxPoints: options.maxPoints || windowMaxPoints(),
    strictMontage: TEST_ONLY_DISTRIBUTION ? "1" : "0",
    compactActive: options.compactActive === false ? "0" : "1",
  };
}

async function openResearchCaseForPrefetch(item, signal = null) {
  const path = String(item?.edfPath || "");
  if (!path) return "";
  if (state.researchPrefetchRecordIds.has(path)) return state.researchPrefetchRecordIds.get(path);
  const opened = await fetchJson("/api/open-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    retryAttempts: 1,
    signal,
    body: JSON.stringify({ path }),
  });
  const recordId = opened?.id || "";
  if (recordId) state.researchPrefetchRecordIds.set(path, recordId);
  return recordId;
}

async function prefetchResearchWindow(item, options = {}) {
  if (!TEST_ONLY_DISTRIBUTION || !item?.edfPath) return false;
  const controller = new AbortController();
  state.researchPrefetchControllers.add(controller);
  let cacheKey = "";
  try {
    const recordId = options.recordId || await openResearchCaseForPrefetch(item, controller.signal);
    if (!recordId || controller.signal.aborted) return false;
    const params = researchWindowPrefetchParams(recordId, item, options);
    cacheKey = windowCacheKey(params);
    if (state.windowCache.has(cacheKey) || state.researchPrefetchQueuedKeys.has(cacheKey)) return false;
    state.researchPrefetchQueuedKeys.add(cacheKey);
    const data = await fetchJson(`/api/window?${qs(params)}`, { retryAttempts: 1, signal: controller.signal });
    if (controller.signal.aborted) return false;
    rememberWindowCache(cacheKey, data);
    return true;
  } catch {
    return false;
  } finally {
    if (cacheKey) state.researchPrefetchQueuedKeys.delete(cacheKey);
    state.researchPrefetchControllers.delete(controller);
  }
}

function researchPrefetchCaseKey(item) {
  return [
    item?.caseId || "",
    item?.edfPath || "",
    item?.eventTime ?? "",
    item?.epochStart ?? "",
    item?.durationSec ?? "",
  ].join("|");
}

function enqueueResearchPrefetchCases(items, options = {}) {
  if (!TEST_ONLY_DISTRIBUTION || !hasActiveResearchPrefetchSession()) return;
  const nextItems = [];
  for (const item of items || []) {
    if (!item?.edfPath) continue;
    const key = researchPrefetchCaseKey(item);
    if (!key || state.researchPrefetchQueuedCases.has(key)) continue;
    state.researchPrefetchQueuedCases.add(key);
    nextItems.push(item);
  }
  if (!nextItems.length) return;
  state.researchPrefetchQueue = options.priority
    ? [...nextItems, ...state.researchPrefetchQueue]
    : [...state.researchPrefetchQueue, ...nextItems];
  drainResearchPrefetchQueue(state.researchPrefetchRunId);
}

async function drainResearchPrefetchQueue(runId) {
  if (state.researchPrefetchActive) return;
  state.researchPrefetchActive = true;
  try {
    while (
      state.researchPrefetchQueue.length &&
      runId === state.researchPrefetchRunId &&
      hasActiveResearchPrefetchSession()
    ) {
      const item = state.researchPrefetchQueue.shift();
      state.researchPrefetchQueuedCases.delete(researchPrefetchCaseKey(item));
      await prefetchResearchWindow(item);
      await sleep(isMobileViewport() ? 90 : 45);
    }
  } finally {
    state.researchPrefetchActive = false;
    if (
      state.researchPrefetchQueue.length &&
      hasActiveResearchPrefetchSession()
    ) {
      drainResearchPrefetchQueue(state.researchPrefetchRunId);
    }
  }
}

function scheduleResearchPrefetch(aroundIndex = state.researchCaseIndex) {
  if (!TEST_ONLY_DISTRIBUTION || !hasActiveResearchPrefetchSession()) return;
  const cases = activeResearchCases();
  if (!cases.length) return;
  const index = Math.max(0, Math.min(cases.length - 1, Number(aroundIndex || 0)));
  const responseSource = isValidationWorkflow() ? state.validationSession?.responses : state.researchSession?.responses;
  const answeredIds = new Set((responseSource || []).map((row) => String(row.caseId || "")));
  const ordered = [
    ...cases.slice(index + 1),
    ...cases.slice(0, index),
  ].filter((item) => item?.sampleEpoch || !answeredIds.has(String(item?.caseId || "")));
  const ahead = ordered.slice(0, RESEARCH_PREFETCH_LOOKAHEAD);
  enqueueResearchPrefetchCases(ahead, { priority: true });
}

function scheduleCurrentResearchWindowPrefetch() {
  if (!TEST_ONLY_DISTRIBUTION || !hasActiveResearchPrefetchSession()) return;
  const item = currentResearchCase();
  if (!item?.edfPath || !state.recordingId) return;
  const montage = activeMontageValue();
  const duration = Number(els.durationSelect?.value || 10) || 10;
  window.setTimeout(() => {
    void prefetchResearchWindow(item, {
      recordId: state.recordingId,
      start: state.start,
      duration,
      montage,
      montages: preferredResearchWindowMontages(montage).join(","),
      tc: els.tcSelect?.value || "0.3",
      hf: els.hfSelect?.value || "120",
      ac: FIXED_AC_FILTER,
      ecg: els.ecgToggle?.checked ? "1" : "0",
      maxPoints: windowMaxPoints(),
      compactActive: false,
    });
  }, 0);
}

function schedulePrefetchAfterControlInteraction(delayMs = 400) {
  if (!TEST_ONLY_DISTRIBUTION || !hasActiveResearchPrefetchSession()) return;
  if (state.researchPrefetchResumeTimer) window.clearTimeout(state.researchPrefetchResumeTimer);
  state.researchPrefetchResumeTimer = window.setTimeout(() => {
    state.researchPrefetchResumeTimer = null;
    scheduleCurrentResearchWindowPrefetch();
    scheduleResearchPrefetch(state.researchCaseIndex);
  }, delayMs);
}

function resetResearchPrefetch(options = {}) {
  state.researchPrefetchRunId += 1;
  if (state.researchPrefetchResumeTimer) window.clearTimeout(state.researchPrefetchResumeTimer);
  state.researchPrefetchResumeTimer = null;
  for (const controller of state.researchPrefetchControllers) controller.abort();
  state.researchPrefetchControllers.clear();
  state.researchPrefetchQueue = [];
  state.researchPrefetchQueuedCases.clear();
  state.researchPrefetchQueuedKeys.clear();
  if (options.clearRecords) state.researchPrefetchRecordIds.clear();
}

