const REQUEST_TOKEN = document.querySelector('meta[name="eeg-viewer-token"]')?.content || "";
const SETTINGS_KEY = "eegViewerSettings.v1";
const PANEL_WIDTHS_KEY = "eegViewerPanelWidths.v1";
const RESEARCH_PROFILE_KEY = "eegViewerResearchProfile.v1";
const RESEARCH_PENDING_RESPONSES_KEY = "eegViewerPendingResearchResponses.v1";
const RESEARCH_RESULT_BACKUP_KEY = "eegViewerResearchResultBackup.v1";
const PUBLIC_WEB_MODE = !["", "localhost", "127.0.0.1", "::1"].includes(window.location.hostname || "");
const TEST_ONLY_DISTRIBUTION = document.body.classList.contains("test-only-distribution");
const PUBLIC_TEST_QUESTION_COUNT = 20;
const DEFAULT_PUBLIC_TEST_DATASET_PATH = "private:validation_v1";
const DEFAULT_PUBLIC_VALIDATION_DATASET_PATH = "private:validation_v1";
const ECG_UV_PER_MM = 5;
const ECG_AUTO_TARGET_MM = 4.5;
const ECG_AUTO_MIN_UV_PER_MM = 5;
const ECG_AUTO_MAX_UV_PER_MM = 250;
const MOBILE_SWIPE_PX_PER_STEP = 12;
const MOBILE_SWIPE_STEP_SEC = 0.2;
const MOBILE_WINDOW_MAX_POINTS = 1500;
const MOBILE_MULTI_MONTAGE_MAX_POINTS = 1000;
const DESKTOP_WINDOW_MAX_POINTS = 5000;
const MOBILE_SWIPE_LOAD_DEBOUNCE_MS = 160;
const MAX_WINDOW_CACHE_ENTRIES = 72;
const RESEARCH_PREFETCH_LOOKAHEAD = 3;
const MONTAGE_LABELS = {
  longitudinal: "縦双極誘導",
  a1a2: "同側耳朶参照基準2",
  conventional: "同側耳朶参照基準1",
  conventional_average: "平均参照基準1",
  average: "平均参照基準2",
  cz: "Cz参照基準",
  transverse: "横双極誘導",
  circular: "環状双極誘導",
};
const DEFAULT_MULTI_MONTAGES = ["conventional", "conventional_average", "longitudinal", "transverse"];
const RESEARCH_PREFETCH_MONTAGES = ["conventional", "conventional_average", "longitudinal", "a1a2", "average", "cz", "transverse", "circular"];
const RIGHT_PANEL_TABS = ["metadata", "test"];
const RESEARCH_RATINGS = ["てんかん性異常あり", "てんかん性異常なし", "判断困難"];
const LAUNCH_PARAMS = new URLSearchParams(window.location.search || "");
const WORKFLOW_MODE = String(LAUNCH_PARAMS.get("mode") || "").trim().toLowerCase() === "validation" ? "validation" : "test";
const DEFAULT_PUBLIC_DATASET_PATH = WORKFLOW_MODE === "validation" ? DEFAULT_PUBLIC_VALIDATION_DATASET_PATH : DEFAULT_PUBLIC_TEST_DATASET_PATH;
const VALIDATION_DECISION_ADOPT = "adopt";
const VALIDATION_DECISION_EXCLUDE = "exclude";
const VALIDATION_DECISION_LABELS = {
  [VALIDATION_DECISION_ADOPT]: "採用",
  [VALIDATION_DECISION_EXCLUDE]: "除外",
};

const state = {
  recordings: [],
  recordingId: "",
  metadata: null,
  windowData: null,
  viewMode: "single",
  multiMontageCount: 3,
  activeMontage: "conventional",
  workspaceMode: "review",
  rightPanelTab: "metadata",
  start: 0,
  context: null,
  cursorTime: null,
  dragSelection: null,
  rightPanelVisible: false,
  windowLoadInFlight: false,
  windowLoadPending: false,
  windowLoadPromise: null,
  windowCache: new Map(),
  suppressNextClick: false,
  touchSwipe: null,
  lastWaveWheelPageAt: 0,
  lastMontageSelectValue: "",
  lastDurationSelectValue: "",
  lastFilterControlKey: "",
  controlWatchTimer: null,
  durationRefreshTimer: null,
  mobileSwipeLoadTimer: null,
  durationSelectFocusedAt: 0,
  panelResizeDrag: null,
  researchTutorialDrag: null,
  researchTutorialMoved: false,
  researchMode: "test",
  researchDataset: null,
  researchDatasetPath: "",
  researchSession: null,
  researchResponses: [],
  researchCaseIndex: 0,
  researchCaseStartedAt: "",
  researchTestStartedAt: "",
  researchTestStartedMs: 0,
  researchTestCompletedAt: "",
  researchResultAutoSubmitted: false,
  researchDebriefSubmitted: false,
  researchSaving: false,
  researchRetryingPending: false,
  researchMontageTiming: null,
  researchPrefetchRunId: 0,
  researchPrefetchActive: false,
  researchPrefetchQueue: [],
  researchPrefetchRecordIds: new Map(),
  researchPrefetchQueuedCases: new Set(),
  researchPrefetchQueuedKeys: new Set(),
  researchTutorialDismissed: false,
  researchSampleCompletedPhases: {},
  researchUsualMontage: "",
  lastResearchResponse: null,
  lastResearchResponseCaseIndex: -1,
  validationSession: null,
  validationResponses: [],
  lastValidationResponse: null,
  lastValidationResponseCaseIndex: -1,
};

const els = {
  recordingSelect: document.getElementById("recordingSelect"),
  recordingLabel: document.querySelector(".recording-label"),
  montageSelect: document.getElementById("montageSelect"),
  workspaceModeButtons: Array.from(document.querySelectorAll("[data-workspace-mode]")),
  rightTabButtons: Array.from(document.querySelectorAll("[data-right-tab]")),
  rightTabPanels: Array.from(document.querySelectorAll("[data-right-tab-panel]")),
  sensitivitySelect: document.getElementById("sensitivitySelect"),
  tcSelect: document.getElementById("tcSelect"),
  hfSelect: document.getElementById("hfSelect"),
  acSelect: document.getElementById("acSelect"),
  durationSelect: document.getElementById("durationSelect"),
  paperSelect: document.getElementById("paperSelect"),
  ecgToggle: document.getElementById("ecgToggle"),
  statusReadout: document.getElementById("statusReadout"),
  metadataPanel: document.getElementById("metadataPanel"),
  warningPanel: document.getElementById("warningPanel"),
  rightTestPanel: document.getElementById("rightTestPanel"),
  waveCanvas: document.getElementById("waveCanvas"),
  waveLoading: document.getElementById("waveLoading"),
  waveScrollbar: document.getElementById("waveScrollbar"),
  eventStrip: document.getElementById("eventStrip"),
  contextMenu: document.getElementById("contextMenu"),
  timeReadout: document.getElementById("timeReadout"),
  calReadout: document.getElementById("calReadout"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  stepBackBtn: document.getElementById("stepBackBtn"),
  stepForwardBtn: document.getElementById("stepForwardBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  workspace: document.querySelector(".workspace"),
  panelResizeHandles: Array.from(document.querySelectorAll("[data-resize-panel]")),
  researchSetupScreen: document.getElementById("researchSetupScreen"),
  researchSetupMessage: document.getElementById("researchSetupMessage"),
  researchSetupDatasetPathInput: document.getElementById("researchSetupDatasetPathInput"),
  validationSetControl: document.getElementById("validationSetControl"),
  validationSetSelect: document.getElementById("validationSetSelect"),
  researchDebriefScreen: document.getElementById("researchDebriefScreen"),
  researchDebriefMessage: document.getElementById("researchDebriefMessage"),
  researchDebriefBehaviorChangeInput: document.getElementById("researchDebriefBehaviorChangeInput"),
  researchDebriefContinueConsentInput: document.getElementById("researchDebriefContinueConsentInput"),
  researchDebriefSubmitBtn: document.getElementById("researchDebriefSubmitBtn"),
  researchCompleteScreen: document.getElementById("researchCompleteScreen"),
  researchCompleteTitle: document.getElementById("researchCompleteTitle"),
  researchCompleteMessage: document.getElementById("researchCompleteMessage"),
  researchMailBox: document.getElementById("researchMailBox"),
  researchEmailBody: document.getElementById("researchEmailBody"),
  researchSavedCsvName: document.getElementById("researchSavedCsvName"),
  researchCopyEmailBtn: document.getElementById("researchCopyEmailBtn"),
  researchShareJsonBtn: document.getElementById("researchShareJsonBtn"),
  researchTutorial: document.getElementById("researchTutorial"),
  researchTutorialDismissBtn: document.getElementById("researchTutorialDismissBtn"),
  researchTutorialTitle: document.getElementById("researchTutorialTitle"),
  researchTutorialLead: document.getElementById("researchTutorialLead"),
  researchTutorialNextTestNote: document.getElementById("researchTutorialNextTestNote"),
  researchTutorialMontageNote: document.getElementById("researchTutorialMontageNote"),
  researchTutorialTargetNote: document.getElementById("researchTutorialTargetNote"),
  researchTutorialSteps: document.getElementById("researchTutorialSteps"),
  researchCompleteSaveDesktopBtn: document.getElementById("researchCompleteSaveDesktopBtn"),
  researchSetupReaderIdInput: document.getElementById("researchSetupReaderIdInput"),
  researchSetupReaderNameInput: document.getElementById("researchSetupReaderNameInput"),
  researchSetupReaderEmailInput: document.getElementById("researchSetupReaderEmailInput"),
  researchSetupReaderAffiliationInput: document.getElementById("researchSetupReaderAffiliationInput"),
  researchConsentConfirmInput: document.getElementById("researchConsentConfirmInput"),
  researchSetupReaderSpecialtySelect: document.getElementById("researchSetupReaderSpecialtySelect"),
  researchPositionSelect: document.getElementById("researchPositionSelect"),
  researchEpilepsySpecialistSelect: document.getElementById("researchEpilepsySpecialistSelect"),
  researchClinicalNeurophysEegSpecialistSelect: document.getElementById("researchClinicalNeurophysEegSpecialistSelect"),
  researchEpilepsyCenterTrainingSelect: document.getElementById("researchEpilepsyCenterTrainingSelect"),
  researchEpilepsyCenterTrainingDurationInput: document.getElementById("researchEpilepsyCenterTrainingDurationInput"),
  researchSetupEpochCountInput: document.getElementById("researchSetupEpochCountInput"),
  researchSetupStartBtn: document.getElementById("researchSetupStartBtn"),
  researchSetupResetProfileBtn: document.getElementById("researchSetupResetProfileBtn"),
  researchStartTestBtn: document.getElementById("researchStartTestBtn"),
  researchToast: document.getElementById("researchToast"),
  researchToastText: document.getElementById("researchToastText"),
  researchUndoBtn: document.getElementById("researchUndoBtn"),
  researchMedicalYearsInput: document.getElementById("researchMedicalYearsInput"),
  researchMonthlyEegReadingCountInput: document.getElementById("researchMonthlyEegReadingCountInput"),
  researchEegReadingCountUnitSelect: document.getElementById("researchEegReadingCountUnitSelect"),
  researchTestProgress: document.getElementById("researchTestProgress"),
  researchWaveProgress: document.getElementById("researchWaveProgress"),
  researchInlineProgress: document.getElementById("researchInlineProgress"),
};

function qs(params) {
  return new URLSearchParams(params).toString();
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cloneFetchOptions(options = {}) {
  const init = { ...options };
  if (options.headers) init.headers = new Headers(options.headers);
  return init;
}

function shouldRetryFetchError(err, response = null) {
  if (!navigator.onLine) return true;
  if (!response) return true;
  return response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
}

async function fetchWithRetry(url, options = {}) {
  const attempts = Math.max(1, Number(options.retryAttempts || 3));
  const retryDelayMs = Math.max(100, Number(options.retryDelayMs || 650));
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const init = cloneFetchOptions(options);
      delete init.retryAttempts;
      delete init.retryDelayMs;
      const headers = new Headers(init.headers || {});
      if (REQUEST_TOKEN) headers.set("X-EEG-Viewer-Token", REQUEST_TOKEN);
      init.headers = headers;
      const res = await fetch(url, init);
      if (res.ok || !shouldRetryFetchError(null, res) || attempt === attempts) return res;
      lastError = new Error(res.statusText || `HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (!shouldRetryFetchError(err) || attempt === attempts) throw err;
    }
    setStatus(`通信が不安定です。再試行中 ${attempt}/${attempts - 1}...`, { busy: true });
    await sleep(retryDelayMs * attempt);
  }
  throw lastError || new Error("Network request failed");
}

async function fetchJson(url, options = {}) {
  const res = await fetchWithRetry(url, options);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || res.statusText);
  return data;
}

async function fetchText(url, options = {}) {
  const res = await fetchWithRetry(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text;
}

function setStatus(message, options = {}) {
  if (!els.statusReadout) return;
  let textEl = els.statusReadout.querySelector(".status-text");
  let progressEl = els.statusReadout.querySelector(".status-progress");
  let progressBarEl = els.statusReadout.querySelector(".status-progress-bar");
  if (!textEl || !progressEl || !progressBarEl) {
    els.statusReadout.textContent = "";
    textEl = document.createElement("span");
    textEl.className = "status-text";
    progressEl = document.createElement("span");
    progressEl.className = "status-progress";
    progressBarEl = document.createElement("span");
    progressBarEl.className = "status-progress-bar";
    progressEl.appendChild(progressBarEl);
    els.statusReadout.append(textEl, progressEl);
  }
  const progress = Number(options.progress);
  const hasProgress = Number.isFinite(progress);
  const pct = Math.max(0, Math.min(100, hasProgress ? progress : 0));
  textEl.textContent = hasProgress ? `${message} ${Math.round(pct)}%` : message;
  progressBarEl.style.width = `${pct}%`;
  els.statusReadout.classList.toggle("has-progress", !!options.busy || hasProgress);
  els.statusReadout.classList.toggle("indeterminate", !!options.busy && !hasProgress);
  els.statusReadout.classList.toggle("busy", !!options.busy);
  els.statusReadout.classList.toggle("error", !!options.error);
}

function setWaveLoading(loading, message = "読み込み中...") {
  if (!els.waveLoading) return;
  els.waveLoading.textContent = message;
  els.waveLoading.hidden = !loading;
}

function clearSharedBrowserResearchState() {
  if (!PUBLIC_WEB_MODE) return;
  try {
    localStorage.removeItem(RESEARCH_PROFILE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function isLikelyMobileViewport() {
  const uaMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrowViewport = window.matchMedia?.("(max-width: 700px)")?.matches;
  const compactHeight = window.matchMedia?.("(orientation: landscape) and (max-height: 620px)")?.matches;
  return Boolean(uaMobile || narrowViewport || (coarsePointer && compactHeight));
}

function updateMobileViewportClass() {
  if (!TEST_ONLY_DISTRIBUTION) return;
  document.body.classList.toggle("mobile-viewport", isLikelyMobileViewport());
  updateMobileControlLabels();
}

function updateMobileControlLabels() {
  const labels = [
    [els.sensitivitySelect, "感度", "Sensitivity"],
    [els.tcSelect, "時定数", "TC"],
    [els.hfSelect, "高域", "HF"],
    [els.montageSelect, "モンタージュ", "Montage"],
    [els.acSelect, "交流", "AC"],
    [els.durationSelect, "表示秒", "Timebase"],
  ];
  const mobile = TEST_ONLY_DISTRIBUTION && isMobileViewport();
  for (const [select, mobileText, desktopText] of labels) {
    const caption = select?.closest(".nk-select")?.querySelector(".select-caption");
    if (caption) caption.textContent = mobile ? mobileText : desktopText;
  }
}

async function init() {
  clearSharedBrowserResearchState();
  updateMobileViewportClass();
  bindControls();
  if (!TEST_ONLY_DISTRIBUTION) {
    bindPanelResizers();
    try {
      restorePanelWidths();
    } catch (err) {
      console.warn("Panel restore skipped", err);
    }
  }
  try {
    scheduleLayoutRefresh();
  } catch (err) {
    console.warn("Initial layout skipped", err);
  }
  window.addEventListener("resize", scheduleLayoutRefresh);
  window.addEventListener("resize", updateMobileViewportClass);
  window.visualViewport?.addEventListener("resize", () => {
    updateMobileViewportClass();
    scheduleLayoutRefresh();
  });
  if (window.ResizeObserver && els.waveCanvas?.parentElement) {
    const observer = new ResizeObserver(scheduleLayoutRefresh);
    observer.observe(els.waveCanvas.parentElement);
  }
  try {
    restoreSettings();
    if (!TEST_ONLY_DISTRIBUTION) {
      applyWorkspaceMode({ redraw: false });
      applyRightPanelTab();
    }
    applyRightPanelVisibility({ redraw: false });
  } catch (err) {
    console.warn("Settings restore skipped", err);
  }
  try {
    restoreResearchProfile();
    applyLaunchParams();
  } catch (err) {
    console.warn("Profile/recent restore skipped", err);
  }
  if (els.recordingLabel) els.recordingLabel.hidden = true;
  state.rightPanelVisible = false;
  applyRightPanelVisibility({ redraw: false });
  setResearchMode(WORKFLOW_MODE);
  rememberControlValues();
  startControlValueWatcher();
  await loadRecordings();
}

function fixedResearchQuestionCount() {
  return PUBLIC_TEST_QUESTION_COUNT;
}

function applyFixedResearchQuestionCount() {
  const value = String(fixedResearchQuestionCount());
  if (els.researchSetupEpochCountInput) els.researchSetupEpochCountInput.value = value;
}

function applyLaunchParams() {
  const params = LAUNCH_PARAMS;
  const dataset = params.get("dataset") || params.get("datasetUrl") || (PUBLIC_WEB_MODE ? DEFAULT_PUBLIC_DATASET_PATH : "");
  if (dataset && els.researchSetupDatasetPathInput) {
    els.researchSetupDatasetPathInput.value = dataset;
  }
  applyFixedResearchQuestionCount();
  applyWorkflowChrome();
}

function isValidationWorkflow() {
  return state.researchMode === "validation";
}

function hasActiveResearchPrefetchSession() {
  return (state.researchMode === "test" && !!state.researchSession) || (state.researchMode === "validation" && !!state.validationSession);
}

function applyWorkflowChrome() {
  const validation = isValidationWorkflow();
  document.body.classList.toggle("validation-workflow", validation);
  const title = document.querySelector(".research-setup-title");
  if (title) title.textContent = validation ? "Validation設定" : "テスト設定";
  const readerLabel = els.researchSetupReaderNameInput?.closest("label");
  if (readerLabel?.firstChild) readerLabel.firstChild.textContent = validation ? "検証者名" : "回答者名 (English)";
  if (els.researchSetupReaderNameInput) {
    els.researchSetupReaderNameInput.placeholder = validation ? "検証者名" : "例: Taro Yamada";
    els.researchSetupReaderNameInput.autocomplete = "name";
  }
  const validationOnly = [els.validationSetControl];
  const testOnly = [
    els.researchSetupReaderEmailInput?.closest("label"),
    els.researchSetupReaderAffiliationInput?.closest("label"),
    els.researchSetupReaderSpecialtySelect?.closest("label"),
    els.researchPositionSelect?.closest("label"),
    els.researchMedicalYearsInput?.closest("label"),
    els.researchMonthlyEegReadingCountInput?.closest("label"),
    els.researchEpilepsySpecialistSelect?.closest("label"),
    els.researchClinicalNeurophysEegSpecialistSelect?.closest("label"),
    els.researchEpilepsyCenterTrainingSelect?.closest("label"),
    els.researchEpilepsyCenterTrainingDurationInput?.closest("label"),
    document.querySelector(".research-fixed-count"),
    document.querySelector(".research-consent-box"),
  ];
  for (const el of validationOnly) if (el) el.hidden = !validation;
  for (const el of testOnly) if (el) el.hidden = validation;
  if (els.researchSetupStartBtn) els.researchSetupStartBtn.textContent = validation ? "Validationを開始" : "開始";
  const tab = document.querySelector('[data-right-tab="test"]');
  if (tab) tab.textContent = validation ? "Validation" : "Test";
  const panelTitle = document.querySelector('[data-right-tab-panel="test"] .panel-title');
  if (panelTitle) panelTitle.textContent = validation ? "Validation" : "Test";
  if (els.researchUndoBtn) els.researchUndoBtn.title = "前の回答を取り消して、その問題に戻ります";
}

function scheduleLayoutRefresh() {
  const refresh = () => {
    resizeCanvas();
    draw();
  };
  if (TEST_ONLY_DISTRIBUTION) {
    requestAnimationFrame(refresh);
    window.setTimeout(refresh, 120);
    return;
  }
  requestAnimationFrame(() => {
    refresh();
    requestAnimationFrame(refresh);
  });
  window.setTimeout(refresh, 80);
  window.setTimeout(refresh, 300);
}

function forceViewerRepaint() {
  const refresh = () => {
    resizeCanvas();
    draw();
    renderStatus();
  };
  refresh();
  requestAnimationFrame(refresh);
  window.setTimeout(refresh, 60);
  window.setTimeout(refresh, 180);
  window.setTimeout(refresh, 420);
}

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
  }, 150);
}

function checkDeferredControlValues(source = "deferred") {
  const montageValue = els.montageSelect?.value || "";
  const durationValue = els.durationSelect?.value || "";
  const filterKey = filterControlKey();
  if (montageValue && montageValue !== state.lastMontageSelectValue) {
    state.lastMontageSelectValue = montageValue;
    handleMontageControlChange(source);
  }
  if (durationValue && durationValue !== state.lastDurationSelectValue) {
    state.lastDurationSelectValue = durationValue;
    handleDurationControlChange(source);
  }
  if (filterKey !== state.lastFilterControlKey) {
    state.lastFilterControlKey = filterKey;
    handleFilterControlChange(source);
  }
}

function scheduleDurationRefresh(source = "duration", options = {}) {
  if (!els.durationSelect) return;
  if (state.durationRefreshTimer) window.clearTimeout(state.durationRefreshTimer);
  state.durationRefreshTimer = window.setTimeout(() => {
    state.durationRefreshTimer = null;
    const value = els.durationSelect?.value || "";
    const currentDuration = Number(state.windowData?.duration || 0);
    const selectedDuration = Number(value || 0);
    const changed = value && value !== state.lastDurationSelectValue;
    const dataMismatch = Number.isFinite(selectedDuration) && selectedDuration > 0 && Math.abs(currentDuration - selectedDuration) > 0.001;
    if (changed || dataMismatch || options.force) {
      handleDurationControlChange(source);
    }
  }, options.delayMs ?? 40);
}

function commitDurationSelection(source = "duration") {
  const select = els.durationSelect;
  if (!select) return;
  const focusedMs = Date.now() - Number(state.durationSelectFocusedAt || 0);
  const shouldBlur = document.activeElement === select && (source.includes("change") || source.includes("input") || focusedMs > 250);
  if (shouldBlur) {
    window.setTimeout(() => {
      if (document.activeElement === select) select.blur();
      scheduleDurationRefresh(`${source}-commit`, { force: true, delayMs: 30 });
    }, 0);
  }
  scheduleDurationRefresh(source, { force: true, delayMs: 80 });
  window.setTimeout(() => scheduleDurationRefresh(`${source}-late`, { force: true, delayMs: 0 }), 260);
}

function filterControlKey() {
  return [
    els.tcSelect?.value || "",
    els.hfSelect?.value || "",
    normalizeAcValue(els.acSelect?.value),
    els.ecgToggle?.checked ? "1" : "0",
  ].join("|");
}

function normalizeAcValue(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "50" || raw === "50HZ") return "50";
  if (raw === "60" || raw === "60HZ") return "60";
  return "OFF";
}

function normalizeAcSelect() {
  if (!els.acSelect) return "OFF";
  const value = normalizeAcValue(els.acSelect.value);
  if (els.acSelect.value !== value) els.acSelect.value = value;
  return value;
}

function acFilterLabel(value = normalizeAcValue(els.acSelect?.value)) {
  const normalized = normalizeAcValue(value);
  return normalized === "OFF" ? "OFF" : `${normalized} Hz`;
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
  return isMultiMontageMode() ? MOBILE_MULTI_MONTAGE_MAX_POINTS : MOBILE_WINDOW_MAX_POINTS;
}

async function handleMontageControlChange(source = "change") {
  if (!els.montageSelect) return;
  state.lastMontageSelectValue = els.montageSelect.value || "";
  state.activeMontage = state.lastMontageSelectValue || state.activeMontage;
  updateResearchMontageTiming();
  renderStatus();
  if (syncActiveMontageData({ requireExact: true })) {
    draw();
    setStatus("Ready");
    return;
  }
  setStatus(`Loading montage ${state.activeMontage} / ${labelForMontage()}...`, { busy: true, progress: 70 });
  await loadWindow();
  draw();
}

async function handleDurationControlChange(source = "change") {
  if (!els.durationSelect) return;
  state.lastDurationSelectValue = els.durationSelect.value || "";
  const nextDuration = Number(state.lastDurationSelectValue || 10) || 10;
  if (state.windowData) {
    state.windowData.duration = nextDuration;
  }
  state.start = clampStart(state.start, nextDuration);
  updateWaveScrollbar();
  renderStatus();
  forceViewerRepaint();
  setStatus(`Loading timebase ${state.lastDurationSelectValue}s...`, { busy: true, progress: 70 });
  await loadWindow();
  forceViewerRepaint();
}

async function handleFilterControlChange(source = "change") {
  state.lastFilterControlKey = filterControlKey();
  renderStatus();
  forceViewerRepaint();
  setStatus(`Loading filters TC ${tcText()} / HF ${hfText()}...`, { busy: true, progress: 70 });
  await loadWindow();
  forceViewerRepaint();
}

function resizeCanvas() {
  const rect = els.waveCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(480, Math.floor(rect.width * ratio));
  const height = Math.max(240, Math.floor(rect.height * ratio));
  if (els.waveCanvas.width !== width) els.waveCanvas.width = width;
  if (els.waveCanvas.height !== height) els.waveCanvas.height = height;
}

function bindControls() {
  [
    els.recordingSelect,
    els.montageSelect,
    els.sensitivitySelect,
    els.tcSelect,
    els.hfSelect,
    els.acSelect,
    els.durationSelect,
    els.paperSelect,
    els.ecgToggle,
  ].filter(Boolean).forEach((el) => el.addEventListener("change", onControlChange));
  [
    els.montageSelect,
    els.sensitivitySelect,
    els.durationSelect,
    els.tcSelect,
    els.hfSelect,
    els.acSelect,
    els.ecgToggle,
  ].filter(Boolean).forEach((el) => {
    const check = () => window.setTimeout(() => checkDeferredControlValues("deferred"), 0);
    el.addEventListener("blur", check);
    el.addEventListener("click", check);
    el.addEventListener("input", check);
    el.addEventListener("keyup", check);
    el.addEventListener("mouseup", check);
  });
  els.sensitivitySelect?.addEventListener("input", () => {
    saveSettings();
    renderStatus();
    draw();
  });
  if (els.durationSelect) {
    els.durationSelect.addEventListener("focus", () => {
      state.durationSelectFocusedAt = Date.now();
    });
    els.durationSelect.addEventListener("input", () => commitDurationSelection("duration-input"));
    els.durationSelect.addEventListener("change", () => commitDurationSelection("duration-change"));
    els.durationSelect.addEventListener("pointerup", () => commitDurationSelection("duration-pointerup"));
    els.durationSelect.addEventListener("keyup", () => commitDurationSelection("duration-keyup"));
    window.addEventListener("focus", () => scheduleDurationRefresh("duration-window-focus", { delayMs: 80 }));
  }
  els.prevBtn?.addEventListener("click", () => {
    pageWaveform(-1);
  });
  els.nextBtn?.addEventListener("click", () => {
    pageWaveform(1);
  });
  els.stepBackBtn?.addEventListener("click", () => {
    state.start = clampStart(state.start - 1);
    state.cursorTime = null;
    loadWindow();
  });
  els.stepForwardBtn?.addEventListener("click", () => {
    state.start = clampStart(state.start + 1);
    state.cursorTime = null;
    loadWindow();
  });
  els.reloadBtn?.addEventListener("click", loadWindow);
  if (!TEST_ONLY_DISTRIBUTION) {
    for (const btn of els.workspaceModeButtons || []) {
      btn.addEventListener("click", () => setWorkspaceMode(btn.dataset.workspaceMode || "review"));
    }
    for (const btn of els.rightTabButtons || []) {
      btn.addEventListener("click", () => setRightPanelTab(btn.dataset.rightTab || "test"));
    }
  }
  els.waveCanvas?.addEventListener("contextmenu", openContextMenu);
  els.waveCanvas?.addEventListener("mousedown", onWaveMouseDown);
  els.waveCanvas?.addEventListener("mousemove", onWaveMouseMove);
  els.waveCanvas?.addEventListener("mouseup", onWaveMouseUp);
  window.addEventListener("mouseup", onWaveMouseUp);
  els.waveCanvas?.addEventListener("mouseleave", onWaveMouseLeave);
  els.waveCanvas?.addEventListener("wheel", onWaveWheel, { passive: false });
  els.waveCanvas?.addEventListener("touchstart", onWaveTouchStart, { passive: true });
  els.waveCanvas?.addEventListener("touchmove", onWaveTouchMove, { passive: false });
  els.waveCanvas?.addEventListener("touchend", onWaveTouchEnd, { passive: false });
  els.waveCanvas?.addEventListener("touchcancel", onWaveTouchCancel);
  els.waveCanvas?.addEventListener("click", onWaveClick);
  els.waveCanvas?.addEventListener("dblclick", onWaveDoubleClick);
  if (els.waveScrollbar) {
    els.waveScrollbar.addEventListener("input", onWaveScrollbarInput);
    els.waveScrollbar.addEventListener("change", onWaveScrollbarChange);
  }
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", (ev) => {
    if (!els.contextMenu?.contains(ev.target)) hideContextMenu();
  });
  window.addEventListener("online", () => {
    setStatus("オンラインに戻りました。未送信回答を確認します");
    retryPendingResearchResponses();
  });
  window.addEventListener("offline", () => {
    setStatus("オフラインです。回答は可能な範囲で一時保存します", { error: true });
  });
  els.contextMenu?.addEventListener("click", onContextMenuClick);
  els.rightTestPanel?.addEventListener("click", onRightTestPanelClick);

  bindResearchControls();
}


function bindResearchControls() {
  els.researchStartTestBtn?.addEventListener("click", startWorkflow);
  els.researchSetupStartBtn?.addEventListener("click", startWorkflow);
  els.researchSetupResetProfileBtn?.addEventListener("click", resetResearchProfileForm);
  els.validationSetSelect?.addEventListener("change", () => setValidationDatasetKind(els.validationSetSelect.value || "ied"));
  els.researchCompleteSaveDesktopBtn?.addEventListener("click", exportResearchJson);
  els.researchShareJsonBtn?.addEventListener("click", shareResearchJsonByEmail);
  els.researchCopyEmailBtn?.addEventListener("click", copyResearchEmailBody);
  els.researchDebriefSubmitBtn?.addEventListener("click", submitResearchDebriefing);
  els.researchTutorialDismissBtn?.addEventListener("click", () => {
    state.researchTutorialDismissed = true;
    updateResearchTutorial();
  });
  els.researchTutorial?.addEventListener("pointerdown", onResearchTutorialPointerDown);
  window.addEventListener("pointermove", onResearchTutorialPointerMove);
  window.addEventListener("pointerup", finishResearchTutorialDrag);
  window.addEventListener("pointercancel", finishResearchTutorialDrag);
  els.researchUndoBtn?.addEventListener("click", undoLastResearchAction);
  [
    els.researchMedicalYearsInput,
    els.researchSetupReaderIdInput,
    els.researchSetupReaderNameInput,
    els.researchSetupReaderEmailInput,
    els.researchSetupReaderAffiliationInput,
    els.researchConsentConfirmInput,
    els.researchSetupReaderSpecialtySelect,
    els.researchPositionSelect,
    els.researchEpilepsySpecialistSelect,
    els.researchClinicalNeurophysEegSpecialistSelect,
    els.researchEpilepsyCenterTrainingSelect,
    els.researchEpilepsyCenterTrainingDurationInput,
    els.researchEegReadingCountUnitSelect,
    els.researchSetupEpochCountInput,
  ].filter(Boolean).forEach((el) => el.addEventListener("change", () => {
    updateEpilepsyCenterDurationRequirement();
    saveResearchProfile();
  }));
  updateEpilepsyCenterDurationRequirement();
}
function startWorkflow() {
  if (isValidationWorkflow()) return startValidationWorkflow();
  return startResearchTest();
}



function resetResearchProfileForm() {
  const textInputs = [
    els.researchSetupReaderIdInput,
    els.researchSetupReaderNameInput,
    els.researchSetupReaderEmailInput,
    els.researchSetupReaderAffiliationInput,
    els.researchMedicalYearsInput,
    els.researchMonthlyEegReadingCountInput,
    els.researchEpilepsyCenterTrainingDurationInput,
  ];
  for (const input of textInputs.filter(Boolean)) input.value = "";
  if (els.researchConsentConfirmInput) els.researchConsentConfirmInput.checked = false;
  for (const select of [
    els.researchSetupReaderSpecialtySelect,
    els.researchPositionSelect,
    els.researchEpilepsySpecialistSelect,
    els.researchClinicalNeurophysEegSpecialistSelect,
    els.researchEpilepsyCenterTrainingSelect,
  ].filter(Boolean)) select.value = "";
  if (els.researchEegReadingCountUnitSelect) els.researchEegReadingCountUnitSelect.value = "month";
  try {
    localStorage.removeItem(RESEARCH_PROFILE_KEY);
  } catch {
    // Ignore private-mode storage failures.
  }
  updateEpilepsyCenterDurationRequirement();
  setResearchSetupMessage("テスト者情報を初期化しました。");
  setStatus("Test profile reset");
  els.researchSetupReaderNameInput?.focus();
}

function updateEpilepsyCenterDurationRequirement() {
  const hasTraining = els.researchEpilepsyCenterTrainingSelect?.value === "yes";
  if (!els.researchEpilepsyCenterTrainingDurationInput) return;
  els.researchEpilepsyCenterTrainingDurationInput.disabled = !hasTraining;
  els.researchEpilepsyCenterTrainingDurationInput.required = hasTraining;
  if (!hasTraining) els.researchEpilepsyCenterTrainingDurationInput.value = "";
  els.researchEpilepsyCenterTrainingDurationInput.placeholder = hasTraining ? "例: 6か月、2年" : "勤務歴なしの場合は不要";
}

function validateResearchProfileForStart() {
  updateEpilepsyCenterDurationRequirement();
  if (isValidationWorkflow()) {
    const reviewerId = String(els.researchSetupReaderNameInput?.value || els.researchSetupReaderIdInput?.value || "").trim();
    if (reviewerId) return true;
    const message = "名前を入力してください。";
    setResearchSetupMessage(message, true);
    setStatus(message, { error: true });
    els.researchSetupReaderNameInput?.focus();
    return false;
  }
  const requiredFields = [
    [els.researchSetupReaderNameInput, "回答者名 (English)"],
    [els.researchSetupReaderEmailInput, "メール"],
    [els.researchSetupReaderAffiliationInput, "所属 (English)"],
    [els.researchPositionSelect, "診療科専門医・指導医資格"],
    [els.researchSetupReaderSpecialtySelect, "診療科"],
    [els.researchMedicalYearsInput, "診療科目年数"],
    [els.researchMonthlyEegReadingCountInput, "脳波判読件数"],
    [els.researchEpilepsySpecialistSelect, "てんかん専門医・指導医資格"],
    [els.researchClinicalNeurophysEegSpecialistSelect, "臨床神経生理学会脳波専門医・指導医資格"],
    [els.researchEpilepsyCenterTrainingSelect, "てんかんセンター勤務歴"],
  ];
  if (els.researchEpilepsyCenterTrainingSelect?.value === "yes") {
    requiredFields.splice(requiredFields.length - 1, 0, [els.researchEpilepsyCenterTrainingDurationInput, "勤務期間"]);
  }
  const missing = requiredFields.filter(([el]) => !String(el?.value ?? "").trim());
  const email = String(els.researchSetupReaderEmailInput?.value || "").trim();
  const invalidEmail = email && els.researchSetupReaderEmailInput?.validity?.valid === false;
  const consentMissing = !els.researchConsentConfirmInput?.checked;
  if (!missing.length && !invalidEmail && !consentMissing) return true;
  const labels = missing.map(([, label]) => label);
  if (invalidEmail) labels.push("メール形式");
  if (consentMissing) labels.push("倫理説明の確認");
  const message = `未入力または確認が必要な項目があります: ${labels.join("、")}`;
  setResearchSetupMessage(message, true);
  setStatus(message, { error: true });
  window.alert(message);
  const first = missing[0]?.[0] || (invalidEmail ? els.researchSetupReaderEmailInput : null);
  first?.focus?.();
  if (!first && consentMissing) els.researchConsentConfirmInput?.focus?.();
  return false;
}

function researchProfile() {
  const storedProfile = storedResearchProfile();
  const readingCount = eegReadingCountValue();
  const readingUnit = eegReadingCountUnit();
  return {
    datasetPath: els.researchSetupDatasetPathInput?.value.trim() || state.researchDatasetPath || "",
    readerId: els.researchSetupReaderIdInput?.value.trim() || "",
    readerName: els.researchSetupReaderNameInput?.value.trim() || "",
    email: els.researchSetupReaderEmailInput?.value.trim() || "",
    affiliation: els.researchSetupReaderAffiliationInput?.value.trim() || "",
    specialty: els.researchSetupReaderSpecialtySelect?.value || "",
    position: els.researchPositionSelect?.value || "",
    epilepsySpecialist: els.researchEpilepsySpecialistSelect?.value || "",
    clinicalNeurophysEegSpecialist: els.researchClinicalNeurophysEegSpecialistSelect?.value || "",
    usualMontage: state.researchUsualMontage || storedProfile.usualMontage || "",
    medicalPracticeYears: els.researchMedicalYearsInput?.value === "" ? "" : Number(els.researchMedicalYearsInput?.value || 0),
    eegReadingCount: readingCount,
    eegReadingCountUnit: readingCount === "" ? "" : readingUnit,
    monthlyEegReadingCount: monthlyEegReadingCountValue(readingCount, readingUnit),
    annualEegReadingCount: annualEegReadingCountValue(readingCount, readingUnit),
    epilepsyCenterTraining: els.researchEpilepsyCenterTrainingSelect?.value || "",
    epilepsyCenterTrainingDuration: els.researchEpilepsyCenterTrainingDurationInput?.value.trim() || "",
    ethicsNoticeConfirmed: Boolean(els.researchConsentConfirmInput?.checked),
    dataProviderSharingAcknowledged: Boolean(els.researchConsentConfirmInput?.checked),
    dataProviderName: "Temple University, a university in the United States",
    dataProviderSharedFields: ["readerName", "affiliation", "email"],
    dataProviderSharingPurpose: "prevention of EEG data leakage",
  };
}

function eegReadingCountValue() {
  return els.researchMonthlyEegReadingCountInput?.value === "" ? "" : Number(els.researchMonthlyEegReadingCountInput?.value || 0);
}

function eegReadingCountUnit() {
  return els.researchEegReadingCountUnitSelect?.value === "year" ? "year" : "month";
}

function monthlyEegReadingCountValue(value = eegReadingCountValue(), unit = eegReadingCountUnit()) {
  if (value === "") return "";
  const count = Number(value || 0);
  return unit === "year" ? Math.round((count / 12) * 100) / 100 : count;
}

function annualEegReadingCountValue(value = eegReadingCountValue(), unit = eegReadingCountUnit()) {
  if (value === "") return "";
  const count = Number(value || 0);
  return unit === "year" ? count : Math.round(count * 12 * 100) / 100;
}

function storedResearchProfile() {
  if (PUBLIC_WEB_MODE) return {};
  try {
    const profile = JSON.parse(localStorage.getItem(RESEARCH_PROFILE_KEY) || "{}");
    return profile && typeof profile === "object" ? profile : {};
  } catch {
    return {};
  }
}

function readPendingResearchResponses() {
  try {
    const rows = JSON.parse(localStorage.getItem(RESEARCH_PENDING_RESPONSES_KEY) || "[]");
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];
  } catch {
    return [];
  }
}

function writePendingResearchResponses(rows) {
  try {
    localStorage.setItem(RESEARCH_PENDING_RESPONSES_KEY, JSON.stringify(rows.slice(-100)));
  } catch {
    // Ignore storage failures; the server remains the primary store.
  }
}

function queuePendingResearchResponse(payload, reason = "") {
  if (!payload || !payload.caseId) return;
  const rows = readPendingResearchResponses();
  const key = `${payload.readerId || ""}|${payload.phase || "1"}|${payload.caseId || ""}`;
  const next = {
    key,
    queuedAt: new Date().toISOString(),
    reason,
    payload,
  };
  const index = rows.findIndex((row) => row.key === key);
  if (index >= 0) rows[index] = next;
  else rows.push(next);
  writePendingResearchResponses(rows);
}

async function retryPendingResearchResponses() {
  if (state.researchRetryingPending || !navigator.onLine) return;
  const rows = readPendingResearchResponses();
  if (!rows.length) return;
  state.researchRetryingPending = true;
  const remaining = [];
  try {
    for (const row of rows) {
      try {
        await fetchJson("/api/research/test/response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row.payload),
          retryAttempts: 2,
        });
      } catch {
        remaining.push(row);
      }
    }
    writePendingResearchResponses(remaining);
    if (rows.length !== remaining.length) {
      setStatus(remaining.length ? `未送信回答を再送しました。一部は未送信です: ${remaining.length}件` : "未送信回答を再送しました");
    }
  } finally {
    state.researchRetryingPending = false;
  }
}

function safeResultFilenamePart(value, fallback = "reader") {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^[_ .-]+|[_ .-]+$/g, "");
  return (cleaned || fallback).slice(0, 80);
}

function researchReaderDisplayId(profile = researchProfile()) {
  return (
    els.researchReaderIdInput?.value.trim() ||
    profile.readerId ||
    profile.email ||
    profile.readerName ||
    "reader"
  );
}

function researchRunReaderId(baseReaderId = researchReaderDisplayId()) {
  const base = safeResultFilenamePart(baseReaderId, "reader");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}_${stamp}_${random}`;
}

function activeResearchReaderId(profile = researchProfile()) {
  return state.researchSession?.readerId || researchReaderDisplayId(profile);
}

function researchDatasetIdForFilename() {
  const datasetId = state.researchDataset?.datasetId || state.researchSession?.datasetId || "";
  if (datasetId) return safeResultFilenamePart(datasetId, "dataset");
  const privateMatch = String(state.researchDatasetPath || "").match(/^private:([^/]+)$/);
  if (privateMatch) return safeResultFilenamePart(privateMatch[1], "dataset");
  return safeResultFilenamePart(String(state.researchDatasetPath || "dataset").split("/").filter(Boolean).pop() || "dataset", "dataset");
}

function researchResultTimestampPart() {
  const source = state.researchTestCompletedAt || new Date().toISOString();
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return parsed.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function researchJsonFilename(_readerId, profile = researchProfile()) {
  const readerName = safeResultFilenamePart(profile.readerName || "", "EEG_test_results");
  const datasetId = researchDatasetIdForFilename();
  const stamp = researchResultTimestampPart();
  return `${datasetId}_${stamp}_${readerName}.json`;
}

function validationReviewerId(profile = researchProfile()) {
  return state.validationSession?.reviewerId || safeResultFilenamePart(profile.readerName || profile.readerId || "reviewer", "reviewer");
}

function validationJsonFilename(profile = researchProfile()) {
  const reviewer = safeResultFilenamePart(validationReviewerId(profile), "reviewer");
  const datasetId = researchDatasetIdForFilename();
  const validationKind = safeResultFilenamePart(activeValidationDatasetKind(), "validation");
  const stamp = researchResultTimestampPart();
  return `${datasetId}_${validationKind}_${stamp}_${reviewer}_validation.json`;
}

function saveResearchProfile() {
  if (PUBLIC_WEB_MODE) {
    clearSharedBrowserResearchState();
    return;
  }
  try {
    localStorage.setItem(RESEARCH_PROFILE_KEY, JSON.stringify(researchProfile()));
  } catch {
    // Ignore private-mode storage failures.
  }
}

function saveUsualResearchMontage(montage) {
  const value = String(montage || "").trim() || activeMontageValue();
  if (!value) return "";
  state.researchUsualMontage = value;
  if (!PUBLIC_WEB_MODE) {
    try {
      const profile = { ...storedResearchProfile(), ...researchProfile(), usualMontage: value };
      localStorage.setItem(RESEARCH_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore private-mode storage failures.
    }
  }
  return value;
}

function restoreResearchProfile() {
  const profile = storedResearchProfile();
  state.researchUsualMontage = profile.usualMontage || "";
  if (els.researchSetupDatasetPathInput) els.researchSetupDatasetPathInput.value = profile.datasetPath || "";
  if (els.researchSetupReaderIdInput) els.researchSetupReaderIdInput.value = profile.readerId || "";
  if (els.researchSetupReaderNameInput) els.researchSetupReaderNameInput.value = profile.readerName || "";
  if (els.researchSetupReaderEmailInput) els.researchSetupReaderEmailInput.value = profile.email || "";
  if (els.researchSetupReaderAffiliationInput) els.researchSetupReaderAffiliationInput.value = profile.affiliation || "";
  if (els.researchSetupReaderSpecialtySelect) els.researchSetupReaderSpecialtySelect.value = profile.specialty || "";
  if (els.researchPositionSelect) els.researchPositionSelect.value = profile.position || "";
  if (els.researchEpilepsySpecialistSelect) els.researchEpilepsySpecialistSelect.value = profile.epilepsySpecialist || "";
  if (els.researchClinicalNeurophysEegSpecialistSelect) els.researchClinicalNeurophysEegSpecialistSelect.value = profile.clinicalNeurophysEegSpecialist || "";
  if (els.researchMedicalYearsInput) els.researchMedicalYearsInput.value = profile.medicalPracticeYears ?? "";
  if (els.researchEegReadingCountUnitSelect) els.researchEegReadingCountUnitSelect.value = profile.eegReadingCountUnit === "year" ? "year" : "month";
  if (els.researchMonthlyEegReadingCountInput) {
    els.researchMonthlyEegReadingCountInput.value = profile.eegReadingCount ?? profile.monthlyEegReadingCount ?? "";
  }
  if (els.researchEpilepsyCenterTrainingSelect) els.researchEpilepsyCenterTrainingSelect.value = profile.epilepsyCenterTraining || "";
  if (els.researchEpilepsyCenterTrainingDurationInput) els.researchEpilepsyCenterTrainingDurationInput.value = profile.epilepsyCenterTrainingDuration || "";
  if (els.researchConsentConfirmInput) els.researchConsentConfirmInput.checked = Boolean(profile.ethicsNoticeConfirmed);
}

function currentResearchDisplayedMontages() {
  const montages = isMultiMontageMode()
    ? multiMontageViews().map((view) => view.montage)
    : [activeMontageValue()];
  return [...new Set(montages.filter(Boolean))];
}

function startResearchMontageTiming() {
  const now = performance.now();
  const activeMontages = currentResearchDisplayedMontages();
  state.researchMontageTiming = {
    startedAtMs: now,
    lastAtMs: now,
    initialMontages: [...activeMontages],
    activeMontages,
    totalsSec: {},
    timeline: [],
    switches: activeMontages.map((montage, index) => ({
      index: index + 1,
      atSec: 0,
      from: "",
      to: montage,
    })),
  };
}

function updateResearchMontageTiming(nextMontages = currentResearchDisplayedMontages()) {
  const timing = state.researchMontageTiming;
  if (!timing) return;
  const now = performance.now();
  const elapsedSec = Math.max(0, (now - Number(timing.lastAtMs || now)) / 1000);
  const previousMontages = [...new Set((timing.activeMontages || []).filter(Boolean))];
  const nextUnique = [...new Set((nextMontages || []).filter(Boolean))];
  const segmentStartSec = Math.max(0, (Number(timing.lastAtMs || now) - Number(timing.startedAtMs || timing.lastAtMs || now)) / 1000);
  const segmentEndSec = Math.max(segmentStartSec, (now - Number(timing.startedAtMs || now)) / 1000);
  for (const montage of previousMontages) {
    timing.totalsSec[montage] = Number(timing.totalsSec[montage] || 0) + elapsedSec;
    timing.timeline.push({
      index: timing.timeline.length + 1,
      montage,
      startSec: Number(segmentStartSec.toFixed(3)),
      endSec: Number(segmentEndSec.toFixed(3)),
      durationSec: Number(elapsedSec.toFixed(3)),
    });
  }
  if (previousMontages.join("|") !== nextUnique.join("|")) {
    timing.switches.push({
      index: timing.switches.length + 1,
      atSec: Number(segmentEndSec.toFixed(3)),
      from: previousMontages.join("+"),
      to: nextUnique.join("+"),
    });
  }
  timing.lastAtMs = now;
  timing.activeMontages = nextUnique;
}

function researchMontageTimingPayload() {
  updateResearchMontageTiming();
  const totals = {};
  const timing = state.researchMontageTiming;
  const initialMontage = (timing?.initialMontages || []).filter(Boolean).join("+") || state.researchCaseInitialMontage || "";
  for (const [montage, seconds] of Object.entries(timing?.totalsSec || {})) {
    totals[montage] = Number(Number(seconds || 0).toFixed(3));
  }
  const summary = Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([montage, seconds]) => `${montage}:${seconds}`)
    .join(";");
  const timeline = (timing?.timeline || []).filter((row) => Number(row.durationSec || 0) > 0);
  const analysisTimeline = timeline.filter((row) => Number(row.durationSec || 0) >= 1);
  const switches = timing?.switches || [];
  const montageUsage = timeline.map((row, index) => ({
    order: index + 1,
    montage: String(row.montage || "").trim(),
    startSec: Number(Number(row.startSec || 0).toFixed(3)),
    endSec: Number(Number(row.endSec || 0).toFixed(3)),
    durationSec: Number(Number(row.durationSec || 0).toFixed(3)),
  })).filter((row) => row.montage);
  const analysisMontageUsage = analysisTimeline.map((row, index) => ({
    order: index + 1,
    montage: String(row.montage || "").trim(),
    startSec: Number(Number(row.startSec || 0).toFixed(3)),
    endSec: Number(Number(row.endSec || 0).toFixed(3)),
    durationSec: Number(Number(row.durationSec || 0).toFixed(3)),
  })).filter((row) => row.montage);
  const analysisTotals = {};
  for (const row of analysisMontageUsage) {
    analysisTotals[row.montage] = Number(Number((analysisTotals[row.montage] || 0) + Number(row.durationSec || 0)).toFixed(3));
  }
  const analysisDisplayedMontages = Object.keys(analysisTotals);
  const analysisHasBipolar = analysisDisplayedMontages.some((montage) => ["longitudinal", "transverse", "circular"].includes(montage));
  const analysisHasReference = analysisDisplayedMontages.some((montage) => ["conventional", "conventional_average", "a1a2", "average", "cz"].includes(montage));
  const montageSequence = switches
    .map((row, index) => ({
      index: Number(row.index || index + 1),
      montage: String(row.to || "").trim(),
      atSec: Number(Number(row.atSec || 0).toFixed(3)),
    }))
    .filter((row) => row.montage);
  const montageOrder = montageSequence.map((row) => row.montage);
  return {
    initialMontage,
    displayedMontages: Object.keys(totals),
    montageDurationsSec: totals,
    montageDurationSummary: summary,
    montageOrder,
    montageSequence,
    montageUsage,
    analysisMontageUsage,
    analysisMontageDurationsSec: analysisTotals,
    analysisDisplayedMontages,
    montageConfirmationBehavior: analysisHasBipolar && analysisHasReference,
    montageUsageAnalysisRule: "exclude_segments_under_1_sec",
    montageTimeline: timeline,
    montageSwitches: switches,
    montageOrderSummary: montageSequence.map((row) => `${row.index}:${row.montage}@${row.atSec}s`).join(";"),
    montageUsageSummary: montageUsage.map((row) => `${row.order}:${row.montage}:${row.startSec}-${row.endSec}s(${row.durationSec}s)`).join(";"),
    analysisMontageUsageSummary: analysisMontageUsage.map((row) => `${row.order}:${row.montage}:${row.startSec}-${row.endSec}s(${row.durationSec}s)`).join(";"),
    montageTimelineSummary: timeline.map((row) => `${row.index}:${row.montage}:${row.startSec}-${row.endSec}s`).join(";"),
    montageSwitchSummary: switches.map((row) => `${row.index}:${row.atSec}s:${row.from || "-"}>${row.to || "-"}`).join(";"),
  };
}

function setResearchControlVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.setAttribute("aria-hidden", visible ? "false" : "true");
}

function updateResearchControlsVisibility() {
  for (const section of document.querySelectorAll("[data-research-section]")) {
    const key = section.dataset.researchSection || "";
    section.hidden = key !== "output";
  }
  updateResearchSetupScreen();
}

function updateResearchSetupScreen() {
  if (!els.researchSetupScreen) return;
  applyWorkflowChrome();
  const showSetup = state.researchMode === "validation" ? !state.validationSession : (state.researchMode === "test" && !state.researchSession);
  document.body.classList.toggle("research-setup-active", showSetup);
  els.researchSetupScreen.hidden = !showSetup;
  els.researchSetupScreen.setAttribute("aria-hidden", showSetup ? "false" : "true");
  if (showSetup) hideResearchCompletion();
}

function researchEmailBodyText(profile = researchProfile()) {
  if (isValidationWorkflow()) {
    const name = profile.readerName || validationReviewerId(profile);
    const validationKindLabel = activeValidationDatasetKindLabel();
    return [
      "斉藤先生",
      "",
      "Validation結果ファイルを提出します。",
      "添付ファイルをご確認ください。",
      "",
      "よろしくお願いいたします。",
      "",
      `氏名: ${name}`,
      `データセット: ${researchDatasetIdForFilename()}`,
      `評価対象: ${validationKindLabel}`,
    ].join("\n");
  }
  const name = profile.readerName || "";
  const email = profile.email || "";
  return [
    "斉藤先生",
    "",
    "脳波読影テストの結果ファイルを提出します。",
    "添付ファイルをご確認ください。",
    "",
    "よろしくお願いいたします。",
    "",
    `氏名: ${name}`,
    `メールアドレス: ${email}`,
  ].join("\n");
}

function updateResearchEmailBody() {
  if (els.researchEmailBody) els.researchEmailBody.value = researchEmailBodyText();
}

function markResearchTestStarted(at = new Date()) {
  state.researchTestStartedAt = at.toISOString();
  state.researchTestStartedMs = at.getTime();
  state.researchTestCompletedAt = "";
}

function researchTestTimingPayload(completedAt = "") {
  const startedAt = state.researchTestStartedAt || state.researchCaseStartedAt || completedAt || "";
  const startMs = Number(state.researchTestStartedMs || (startedAt ? Date.parse(startedAt) : 0));
  const endMs = completedAt ? Date.parse(completedAt) : Date.now();
  const totalElapsedMs = startMs && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;
  return {
    testStartedAt: startedAt,
    testCompletedAt: completedAt || "",
    tutorialCompletedAt: startedAt,
    tutorialToTestCompletedMs: totalElapsedMs,
    tutorialToTestCompletedSec: Math.round(totalElapsedMs / 100) / 10,
    totalElapsedMs,
    totalElapsedSec: Math.round(totalElapsedMs / 100) / 10,
  };
}

function downloadTextFile(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveResearchResultBackup(filename, text) {
  try {
    localStorage.setItem(RESEARCH_RESULT_BACKUP_KEY, JSON.stringify({
      filename,
      text,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // Ignore storage failures; explicit download remains available.
  }
}

function downloadResearchResultBackup() {
  try {
    const backup = JSON.parse(localStorage.getItem(RESEARCH_RESULT_BACKUP_KEY) || "{}");
    if (backup?.filename && backup?.text) {
      downloadTextFile(backup.filename, backup.text);
      return backup;
    }
  } catch {
    // Ignore malformed backup.
  }
  return null;
}

function isMobileViewport() {
  return window.matchMedia?.("(max-width: 700px)")?.matches || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
}

function defaultResearchTimebaseSec() {
  return TEST_ONLY_DISTRIBUTION && isMobileViewport() ? 4 : 10;
}

function researchCaseCenterTime(item) {
  const event = Number(item?.eventTime);
  if (Number.isFinite(event)) return event;
  const total = recordingDuration();
  if (Number.isFinite(total) && total > 0) return total / 2;
  const epochStart = Number(item?.epochStart);
  const duration = Number(item?.durationSec);
  if (Number.isFinite(epochStart) && Number.isFinite(duration) && duration > 0) return epochStart + duration / 2;
  return Number.isFinite(epochStart) ? epochStart : 0;
}

function centeredStartForResearchCase(item, timebaseSec = visibleDuration()) {
  const duration = Number(timebaseSec);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : defaultResearchTimebaseSec();
  return clampStart(researchCaseCenterTime(item) - safeDuration / 2, safeDuration);
}

async function requestMobileFullscreen() {
  if (!TEST_ONLY_DISTRIBUTION || !isMobileViewport()) return;
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
  if (!request || document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    await request.call(root);
    document.body.classList.add("viewer-fullscreen");
  } catch {
    document.body.classList.add("viewer-fullscreen-requested");
  }
}

function showResearchCompletion() {
  if (!els.researchCompleteScreen) return;
  const mobile = isMobileViewport();
  hideResearchDebriefing();
  els.researchCompleteScreen.hidden = false;
  els.researchCompleteScreen.setAttribute("aria-hidden", "false");
  const validation = isValidationWorkflow();
  if (els.researchCompleteTitle) els.researchCompleteTitle.textContent = "お疲れ様でした!";
  if (els.researchCompleteMessage) {
    els.researchCompleteMessage.hidden = mobile && !validation;
    els.researchCompleteMessage.textContent = validation
      ? "Validation結果JSONファイルをダウンロードし、メールに添付して送ってください。"
      : (mobile ? "" : "JSONファイルをダウンロードし、メールに添付して送ってください。");
  }
  if (els.researchMailBox) els.researchMailBox.hidden = mobile && !validation;
  if (els.researchCopyEmailBtn) els.researchCopyEmailBtn.hidden = mobile && !validation;
  if (els.researchShareJsonBtn) els.researchShareJsonBtn.hidden = validation || !mobile;
  if (els.researchCompleteSaveDesktopBtn) {
    els.researchCompleteSaveDesktopBtn.hidden = mobile && !validation;
    els.researchCompleteSaveDesktopBtn.textContent = "JSONファイルをダウンロード";
  }
  updateResearchEmailBody();
  if (els.researchSavedCsvName) {
    els.researchSavedCsvName.textContent = "JSONファイルはまだダウンロードされていません。";
  }
  hideResearchWaveProgress();
}

function hideResearchCompletion() {
  if (!els.researchCompleteScreen) return;
  els.researchCompleteScreen.hidden = true;
  els.researchCompleteScreen.setAttribute("aria-hidden", "true");
  if (els.researchMailBox) els.researchMailBox.hidden = false;
  if (els.researchCopyEmailBtn) els.researchCopyEmailBtn.hidden = false;
  if (els.researchShareJsonBtn) els.researchShareJsonBtn.hidden = false;
}

function showResearchDebriefing() {
  if (!els.researchDebriefScreen) {
    showResearchCompletion();
    return;
  }
  hideResearchCompletion();
  hideResearchDebriefing();
  els.researchDebriefScreen.hidden = false;
  els.researchDebriefScreen.setAttribute("aria-hidden", "false");
  if (els.researchDebriefMessage) els.researchDebriefMessage.textContent = "";
  hideResearchWaveProgress();
}

function hideResearchDebriefing() {
  if (!els.researchDebriefScreen) return;
  els.researchDebriefScreen.hidden = true;
  els.researchDebriefScreen.setAttribute("aria-hidden", "true");
}

function setResearchSetupMessage(message = "", isError = false) {
  if (!els.researchSetupMessage) return;
  els.researchSetupMessage.textContent = message;
  els.researchSetupMessage.hidden = !message;
  els.researchSetupMessage.classList.toggle("is-error", Boolean(isError));
}

function setResearchStartBusy(isBusy) {
  for (const btn of [els.researchStartTestBtn, els.researchSetupStartBtn]) {
    if (!btn) continue;
    btn.disabled = isBusy;
    btn.textContent = isBusy ? "開始中..." : (btn === els.researchSetupStartBtn ? (isValidationWorkflow() ? "Validationを開始" : "開始") : "Start");
  }
}

function setResearchMode(mode) {
  state.researchMode = mode === "validation" ? "validation" : "test";
  applyWorkflowChrome();
  hideResearchCompletion();
  document.body.classList.add("research-mode");
  updateResearchControlsVisibility();
  if (state.researchMode !== "test") {
    resetResearchPrefetch();
    state.researchTutorialDismissed = false;
    state.researchSampleCompletedPhases = {};
    hideResearchTutorial();
    state.researchSession = null;
    state.researchResponses = [];
    state.lastResearchResponse = null;
  } else {
    state.validationSession = null;
    state.validationResponses = [];
    state.lastValidationResponse = null;
  }
  renderRightResearchPanels();
  hideResearchToast();
  updateResearchSetupScreen();
  refreshResearchDisplay();
}

function activeResearchCases() {
  if (state.researchMode === "validation" && state.validationSession) {
    return state.validationSession.cases || [];
  }
  if ((state.researchMode === "test" && state.researchSession) || (isValidationWorkflow() && state.validationSession)) {
    const phase = String(state.researchSession.phase || "");
    const cases = cappedResearchSessionCases(state.researchSession.cases || []);
    if (Number(state.researchSession.answeredCount || 0) > 0) {
      return cases.filter((row) => !row.sampleEpoch);
    }
    const completed = state.researchSampleCompletedPhases[phase] || {};
    return cases.filter((row) => !row.sampleEpoch || !completed[String(row.caseId || "")]);
  }
  return state.researchDataset?.cases || [];
}

function cappedResearchSessionCases(cases) {
  const samples = [];
  const selected = [];
  for (const row of cases || []) {
    if (row?.sampleEpoch) {
      samples.push(row);
      continue;
    }
    if (selected.length < fixedResearchQuestionCount()) selected.push(row);
  }
  return [...samples, ...selected];
}

function currentResearchCase() {
  const cases = activeResearchCases();
  if (!cases.length) return null;
  state.researchCaseIndex = Math.max(0, Math.min(cases.length - 1, state.researchCaseIndex));
  return cases[state.researchCaseIndex];
}

function isResearchPracticeCase(item = currentResearchCase()) {
  return !!(item?.sampleEpoch && state.researchSession?.phase === "1");
}

function isResearchMontageSetupPractice(item = currentResearchCase()) {
  return isResearchPracticeCase(item) && String(item?.sampleStep || "") === "montage_setup";
}

function researchPracticeSampleNumber(item = currentResearchCase()) {
  if (!isResearchPracticeCase(item)) return 0;
  const sampleCases = (state.researchSession?.cases || []).filter((row) => row.sampleEpoch);
  const index = sampleCases.findIndex((row) => row.caseId === item?.caseId);
  return index >= 0 ? index + 1 : (isResearchMontageSetupPractice(item) ? 2 : 1);
}

function researchPracticeLabel(item = currentResearchCase()) {
  const number = researchPracticeSampleNumber(item);
  return number ? `練習サンプル${number}` : "練習サンプル";
}

function updateResearchTutorial(item = currentResearchCase()) {
  if (!els.researchTutorial) return;
  const show = isResearchPracticeCase(item) && !state.researchTutorialDismissed;
  const isMontageSetup = isResearchMontageSetupPractice(item);
  if (show && isMobileViewport() && !state.researchTutorialDrag && !state.researchTutorialMoved) resetResearchTutorialPosition();
  if (els.researchTutorialTitle) els.researchTutorialTitle.textContent = researchPracticeLabel(item);
  if (els.researchTutorialLead) {
    els.researchTutorialLead.classList.toggle("research-tutorial-lead-emphasis", isMontageSetup);
    els.researchTutorialLead.textContent = isMontageSetup
      ? "普段最も使用するモンタージュに切り替えてから判定してください。回答は記録されません。"
      : "これは操作説明用の練習問題です。回答は記録されません。";
  }
  if (els.researchTutorialMontageNote) {
    els.researchTutorialMontageNote.hidden = isMontageSetup;
    els.researchTutorialMontageNote.textContent = "波形の感度、時定数、表示スケール、モンタージュは自由に変更して構いません。";
  }
  if (els.researchTutorialNextTestNote) els.researchTutorialNextTestNote.hidden = !isMontageSetup;
  if (els.researchTutorialTargetNote) els.researchTutorialTargetNote.hidden = isMontageSetup;
  if (els.researchTutorialSteps) els.researchTutorialSteps.hidden = isMontageSetup;
  els.researchTutorial.hidden = !show;
  els.researchTutorial.setAttribute("aria-hidden", show ? "false" : "true");
}

function hideResearchTutorial() {
  if (!els.researchTutorial) return;
  els.researchTutorial.hidden = true;
  els.researchTutorial.setAttribute("aria-hidden", "true");
  state.researchTutorialDrag = null;
  state.researchTutorialMoved = false;
}

function resetResearchTutorialPosition() {
  const panel = els.researchTutorial;
  if (!panel) return;
  panel.style.left = "";
  panel.style.right = "";
  panel.style.top = "";
  panel.style.bottom = "";
  state.researchTutorialMoved = false;
}

function clampResearchTutorialPosition(left, top) {
  const panel = els.researchTutorial;
  const parent = panel?.offsetParent || els.workspace || document.body;
  if (!panel || !parent) return { left: 0, top: 0 };
  const parentRect = parent.getBoundingClientRect();
  const width = panel.offsetWidth || panel.getBoundingClientRect().width || 0;
  const height = panel.offsetHeight || panel.getBoundingClientRect().height || 0;
  const maxLeft = Math.max(0, parentRect.width - width - 4);
  const maxTop = Math.max(0, parentRect.height - height - 4);
  return {
    left: Math.min(maxLeft, Math.max(4, left)),
    top: Math.min(maxTop, Math.max(4, top)),
  };
}

function onResearchTutorialPointerDown(ev) {
  const panel = els.researchTutorial;
  if (!panel || panel.hidden || !isMobileViewport()) return;
  if (ev.target?.closest?.("button, a, input, select, textarea")) return;
  const parent = panel.offsetParent || els.workspace || document.body;
  const panelRect = panel.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const startLeft = panelRect.left - parentRect.left;
  const startTop = panelRect.top - parentRect.top;
  state.researchTutorialDrag = {
    pointerId: ev.pointerId,
    startX: ev.clientX,
    startY: ev.clientY,
    startLeft,
    startTop,
  };
  panel.classList.add("dragging");
  panel.setPointerCapture?.(ev.pointerId);
  ev.preventDefault();
  ev.stopPropagation();
}

function onResearchTutorialPointerMove(ev) {
  const drag = state.researchTutorialDrag;
  const panel = els.researchTutorial;
  if (!drag || !panel || drag.pointerId !== ev.pointerId) return;
  const next = clampResearchTutorialPosition(
    drag.startLeft + ev.clientX - drag.startX,
    drag.startTop + ev.clientY - drag.startY,
  );
  panel.style.left = `${Math.round(next.left)}px`;
  panel.style.top = `${Math.round(next.top)}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  state.researchTutorialMoved = true;
  ev.preventDefault();
}

function finishResearchTutorialDrag(ev) {
  const drag = state.researchTutorialDrag;
  const panel = els.researchTutorial;
  if (!drag || (ev?.pointerId != null && drag.pointerId !== ev.pointerId)) return;
  state.researchTutorialDrag = null;
  panel?.classList.remove("dragging");
  if (panel && typeof panel.releasePointerCapture === "function") {
    try {
      panel.releasePointerCapture(drag.pointerId);
    } catch {
      // The browser may already have released this pointer.
    }
  }
}

function refreshResearchDisplay() {
  renderResearchProgress();
  renderRightResearchPanels();
}

function hideResearchWaveProgress() {
  if (!els.researchWaveProgress) return;
  els.researchWaveProgress.hidden = true;
  els.researchWaveProgress.setAttribute("aria-hidden", "true");
  els.researchWaveProgress.innerHTML = "";
}

function researchProgressSnapshot() {
  const session = isValidationWorkflow() ? state.validationSession : state.researchSession;
  const cases = activeResearchCases();
  const current = currentResearchCase();
  const total = Number(session?.totalCount || cases.filter((row) => !row.sampleEpoch).length || 0);
  const answered = Number(session?.answeredCount || 0);
  const isPractice = isResearchPracticeCase(current);
  const currentQuestion = !current || isPractice || current.sampleEpoch ? answered : Math.min(total, answered + 1);
  const remaining = Math.max(0, total - answered);
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return { cases, current, total, answered, currentQuestion, remaining, pct, isPractice };
}

function firstUnansweredResearchCaseIndex() {
  const cases = activeResearchCases();
  const responseSource = isValidationWorkflow() ? state.validationSession?.responses : state.researchSession?.responses;
  const answeredIds = new Set((responseSource || []).map((row) => String(row.caseId || "")));
  const index = cases.findIndex((row) => !row.sampleEpoch && !answeredIds.has(String(row.caseId || "")));
  return index >= 0 ? index : -1;
}

function researchDebriefingPayload() {
  const selected = document.querySelector('input[name="researchDebriefMontageLikert"]:checked');
  return {
    datasetPath: state.researchDatasetPath,
    readerId: state.researchSession?.readerId || activeResearchReaderId(researchProfile()),
    sessionToken: state.researchSession?.sessionToken || "",
    completedAt: new Date().toISOString(),
    primaryEndpointDisclosure: "",
    operationLogDisclosure: "回答内容に加えて, 判読中のモンタージュ切り替え, 表示時間, 判読時間などの操作ログを記録",
    montageSwitchIncreaseLikert: selected ? Number(selected.value) : null,
    behaviorChangeFreeText: els.researchDebriefBehaviorChangeInput?.value.trim() || "",
    continuedDataUseConsent: Boolean(els.researchDebriefContinueConsentInput?.checked),
    withdrawalOpportunityProvided: true,
    ...researchTestTimingPayload(state.researchTestCompletedAt || new Date().toISOString()),
  };
}

async function submitResearchDebriefing() {
  if (!state.researchSession) return;
  const payload = researchDebriefingPayload();
  if (!payload.montageSwitchIncreaseLikert) {
    if (els.researchDebriefMessage) els.researchDebriefMessage.textContent = "5段階評価を選択してください。";
    return;
  }
  if (!payload.continuedDataUseConsent) {
    if (els.researchDebriefMessage) els.researchDebriefMessage.textContent = "研究参加への同意を確認してください。";
    return;
  }
  if (els.researchDebriefSubmitBtn) els.researchDebriefSubmitBtn.disabled = true;
  if (els.researchDebriefMessage) els.researchDebriefMessage.textContent = "";
  try {
    await fetchJson("/api/research/test/debriefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.researchDebriefSubmitted = true;
    await completeResearchTest();
  } catch (err) {
    if (els.researchDebriefMessage) els.researchDebriefMessage.textContent = `保存できませんでした: ${err.message}`;
    setStatus(`Debriefing save failed: ${err.message}`, { error: true });
  } finally {
    if (els.researchDebriefSubmitBtn) els.researchDebriefSubmitBtn.disabled = false;
  }
}

async function completeResearchTest() {
  hideResearchTutorial();
  refreshResearchDisplay();
  if (isValidationWorkflow()) {
    showResearchCompletion();
    try {
      await submitValidationJson({ automatic: true });
    } catch (err) {
      setStatus(`Validation submit failed: ${err.message}`, { error: true });
    }
    return;
  }
  if (!state.researchDebriefSubmitted && els.researchDebriefScreen) {
    showResearchDebriefing();
    setStatus("事後アンケートに回答してください");
    return;
  }
  showResearchCompletion();
  if (state.researchMode !== "test" || state.researchResultAutoSubmitted) return;
  state.researchResultAutoSubmitted = true;
  try {
    await submitResearchJson({ automatic: true });
  } catch (err) {
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = "JSONファイルをダウンロードしてメールに添付してください。";
    }
    setStatus(`Result auto submit failed: ${err.message}`, { error: true });
  }
}

function renderResearchWaveProgress(snapshot = researchProgressSnapshot()) {
  if (!els.researchWaveProgress) return;
  const session = isValidationWorkflow() ? state.validationSession : state.researchSession;
  if (!session || (state.researchMode !== "test" && state.researchMode !== "validation") || els.researchCompleteScreen?.hidden === false || els.researchDebriefScreen?.hidden === false) {
    hideResearchWaveProgress();
    return;
  }
  const { total, answered, currentQuestion, remaining, pct, isPractice } = snapshot;
  const currentCase = currentResearchCase();
  const title = isValidationWorkflow() ? `Validation ${currentQuestion}/${total || 0}` : (isPractice ? researchPracticeLabel(currentCase) : `本番 ${currentQuestion}/${total || 0}`);
  const detail = isValidationWorkflow() ? `現在: ${validationDatasetKindLabel(currentCase)} · 選択: ${selectedValidationDatasetKindLabel()} · 確認済み ${answered}/${total || 0} · 残り ${remaining} 件` : (isPractice ? `本番は未開始 · 全 ${total || 0} 問` : `回答済み ${answered}/${total || 0} · 残り ${remaining} 問`);
  const hint = "";
  els.researchWaveProgress.hidden = false;
  els.researchWaveProgress.setAttribute("aria-hidden", "false");
  els.researchWaveProgress.innerHTML = `
    <div class="research-wave-progress-main">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
    <div class="research-wave-progress-meter" aria-label="テスト進捗 ${pct}%"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
    <div class="research-wave-progress-pct">${pct}%</div>
    ${hint}
  `;
}

function hideResearchInlineProgress() {
  for (const el of [els.researchInlineProgress]) {
    if (!el) continue;
    el.hidden = true;
    el.textContent = "";
  }
}

function updateResearchUndoButton() {
  if (!els.researchUndoBtn) return;
  const hasUndoTarget = isValidationWorkflow() ? activeValidationResponses().length > 0 : activeResearchResponses().length > 0;
  els.researchUndoBtn.disabled = !hasUndoTarget;
}

function renderResearchInlineProgress(snapshot = null) {
  updateResearchUndoButton();
  if ((els.researchCompleteScreen?.hidden === false || els.researchDebriefScreen?.hidden === false) && state.researchMode === "test") {
    const el = els.researchInlineProgress;
    hideResearchInlineProgress();
    if (el) {
      el.hidden = false;
      el.textContent = "完了";
    }
    return;
  }
  if (isValidationWorkflow() && state.validationSession) {
    const data = snapshot || researchProgressSnapshot();
    hideResearchInlineProgress();
    if (els.researchInlineProgress) {
      els.researchInlineProgress.hidden = false;
      els.researchInlineProgress.textContent = `残り ${data.remaining} 件`;
    }
    return;
  }
  if (state.researchMode === "test" && state.researchSession) {
    const data = snapshot || researchProgressSnapshot();
    const label = data.isPractice
      ? `練習中 · 本番 ${data.total || 0} 問`
      : `残り ${data.remaining} 問`;
    hideResearchInlineProgress();
    if (els.researchInlineProgress) {
      els.researchInlineProgress.hidden = false;
      els.researchInlineProgress.textContent = label;
    }
    return;
  }
  hideResearchInlineProgress();
}

function renderResearchProgress() {
  if (!els.researchTestProgress) return;
  const session = isValidationWorkflow() ? state.validationSession : state.researchSession;
  if (!session || (state.researchMode !== "test" && state.researchMode !== "validation")) {
    els.researchTestProgress.innerHTML = '<div class="research-empty">No test running.</div>';
    renderResearchWaveProgress();
    renderResearchInlineProgress();
    renderRightResearchPanels();
    return;
  }
  const snapshot = researchProgressSnapshot();
  const { cases, current, total, answered, currentQuestion, remaining, pct, isPractice } = snapshot;
  const displayIndex = cases.length ? state.researchCaseIndex + 1 : 0;
  const currentLabel = isValidationWorkflow() ? `Validation ${currentQuestion}/${total || 0}` : (isPractice ? researchPracticeLabel(current) : `本番 ${currentQuestion}/${total || 0}`);
  els.researchTestProgress.innerHTML = `
    <div class="research-progress-card">
      <div class="research-progress-head"><strong>${escapeHtml(currentLabel)}</strong><span>${pct}%</span></div>
      <div>${isValidationWorkflow() ? "確認済み" : "回答済み"} ${answered}/${total} · 残り ${remaining} ${isValidationWorkflow() ? "件" : "問"}</div>
      <div class="research-progress-bar"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
      <div class="research-small">Showing ${displayIndex}/${cases.length || 0}${isPractice ? " · 説明用テスト問題" : (current?.sampleEpoch ? " · sample epoch" : "")}</div>
    </div>
  `;
  renderResearchWaveProgress(snapshot);
  renderResearchInlineProgress(snapshot);
  renderRightResearchPanels();
}

function researchCaseLabelGroup(caseRow) {
  const group = String(caseRow?.labelGroup || "");
  if (group === "epileptiform") return "てんかん性異常あり";
  if (group === "non_epileptiform") return "てんかん性異常なし";
  return group || "-";
}

function researchExpectedRating(caseRow) {
  const group = String(caseRow?.labelGroup || "");
  if (group === "epileptiform") return "てんかん性異常あり";
  if (group === "non_epileptiform") return "てんかん性異常なし";
  return "";
}

function normalizeResearchRating(rating) {
  const value = String(rating || "").trim().toLowerCase();
  if (value === "ied present" || value === "ieds present" || value === "てんかん性異常あり") return "てんかん性異常あり";
  if (value === "ied absent" || value === "ieds absent" || value === "てんかん性異常なし") return "てんかん性異常なし";
  if (value === "uncertain" || value === "判定困難" || value === "判断困難" || value === "judgment difficult") return "判断困難";
  return String(rating || "");
}

function researchResponseCase(response = state.lastResearchResponse) {
  if (!response) return null;
  const caseId = String(response.caseId || "");
  return (state.researchDataset?.cases || []).find((row) => String(row.caseId || "") === caseId) || null;
}

function researchResponseCorrectness(response = state.lastResearchResponse) {
  if (!response) return { label: "未判定", className: "pending", expected: "" };
  const caseRow = researchResponseCase(response);
  const expected = researchExpectedRating(caseRow);
  const rating = normalizeResearchRating(response.rating);
  if (!expected || rating === "判断困難" || !rating) return { label: "判断困難", className: "unknown", expected };
  const ok = rating === expected;
  return { label: ok ? "正解" : "不正解", className: ok ? "correct" : "incorrect", expected };
}

function researchRatingLabel(rating) {
  return normalizeResearchRating(rating);
}

function setResearchResponsesFromSession(session = state.researchSession) {
  state.researchResponses = Array.isArray(session?.responses) ? [...session.responses] : [];
  updateResearchUndoButton();
}

function activeResearchResponses() {
  const rows = Array.isArray(state.researchResponses) ? state.researchResponses : [];
  return rows
    .filter((row) => row && !row.superseded && !row.undoneAt)
    .sort((a, b) => {
      const orderA = Number(a.answerOrder || 0);
      const orderB = Number(b.answerOrder || 0);
      if (orderA || orderB) return orderA - orderB;
      return String(a.answeredAt || "").localeCompare(String(b.answeredAt || ""));
    });
}

function researchDetailRows(rows) {
  return `<dl class="research-detail-list">${rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value === undefined || value === null || value === "" ? "-" : String(value))}</dd>`).join("")}</dl>`;
}

function researchMontageTimingSummaryText(response) {
  if (!response) return "";
  if (response.montageUsageSummary) return response.montageUsageSummary;
  if (Array.isArray(response.montageUsage) && response.montageUsage.length) {
    return response.montageUsage
      .map((row, index) => {
        const order = Number(row.order || index + 1);
        const montage = row.montage || "-";
        const start = Number(row.startSec || 0).toFixed(1);
        const end = Number(row.endSec || 0).toFixed(1);
        const duration = Number(row.durationSec || 0).toFixed(1);
        return `${order}. ${montage} ${start}-${end}s (${duration}s)`;
      })
      .join(" / ");
  }
  if (response.montageTimelineSummary) return response.montageTimelineSummary;
  if (response.montageDurationSummary) return response.montageDurationSummary;
  const durations = response.montageDurationsSec || {};
  return Object.entries(durations)
    .map(([montage, seconds]) => `${montage}:${Number(seconds || 0).toFixed(3)}`)
    .join(";");
}

function researchMontageUsageRows(response) {
  const rows = Array.isArray(response?.montageUsage) ? response.montageUsage : [];
  if (rows.length) {
    return rows.map((row, index) => [
      `Montage ${Number(row.order || index + 1)}`,
      `${row.montage || "-"} / ${Number(row.startSec || 0).toFixed(1)}-${Number(row.endSec || 0).toFixed(1)}秒 / ${Number(row.durationSec || 0).toFixed(1)}秒使用`,
    ]);
  }
  return [["Montage usage", researchMontageTimingSummaryText(response)]];
}

function renderRightResearchPanels() {
  renderRightTestPanel();
}

function renderRightTestPanel() {
  if (!els.rightTestPanel) return;
  if (isValidationWorkflow()) return renderRightValidationPanel();
  const session = state.researchSession;
  const current = currentResearchCase();
  const responses = activeResearchResponses();
  const currentRows = current ? [
    ["Phase", session?.phase || ""],
    ["Current", `${state.researchCaseIndex + 1}/${activeResearchCases().length || 0}${isResearchPracticeCase(current) ? " 説明用" : (current.sampleEpoch ? " sample" : "")}`],
    ["Case", current.caseId || ""],
    ["Recording", current.recordingId || ""],
    ["Epoch", `${formatSec(Number(current.epochStart || 0))} + ${Number(current.durationSec || 10)}s`],
    ["Event", formatSec(Number(current.eventTime ?? current.epochStart ?? 0))],
    ["Displayed montages", currentResearchDisplayedMontages().join(", ")],
  ] : [];
  const resultCards = responses.map((response, index) => {
    const caseRow = researchResponseCase(response);
    const result = researchResponseCorrectness(response);
    const rows = [
      ["Case", response.caseId || ""],
      ["Recording", caseRow?.recordingId || ""],
      ["True label", researchCaseLabelGroup(caseRow)],
      ["Your rating", researchRatingLabel(response.rating)],
      ["Correct", result.label || ""],
      ["Expected", result.expected || ""],
      ["Phase", response.phase || ""],
      ["Final montage", response.finalMontage || response.usedMontage || response.spikeMontage || ""],
      ...researchMontageUsageRows(response),
      ["Answered", response.answeredAt || ""],
    ];
    const answerOrder = Number(response.answerOrder || index + 1);
    return `<div class="research-result-card ${escapeHtml(result.className)}"><div class="research-result-head"><strong>${answerOrder}問目 ${escapeHtml(result.label)}</strong><span>${escapeHtml(researchRatingLabel(response.rating) || "-")}</span></div>${researchDetailRows(rows)}</div>`;
  }).join("");
  els.rightTestPanel.innerHTML = `
    ${current ? `<div class="research-result-card"><div class="research-result-title">Current epoch</div>${researchDetailRows(currentRows)}</div>` : '<div class="research-empty">No test epoch loaded.</div>'}
    <div class="research-result-title">解答記録 (${responses.length})</div>
    <div class="research-result-list">${resultCards || '<div class="research-empty">No saved judgment yet.</div>'}</div>
  `;
}

async function loadResearchDatasetFromPath(path) {
  const datasetPath = String(path || "").trim();
  if (!datasetPath) throw new Error("Dataset path or URL is required.");
  const dataset = await fetchJson(`/api/research/dataset?${qs({ path: datasetPath })}`);
  state.researchDataset = dataset;
  state.researchDatasetPath = dataset.datasetPath || datasetPath;
  if (els.researchSetupDatasetPathInput && !/^https?:\/\//i.test(datasetPath)) {
    els.researchSetupDatasetPathInput.value = state.researchDatasetPath;
  }
  applyFixedResearchQuestionCount();
  refreshResearchDisplay();
  return dataset;
}

function activeValidationResponses() {
  return state.validationSession?.responses || state.validationResponses || [];
}

function validationDatasetKindLabel(row = currentResearchCase()) {
  const source = String(row?.sourceGroup || "").toLowerCase();
  const group = String(row?.labelGroup || "").toLowerCase();
  if (source.includes("epilepsy") && !source.includes("no_")) return "IEDデータセット";
  if (group === "epileptiform") return "IEDデータセット";
  if (source.includes("artifact") || source.includes("no_epilepsy") || group === "non_epileptiform") return "アーチファクト/IEDなしデータセット";
  return row?.sourceGroup || row?.labelGroup || "データセット種別未設定";
}

function selectedValidationDatasetKind() {
  return els.validationSetSelect?.value === "artifact" ? "artifact" : "ied";
}

function setValidationDatasetKind(kind) {
  const next = kind === "artifact" ? "artifact" : "ied";
  if (els.validationSetSelect) els.validationSetSelect.value = next;
  if (isValidationWorkflow()) {
    renderResearchProgress();
    renderRightResearchPanels();
  }
}

function selectedValidationDatasetKindLabel() {
  return selectedValidationDatasetKind() === "artifact" ? "アーチファクトデータセット" : "IEDデータセット";
}

function activeValidationDatasetKind() {
  return state.validationSession?.validationSet || selectedValidationDatasetKind();
}

function activeValidationDatasetKindLabel() {
  return activeValidationDatasetKind() === "artifact" ? "アーチファクトデータセット" : "IEDデータセット";
}

function validationTargetName(row = currentResearchCase()) {
  return validationDatasetKindLabel(row).includes("アーチファクト") ? "アーチファクト" : "IED";
}

function setValidationResponsesFromSession(session) {
  state.validationResponses = Array.isArray(session?.responses) ? session.responses : [];
}

function renderRightValidationPanel() {
  if (!els.rightTestPanel) return;
  const current = currentResearchCase();
  const responses = activeValidationResponses();
  const responseByCaseId = new Map(responses.map((response) => [String(response.caseId || ""), response]));
  const cases = activeResearchCases();
  const targetName = validationTargetName(current);
  const currentRows = current ? [
    ["Current", `${state.researchCaseIndex + 1}/${cases.length || 0}`],
    ["Reference", researchCaseLabelGroup(current)],
  ] : [];
  const resultCards = cases.map((item, index) => {
    const response = responseByCaseId.get(String(item.caseId || ""));
    const decision = String(response?.decision || "");
    const label = response ? (response.decisionLabel || VALIDATION_DECISION_LABELS[decision] || decision || "") : "未評価";
    const className = response
      ? (decision === VALIDATION_DECISION_ADOPT ? "validation-adopted" : (decision === VALIDATION_DECISION_EXCLUDE ? "validation-excluded" : "validation-pending"))
      : "validation-pending";
    const actionLabel = response ? "再評価" : "評価";
    return `<div class="research-result-card validation-decision-card ${escapeHtml(className)}" data-action="validation-revisit" data-case-id="${escapeHtml(item.caseId || "")}"><div class="research-result-head"><strong>${index + 1}件目</strong><span>${escapeHtml(label || "-")}</span></div><button type="button" class="validation-revisit-button" data-action="validation-revisit" data-case-id="${escapeHtml(item.caseId || "")}">${actionLabel}</button></div>`;
  }).join("");
  els.rightTestPanel.innerHTML = `
    <div class="research-result-card validation-help-card">
      <div class="validation-help-title">操作</div>
      <div class="validation-current-dataset">現在: ${escapeHtml(validationDatasetKindLabel(current))}</div>
      <div class="validation-key-row validation-key-adopt"><kbd>Enter</kbd><strong>採用</strong></div>
      <div class="validation-key-row validation-key-exclude"><kbd>Backspace</kbd><strong>除外</strong></div>
      <div class="validation-key-row validation-key-exclude"><kbd>Delete</kbd><strong>除外</strong></div>
      <div class="validation-help-text">このepochを${escapeHtml(targetName)}として採用できる場合は採用、波形や切り出しに問題があり${escapeHtml(targetName)}として使わない場合は除外を選んでください。</div>
      <div class="validation-help-text">下のValidation記録カードを押すと、そのepochを表示できます。保存後は残りの未評価カードの若い番号へ進みます。</div>
    </div>
    ${current ? `<div class="research-result-card"><div class="research-result-title">Current epoch</div>${researchDetailRows(currentRows)}</div>` : '<div class="research-empty">No validation epoch loaded.</div>'}
    <div class="research-result-title">Validation記録 (${responses.length}/${cases.length || 0})</div>
    <div class="research-result-list">${resultCards || '<div class="research-empty">No validation cases.</div>'}</div>
  `;
}

async function revisitValidationCase(caseId) {
  if (!isValidationWorkflow() || !state.validationSession) return;
  const targetCaseId = String(caseId || "").trim();
  if (!targetCaseId) return;
  const cases = activeResearchCases();
  const index = cases.findIndex((row) => String(row.caseId || "") === targetCaseId);
  if (index < 0) {
    setStatus("再評価対象のepochが現在のvalidation datasetにありません。", { error: true });
    return;
  }
  hideResearchCompletion();
  hideResearchDebriefing();
  hideResearchToast();
  state.researchResultAutoSubmitted = false;
  await showResearchCase(index);
  setStatus("再評価するepochを表示しました。Enter=採用 / Backspace・Delete=除外");
}

async function startValidationWorkflow() {
  requestMobileFullscreen();
  setResearchSetupMessage("入力内容を確認中...");
  if (!validateResearchProfileForStart()) return;
  saveResearchProfile();
  hideResearchCompletion();
  hideResearchDebriefing();
  hideResearchTutorial();
  state.researchTestStartedAt = "";
  state.researchTestStartedMs = 0;
  state.researchTestCompletedAt = "";
  state.researchResultAutoSubmitted = false;
  resetResearchPrefetch({ clearRecords: true });
  const profile = researchProfile();
  const reviewerId = safeResultFilenamePart(profile.readerName || profile.readerId || "reviewer", "reviewer");
  const setupDatasetPath = els.researchSetupDatasetPathInput?.value.trim() || profile.datasetPath || (PUBLIC_WEB_MODE ? DEFAULT_PUBLIC_DATASET_PATH : "");
  if (!setupDatasetPath) {
    const message = "Validation用データセットを読み込めません。管理者に連絡してください。";
    setResearchSetupMessage(message, true);
    setStatus(message, { error: true });
    return;
  }
  setResearchSetupMessage("Starting validation...");
  setResearchStartBusy(true);
  setStatus("Starting validation...", { busy: true });
  try {
    let datasetPath = setupDatasetPath || state.researchDatasetPath || "";
    const dataset = await loadResearchDatasetFromPath(datasetPath);
    datasetPath = dataset.datasetPath || datasetPath;
    const validationSet = selectedValidationDatasetKind();
    const resetResult = await fetchJson("/api/research/validation/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath, reviewerId, validationSet }),
    });
    const session = resetResult.session || await fetchJson(`/api/research/validation/session?${qs({ dataset: datasetPath, reviewerId, validationSet })}`);
    if (!Array.isArray(session.cases) || !session.cases.length) {
      throw new Error("No validation cases are available for this dataset.");
    }
    state.validationSession = session;
    setValidationResponsesFromSession(session);
    state.researchDatasetPath = session.datasetPath || datasetPath;
    state.researchCaseIndex = Math.max(0, firstUnansweredResearchCaseIndex());
    if (state.researchCaseIndex < 0) state.researchCaseIndex = 0;
    markResearchTestStarted(new Date());
    setResearchSetupMessage("");
    setResearchMode("validation");
    state.rightPanelTab = "test";
    applyRightPanelTab();
    setRightPanelVisible(true, { save: false });
    updateResearchSetupScreen();
    refreshResearchDisplay();
    if (firstUnansweredResearchCaseIndex() < 0) await completeResearchTest();
    else await showResearchCase(state.researchCaseIndex);
  } catch (err) {
    const message = `Validation start failed: ${err.message}`;
    setResearchSetupMessage(message, true);
    setStatus(message, { error: true });
  } finally {
    setResearchStartBusy(false);
  }
}

function renderValidationContextMenu() {
  const context = state.context || {};
  const channel = context.channel || context.montageChannel || "";
  const onset = Number(context.onset);
  const target = [channel, Number.isFinite(onset) ? formatSec(onset) : ""].filter(Boolean).join(" · ");
  els.contextMenu.innerHTML = `
    <div class="context-menu-caption">Validation${target ? `: ${escapeHtml(target)}` : ""}<br>Enter=採用 / Backspace・Delete=除外</div>
    <button data-action="validation-decision" data-decision="${VALIDATION_DECISION_ADOPT}">採用</button>
    <button data-action="validation-decision" data-decision="${VALIDATION_DECISION_EXCLUDE}" class="danger-action">除外</button>
  `;
}

async function saveValidationDecision(decision) {
  const item = currentResearchCase();
  if (!item || !state.validationSession || state.researchSaving) return;
  state.researchSaving = true;
  const answeredAt = new Date().toISOString();
  const elapsedMs = state.researchCaseStartedAt ? Date.now() - Date.parse(state.researchCaseStartedAt) : 0;
  const reviewerId = state.validationSession.reviewerId || safeResultFilenamePart(researchProfile().readerName || "reviewer", "reviewer");
  const revisitingAnsweredCase = activeValidationResponses().some((response) => String(response.caseId || "") === String(item.caseId || ""));
  try {
    const responsePayload = {
      datasetPath: state.researchDatasetPath,
      reviewerId,
      validationSet: selectedValidationDatasetKind(),
      reviewerProfile: { reviewerId, reviewerName: researchProfile().readerName || reviewerId },
      caseId: item.caseId,
      eventTime: item.eventTime ?? "",
      epochStart: item.epochStart ?? "",
      durationSec: item.durationSec ?? "",
      decision,
      startedAt: state.researchCaseStartedAt || answeredAt,
      answeredAt,
      elapsedMs,
      displayMode: "validation_single",
      ...researchSpikeSelectionPayload(),
    };
    const data = await fetchJson("/api/research/validation/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responsePayload),
    });
    state.validationSession = data.session;
    setValidationResponsesFromSession(data.session);
    state.researchTestCompletedAt = answeredAt;
    state.lastValidationResponse = data.response;
    state.lastValidationResponseCaseIndex = state.researchCaseIndex;
    renderRightResearchPanels();
    showResearchToast(`保存しました: ${VALIDATION_DECISION_LABELS[decision] || decision} · やり直す場合は「前の問題をやり直す」`, { undo: true });
    const nextIndex = firstUnansweredResearchCaseIndex();
    if (nextIndex >= 0) {
      await showResearchCase(nextIndex);
      setStatus(revisitingAnsweredCase ? "再評価を保存しました。残りの未評価epochへ進みます。" : "保存しました。次の未評価epochへ進みます。");
    } else {
      await completeResearchTest();
    }
  } catch (err) {
    setStatus(`Validation save failed: ${err.message}`, { error: true });
    showResearchToast(`保存できませんでした: ${err.message}`);
  } finally {
    state.researchSaving = false;
  }
}

async function undoValidationResponse() {
  if (!state.lastValidationResponse || !state.validationSession) return;
  try {
    const data = await fetchJson("/api/research/validation/response/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetPath: state.researchDatasetPath,
        reviewerId: state.validationSession.reviewerId,
        validationSet: state.validationSession.validationSet || selectedValidationDatasetKind(),
        responseId: state.lastValidationResponse.responseId,
      }),
    });
    state.validationSession = data.session;
    setValidationResponsesFromSession(data.session);
    const cases = activeResearchCases();
    const caseId = data.undone?.caseId;
    const index = cases.findIndex((row) => row.caseId === caseId);
    state.lastValidationResponse = null;
    hideResearchToast();
    await showResearchCase(index >= 0 ? index : Math.max(0, state.lastValidationResponseCaseIndex));
    setStatus("Validation undo complete");
  } catch (err) {
    setStatus(`Validation undo failed: ${err.message}`, { error: true });
  }
}

async function submitValidationJson(options = {}) {
  const datasetPath = state.researchDatasetPath || "";
  if (!datasetPath) throw new Error("Dataset path is required.");
  const reviewerId = state.validationSession?.reviewerId || safeResultFilenamePart(researchProfile().readerName || "reviewer", "reviewer");
  const validationSet = activeValidationDatasetKind();
  const result = await fetchJson("/api/research/validation/submit-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datasetPath, reviewerId, validationSet, completedAt: state.researchTestCompletedAt || new Date().toISOString() }),
  });
  if (els.researchSavedCsvName) {
    els.researchSavedCsvName.textContent = options.automatic
      ? `Validation結果（${activeValidationDatasetKindLabel()}）はサーバーに保存されました。JSONファイルをダウンロードしてメールに添付してください。`
      : `Validation結果を保存しました: ${result.submissionId || result.filename || reviewerId}`;
  }
  setStatus("Validation complete. JSONファイルをダウンロードしてメールに添付してください。");
  return result;
}



async function startResearchTest() {
  requestMobileFullscreen();
  setResearchSetupMessage("入力内容を確認中...");
  if (!validateResearchProfileForStart()) return;
  saveResearchProfile();
  retryPendingResearchResponses();
  hideResearchCompletion();
  hideResearchDebriefing();
  state.researchTutorialDismissed = false;
  state.researchSampleCompletedPhases = {};
  state.researchTestStartedAt = "";
  state.researchTestStartedMs = 0;
  state.researchTestCompletedAt = "";
  state.researchResultAutoSubmitted = false;
  state.researchDebriefSubmitted = false;
  state.researchUsualMontage = "";
  resetResearchPrefetch({ clearRecords: true });
  hideResearchTutorial();
  const profile = researchProfile();
  const baseReaderId = researchReaderDisplayId(profile);
  const readerId = researchRunReaderId(baseReaderId);
  profile.baseReaderId = baseReaderId;
  profile.testRunReaderId = readerId;
  profile.testRunStartedAt = new Date().toISOString();
  const phase = "1";
  const setupDatasetPath = els.researchSetupDatasetPathInput?.value.trim() || profile.datasetPath || (PUBLIC_WEB_MODE ? DEFAULT_PUBLIC_DATASET_PATH : "");
  applyFixedResearchQuestionCount();
  if (!setupDatasetPath) {
    const existingDatasetPath = profile.datasetPath || state.researchDatasetPath || "";
    if (!existingDatasetPath) {
      const message = "テスト用データセットを読み込めません。管理者に連絡してください。";
      setResearchSetupMessage(message, true);
      setStatus(message, { error: true });
      return;
    }
  }
  setResearchSetupMessage("Starting test...");
  setResearchStartBusy(true);
  setStatus("Starting test...", { busy: true });
  try {
    const existingDatasetPath = setupDatasetPath || state.researchDatasetPath || "";
    let datasetPath = existingDatasetPath || state.researchDatasetPath || "";
    if (datasetPath) {
      const dataset = await loadResearchDatasetFromPath(datasetPath);
      datasetPath = dataset.datasetPath || datasetPath;
    }
    const session = await fetchJson(`/api/research/test/session?${qs({ dataset: datasetPath, readerId, phase })}`);
    if (!Array.isArray(session.cases) || !session.cases.length) {
      throw new Error("No test cases are available for this run. Check the selected dataset or upload status.");
    }
    state.researchSession = session;
    setResearchResponsesFromSession(session);
    state.researchDatasetPath = session.datasetPath || datasetPath;
    if (!state.researchDataset || state.researchDataset.datasetPath !== state.researchDatasetPath) {
      state.researchDataset = await fetchJson(`/api/research/dataset?${qs({ path: state.researchDatasetPath })}`);
    }
    state.researchCaseIndex = 0;
    setResearchSetupMessage("");
    setResearchMode("test");
    updateResearchSetupScreen();
    refreshResearchDisplay();
    await showResearchCase(0);
  } catch (err) {
    const message = `Test start failed: ${err.message}`;
    setResearchSetupMessage(message, true);
    setStatus(message, { error: true });
  } finally {
    setResearchStartBusy(false);
  }
}

async function showResearchCase(index) {
  const cases = activeResearchCases();
  if (!cases.length) {
    hideResearchTutorial();
    await completeResearchTest();
    setStatus(isValidationWorkflow() ? "Validation complete. 結果はサーバーに保存されました。" : "Test complete. JSONファイルをダウンロードしてメールに添付してください");
    return;
  }
  state.researchCaseIndex = Math.max(0, Math.min(cases.length - 1, index));
  const item = cases[state.researchCaseIndex];
  refreshResearchDisplay();
  setStatus(`${isValidationWorkflow() ? `Loading validation epoch ${state.researchCaseIndex + 1}/${cases.length}` : (isResearchPracticeCase(item) ? "Loading explanation practice epoch" : (item.sampleEpoch ? `Loading ${"Phase 1"} sample` : `Loading test epoch ${state.researchCaseIndex + 1}/${cases.length}`))}...`, { busy: true });
  try {
    const opened = await fetchJson("/api/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.edfPath }),
    });
    applyOpenedRecording(opened);
    await loadMetadata();
    state.cursorTime = null;
    state.dragSelection = null;
    const profile = researchProfile();
    const usualMontage = isValidationWorkflow() ? "longitudinal" : (isResearchPracticeCase(item) ? "conventional" : (state.researchUsualMontage || profile.usualMontage || item.phase1Montage || activeMontageValue() || "conventional"));
    if (els.sensitivitySelect) els.sensitivitySelect.value = "10uV";
    if (els.tcSelect) els.tcSelect.value = "0.3";
    if (els.hfSelect) els.hfSelect.value = "120";
    if (els.acSelect) els.acSelect.value = "60";
    const researchTimebase = defaultResearchTimebaseSec();
    if (els.durationSelect) els.durationSelect.value = String(researchTimebase);
    state.start = centeredStartForResearchCase(item, researchTimebase);
    state.viewMode = "single";
    els.montageSelect.value = usualMontage;
    state.activeMontage = els.montageSelect.value;
    updateViewModeButtons();
    syncMultiMontageControls();
    if (isValidationWorkflow()) {
      state.rightPanelTab = "test";
      applyRightPanelTab();
      setRightPanelVisible(true, { save: false });
    } else {
      setRightPanelVisible(false, { save: false });
    }
    state.windowData = null;
    await loadWindow();
    scheduleLayoutRefresh();
    if (isValidationWorkflow()) hideResearchTutorial();
    else updateResearchTutorial(item);
    state.researchCaseStartedAt = new Date().toISOString();
    startResearchMontageTiming();
    renderResearchInlineProgress();
    setStatus(isValidationWorkflow() ? `Validation: ${state.researchCaseIndex + 1}/${cases.length} · 波形を左クリックして採用/除外を選択してください` : (isResearchPracticeCase(item) ? `${researchPracticeLabel(item)}: 波形を左クリックして三択から回答してください` : (item.sampleEpoch ? `Phase ${state.researchSession?.phase || ""} sample` : `Test ${state.researchSession?.phase || ""}: ${state.researchCaseIndex + 1}/${cases.length}`)));
    renderRightResearchPanels();
    scheduleResearchPrefetch(state.researchCaseIndex);
  } catch (err) {
    hideResearchTutorial();
    setStatus(`Test epoch load failed: ${err.message}`, { error: true });
  }
}

function renderResearchRatingContextMenu() {
  if (isValidationWorkflow()) return renderValidationContextMenu();
  const context = state.context || {};
  const channel = context.channel || context.montageChannel || "";
  const onset = Number(context.onset);
  const target = [channel, Number.isFinite(onset) ? formatSec(onset) : ""].filter(Boolean).join(" · ");
  els.contextMenu.innerHTML = `
    <div class="context-menu-caption">Test judgment${target ? `: ${escapeHtml(target)}` : ""}</div>
    ${RESEARCH_RATINGS.map((rating) => `<button data-action="research-rating" data-rating="${escapeHtml(rating)}">${escapeHtml(rating)}</button>`).join("")}
  `;
}

function researchSpikeSelectionPayload() {
  const context = state.context || {};
  const onset = Number(context.onset);
  const fallbackDuration = Math.min(1, Math.max(0.05, visibleDuration() || 1));
  const fallbackStart = Number.isFinite(onset) ? Math.max(0, onset - fallbackDuration / 2) : Math.max(0, Number(state.start || 0));
  const selectionStart = fallbackStart;
  const selectionDuration = fallbackDuration;
  return {
    usedMontage: activeMontageValue(),
    finalMontage: activeMontageValue(),
    sensitivity: els.sensitivitySelect?.value || "",
    sensitivityUvPerMm: sensitivityValue(),
    tc: els.tcSelect?.value || "",
    timeConstant: els.tcSelect?.value || "",
    timeConstantLabel: tcText(),
    hf: els.hfSelect?.value || "",
    highCutFilter: els.hfSelect?.value || "",
    highCutFilterLabel: hfText(),
    ac: normalizeAcValue(els.acSelect?.value),
    acFilter: normalizeAcValue(els.acSelect?.value),
    acFilterLabel: acFilterLabel(),
    acFilterUsed: normalizeAcValue(els.acSelect?.value) !== "OFF",
    timebaseSec: Number(els.durationSelect?.value || visibleDuration() || 0),
    spikeTime: Number.isFinite(onset) ? onset : "",
    spikeSampleIndex: Number.isFinite(Number(context.sampleIndex)) ? Number(context.sampleIndex) : "",
    spikeSfreq: Number.isFinite(Number(context.sfreq)) ? Number(context.sfreq) : "",
    spikeChannel: context.channel || "",
    clickedElectrode: context.channel || context.montageChannel || "",
    clickedCanvasX: Number.isFinite(Number(context.canvasX)) ? Number(context.canvasX) : "",
    clickedCanvasY: Number.isFinite(Number(context.canvasY)) ? Number(context.canvasY) : "",
    clickedRowIndex: Number.isFinite(Number(context.rowIndex)) ? Number(context.rowIndex) : "",
    spikeMontageChannel: context.montageChannel || "",
    spikeMontage: context.montage || activeMontageValue(),
    selectedWaveformStart: selectionStart,
    selectedWaveformDuration: selectionDuration,
  };
}

async function saveResearchRating(rating) {
  const item = currentResearchCase();
  if (!item || !state.researchSession) return;
  if (state.researchSaving) return;
  state.researchSaving = true;
  const answeredAt = new Date().toISOString();
  const elapsedMs = state.researchCaseStartedAt ? Date.now() - Date.parse(state.researchCaseStartedAt) : 0;
  try {
    if (item.sampleEpoch) {
      hideResearchTutorial();
      const phase = String(state.researchSession.phase || "");
      if (!state.researchSampleCompletedPhases[phase] || typeof state.researchSampleCompletedPhases[phase] !== "object") {
        state.researchSampleCompletedPhases[phase] = {};
      }
      state.researchSampleCompletedPhases[phase][String(item.caseId || "")] = true;
      state.researchTutorialDismissed = false;
      if (isResearchMontageSetupPractice(item)) {
        const usualMontage = saveUsualResearchMontage(activeMontageValue());
        markResearchTestStarted(new Date());
        resetResearchPrefetch();
        showResearchToast(`練習終了 · ${MONTAGE_LABELS[usualMontage] || usualMontage}で本番開始`);
      } else if (isResearchPracticeCase(item)) {
        showResearchToast("操作練習終了 · 次は普段使用するモンタージュを選んでください");
      } else {
        showResearchToast("Sample shown");
      }
      const remainingCases = activeResearchCases();
      const nextPracticeIndex = remainingCases.findIndex((row) => row.sampleEpoch);
      const nextIndex = nextPracticeIndex >= 0 ? nextPracticeIndex : firstUnansweredResearchCaseIndex();
      if (nextIndex >= 0) await showResearchCase(nextIndex);
      else {
        await completeResearchTest();
        setStatus("Test complete. JSONファイルをダウンロードしてメールに添付してください");
      }
      return;
    }
    const responsePayload = {
      datasetPath: state.researchDatasetPath,
      readerId: state.researchSession.readerId,
      readerProfile: researchProfile(),
      phase: state.researchSession.phase,
      caseId: item.caseId,
      sessionToken: state.researchSession.sessionToken || "",
      eventTime: item.eventTime ?? "",
      epochStart: item.epochStart ?? "",
      durationSec: item.durationSec ?? "",
      rating,
      startedAt: state.researchCaseStartedAt || answeredAt,
      answeredAt,
      elapsedMs,
      ...researchTestTimingPayload(answeredAt),
      displayMode: "phase1_single",
      ...researchSpikeSelectionPayload(),
      ...researchMontageTimingPayload(),
    };
    const data = await fetchJson("/api/research/test/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responsePayload),
    });
    writePendingResearchResponses(readPendingResearchResponses().filter((row) => row.key !== `${responsePayload.readerId || ""}|${responsePayload.phase || "1"}|${responsePayload.caseId || ""}`));
    state.researchSession = data.session;
    state.researchTestCompletedAt = answeredAt;
    setResearchResponsesFromSession(data.session);
    state.lastResearchResponse = data.response;
    state.lastResearchResponseCaseIndex = state.researchCaseIndex;
    renderRightResearchPanels();
    showResearchToast(`保存しました: ${researchRatingLabel(rating)} · やり直す場合は「前の問題をやりなおす」`, { undo: true });
    const cases = activeResearchCases();
    const nextIndex = firstUnansweredResearchCaseIndex();
    if (nextIndex >= 0) await showResearchCase(nextIndex);
    else {
      state.researchCaseIndex = cases.length ? cases.length - 1 : 0;
      await completeResearchTest();
      setStatus("Test complete. JSONファイルをダウンロードしてメールに添付してください");
    }
  } catch (err) {
    if (!item.sampleEpoch) {
      const fallbackPayload = {
        datasetPath: state.researchDatasetPath,
        readerId: state.researchSession.readerId,
        readerProfile: researchProfile(),
        phase: state.researchSession.phase,
        caseId: item.caseId,
        sessionToken: state.researchSession.sessionToken || "",
        eventTime: item.eventTime ?? "",
        epochStart: item.epochStart ?? "",
        durationSec: item.durationSec ?? "",
        rating,
        startedAt: state.researchCaseStartedAt || answeredAt,
        answeredAt,
        elapsedMs,
        ...researchTestTimingPayload(answeredAt),
        displayMode: "phase1_single",
        ...researchSpikeSelectionPayload(),
        ...researchMontageTimingPayload(),
      };
      queuePendingResearchResponse(fallbackPayload, err.message || "save failed");
      const localResponse = {
        ...fallbackPayload,
        responseId: `local-pending-${Date.now()}`,
        answerOrder: Number(state.researchSession?.answeredCount || state.researchResponses?.length || 0) + 1,
        pendingUpload: true,
      };
      state.researchSession.responses = [...(state.researchSession.responses || []), localResponse];
      state.researchSession.answeredCount = Number(state.researchSession.answeredCount || 0) + 1;
      setResearchResponsesFromSession(state.researchSession);
      state.lastResearchResponse = localResponse;
      state.lastResearchResponseCaseIndex = state.researchCaseIndex;
      renderRightResearchPanels();
      showResearchToast("通信が不安定です。この回答は端末内に一時保存しました。オンライン復帰時に再送します。");
      setStatus(`Save failed: ${err.message}. 回答は端末内に一時保存しました。`, { error: true });
      const nextIndex = firstUnansweredResearchCaseIndex();
      if (nextIndex >= 0) await showResearchCase(nextIndex);
      else await completeResearchTest();
      return;
    }
    setStatus(`Save failed: ${err.message}`, { error: true });
    showResearchToast(`保存できませんでした: ${err.message}`);
  } finally {
    state.researchSaving = false;
  }
}

function showResearchToast(message, options = {}) {
  if (!els.researchToast || !els.researchToastText) return;
  if (TEST_ONLY_DISTRIBUTION && isMobileViewport()) {
    els.researchToast.classList.add("hidden");
    return;
  }
  els.researchToastText.textContent = message;
  updateResearchUndoButton();
  els.researchToast.classList.remove("hidden");
}

function hideResearchToast() {
  els.researchToast?.classList.add("hidden");
}

async function undoResearchResponse() {
  if (!state.lastResearchResponse || !state.researchSession) return;
  try {
    const data = await fetchJson("/api/research/test/response/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetPath: state.researchDatasetPath,
        readerId: state.researchSession.readerId,
        responseId: state.lastResearchResponse.responseId,
        sessionToken: state.researchSession.sessionToken || "",
      }),
    });
    state.researchSession = data.session;
    setResearchResponsesFromSession(data.session);
    const cases = activeResearchCases();
    const caseId = data.undone?.caseId;
    const index = cases.findIndex((row) => row.caseId === caseId);
    state.lastResearchResponse = null;
    hideResearchToast();
    await showResearchCase(index >= 0 ? index : Math.max(0, state.lastResearchResponseCaseIndex));
    setStatus("Undo complete");
  } catch (err) {
    setStatus(`Undo failed: ${err.message}`, { error: true });
  }
}

function undoLastResearchAction() {
  if (isValidationWorkflow()) return undoValidationResponse();
  undoResearchResponse();
}

async function exportResearchJson() {
  const datasetPath = state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Enter dataset folder path", { error: true });
  saveResearchProfile();
  const profile = researchProfile();
  if (isValidationWorkflow()) {
    const reviewerId = validationReviewerId(profile);
    try {
      setStatus("Validation結果JSONファイルをダウンロード中...", { busy: true });
      const jsonFilename = validationJsonFilename(profile);
      const jsonText = await fetchText(`/api/research/validation/export.json?${qs({ dataset: datasetPath, reviewerId, validationSet: activeValidationDatasetKind() })}`);
      saveResearchResultBackup(jsonFilename, jsonText);
      downloadTextFile(jsonFilename, jsonText);
      if (els.researchSavedCsvName) {
        els.researchSavedCsvName.textContent = `ダウンロードしました: ${jsonFilename}。メールに添付してください。`;
      }
      setStatus(`Validation結果JSONファイルをダウンロードしました: ${jsonFilename}`);
    } catch (err) {
      const backup = downloadResearchResultBackup();
      if (backup) {
        setStatus(`Export failed. 最後のバックアップをダウンロードしました: ${backup.filename}`, { error: true });
        return;
      }
      setStatus(`Validation export failed: ${err.message}`, { error: true });
    }
    return;
  }
  const readerId = activeResearchReaderId(profile);
  try {
    setStatus("結果JSONファイルをダウンロード中...", { busy: true });
    await retryPendingResearchResponses();
    const jsonFilename = researchJsonFilename(readerId, profile);
    const jsonText = await fetchText(`/api/research/test/export.json?${qs({ dataset: datasetPath, readerId, sessionToken: state.researchSession?.sessionToken || "" })}`);
    saveResearchResultBackup(jsonFilename, jsonText);
    downloadTextFile(jsonFilename, jsonText);
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = `ダウンロードしました: ${jsonFilename}。メールに添付してください。`;
    }
    setStatus(`結果JSONファイルをダウンロードしました: ${jsonFilename}`);
  } catch (err) {
    const backup = downloadResearchResultBackup();
    if (backup) {
      setStatus(`Export failed. 最後のバックアップをダウンロードしました: ${backup.filename}`, { error: true });
      return;
    }
    setStatus(`Export failed: ${err.message}`, { error: true });
  }
}

async function shareResearchJsonByEmail() {
  const datasetPath = state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Enter dataset folder path", { error: true });
  saveResearchProfile();
  const profile = researchProfile();
  if (isValidationWorkflow()) {
    const reviewerId = validationReviewerId(profile);
    const jsonFilename = validationJsonFilename(profile);
    const validationKindLabel = activeValidationDatasetKindLabel();
    try {
      setStatus("Validation結果JSONファイルを共有準備中...", { busy: true });
      const jsonText = await fetchText(`/api/research/validation/export.json?${qs({ dataset: datasetPath, reviewerId, validationSet: activeValidationDatasetKind() })}`);
      saveResearchResultBackup(jsonFilename, jsonText);
      const file = new File([jsonText], jsonFilename, { type: "application/json" });
      const shareData = {
        title: `脳波Validation結果（${validationKindLabel}）`,
        text: researchEmailBodyText(profile),
        files: [file],
      };
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share(shareData);
        if (els.researchSavedCsvName) els.researchSavedCsvName.textContent = `共有しました: ${jsonFilename}`;
        setStatus(`Validation結果JSONファイルを共有しました: ${jsonFilename}`);
        return;
      }
      downloadTextFile(jsonFilename, jsonText);
      window.location.href = `mailto:satoshi.saito@ncnp.go.jp?subject=${encodeURIComponent(`脳波Validation結果（${validationKindLabel}）`)}&body=${encodeURIComponent(researchEmailBodyText(profile))}`;
      if (els.researchSavedCsvName) {
        els.researchSavedCsvName.textContent = `${jsonFilename}をダウンロードしました。メールに添付してください。`;
      }
      setStatus("Validation結果JSONファイルをダウンロードしました。メールに添付してください");
    } catch (err) {
      if (err?.name === "AbortError") {
        setStatus("JSONファイル共有をキャンセルしました");
        return;
      }
      const backup = downloadResearchResultBackup();
      if (backup) {
        setStatus(`Share failed. 最後のバックアップをダウンロードしました: ${backup.filename}`, { error: true });
        return;
      }
      setStatus(`Validation share failed: ${err.message}`, { error: true });
      if (els.researchSavedCsvName) {
        els.researchSavedCsvName.textContent = "共有できませんでした。JSONファイルをダウンロードしてメールに添付してください。";
      }
    }
    return;
  }
  const readerId = activeResearchReaderId(profile);
  const jsonFilename = researchJsonFilename(readerId, profile);
  try {
    setStatus("結果JSONファイルをメール送信準備中...", { busy: true });
    await retryPendingResearchResponses();
    const jsonText = await fetchText(`/api/research/test/export.json?${qs({ dataset: datasetPath, readerId, sessionToken: state.researchSession?.sessionToken || "" })}`);
    saveResearchResultBackup(jsonFilename, jsonText);
    downloadTextFile(jsonFilename, jsonText);
    window.location.href = `mailto:satoshi.saito@ncnp.go.jp?subject=${encodeURIComponent("脳波読影テスト結果")}&body=${encodeURIComponent(researchEmailBodyText(profile))}`;
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = `${jsonFilename}をダウンロードしました。開いたメールに添付してください。`;
    }
    setStatus("宛先入力済みのメール画面を開きました。JSONファイルを添付してください");
  } catch (err) {
    if (err?.name === "AbortError") {
      setStatus("JSONファイル共有をキャンセルしました");
      return;
    }
    const backup = downloadResearchResultBackup();
    if (backup) {
      setStatus(`Share failed. 最後のバックアップをダウンロードしました: ${backup.filename}`, { error: true });
      if (els.researchSavedCsvName) {
        els.researchSavedCsvName.textContent = `共有できませんでした。最後のバックアップ ${backup.filename} をダウンロードしました。`;
      }
      return;
    }
    setStatus(`Share failed: ${err.message}`, { error: true });
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = "共有できませんでした。JSONファイルをダウンロードしてメールに添付してください。";
    }
  }
}

async function submitResearchJson(options = {}) {
  const datasetPath = state.researchDatasetPath || "";
  if (!datasetPath) {
    const err = new Error("Enter dataset folder path");
    setStatus(err.message, { error: true });
    if (options.automatic) throw err;
    return;
  }
  saveResearchProfile();
  const profile = researchProfile();
  const readerId = activeResearchReaderId(profile);
  try {
    setStatus(options.automatic ? "テスト完了処理中..." : "結果を送信中...", { busy: true });
    await retryPendingResearchResponses();
    const jsonFilename = researchJsonFilename(readerId, profile);
    const result = await fetchJson("/api/research/test/submit-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath, readerId, filename: jsonFilename, sessionToken: state.researchSession?.sessionToken || "", ...researchTestTimingPayload(state.researchTestCompletedAt) }),
    });
    const label = result.submissionId || result.filename || jsonFilename;
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = options.automatic
        ? "JSONファイルをダウンロードしてメールに添付してください。"
        : `送信しました: ${label}`;
    }
    setStatus(options.automatic ? "テスト完了。JSONファイルをダウンロードしてメールに添付してください。" : `結果を送信しました: ${label}`);
    return result;
  } catch (err) {
    setStatus(`Submit failed: ${err.message}`, { error: true });
    if (options.automatic) throw err;
  }
}

async function copyResearchEmailBody() {
  updateResearchEmailBody();
  const text = els.researchEmailBody?.value || researchEmailBodyText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (els.researchEmailBody) {
      els.researchEmailBody.focus();
      els.researchEmailBody.select();
      document.execCommand("copy");
      window.getSelection()?.removeAllRanges();
    } else {
      throw new Error("Clipboard is unavailable");
    }
    showResearchToast("メール例文をコピーできました");
    setStatus("メール例文をコピーできました");
  } catch (err) {
    setStatus(`Copy failed: ${err.message}`, { error: true });
  }
}

function restorePanelWidths() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PANEL_WIDTHS_KEY) || "{}");
  } catch {
    saved = {};
  }
  applyPanelWidth("right", Number(saved.right));
}

function savePanelWidths() {
  const styles = getComputedStyle(document.documentElement);
  const workspaceStyles = els.workspace ? getComputedStyle(els.workspace) : styles;
  const right = parseFloat(workspaceStyles.getPropertyValue("--right-panel-width"));
  localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify({ right }));
}

function applyPanelWidth(_panel, width) {
  if (!els.workspace || !Number.isFinite(width)) return;
  const min = 210;
  const max = Math.max(min, Math.floor(window.innerWidth * 0.62));
  const clamped = Math.max(min, Math.min(max, Math.round(width)));
  els.workspace.style.setProperty("--right-panel-width", clamped + "px");
}

function bindPanelResizers() {
  for (const handle of els.panelResizeHandles || []) {
    handle.addEventListener("pointerdown", onPanelResizePointerDown);
  }
  window.addEventListener("pointermove", onPanelResizePointerMove);
  window.addEventListener("pointerup", finishPanelResize);
  window.addEventListener("pointercancel", finishPanelResize);
}

function onPanelResizePointerDown(ev) {
  const handle = ev.currentTarget;
  const panel = handle?.dataset?.resizePanel;
  if (panel !== "right" || !els.workspace) return;
  const styles = getComputedStyle(els.workspace);
  const startWidth = parseFloat(styles.getPropertyValue("--right-panel-width"));
  state.panelResizeDrag = { panel, startX: ev.clientX, startWidth: Number.isFinite(startWidth) ? startWidth : 0, handle, pointerId: ev.pointerId };
  handle.classList.add("dragging");
  handle.setPointerCapture?.(ev.pointerId);
  ev.preventDefault();
}

function onPanelResizePointerMove(ev) {
  const drag = state.panelResizeDrag;
  if (!drag) return;
  const nextWidth = drag.startWidth + (drag.startX - ev.clientX);
  applyPanelWidth(drag.panel, nextWidth);
  resizeCanvas();
  draw();
}

function finishPanelResize() {
  const drag = state.panelResizeDrag;
  if (!drag) return;
  drag.handle?.classList.remove("dragging");
  if (typeof drag.handle?.releasePointerCapture === "function") {
    try {
      drag.handle.releasePointerCapture(drag.pointerId);
    } catch {
      // The browser may already have released this pointer.
    }
  }
  state.panelResizeDrag = null;
  savePanelWidths();
}

function restoreSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    setSelectValue(els.montageSelect, settings.montage);
    state.activeMontage = els.montageSelect.value || "conventional";
    state.viewMode = "single";
    state.workspaceMode = "review";
    if (RIGHT_PANEL_TABS.includes(settings.rightPanelTab)) {
      state.rightPanelTab = settings.rightPanelTab;
    }
    syncMultiMontageControls();
    updateViewModeButtons();
    setSelectValue(els.sensitivitySelect, settings.sensitivity);
    setSelectValue(els.tcSelect, settings.tc);
    setSelectValue(els.hfSelect, settings.hf);
    setSelectValue(els.acSelect, normalizeAcValue(settings.ac));
    normalizeAcSelect();
    setSelectValue(els.durationSelect, settings.duration);
    syncTimebaseButtons();
    setSelectValue(els.paperSelect, settings.paper);
    if (typeof settings.ecg === "boolean") els.ecgToggle.checked = settings.ecg;
    if (typeof settings.rightPanelVisible === "boolean") {
      state.rightPanelVisible = settings.rightPanelVisible;
    }
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
}

function saveSettings() {
  const settings = {
    montage: els.montageSelect.value,
    viewMode: "single",
    workspaceMode: "review",
    rightPanelTab: RIGHT_PANEL_TABS.includes(state.rightPanelTab) ? state.rightPanelTab : "metadata",
    sensitivity: els.sensitivitySelect.value,
    tc: els.tcSelect.value,
    hf: els.hfSelect.value,
    ac: normalizeAcSelect(),
    duration: els.durationSelect.value,
    paper: els.paperSelect.value,
    ecg: els.ecgToggle.checked,
    rightPanelVisible: state.rightPanelVisible,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}



function isMultiMontageMode() {
  return false;
}

function normalizeMultiMontageCount(value) {
  const count = Number(value);
  if (count === 2 || count === 3 || count === 4) return count;
  return 3;
}

function activeMultiMontageCount() {
  return normalizeMultiMontageCount(state.multiMontageCount);
}

function viewModeColumnCount(mode = state.viewMode, montageCount = state.multiMontageCount) {
  return mode === "multi" ? normalizeMultiMontageCount(montageCount) : 1;
}

function availableTimebases() {
  return Array.from(els.durationSelect?.options || [])
    .map((opt) => Number(opt.value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
}

function nearestTimebase(value) {
  const options = availableTimebases();
  if (!options.length) return null;
  return options.reduce((best, option) => (
    Math.abs(option - value) < Math.abs(best - value) ? option : best
  ), options[0]);
}

function autoAdjustTimebaseForViewMode(prevMode, prevCount, nextMode, nextCount) {
  if (!els.durationSelect) return false;
  const current = Number(els.durationSelect.value);
  if (!Number.isFinite(current) || current <= 0) return false;
  const previousColumns = viewModeColumnCount(prevMode, prevCount);
  const nextColumns = viewModeColumnCount(nextMode, nextCount);
  if (previousColumns === nextColumns) return false;
  const target = current * previousColumns / nextColumns;
  const nextTimebase = nearestTimebase(target);
  if (!Number.isFinite(nextTimebase) || Math.abs(nextTimebase - current) < 1e-6) return false;
  els.durationSelect.value = String(nextTimebase);
  return true;
}

function activeMontageValue() {
  return els.montageSelect.value || state.activeMontage || "conventional";
}

function updateViewModeButtons() {
  const count = activeMultiMontageCount();
  document.body.classList.toggle("multi-montage-mode", isMultiMontageMode());
  document.body.classList.toggle("multi-montage-two", isMultiMontageMode() && count === 2);
  document.body.classList.toggle("multi-montage-three", isMultiMontageMode() && count === 3);
  document.body.classList.toggle("multi-montage-four", isMultiMontageMode() && count === 4);
}

function normalizeMultiMontages(value) {
  const valid = new Set(Object.keys(MONTAGE_LABELS));
  const source = Array.isArray(value) ? value : DEFAULT_MULTI_MONTAGES;
  const out = source.slice(0, 4).map((montage, index) => valid.has(montage) ? montage : DEFAULT_MULTI_MONTAGES[index]);
  while (out.length < 4) out.push(DEFAULT_MULTI_MONTAGES[out.length]);
  return out;
}

function syncMultiMontageControls() {
  state.multiMontages = normalizeMultiMontages(state.multiMontages);
}

function multiMontageViews() {
  return normalizeMultiMontages(state.multiMontages)
    .slice(0, activeMultiMontageCount())
    .map((montage) => ({ montage, label: MONTAGE_LABELS[montage] || montage }));
}

function setViewMode(mode, montageCount = state.multiMontageCount) {
  const next = "single";
  const nextCount = normalizeMultiMontageCount(montageCount);
  if (state.viewMode === next && state.multiMontageCount === nextCount) return;
  const prevMode = state.viewMode;
  const prevCount = state.multiMontageCount;
  state.viewMode = "single";
  state.multiMontageCount = nextCount;
  autoAdjustTimebaseForViewMode(prevMode, prevCount, next, nextCount);
  state.activeMontage = activeMontageValue();
  syncMultiMontageControls();
  updateViewModeButtons();
  updateResearchMontageTiming();
  saveSettings();
  state.windowData = null;
  loadWindow();
}

function syncActiveMontageData(options = {}) {
  const data = state.windowData;
  if (!data || !Array.isArray(data.montageViews)) return false;
  const active = activeMontageValue();
  const exact = data.montageViews.find((item) => item.montage === active && item.available !== false && (item.traces || []).length);
  if (options.requireExact && !exact) return false;
  const view = exact || data.montageViews.find((item) => item.available !== false && (item.traces || []).length) || data.montageViews[0];
  if (!view) return false;
  data.montage = view.montage;
  data.traces = view.traces || [];
  data.times = view.times || data.times || [];
  state.activeMontage = view.montage;
  if (els.montageSelect.value !== view.montage) els.montageSelect.value = view.montage;
  return true;
}

function setActiveMontage(montage, options = {}) {
  if (!montage) return;
  state.activeMontage = montage;
  if (els.montageSelect.value !== montage) els.montageSelect.value = montage;
  syncActiveMontageData();
  updateResearchMontageTiming();
  saveSettings();
  if (options.reload) {
    loadWindow();
    return;
  }
  renderStatus();
  draw();
}

function applyWorkspaceMode(options = {}) {
  document.body.classList.add("review-mode");
  for (const btn of els.workspaceModeButtons || []) {
    const active = btn.dataset.workspaceMode === state.workspaceMode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }
  if (options.redraw === false) return;
  resizeCanvas();
  draw();
}

function setWorkspaceMode(mode) {
  const next = "review";
  if (state.workspaceMode === next) return;
  state.workspaceMode = next;
  saveSettings();
  applyWorkspaceMode();
}

function applyRightPanelTab() {
  const activeTab = RIGHT_PANEL_TABS.includes(state.rightPanelTab) ? state.rightPanelTab : "metadata";
  state.rightPanelTab = activeTab;
  for (const btn of els.rightTabButtons || []) {
    const active = btn.dataset.rightTab === activeTab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
    btn.tabIndex = active ? 0 : -1;
  }
  for (const panel of els.rightTabPanels || []) {
    panel.hidden = panel.dataset.rightTabPanel !== activeTab;
  }
  requestAnimationFrame(() => {
    if (activeTab === "test") {
      renderRightResearchPanels();
    }
  });
}

function setRightPanelTab(tab, options = {}) {
  if (!RIGHT_PANEL_TABS.includes(tab)) return;
  state.rightPanelTab = tab;
  if (!state.rightPanelVisible) {
    setRightPanelVisible(true, { save: false, redraw: false });
  }
  applyRightPanelTab();
  if (options.save !== false) saveSettings();
}


function applyRightPanelVisibility(options = {}) {
  document.body.classList.toggle("right-panel-hidden", !state.rightPanelVisible);
  if (options.redraw === false) return;
  scheduleLayoutRefresh();
}

function setRightPanelVisible(visible, options = {}) {
  state.rightPanelVisible = Boolean(visible);
  if (options.save !== false) saveSettings();
  applyRightPanelVisibility(options);
}

function setSelectValue(select, value) {
  if (!value) return;
  if ([...select.options].some((opt) => opt.value === value || opt.textContent === value)) {
    select.value = value;
  }
}

function onKeyDown(ev) {
  const target = ev.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return;
  }
  if (isValidationWorkflow() && state.validationSession && (ev.key === "Enter" || ev.key === "a" || ev.key === "A")) {
    ev.preventDefault();
    saveValidationDecision(VALIDATION_DECISION_ADOPT);
    return;
  }
  if (isValidationWorkflow() && state.validationSession && (ev.key === "Backspace" || ev.key === "Delete" || ev.key === "x" || ev.key === "X")) {
    ev.preventDefault();
    saveValidationDecision(VALIDATION_DECISION_EXCLUDE);
    return;
  }
  if (ev.key === "ArrowLeft") {
    ev.preventDefault();
    state.start = clampStart(state.start - 1);
    state.cursorTime = null;
    loadWindow();
  } else if (ev.key === "ArrowRight") {
    ev.preventDefault();
    state.start = clampStart(state.start + 1);
    state.cursorTime = null;
    loadWindow();
  } else if (ev.key === "ArrowUp" || ev.key === "+" || ev.key === "=") {
    ev.preventDefault();
    stepSensitivity(-1);
  } else if (ev.key === "ArrowDown" || ev.key === "-" || ev.key === "_") {
    ev.preventDefault();
    stepSensitivity(1);
  } else if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(ev.key)) {
    ev.preventDefault();
    const montageByKey = {
      1: "conventional",
      2: "conventional_average",
      3: "longitudinal",
      4: "transverse",
      5: "a1a2",
      6: "average",
      7: "cz",
      8: "circular",
    };
    setMontage(montageByKey[ev.key]);
  }
}

function pageWaveform(direction) {
  if (!state.recordingId) return;
  const duration = visibleDuration();
  state.start = clampStart(state.start + direction * duration, duration);
  state.cursorTime = null;
  updateWaveScrollbar();
  loadWindow();
}

function shiftWaveformSeconds(deltaSec) {
  if (!state.recordingId || !Number.isFinite(deltaSec) || deltaSec === 0) return;
  const nextStart = clampStart(Number((Number(state.start || 0) + deltaSec).toFixed(3)));
  if (nextStart === state.start) return;
  state.start = nextStart;
  state.cursorTime = null;
  updateWaveScrollbar();
  renderStatus();
  loadWindow();
}

function clearMobileSwipeLoadTimer() {
  if (!state.mobileSwipeLoadTimer) return;
  clearTimeout(state.mobileSwipeLoadTimer);
  state.mobileSwipeLoadTimer = null;
}

function scheduleMobileSwipeLoad() {
  clearMobileSwipeLoadTimer();
  setWaveLoading(true);
  state.mobileSwipeLoadTimer = setTimeout(() => {
    state.mobileSwipeLoadTimer = null;
    loadWindow();
  }, MOBILE_SWIPE_LOAD_DEBOUNCE_MS);
}

function onWaveTouchStart(ev) {
  if (!state.windowData?.traces?.length || ev.touches.length !== 1) return;
  const touch = ev.touches[0];
  state.touchSwipe = {
    startX: touch.clientX,
    startY: touch.clientY,
    lastX: touch.clientX,
    lastY: touch.clientY,
    startTime: Number(state.start || 0),
    appliedSeconds: 0,
    swiping: false,
  };
}

function onWaveTouchMove(ev) {
  if (!state.touchSwipe || ev.touches.length !== 1) return;
  const touch = ev.touches[0];
  const dx = touch.clientX - state.touchSwipe.startX;
  const dy = touch.clientY - state.touchSwipe.startY;
  state.touchSwipe.lastX = touch.clientX;
  state.touchSwipe.lastY = touch.clientY;
  if (!state.touchSwipe.swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    state.touchSwipe.swiping = true;
    hideContextMenu();
  }
  if (state.touchSwipe.swiping) {
    ev.preventDefault();
    state.suppressNextClick = true;
    const steps = Math.round((-dx / MOBILE_SWIPE_PX_PER_STEP) || 0);
    const deltaSec = Number((steps * MOBILE_SWIPE_STEP_SEC).toFixed(3));
    if (deltaSec !== state.touchSwipe.appliedSeconds) {
      state.start = clampStart(Number((state.touchSwipe.startTime + deltaSec).toFixed(3)));
      state.touchSwipe.appliedSeconds = deltaSec;
      state.cursorTime = null;
      updateWaveScrollbar();
      renderStatus();
      draw();
      scheduleMobileSwipeLoad();
    }
  }
}

function onWaveTouchEnd(ev) {
  const swipe = state.touchSwipe;
  state.touchSwipe = null;
  if (!swipe?.swiping) return;
  const dx = swipe.lastX - swipe.startX;
  if (Math.abs(dx) < 16) return;
  ev.preventDefault();
  state.suppressNextClick = true;
  hideContextMenu();
  clearMobileSwipeLoadTimer();
  if (!swipe.appliedSeconds) {
    shiftWaveformSeconds(dx < 0 ? MOBILE_SWIPE_STEP_SEC : -MOBILE_SWIPE_STEP_SEC);
  } else {
    loadWindow();
  }
}

function onWaveTouchCancel() {
  state.touchSwipe = null;
  clearMobileSwipeLoadTimer();
  setWaveLoading(false);
}

function onWaveScrollbarInput(ev) {
  if (!state.recordingId) return;
  state.start = clampStart(Number(ev.target.value));
  state.cursorTime = null;
  renderStatus();
}

function onWaveScrollbarChange(ev) {
  if (!state.recordingId) return;
  state.start = clampStart(Number(ev.target.value));
  state.cursorTime = null;
  updateWaveScrollbar();
  loadWindow();
}

function updateWaveScrollbar() {
  const input = els.waveScrollbar;
  if (!input) return;
  const duration = visibleDuration();
  const total = recordingDuration();
  const maxStart = total ? Math.max(0, total - duration) : 0;
  const step = Number(state.windowData?.sfreq || 0) > 0 ? Math.max(0.001, 1 / Number(state.windowData.sfreq)) : 0.1;
  input.min = "0";
  input.max = String(maxStart);
  input.step = String(step);
  input.value = String(clampStart(state.start, duration));
  input.disabled = !state.recordingId || maxStart <= 0;
}

function onWaveWheel(ev) {
  if (!state.recordingId) return;
  const primaryDelta = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
  if (!primaryDelta) return;
  ev.preventDefault();
  const now = performance.now();
  if (now - state.lastWaveWheelPageAt < 180) return;
  state.lastWaveWheelPageAt = now;
  pageWaveform(primaryDelta > 0 ? 1 : -1);
}

function setMontage(montage) {
  if (!montage || els.montageSelect.value === montage) return;
  if (isMultiMontageMode()) {
    setActiveMontage(montage);
    return;
  }
  els.montageSelect.value = montage;
  state.activeMontage = montage;
  saveSettings();
  updateResearchMontageTiming();
  if (syncActiveMontageData({ requireExact: true })) {
    renderStatus();
    draw();
    return;
  }
  state.windowData = null;
  loadWindow();
}

function stepSensitivity(direction) {
  const options = [...els.sensitivitySelect.options];
  const nextIndex = Math.min(
    options.length - 1,
    Math.max(0, els.sensitivitySelect.selectedIndex + direction)
  );
  if (nextIndex === els.sensitivitySelect.selectedIndex) return;
  els.sensitivitySelect.selectedIndex = nextIndex;
  saveSettings();
  renderStatus();
  draw();
}

function applyOpenedRecording(opened) {
  if (!(TEST_ONLY_DISTRIBUTION && hasActiveResearchPrefetchSession())) {
    state.windowCache.clear();
  }
  const rows = Array.isArray(opened?.recordings) ? opened.recordings : [];
  const next = rows.length ? rows : [{ id: opened?.id, baseName: opened?.id, format: "EDF", eegPath: opened?.path || "", sizeMb: "" }];
  const byId = new Map((state.recordings || []).map((rec) => [String(rec.id || ""), rec]));
  for (const rec of next) {
    if (rec?.id) byId.set(String(rec.id), rec);
  }
  state.recordings = Array.from(byId.values());
  if (els.recordingSelect) {
    els.recordingSelect.innerHTML = "";
    for (const rec of state.recordings) {
      const opt = document.createElement("option");
      opt.value = rec.id;
      opt.textContent = `${rec.baseName || rec.id} [${rec.format || "EEG"}]${rec.sizeMb !== undefined && rec.sizeMb !== "" ? ` (${rec.sizeMb} MB)` : ""}`;
      opt.title = rec.eegPath || "";
      els.recordingSelect.appendChild(opt);
    }
  }
  state.recordingId = opened?.id || next[0]?.id || state.recordingId;
  if (els.recordingSelect && state.recordingId) els.recordingSelect.value = state.recordingId;
}

async function loadRecordings(preferredId = "", options = {}) {
  setStatus("Loading recording list...", { busy: true, progress: 40 });
  state.recordings = await fetchJson("/api/recordings");
  els.recordingSelect.innerHTML = "";
  for (const rec of state.recordings) {
    const opt = document.createElement("option");
    opt.value = rec.id;
    opt.textContent = `${rec.baseName || rec.id} [${rec.format || "EEG"}] (${rec.sizeMb} MB)`;
    opt.title = rec.eegPath || "";
    els.recordingSelect.appendChild(opt);
  }
  if (state.recordings.length) {
    const ids = new Set(state.recordings.map((rec) => rec.id));
    state.recordingId = ids.has(preferredId)
      ? preferredId
      : ids.has(state.recordingId)
        ? state.recordingId
        : state.recordings[0].id;
    els.recordingSelect.value = state.recordingId;
    setStatus("Loading metadata...", { busy: true, progress: 60 });
    await loadMetadata();
    if (preferredId && options.loadWindow !== false) {
      await loadWindow();
    } else if (preferredId) {
      setStatus("Ready. Loading waveform...", { busy: true, progress: 65 });
    } else {
      setStatus("Ready. Loading waveform...", { busy: true, progress: 65 });
      setTimeout(() => loadWindow(), 0);
    }
  } else {
    setStatus("No .EEG or .EDF recordings found", { error: true });
  }
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
  } else if ([els.tcSelect, els.hfSelect, els.acSelect, els.ecgToggle].includes(ev.target)) {
    await handleFilterControlChange("change");
    return;
  }
  await loadWindow();
  scheduleLayoutRefresh();
}


async function loadMetadata() {
  setStatus("Loading metadata...", { busy: true, progress: 60 });
  state.metadata = await fetchJson(`/api/recording?${qs({ id: state.recordingId })}`);
  renderMetadata();
}

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
  const duration = Number(options.duration || defaultResearchTimebaseSec()) || defaultResearchTimebaseSec();
  const montage = options.montage || researchCasePrefetchMontage(item);
  const montages = options.montages || preferredResearchWindowMontages(montage).join(",");
  return {
    id: recordId,
    start: options.start ?? researchCasePrefetchStart(item, duration),
    duration,
    montage,
    montages,
    tc: options.tc || "0.3",
    hf: options.hf || "120",
    ac: normalizeAcValue(options.ac || normalizeAcSelect()),
    ecg: "1",
    maxPoints: options.maxPoints || windowMaxPoints(),
    strictMontage: TEST_ONLY_DISTRIBUTION ? "1" : "0",
  };
}

async function openResearchCaseForPrefetch(item) {
  const path = String(item?.edfPath || "");
  if (!path) return "";
  if (state.researchPrefetchRecordIds.has(path)) return state.researchPrefetchRecordIds.get(path);
  const opened = await fetchJson("/api/open-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    retryAttempts: 1,
    body: JSON.stringify({ path }),
  });
  const recordId = opened?.id || "";
  if (recordId) state.researchPrefetchRecordIds.set(path, recordId);
  return recordId;
}

async function prefetchResearchWindow(item, options = {}) {
  if (!TEST_ONLY_DISTRIBUTION || !item?.edfPath) return false;
  const recordId = options.recordId || await openResearchCaseForPrefetch(item);
  if (!recordId) return false;
  const params = researchWindowPrefetchParams(recordId, item, options);
  const cacheKey = windowCacheKey(params);
  if (state.windowCache.has(cacheKey) || state.researchPrefetchQueuedKeys.has(cacheKey)) return false;
  state.researchPrefetchQueuedKeys.add(cacheKey);
  try {
    const data = await fetchJson(`/api/window?${qs(params)}`, { retryAttempts: 1 });
    rememberWindowCache(cacheKey, data);
    return true;
  } catch {
    return false;
  } finally {
    state.researchPrefetchQueuedKeys.delete(cacheKey);
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
      runId === state.researchPrefetchRunId &&
      hasActiveResearchPrefetchSession()
    ) {
      drainResearchPrefetchQueue(runId);
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
  const rest = ordered.slice(RESEARCH_PREFETCH_LOOKAHEAD);
  enqueueResearchPrefetchCases(ahead, { priority: true });
  enqueueResearchPrefetchCases(rest);
}

function resetResearchPrefetch(options = {}) {
  state.researchPrefetchRunId += 1;
  state.researchPrefetchActive = false;
  state.researchPrefetchQueue = [];
  state.researchPrefetchQueuedCases.clear();
  state.researchPrefetchQueuedKeys.clear();
  if (options.clearRecords) state.researchPrefetchRecordIds.clear();
}

function applyWindowData(data, requestedMontage) {
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
  state.start = state.windowData.start || 0;
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

async function loadWindow() {
  if (!state.recordingId) return;
  if (state.windowLoadInFlight) {
    state.windowLoadPending = true;
    setStatus("Loading waveform...", { busy: true, progress: 75 });
    setWaveLoading(true);
    return state.windowLoadPromise || undefined;
  }
  state.windowLoadInFlight = true;
  setWaveLoading(true);
  state.windowLoadPromise = (async () => {
    const endpoint = "/api/window";
    try {
      do {
        state.windowLoadPending = false;
        setStatus("Loading waveform...", { busy: true, progress: 75 });
        const requestedMontage = activeMontageValue();
        const requestedDuration = Number(els.durationSelect?.value || 10) || 10;
        const params = {
          id: state.recordingId,
          start: state.start,
          duration: requestedDuration,
          montage: requestedMontage,
          montages: TEST_ONLY_DISTRIBUTION ? preferredResearchWindowMontages(requestedMontage).join(",") : preferredWindowMontages(requestedMontage).join(","),
          tc: els.tcSelect.value,
          hf: els.hfSelect.value,
          ac: normalizeAcSelect(),
          ecg: els.ecgToggle.checked ? "1" : "0",
          maxPoints: windowMaxPoints(),
          strictMontage: TEST_ONLY_DISTRIBUTION ? "1" : "0",
        };
        const cacheKey = windowCacheKey(params);
        const cached = state.windowCache.get(cacheKey);
        if (cached) {
          applyWindowData(cached, requestedMontage);
          setStatus("Ready");
          setWaveLoading(false);
          return cached;
        }
        const data = await fetchJson(`${endpoint}?${qs(params)}`);
        if (state.windowLoadPending) continue;
        rememberWindowCache(cacheKey, data);
        applyWindowData(data, requestedMontage);
      } while (state.windowLoadPending);
    } catch (err) {
      if (!state.windowLoadPending) setStatus(`Waveform failed: ${err.message}`, { error: true });
    } finally {
      state.windowLoadInFlight = false;
      state.windowLoadPending = false;
      state.windowLoadPromise = null;
      setWaveLoading(false);
    }
  })();
  return state.windowLoadPromise;
}

function renderMetadata() {
  const md = state.metadata;
  if (!md || !els.metadataPanel) return;
  const rows = [
    ["ID", md.id],
    ["Device", md.deviceName || "-"],
    ["System ref", md.systemReference || "-"],
    ["Raw ch", (md.raw.channels || []).join(", ") || "-"],
    ["sfreq", md.raw.sfreq ? `${md.raw.sfreq} Hz` : "-"],
    ["Duration", `${(md.raw.durationSec || 0).toFixed(2)} s`],
    ["Aux", (md.auxiliaryChannels || []).join(", ") || "-"],
    ["Viewer", md.viewer.portaViewReviewExists ? "PortaViewReview.exe" : "not found"],
  ];
  els.metadataPanel.innerHTML = rows
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("");
}

function renderWarnings() {
  const warnings = (state.windowData && state.windowData.warnings) || [];
  const warningHtml = warnings.map((w) => `<p>${escapeHtml(w)}</p>`).join("");
  if (els.warningPanel) {
    els.warningPanel.innerHTML = warningHtml || "<p>No warnings.</p>";
  }
}

function renderStatus() {
  const duration = visibleDuration();
  const end = state.start + duration;
  const tc = tcText();
  const sensitivity = sensitivityValue();
  const traceCount = isMultiWindowData()
    ? (state.windowData.montageViews || []).map((view) => (view.traces || []).length).join("/")
    : String((state.windowData?.traces || []).length);
  const traceText = traceCount && traceCount !== "0" ? ` · ${traceCount} traces` : "";
  const firstTrace = state.windowData?.traces?.[0]?.label ? ` · ${state.windowData.traces[0].label}` : "";
  const loadedDuration = Number(state.windowData?.duration || 0);
  const durationText = loadedDuration ? ` · loaded ${loadedDuration.toFixed(2)}s` : "";
  const acText = acFilterLabel();
  setStatus(`${state.recordingId} · ${labelForMontage()} · ${sensitivity}uV/mm · TC ${tc} · HF ${hfText()} · AC ${acText}${traceText}${firstTrace}${durationText} · ${formatSec(state.start)}-${formatSec(end)}`);
  els.timeReadout.textContent = `${formatSec(state.start)} - ${formatSec(end)}`;
  els.calReadout.textContent = `${sensitivity}uV/mm · TC ${tc} · HF ${hfText()} · AC ${acText} · ${els.paperSelect.value} mm/s`;
}

function isMultiWindowData() {
  return false;
}

function draw() {
  resizeCanvas();
  const canvas = els.waveCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const traces = displayTraces(state.windowData?.traces || []);
  const times = state.windowData?.times || [];
  const duration = visibleDuration();
  const start = Number(state.start || 0);
  if (els.timeReadout) {
    els.timeReadout.textContent = `${formatSec(start)} - ${formatSec(start + duration)}`;
  }
  if (els.calReadout) {
    els.calReadout.textContent = `${sensitivityValue()} uV/mm · TC ${tcText()} · AC ${acFilterLabel()} · ${els.paperSelect?.value || "30"} mm/s`;
  }
  if (!traces.length || !times.length) {
    ctx.fillStyle = "#68707c";
    ctx.font = `${13 * ratio}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("No waveform data", canvas.width / 2, canvas.height / 2);
    return;
  }
  const { left, right, top, bottom } = plotLayout(canvas);
  const plotW = canvas.width - left - right;
  const plotH = canvas.height - top - bottom;
  const sensitivity = sensitivityValue();
  const pxPerMm = Math.max(3 * ratio, Number(els.paperSelect?.value || 30) * ratio / 10);
  if (isMultiWindowData()) {
    const layouts = multiMontageColumnLayouts(left, top, plotW, plotH, ratio);
    layouts.forEach((layout) => {
      const view = layout.view || {};
      drawWaveColumn(ctx, layout, displayTraces(view.traces || []), view.times || state.windowData?.times || [], {
        duration,
        start,
        pxPerMm,
        sensitivity,
        ratio,
        single: false,
        active: view.montage === activeMontageValue(),
        montage: view.montage || activeMontageValue(),
      });
    });
  } else {
    drawWaveColumn(ctx, { left, top, plotW, plotH }, traces, times, {
      duration,
      start,
      pxPerMm,
      sensitivity,
      ratio,
      single: true,
      active: true,
      montage: activeMontageValue(),
    });
  }
  drawCursorLine(ctx, left, top, plotW, plotH, start, duration, ratio);
}

function multiMontageColumnLayouts(left, top, plotW, plotH, ratio) {
  const gap = 14 * ratio;
  const labelGutter = 48 * ratio;
  const views = multiMontageViews();
  const count = Math.max(1, views.length);
  const columnW = Math.max(80 * ratio, (plotW - gap * (count - 1)) / count);
  return views.map((view, index) => {
    const columnLeft = left + index * (columnW + gap);
    const traceLeft = columnLeft + labelGutter;
    return {
      left: traceLeft,
      top,
      plotW: Math.max(40 * ratio, columnW - labelGutter),
      plotH,
      labelLeft: columnLeft + 4 * ratio,
      labelMaxW: labelGutter - 8 * ratio,
      numberRight: traceLeft - 4 * ratio,
      view,
    };
  });
}

function drawViewerWaveformPath(ctx, values, times, options) {
  const { left, plotW, centerY, start, duration, yScale, strokeStyle, lineWidth } = options;
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  let started = false;
  (values || []).forEach((value, i) => {
    const time = Number((times || [])[i]);
    const voltage = Number(value);
    if (!Number.isFinite(time) || !Number.isFinite(voltage)) return;
    const x = left + ((time - start) / duration) * plotW;
    const y = centerY - voltage * yScale;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (started) ctx.stroke();
  ctx.restore();
}

function traceUvPerMm(trace, fallbackSensitivity) {
  if (trace?.role !== "ecg") return fallbackSensitivity;
  const values = (trace.values || [])
    .map((value) => Math.abs(Number(value)))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return ECG_UV_PER_MM;
  values.sort((a, b) => a - b);
  const p95 = values[Math.max(0, Math.min(values.length - 1, Math.round(values.length * 0.95)))];
  const target = p95 / ECG_AUTO_TARGET_MM;
  return Math.max(ECG_AUTO_MIN_UV_PER_MM, Math.min(ECG_AUTO_MAX_UV_PER_MM, target || ECG_UV_PER_MM));
}

function drawWaveColumn(ctx, layout, traces, times, options) {
  const { left, top, plotW, plotH } = layout;
  const { duration, start, pxPerMm, sensitivity, ratio } = options;
  const rowH = plotH / Math.max(1, traces.length);
  const labelPx = options.single ? fitFontPx(rowH, ratio) : fitMultiMontageFontPx(rowH, ratio);
  ctx.save();
  if (!options.single) {
    ctx.strokeStyle = options.active ? "rgba(32, 121, 76, .9)" : "rgba(120, 124, 116, .28)";
    ctx.lineWidth = Math.max(1, (options.active ? 2.2 : 1) * ratio);
    ctx.strokeRect(left, top, plotW, plotH);
  }
  drawGrid(ctx, left, top, plotW, plotH, duration);
  drawTimeHeader(ctx, left, top, plotW, duration, start, ratio);
  drawRowBaselines(ctx, left, top, plotW, rowH, traces.length, ratio);
  drawScalogramSelection(ctx, left, top, plotW, plotH, start, duration, ratio);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, plotW, plotH);
  ctx.clip();
  traces.forEach((trace, rowIndex) => {
    const centerY = top + rowH * (rowIndex + 0.5);
    const yScale = pxPerMm / Math.max(1e-6, traceUvPerMm(trace, sensitivity));
    drawViewerWaveformPath(ctx, trace.values, trace.times || times, {
      left,
      plotW,
      centerY,
      start,
      duration,
      yScale,
      strokeStyle: traceColor(trace, rowIndex, options.montage),
      lineWidth: trace.role === "ecg" ? 1.25 * ratio : 1.05 * ratio,
    });
  });
  ctx.restore();

  traces.forEach((trace, rowIndex) => {
    const centerY = top + rowH * (rowIndex + 0.5);
    ctx.font = `${labelPx}px Arial`;
    ctx.textAlign = "left";
    ctx.fillStyle = traceColor(trace, rowIndex, options.montage);
    const labelX = layout.labelLeft ?? (isMobileViewport() ? 4 * ratio : 45 * ratio);
    const maxW = layout.labelMaxW ?? (isMobileViewport() ? Math.max(24 * ratio, left - labelX - 4 * ratio) : Math.max(45 * ratio, plotW - (labelX - left) - 3 * ratio));
    ctx.fillText(nkLabel(trace.label), labelX, centerY + labelPx * 0.35, maxW);
  });

  drawCursorLine(ctx, left, top, plotW, plotH, start, duration, ratio);
  if (!options.single) drawMultiMontageHeader(ctx, layout, options, ratio);
  if (options.single) {
    drawCalibration(ctx, left, top, plotW, plotH, duration, sensitivity, pxPerMm, ratio);
    drawMarkerRow(ctx, left, top, plotW, plotH, ratio);
  } else if (options.active) {
    drawCalibration(ctx, left, top, plotW, plotH, duration, sensitivity, pxPerMm, ratio);
  }
  ctx.restore();
}

function drawMultiMontageHeader(ctx, layout, options, ratio) {
  const { left, top, plotW } = layout;
  const label = options.label || options.montage || "";
  if (!label) return;
  const headerH = 16 * ratio;
  const padX = 5 * ratio;
  const headerW = Math.min(plotW - 2 * ratio, 78 * ratio);
  ctx.save();
  ctx.font = `${11 * ratio}px Arial`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = options.active ? "#20794c" : "#f7f7f3";
  ctx.strokeStyle = options.active ? "rgba(20, 94, 56, .95)" : "rgba(120,124,116,.5)";
  ctx.lineWidth = Math.max(1, ratio);
  ctx.fillRect(left + 1 * ratio, top + 1 * ratio, headerW, headerH);
  ctx.strokeRect(left + 1 * ratio, top + 1 * ratio, headerW, headerH);
  ctx.fillStyle = options.active ? "#fff" : "#374654";
  ctx.fillText(label, left + padX, top + 1 * ratio + headerH / 2, Math.max(20 * ratio, headerW - 2 * padX));
  ctx.restore();
}

function drawGrid(ctx, left, top, plotW, plotH, duration) {
  ctx.strokeStyle = "rgba(210, 202, 130, .34)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= duration * 5; i++) {
    const x = left + (i / (duration * 5)) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + plotH);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(176, 166, 78, .58)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= duration; i++) {
    const x = left + (i / duration) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + plotH);
    ctx.stroke();
  }
}

function drawTimeHeader(ctx, left, top, plotW, duration, start, ratio) {
  ctx.save();
  ctx.font = `${12 * ratio}px Arial`;
  ctx.fillStyle = "rgba(150, 151, 142, .66)";
  ctx.textAlign = "center";
  for (let i = 0; i <= duration; i += 2) {
    const x = left + (i / duration) * plotW;
    ctx.fillText(`▽ ${formatHeaderTime(start + i)}`, x, top - 8 * ratio);
  }
  ctx.restore();
}

function drawRowBaselines(ctx, left, top, plotW, rowH, count, ratio) {
  ctx.save();
  ctx.strokeStyle = "rgba(96, 102, 86, .12)";
  ctx.lineWidth = 1 * ratio;
  for (let i = 0; i < count; i++) {
    const y = top + rowH * (i + 0.5);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScalogramSelection(ctx, left, top, plotW, plotH, start, duration, ratio) {
  if (state.researchMode === "test" && state.researchSession) return;
  const selection = state.dragSelection;
  if (!selection) return;
  const selStart = Number(selection.start || 0);
  const selEnd = selStart + Number(selection.duration || 1);
  if (selEnd < start || selStart > start + duration) return;
  const x1 = left + ((Math.max(selStart, start) - start) / duration) * plotW;
  const x2 = left + ((Math.min(selEnd, start + duration) - start) / duration) * plotW;
  ctx.save();
  ctx.fillStyle = "rgba(79, 176, 104, .08)";
  ctx.strokeStyle = "rgba(79, 176, 104, .52)";
  ctx.lineWidth = Math.max(0.25, 0.22 * ratio);
  ctx.fillRect(x1, top, Math.max(2 * ratio, x2 - x1), plotH);
  ctx.strokeRect(x1, top, Math.max(2 * ratio, x2 - x1), plotH);
  ctx.restore();
}

function drawCursorLine(ctx, left, top, plotW, plotH, start, duration, ratio) {
  if (state.cursorTime === null) return;
  if (state.cursorTime < start || state.cursorTime > start + duration) return;
  const x = left + ((state.cursorTime - start) / duration) * plotW;
  ctx.save();
  ctx.strokeStyle = "rgba(20, 150, 84, .92)";
  ctx.lineWidth = Math.max(1.5, 1.4 * ratio);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + plotH);
  ctx.stroke();
  ctx.restore();
}

function drawCalibration(ctx, left, top, plotW, plotH, duration, sensitivity, pxPerMm, ratio) {
  const x = left + plotW * 0.61;
  const y = top + plotH * 0.86;
  const w = plotW / duration;
  const h = (50 / sensitivity) * pxPerMm;
  ctx.strokeStyle = "#6f78ba";
  ctx.fillStyle = "#5665b1";
  ctx.lineWidth = 1.25 * ratio;
  ctx.font = `${13 * ratio}px Arial`;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y - h);
  ctx.stroke();
  ctx.fillText("1s", x + 5 * ratio, y - 5 * ratio);
  ctx.fillText("50uV", x + w + 5 * ratio, y - h * 0.45);
}

function drawMarkerRow(ctx, left, top, plotW, plotH, ratio) {
  const y = top + plotH - 5 * ratio;
  ctx.save();
  ctx.strokeStyle = "rgba(80, 80, 75, .42)";
  ctx.fillStyle = "#555650";
  ctx.font = `${12 * ratio}px Arial`;
  ctx.fillText("M", 35 * ratio, y + 4 * ratio);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left + plotW, y);
  ctx.stroke();
  ctx.restore();
}

function onWaveMouseDown(ev) {
  if (ev.button !== 0 || !state.windowData?.traces?.length) return;
  if (state.researchMode === "test" && state.researchSession) {
    state.dragSelection = null;
    state.suppressNextClick = false;
    return;
  }
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reload: false });
  const selection = draggedSelection(point.onset, point.onset);
  state.dragSelection = {
    ...selection,
    anchor: point.onset,
    active: true,
  };
  state.suppressNextClick = false;
}

function onWaveMouseMove(ev) {
  if (!state.dragSelection?.active) return;
  const point = canvasToData(ev);
  state.dragSelection = {
    ...draggedSelection(state.dragSelection.anchor, point.onset),
    anchor: state.dragSelection.anchor,
    active: true,
    pointer: point.onset,
  };
  draw();
}

function onWaveMouseUp(ev) {
  if (ev.button !== 0 || !state.dragSelection?.active) return;
  const point = canvasToData(ev);
  const moved = Math.abs(point.onset - state.dragSelection.anchor) > 0.03;
  const selection = draggedSelection(state.dragSelection.anchor, point.onset);
  state.dragSelection = null;
  if (!moved) {
    return;
  }
  state.suppressNextClick = true;
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reload: false });
  state.cursorTime = selection.start;
  draw();
}

function onWaveMouseLeave(ev) {
  if (!state.dragSelection?.active) return;
  if (ev?.buttons === 1) return;
  state.dragSelection = null;
  draw();
}

function draggedSelection(anchor, pointer) {
  const total = recordingDuration();
  const start = Math.max(0, Math.min(Number(anchor || 0), Number(pointer || 0)));
  const endLimit = total || state.start + visibleDuration();
  const end = Math.min(endLimit, Math.max(Number(anchor || 0), Number(pointer || 0)));
  return {
    start: preciseNumber(start),
    duration: preciseNumber(Math.max(0, end - start)),
  };
}

function openContextMenu(ev) {
  ev.preventDefault();
  if (TEST_ONLY_DISTRIBUTION && !(state.researchMode === "test" && state.researchSession)) {
    hideContextMenu();
    return;
  }
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reload: false });
  state.context = { ...point };
  if (state.researchMode === "test" && state.researchSession) renderResearchRatingContextMenu();
  else return hideContextMenu();
  els.contextMenu.style.left = `${ev.clientX}px`;
  els.contextMenu.style.top = `${ev.clientY}px`;
  els.contextMenu.classList.remove("hidden");
}

function openResearchRatingMenu(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reload: false });
  state.cursorTime = point.onset;
  state.context = { ...point };
  draw();
  renderResearchRatingContextMenu();
  setStatus(`Selected ${point.channel || point.montageChannel || "waveform"} at ${formatSec(point.onset)}`);
  els.contextMenu.style.left = `${ev.clientX}px`;
  els.contextMenu.style.top = `${ev.clientY}px`;
  els.contextMenu.classList.remove("hidden");
}

function onWaveClick(ev) {
  if (ev.button !== 0) return;
  if (state.suppressNextClick) {
    state.suppressNextClick = false;
    return;
  }
  if (state.researchMode === "test" && state.researchSession) {
    openResearchRatingMenu(ev);
    return;
  }
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reload: false });
  state.cursorTime = point.onset;
  draw();
}

function onWaveDoubleClick(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reload: false });
  state.dragSelection = null;
  state.suppressNextClick = true;
  hideContextMenu();
  state.cursorTime = point.onset;
  draw();
}

function hideContextMenu() {
  els.contextMenu.classList.add("hidden");
}

function renderWaveContextMenu() {
  els.contextMenu.innerHTML = "";
  hideContextMenu();
}

function canvasToData(ev) {
  const rect = els.waveCanvas.getBoundingClientRect();
  const xCss = ev.clientX - rect.left;
  const yCss = ev.clientY - rect.top;
  const ratio = window.devicePixelRatio || 1;
  const x = xCss * ratio;
  const y = yCss * ratio;
  const { left, right, top, bottom } = plotLayout(els.waveCanvas);
  const plotW = els.waveCanvas.width - left - right;
  const plotH = els.waveCanvas.height - top - bottom;
  const duration = visibleDuration();
  let activeMontage = activeMontageValue();
  let traces = displayTraces(state.windowData?.traces || []);
  let columnLeft = left;
  let columnW = plotW;
  if (isMultiWindowData()) {
    const layouts = multiMontageColumnLayouts(left, top, plotW, plotH, ratio);
    let layoutIndex = layouts.findIndex((layout) => x >= layout.left && x <= layout.left + layout.plotW);
    if (layoutIndex < 0) {
      layoutIndex = x < layouts[0].left ? 0 : layouts.length - 1;
    }
    const layout = layouts[layoutIndex];
    const view = state.windowData.montageViews[layoutIndex] || state.windowData.montageViews[0];
    activeMontage = view?.montage || activeMontage;
    traces = displayTraces(view?.traces || []);
    columnLeft = layout.left;
    columnW = layout.plotW;
  }
  const rawTime = state.start + Math.min(1, Math.max(0, (x - columnLeft) / Math.max(1, columnW))) * duration;
  const { onset, sampleIndex, sfreq } = snapTimeToSample(rawTime);
  const rowIndex = Math.max(0, Math.min(traces.length - 1, Math.floor((y - top) / (plotH / Math.max(1, traces.length)))));
  const trace = traces[rowIndex] || {};
  return {
    onset,
    sampleIndex,
    sfreq,
    channel: nkLabel(trace.label || ""),
    montageChannel: nkLabel(trace.label || ""),
    montage: activeMontage,
    canvasX: xCss,
    canvasY: yCss,
    rowIndex,
  };
}

function onContextMenuClick(ev) {
  const button = ev.target.closest("button");
  if (!button || !state.context) return;
  const action = button.dataset.action;
  const label = button.dataset.label;
  const rating = button.dataset.rating;
  const decision = button.dataset.decision;
  hideContextMenu();
  if (action === "validation-decision") {
    saveValidationDecision(decision);
    return;
  }
  if (action === "research-rating") {
    saveResearchRating(rating);
    return;
  }
  if (action === "point") {
    setStatus(`${label || "point"}: ${formatSec(state.context.onset)}`);
  }
}

function onRightTestPanelClick(ev) {
  const target = ev.target.closest("[data-action='validation-revisit']");
  if (!target || !els.rightTestPanel?.contains(target)) return;
  ev.preventDefault();
  revisitValidationCase(target.dataset.caseId || "");
}

function labelForMontage() {
  return els.montageSelect.options[els.montageSelect.selectedIndex].text;
}

function displayTraces(traces) {
  const eegTraces = traces.filter((t) => t.role !== "ecg");
  const ecgTraces = traces.filter((t) => t.role === "ecg");
  return [...eegTraces, ...ecgTraces];
}

function visibleDuration() {
  const duration = Number(els.durationSelect?.value || state.windowData?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 10;
}

function recordingDuration() {
  const candidates = [
    state.metadata?.raw?.durationSec,
    state.windowData?.metadata?.raw?.durationSec,
    state.windowData?.recordingDurationSec,
    state.windowData?.totalDurationSec,
    state.windowData?.rawDurationSec,
  ];
  for (const value of candidates) {
    const duration = Number(value);
    if (Number.isFinite(duration) && duration > 0) return duration;
  }
  const times = state.windowData?.times;
  if (Array.isArray(times) && times.length) {
    const last = Number(times[times.length - 1]);
    if (Number.isFinite(last) && last > 0) return Math.max(last, Number(state.start || 0) + last);
  }
  return 0;
}

function clampStart(value, duration = visibleDuration()) {
  const start = Number(value);
  const safeStart = Number.isFinite(start) ? start : 0;
  const total = recordingDuration();
  const visible = Number(duration);
  const safeDuration = Number.isFinite(visible) && visible > 0 ? visible : 10;
  const maxStart = total > 0 ? Math.max(0, total - safeDuration) : Math.max(0, safeStart);
  return Math.max(0, Math.min(safeStart, maxStart));
}

function snapTimeToSample(time) {
  const sfreq = Number(state.windowData?.sfreq || 0);
  if (Number.isFinite(sfreq) && sfreq > 0) {
    const sampleIndex = Math.max(0, Math.round(time * sfreq));
    return { onset: preciseNumber(sampleIndex / sfreq), sampleIndex, sfreq };
  }
  return { onset: preciseNumber(time), sampleIndex: null, sfreq: null };
}

function preciseNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
}

function plotLayout(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const h = canvas.height;
  const compact = h < 560 * ratio;
  if (TEST_ONLY_DISTRIBUTION && isMobileViewport()) {
    return {
      left: 62 * ratio,
      right: 6 * ratio,
      top: 20 * ratio,
      bottom: 6 * ratio,
    };
  }
  return {
    left: 86 * ratio,
    right: 14 * ratio,
    top: (compact ? 24 : 31) * ratio,
    bottom: (compact ? 8 : 17) * ratio,
  };
}

function fitFontPx(rowH, ratio) {
  const maxPx = 12 * ratio;
  const minPx = 7 * ratio;
  return Math.max(minPx, Math.min(maxPx, rowH * 0.42));
}

function fitMultiMontageFontPx(rowH, ratio) {
  const maxPx = 11 * ratio;
  const minPx = 9 * ratio;
  return Math.max(minPx, Math.min(maxPx, rowH * 0.5));
}

function sensitivityValue() {
  const raw = String(els.sensitivitySelect.value || "");
  const value = parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : 10;
}

function tcText() {
  return els.tcSelect.value === "OFF" ? "OFF" : `${els.tcSelect.value}s`;
}

function hfText() {
  return els.hfSelect.value === "OFF" ? "OFF" : `${els.hfSelect.value}Hz`;
}

function nkLabel(label) {
  const text = String(label || "");
  if (text === "E" || text === "X5") return "ECG";
  return text
    .replaceAll("T7", "T3")
    .replaceAll("T8", "T4")
    .replaceAll("P7", "T5")
    .replaceAll("P8", "T6");
}

function traceColor(trace, rowIndex, montage = activeMontageValue()) {
  if (trace.role === "ecg") return "#5f6762";
  if (montage === "circular") {
    if (trace.group === "midline") return "#303030";
    if (trace.group === "left_temporal" || trace.group === "left_parasagittal") return "#1b3298";
    if (trace.group === "right_temporal" || trace.group === "right_parasagittal") return "#b4232d";
  }
  if (montage === "conventional" || montage === "conventional_average") {
    const label = String(trace.label || "");
    if (/(^|-)Fz($|-)|(^|-)Cz($|-)/.test(label)) return "#23734f";
    if (trace.group === "midline") return "#303030";
    if (trace.group === "left_temporal" || trace.group === "left_parasagittal") return "#1b3298";
    if (trace.group === "right_temporal" || trace.group === "right_parasagittal") return "#b4232d";
  }
  if (montage === "transverse") {
    if (trace.group?.startsWith("left_")) return "#344bc2";
    if (trace.group?.startsWith("right_")) return "#bf3f4c";
    return "#68706e";
  }
  if (trace.group === "left_temporal") return "#344bc2";
  if (trace.group === "right_temporal") return "#bf3f4c";
  if (trace.group === "left_parasagittal") return "#344bc2";
  if (trace.group === "right_parasagittal") return "#bf3f4c";
  if (trace.group === "midline") return "#23734f";
  if (montage === "a1a2") {
    if (rowIndex <= 3) return "#7880b8";
    if (rowIndex <= 7) return "#b84f57";
    if (rowIndex <= 11) return "#7880b8";
    if (rowIndex <= 15) return "#b84f57";
    if (rowIndex <= 17) return "#3f4542";
    return "#222";
  }
  if (rowIndex <= 3) return "#7880b8";
  if (rowIndex <= 7) return "#d18bd7";
  if (rowIndex <= 11) return "#8fc895";
  if (rowIndex <= 15) return "#c98286";
  if (rowIndex <= 17) return "#68706e";
  return "#222";
}

function formatSec(sec) {
  const mins = Math.floor(sec / 60);
  const s = sec - mins * 60;
  return `${String(mins).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

function formatHeaderTime(sec) {
  const mins = Math.floor(sec / 60);
  const s = Math.floor(sec - mins * 60);
  return `${mins}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init().catch((err) => {
  console.error(err);
  setStatus(err.message, { error: true });
});
