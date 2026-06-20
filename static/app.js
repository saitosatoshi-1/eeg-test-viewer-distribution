const REQUEST_TOKEN = document.querySelector('meta[name="eeg-viewer-token"]')?.content || "";
const SETTINGS_KEY = "eegViewerSettings.v1";
const RECENT_FILES_KEY = "eegViewerRecentFiles.v1";
const PANEL_WIDTHS_KEY = "eegViewerPanelWidths.v1";
const ANNOTATION_LIST_HEIGHT_KEY = "eegViewerAnnotationListHeight.v1";
const RESEARCH_PROFILE_KEY = "eegViewerResearchProfile.v1";
const PUBLIC_WEB_MODE = !["", "localhost", "127.0.0.1", "::1"].includes(window.location.hostname || "");
const RECENT_FILES_LIMIT = 8;
const ECG_UV_PER_MM = 5;
const ECG_AUTO_TARGET_MM = 4.5;
const ECG_AUTO_MIN_UV_PER_MM = 5;
const ECG_AUTO_MAX_UV_PER_MM = 250;
const MONTAGE_LABELS = {
  longitudinal: "縦双極誘導",
  a1a2: "耳朶参照基準2",
  conventional: "耳朶参照基準1",
  conventional_average: "平均参照基準1",
  average: "平均参照基準2",
  cz: "Cz参照基準",
  transverse: "横双極誘導",
  c3c4: "C3/C4参照基準",
  laplacian: "SD参照基準",
};
const DEFAULT_MULTI_MONTAGES = ["conventional", "conventional_average", "longitudinal", "transverse"];
const RIGHT_PANEL_TABS = ["metadata", "annotations", "test", "answer"];
const SCALOGRAM_PRESETS = {
  spike: { freqStepHz: 1, timeBins: 200 },
  balanced: { freqStepHz: 1, timeBins: 120 },
  overview: { freqStepHz: 2, timeBins: 80 },
};
const ATTENUATION_PRESETS = {
  spike: { baselineSec: 1.5, freqStepHz: 1, timeBins: 200 },
  balanced: { baselineSec: 3, freqStepHz: 1, timeBins: 120 },
  overview: { baselineSec: 3, freqStepHz: 2, timeBins: 80 },
};
const STFT_PRESETS = {
  spike: { windowMs: 75, overlapPct: 90 },
  balanced: { windowMs: 125, overlapPct: 95 },
  rhythm: { windowMs: 500, overlapPct: 90 },
};
const RESEARCH_RATINGS = ["てんかん性異常あり", "てんかん性異常なし", "判断困難"];

const state = {
  recordings: [],
  recordingId: "",
  metadata: null,
  windowData: null,
  viewMode: "single",
  multiMontageCount: 3,
  activeMontage: "conventional",
  annotations: [],
  allAnnotations: [],
  showSourceAnnotations: true,
  workspaceMode: "review",
  rightPanelTab: "metadata",
  recentFiles: [],
  start: 0,
  context: null,
  cursorTime: null,
  rangeStart: null,
  dragSelection: null,
  scalogramSelection: null,
  scalogramRequestId: 0,
  additionalManualAnchor: null,
  scalogramData: null,
  rightPanelVisible: false,
  scalogramVisible: false,
  scalogramMode: "signed",
  scalogramDisplayScope: "all",
  scalogramDetectionMode: "both",
  analysisKind: "scalogram",
  attenuationScaleMode: "db",
  topomapMode: "mean",
  topomapLayout: "system",
  stftScaleMode: "db",
  stftPowerGain: 1,
  attenuationFreqRange: { low: 0, high: 120 },
  attenuationBaselineSec: 3,
  attenuationFreqStepHz: 1,
  attenuationTimeBins: 120,
  psdFreqRange: { low: 0, high: 120 },
  stftFreqRange: { low: 0, high: 120 },
  scalogramFreqStepHz: 1,
  scalogramTimeBins: 120,
  stftWindowMs: 125,
  stftOverlapPct: 95,
  fzPeakWindowMs: 10,
  preciseTopomap: null,
  topomapSelection: null,
  fzSpikeTopomap: null,
  fzAfterSlowTopomap: null,
  fzSpikeTopomapRequestId: 0,
  topomapRequestId: 0,
  windowLoadInFlight: false,
  windowLoadPending: false,
  windowLoadPromise: null,
  selectedScalogramIndex: 0,
  suppressNextClick: false,
  lastWaveWheelPageAt: 0,
  lastMontageSelectValue: "",
  lastDurationSelectValue: "",
  lastFilterControlKey: "",
  controlWatchTimer: null,
  durationRefreshTimer: null,
  durationSelectFocusedAt: 0,
  panelResizeDrag: null,
  annotationResizeDrag: null,
  researchMode: "test",
  researchDataset: null,
  researchDatasetPath: "",
  researchSession: null,
  researchResponses: [],
  researchCaseIndex: 0,
  researchCaseStartedAt: "",
  researchMontageTiming: null,
  researchTutorialDismissed: false,
  researchSampleCompletedPhases: {},
  validationSession: null,
  validationResponses: [],
  validationCaseStartedAt: "",
  validationSaving: false,
  lastValidationResponse: null,
  lastResearchResponse: null,
  lastResearchResponseCaseIndex: -1,
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
  ecgFilterToggle: document.getElementById("ecgFilterToggle"),
  filePathInput: document.getElementById("filePathInput"),
  clearFilePathBtn: document.getElementById("clearFilePathBtn"),
  loadFileBtn: document.getElementById("loadFileBtn"),
  recentFileSelect: document.getElementById("recentFileSelect"),
  statusReadout: document.getElementById("statusReadout"),
  metadataPanel: document.getElementById("metadataPanel"),
  warningPanel: document.getElementById("warningPanel"),
  resultWarningPanel: document.getElementById("resultWarningPanel"),
  rightTestPanel: document.getElementById("rightTestPanel"),
  rightAnswerPanel: document.getElementById("rightAnswerPanel"),
  waveCanvas: document.getElementById("waveCanvas"),
  waveScrollbar: document.getElementById("waveScrollbar"),
  eventStrip: document.getElementById("eventStrip"),
  eventControls: document.getElementById("eventControls"),
  annotationList: document.getElementById("annotationList"),
  annotationListResize: document.getElementById("annotationListResize"),
  sourceAnnotationToggle: document.getElementById("sourceAnnotationToggle"),
  rightPanelToggleBtn: document.getElementById("rightPanelToggleBtn"),
  scalogramReadout: document.getElementById("scalogramReadout"),
  scalogramDetailTitle: document.getElementById("scalogramDetailTitle"),
  scalogramDetailCanvas: document.getElementById("scalogramDetailCanvas"),
  scalogramList: document.getElementById("scalogramList"),
  scalogramModeButtons: Array.from(document.querySelectorAll("[data-scalogram-mode]")),
  scalogramScopeButtons: Array.from(document.querySelectorAll("[data-scalogram-scope]")),
  scalogramDetectionButtons: Array.from(document.querySelectorAll("[data-scalogram-detection]")),
  analysisKindButtons: Array.from(document.querySelectorAll("[data-analysis-kind]")),
  attenuationScaleButtons: Array.from(document.querySelectorAll("[data-attenuation-scale]")),
  attenuationPresetButtons: Array.from(document.querySelectorAll("[data-attenuation-preset]")),
  stftScaleButtons: Array.from(document.querySelectorAll("[data-stft-scale]")),
  scalogramPresetButtons: Array.from(document.querySelectorAll("[data-scalogram-preset]")),
  stftPresetButtons: Array.from(document.querySelectorAll("[data-stft-preset]")),
  topomapStack: document.querySelector(".topomap-stack"),
  attenuationFreqLowInput: document.getElementById("attenuationFreqLowInput"),
  attenuationFreqHighInput: document.getElementById("attenuationFreqHighInput"),
  attenuationBaselineSecInput: document.getElementById("attenuationBaselineSecInput"),
  attenuationBaselineSecValue: document.getElementById("attenuationBaselineSecValue"),
  attenuationFreqStepInput: document.getElementById("attenuationFreqStepInput"),
  attenuationFreqStepValue: document.getElementById("attenuationFreqStepValue"),
  attenuationTimeBinsInput: document.getElementById("attenuationTimeBinsInput"),
  attenuationTimeBinsValue: document.getElementById("attenuationTimeBinsValue"),
  psdFreqLowInput: document.getElementById("psdFreqLowInput"),
  psdFreqHighInput: document.getElementById("psdFreqHighInput"),
  stftFreqLowInput: document.getElementById("stftFreqLowInput"),
  stftFreqHighInput: document.getElementById("stftFreqHighInput"),
  stftPowerGainInput: document.getElementById("stftPowerGainInput"),
  stftPowerGainValue: document.getElementById("stftPowerGainValue"),
  scalogramFreqStepInput: document.getElementById("scalogramFreqStepInput"),
  scalogramFreqStepValue: document.getElementById("scalogramFreqStepValue"),
  scalogramTimeBinsInput: document.getElementById("scalogramTimeBinsInput"),
  scalogramTimeBinsValue: document.getElementById("scalogramTimeBinsValue"),
  stftWindowMsInput: document.getElementById("stftWindowMsInput"),
  stftWindowMsValue: document.getElementById("stftWindowMsValue"),
  stftOverlapPctInput: document.getElementById("stftOverlapPctInput"),
  stftOverlapPctValue: document.getElementById("stftOverlapPctValue"),
  fzPeakWindowMsInput: document.getElementById("fzPeakWindowMsInput"),
  fzPeakWindowMsValue: document.getElementById("fzPeakWindowMsValue"),
  scalogramModeControls: Array.from(document.querySelectorAll(".scalogram-mode-controls")),
  exportAnalysisJsonBtn: document.getElementById("exportAnalysisJsonBtn"),
  exportScalogramJpegBtn: document.getElementById("exportScalogramJpegBtn"),
  fzSpikeTopomapTitle: document.getElementById("fzSpikeTopomapTitle"),
  fzSpikeTopomapCanvas: document.getElementById("fzSpikeTopomapCanvas"),
  fzSpikeTopomapReadout: document.getElementById("fzSpikeTopomapReadout"),
  fzSpikeFtliReadout: document.getElementById("fzSpikeFtliReadout"),
  fzAfterSlowTopomapTitle: document.getElementById("fzAfterSlowTopomapTitle"),
  fzAfterSlowTopomapCanvas: document.getElementById("fzAfterSlowTopomapCanvas"),
  fzAfterSlowTopomapReadout: document.getElementById("fzAfterSlowTopomapReadout"),
  fzAfterSlowFtliReadout: document.getElementById("fzAfterSlowFtliReadout"),
  systemTopomapCanvas: document.getElementById("systemTopomapCanvas"),
  topomapReadout: document.getElementById("topomapReadout"),
  earlobeTopomapTitle: document.getElementById("earlobeTopomapTitle"),
  exportTopomapJsonBtn: document.getElementById("exportTopomapJsonBtn"),
  exportTopomapJpegBtn: document.getElementById("exportTopomapJpegBtn"),
  contextMenu: document.getElementById("contextMenu"),
  annotationDialog: document.getElementById("annotationDialog"),
  annotationLabel: document.getElementById("annotationLabel"),
  annotationNote: document.getElementById("annotationNote"),
  dialogTitle: document.getElementById("dialogTitle"),
  saveAnnotationBtn: document.getElementById("saveAnnotationBtn"),
  timeReadout: document.getElementById("timeReadout"),
  calReadout: document.getElementById("calReadout"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  stepBackBtn: document.getElementById("stepBackBtn"),
  stepForwardBtn: document.getElementById("stepForwardBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  rangeCancelBtn: document.getElementById("rangeCancelBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  importJsonInput: document.getElementById("importJsonInput"),
  exportViewerJpegBtn: document.getElementById("exportViewerJpegBtn"),
  workspace: document.querySelector(".workspace"),
  panelResizeHandles: Array.from(document.querySelectorAll("[data-resize-panel]")),
  researchModeButtons: Array.from(document.querySelectorAll("[data-research-mode]")),
  researchDatasetPathInput: document.getElementById("researchDatasetPathInput"),
  researchClearDatasetPathBtn: document.getElementById("researchClearDatasetPathBtn"),
  researchIedsPresentPathInput: document.getElementById("researchIedsPresentPathInput"),
  researchClearIedsPresentPathBtn: document.getElementById("researchClearIedsPresentPathBtn"),
  researchIedsAbsentPathInput: document.getElementById("researchIedsAbsentPathInput"),
  researchClearIedsAbsentPathBtn: document.getElementById("researchClearIedsAbsentPathBtn"),
  researchSetupScreen: document.getElementById("researchSetupScreen"),
  researchSetupMessage: document.getElementById("researchSetupMessage"),
  researchSetupDatasetPathInput: document.getElementById("researchSetupDatasetPathInput"),
  researchCompleteScreen: document.getElementById("researchCompleteScreen"),
  researchCompleteTitle: document.getElementById("researchCompleteTitle"),
  researchCompleteMessage: document.getElementById("researchCompleteMessage"),
  researchMailBox: document.getElementById("researchMailBox"),
  researchEmailBody: document.getElementById("researchEmailBody"),
  researchSavedCsvName: document.getElementById("researchSavedCsvName"),
  researchCopyEmailBtn: document.getElementById("researchCopyEmailBtn"),
  researchTutorial: document.getElementById("researchTutorial"),
  researchTutorialDismissBtn: document.getElementById("researchTutorialDismissBtn"),
  researchCompleteExportCsvBtn: document.getElementById("researchCompleteExportCsvBtn"),
  researchCompleteSaveDesktopBtn: document.getElementById("researchCompleteSaveDesktopBtn"),
  researchSetupIedsPresentPathInput: document.getElementById("researchSetupIedsPresentPathInput"),
  researchSetupIedsAbsentPathInput: document.getElementById("researchSetupIedsAbsentPathInput"),
  researchSetupReaderIdInput: document.getElementById("researchSetupReaderIdInput"),
  researchSetupReaderNameInput: document.getElementById("researchSetupReaderNameInput"),
  researchSetupReaderEmailInput: document.getElementById("researchSetupReaderEmailInput"),
  researchSetupReaderAffiliationInput: document.getElementById("researchSetupReaderAffiliationInput"),
  researchSetupReaderSpecialtySelect: document.getElementById("researchSetupReaderSpecialtySelect"),
  researchPositionSelect: document.getElementById("researchPositionSelect"),
  researchEpilepsySpecialistSelect: document.getElementById("researchEpilepsySpecialistSelect"),
  researchClinicalNeurophysEegSpecialistSelect: document.getElementById("researchClinicalNeurophysEegSpecialistSelect"),
  researchEpilepsyCenterTrainingSelect: document.getElementById("researchEpilepsyCenterTrainingSelect"),
  researchEpilepsyCenterTrainingDurationInput: document.getElementById("researchEpilepsyCenterTrainingDurationInput"),
  researchSetupMontageSelect: document.getElementById("researchSetupMontageSelect"),
  researchSetupEpochCountInput: document.getElementById("researchSetupEpochCountInput"),
  researchSetupStartBtn: document.getElementById("researchSetupStartBtn"),
  researchSetupResetProfileBtn: document.getElementById("researchSetupResetProfileBtn"),
  researchCreateDatasetBtn: document.getElementById("researchCreateDatasetBtn"),
  researchLoadDatasetBtn: document.getElementById("researchLoadDatasetBtn"),
  researchCutEpochBtn: document.getElementById("researchCutEpochBtn"),
  researchStartValidationBtn: document.getElementById("researchStartValidationBtn"),
  researchEpochCountInput: document.getElementById("researchEpochCountInput"),
  researchReaderIdInput: document.getElementById("researchReaderIdInput"),
  researchPhaseSelect: document.getElementById("researchPhaseSelect"),
  researchStartTestBtn: document.getElementById("researchStartTestBtn"),
  researchToast: document.getElementById("researchToast"),
  researchToastText: document.getElementById("researchToastText"),
  researchUndoBtn: document.getElementById("researchUndoBtn"),
  researchOutputPathInput: document.getElementById("researchOutputPathInput"),
  researchDoctorNameInput: document.getElementById("researchDoctorNameInput"),
  researchMedicalYearsInput: document.getElementById("researchMedicalYearsInput"),
  researchNeurologyYearsInput: document.getElementById("researchNeurologyYearsInput"),
  researchEegTrainingSelect: document.getElementById("researchEegTrainingSelect"),
  researchMonthlyReadsInput: document.getElementById("researchMonthlyReadsInput"),
  researchTestProgress: document.getElementById("researchTestProgress"),
  researchWaveProgress: document.getElementById("researchWaveProgress"),
  researchInlineProgress: document.getElementById("researchInlineProgress"),
  validationInlineProgress: document.getElementById("validationInlineProgress"),
  researchDesignEpochCountInput: document.getElementById("researchDesignEpochCountInput"),
  researchPhase2SampleToggle: document.getElementById("researchPhase2SampleToggle"),
  researchFalsePositiveToggle: document.getElementById("researchFalsePositiveToggle"),
  researchSaveDesignBtn: document.getElementById("researchSaveDesignBtn"),
  researchPanel: document.getElementById("researchPanel"),
  researchCaseEditor: document.getElementById("researchCaseEditor"),
  researchIncludeInput: document.getElementById("researchIncludeInput"),
  researchExcludeReasonInput: document.getElementById("researchExcludeReasonInput"),
  researchQualityNotesInput: document.getElementById("researchQualityNotesInput"),
  researchSaveCaseBtn: document.getElementById("researchSaveCaseBtn"),
  researchPrevCaseBtn: document.getElementById("researchPrevCaseBtn"),
  researchNextCaseBtn: document.getElementById("researchNextCaseBtn"),
};

function qs(params) {
  return new URLSearchParams(params).toString();
}

async function fetchJson(url, options = {}) {
  const init = { ...options };
  const headers = new Headers(init.headers || {});
  if (REQUEST_TOKEN) headers.set("X-EEG-Viewer-Token", REQUEST_TOKEN);
  init.headers = headers;
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || res.statusText);
  return data;
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

function setOpenFileBusy(isBusy) {
  if (els.loadFileBtn) {
    els.loadFileBtn.disabled = isBusy;
    els.loadFileBtn.textContent = isBusy ? "Opening..." : "Open";
  }
  if (els.reloadBtn) els.reloadBtn.disabled = isBusy;
  if (els.filePathInput) els.filePathInput.disabled = isBusy;
  if (els.recentFileSelect) els.recentFileSelect.disabled = isBusy;
}

function clearSharedBrowserResearchState() {
  if (!PUBLIC_WEB_MODE) return;
  try {
    localStorage.removeItem(RESEARCH_PROFILE_KEY);
    localStorage.removeItem(RECENT_FILES_KEY);
  } catch {
    // Ignore storage failures.
  }
}

async function init() {
  clearSharedBrowserResearchState();
  bindControls();
  bindPanelResizers();
  try {
    restorePanelWidths();
    restoreAnnotationListHeight();
  } catch (err) {
    console.warn("Panel restore skipped", err);
  }
  try {
    scheduleLayoutRefresh();
  } catch (err) {
    console.warn("Initial layout skipped", err);
  }
  window.addEventListener("resize", scheduleLayoutRefresh);
  if (window.ResizeObserver && els.waveCanvas?.parentElement) {
    const observer = new ResizeObserver(scheduleLayoutRefresh);
    observer.observe(els.waveCanvas.parentElement);
  }
  try {
    restoreSettings();
    applyWorkspaceMode({ redraw: false });
    applyRightPanelTab();
    applyRightPanelVisibility({ redraw: false });
    applyScalogramVisibility({ redraw: false });
    applyTopomapLayout();
  } catch (err) {
    console.warn("Settings restore skipped", err);
  }
  try {
    restoreRecentFiles();
    restoreResearchProfile();
    applyLaunchParams();
  } catch (err) {
    console.warn("Profile/recent restore skipped", err);
  }
  if (els.recordingLabel) els.recordingLabel.hidden = true;
  state.rightPanelVisible = false;
  applyRightPanelVisibility({ redraw: false });
  setResearchMode("test");
  rememberControlValues();
  startControlValueWatcher();
  await loadRecordings();
}

function applyLaunchParams() {
  const params = new URLSearchParams(window.location.search || "");
  const dataset = params.get("dataset") || params.get("datasetUrl") || "";
  if (dataset && els.researchSetupDatasetPathInput) {
    els.researchSetupDatasetPathInput.value = dataset;
  }
  const questions = params.get("questions") || params.get("count") || "";
  if (questions && els.researchSetupEpochCountInput) {
    els.researchSetupEpochCountInput.value = questions;
  }
}

function scheduleLayoutRefresh() {
  const refresh = () => {
    resizeCanvas();
    draw();
  };
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
    els.acSelect?.value || "",
    els.ecgToggle?.checked ? "1" : "0",
    els.ecgFilterToggle?.checked ? "1" : "0",
  ].join("|");
}

async function handleMontageControlChange(source = "change") {
  if (!els.montageSelect) return;
  state.lastMontageSelectValue = els.montageSelect.value || "";
  state.activeMontage = state.lastMontageSelectValue || state.activeMontage;
  state.windowData = null;
  updateResearchMontageTiming();
  renderStatus();
  setStatus(`Loading montage ${state.activeMontage} / ${labelForMontage()}...`, { busy: true, progress: 70 });
  await loadWindow();
  forceViewerRepaint();
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
  state.windowData = null;
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

function resizeTopomapCanvases() {
  [els.systemTopomapCanvas, els.earlobeReferenceTopomapCanvas, els.averageTopomapCanvas, els.earlobeExtraTopomapCanvas, els.czTopomapCanvas, els.fzSpikeTopomapCanvas, els.fzAfterSlowTopomapCanvas].forEach((canvas) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(220, Math.floor(rect.width * ratio));
    canvas.height = Math.max(150, Math.floor(rect.height * ratio));
  });
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
    els.ecgFilterToggle,
  ].filter(Boolean).forEach((el) => el.addEventListener("change", onControlChange));
  [
    els.montageSelect,
    els.durationSelect,
    els.tcSelect,
    els.hfSelect,
    els.acSelect,
    els.ecgToggle,
    els.ecgFilterToggle,
  ].filter(Boolean).forEach((el) => {
    const check = () => window.setTimeout(() => checkDeferredControlValues("deferred"), 0);
    el.addEventListener("blur", check);
    el.addEventListener("click", check);
    el.addEventListener("input", check);
    el.addEventListener("keyup", check);
    el.addEventListener("mouseup", check);
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
  els.loadFileBtn?.addEventListener("click", openFileFromPath);
  if (els.clearFilePathBtn) {
    els.clearFilePathBtn.addEventListener("click", () => {
      els.filePathInput.value = "";
      els.filePathInput.focus();
    });
  }
  els.recentFileSelect?.addEventListener("change", () => {
    const path = els.recentFileSelect.value;
    if (!path) return;
    els.filePathInput.value = path;
    openFileFromPath();
  });
  els.filePathInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      openFileFromPath();
    }
  });
  for (const btn of els.viewModeButtons || []) {
    btn.addEventListener("click", () => setViewMode(btn.dataset.viewMode || "single", btn.dataset.montageCount));
  }
  for (const btn of els.workspaceModeButtons || []) {
    btn.addEventListener("click", () => setWorkspaceMode(btn.dataset.workspaceMode || "review"));
  }
  for (const btn of els.rightTabButtons || []) {
    btn.addEventListener("click", () => setRightPanelTab(btn.dataset.rightTab || "topomap"));
  }
  for (const select of els.multiMontageSelects || []) {
    select.addEventListener("change", onMultiMontageSelectChange);
  }
  els.rangeCancelBtn?.addEventListener("click", () => {
    state.rangeStart = null;
    state.dragSelection = null;
    state.scalogramSelection = null;
    state.scalogramData = null;
    els.rangeCancelBtn.disabled = true;
    hideContextMenu();
    draw();
  });

  els.waveCanvas?.addEventListener("contextmenu", openContextMenu);
  els.waveCanvas?.addEventListener("mousedown", onWaveMouseDown);
  els.waveCanvas?.addEventListener("mousemove", onWaveMouseMove);
  els.waveCanvas?.addEventListener("mouseup", onWaveMouseUp);
  window.addEventListener("mouseup", onWaveMouseUp);
  els.waveCanvas?.addEventListener("mouseleave", onWaveMouseLeave);
  els.waveCanvas?.addEventListener("wheel", onWaveWheel, { passive: false });
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
  els.contextMenu?.addEventListener("click", onContextMenuClick);

  els.saveAnnotationBtn?.addEventListener("click", (ev) => {
    ev.preventDefault();
    saveDialogAnnotation();
  });
  els.annotationDialog?.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.isComposing) return;
    if (ev.target === els.annotationNote && ev.shiftKey) return;
    if (ev.target instanceof HTMLButtonElement) return;
    ev.preventDefault();
    saveDialogAnnotation();
  });

  els.exportJsonBtn?.addEventListener("click", exportJson);
  if (els.sourceAnnotationToggle) {
    els.sourceAnnotationToggle.addEventListener("change", () => {
      state.showSourceAnnotations = els.sourceAnnotationToggle.checked;
      saveSettings();
      applyAnnotationVisibility();
    });
  }
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.addEventListener("click", exportAnalysisJson);
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.addEventListener("click", exportScalogramJpeg);
  if (els.rightPanelToggleBtn) {
    els.rightPanelToggleBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleRightPanel();
    });
  }
  if (els.exportViewerJpegBtn) els.exportViewerJpegBtn.addEventListener("click", exportViewerJpeg);
  els.importJsonInput?.addEventListener("change", importJson);
  bindResearchControls();
}


function bindResearchControls() {
  for (const btn of els.researchModeButtons || []) {
    btn.addEventListener("click", () => setResearchMode(btn.dataset.researchMode || "viewer"));
  }
  els.researchCreateDatasetBtn?.addEventListener("click", createResearchDataset);
  els.researchLoadDatasetBtn?.addEventListener("click", loadResearchDatasetFromInput);
  els.researchCutEpochBtn?.addEventListener("click", cutCurrentResearchEpoch);
  els.researchStartValidationBtn?.addEventListener("click", startValidationMode);
  els.researchStartTestBtn?.addEventListener("click", startResearchTest);
  els.researchSetupStartBtn?.addEventListener("click", startResearchTest);
  els.researchSetupResetProfileBtn?.addEventListener("click", resetResearchProfileForm);
  els.researchClearDatasetPathBtn?.addEventListener("click", () => clearResearchPath("dataset"));
  els.researchClearIedsPresentPathBtn?.addEventListener("click", () => clearResearchPath("iedsPresent"));
  els.researchClearIedsAbsentPathBtn?.addEventListener("click", () => clearResearchPath("iedsAbsent"));
  els.researchEpochCountInput?.addEventListener("change", saveResearchEpochCount);
  els.researchCompleteExportCsvBtn?.addEventListener("click", submitResearchJson);
  els.researchCompleteSaveDesktopBtn?.addEventListener("click", exportResearchJson);
  els.researchCopyEmailBtn?.addEventListener("click", copyResearchEmailBody);
  els.researchTutorialDismissBtn?.addEventListener("click", () => {
    state.researchTutorialDismissed = true;
    updateResearchTutorial();
  });
  els.researchUndoBtn?.addEventListener("click", undoLastResearchAction);
  els.researchSaveCaseBtn?.addEventListener("click", saveResearchCaseEdits);
  els.researchPrevCaseBtn?.addEventListener("click", () => moveResearchCase(-1));
  els.researchNextCaseBtn?.addEventListener("click", () => moveResearchCase(1));
  els.researchSaveDesignBtn?.addEventListener("click", saveResearchTestDesign);
  els.researchDesignEpochCountInput?.addEventListener("change", () => {
    if (els.researchEpochCountInput) els.researchEpochCountInput.value = els.researchDesignEpochCountInput.value;
    saveResearchTestDesign();
  });
  els.researchPhase2SampleToggle?.addEventListener("change", saveResearchTestDesign);
  els.researchFalsePositiveToggle?.addEventListener("change", saveResearchTestDesign);
  [
    els.researchOutputPathInput,
    els.researchDoctorNameInput,
    els.researchMedicalYearsInput,
    els.researchNeurologyYearsInput,
    els.researchEegTrainingSelect,
    els.researchMonthlyReadsInput,
    els.researchSetupReaderIdInput,
    els.researchSetupReaderNameInput,
    els.researchSetupReaderEmailInput,
    els.researchSetupReaderAffiliationInput,
    els.researchSetupReaderSpecialtySelect,
    els.researchPositionSelect,
    els.researchEpilepsySpecialistSelect,
    els.researchClinicalNeurophysEegSpecialistSelect,
    els.researchEpilepsyCenterTrainingSelect,
    els.researchEpilepsyCenterTrainingDurationInput,
    els.researchSetupEpochCountInput,
  ].filter(Boolean).forEach((el) => el.addEventListener("change", () => {
    updateEpilepsyCenterDurationRequirement();
    saveResearchProfile();
  }));
  bindSyncedInputs(els.researchIedsPresentPathInput, els.researchSetupIedsPresentPathInput);
  bindSyncedInputs(els.researchIedsAbsentPathInput, els.researchSetupIedsAbsentPathInput);
  bindSyncedInputs(els.researchReaderIdInput, els.researchSetupReaderIdInput);
  bindSyncedInputs(els.researchEpochCountInput, els.researchSetupEpochCountInput);
  updateEpilepsyCenterDurationRequirement();
}

function bindSyncedInputs(a, b) {
  if (!a || !b) return;
  const sync = (source, target) => {
    if (target.value !== source.value) target.value = source.value;
  };
  a.addEventListener("input", () => sync(a, b));
  b.addEventListener("input", () => sync(b, a));
  a.addEventListener("change", () => sync(a, b));
  b.addEventListener("change", () => sync(b, a));
}

function clearResearchPath(kind) {
  if (kind === "dataset") {
    if (els.researchDatasetPathInput) els.researchDatasetPathInput.value = "";
    state.researchDatasetPath = "";
    state.researchDataset = null;
    state.researchSession = null;
    state.validationSession = null;
    state.researchResponses = [];
    state.validationResponses = [];
    state.researchCaseIndex = 0;
    hideResearchTutorial();
    hideResearchCompletion();
    hideResearchWaveProgress();
    hideValidationWaveProgress();
    renderResearchPanel();
    updateResearchSetupScreen();
    setStatus("Dataset path cleared");
    els.researchDatasetPathInput?.focus();
    return;
  }
  const target = kind === "iedsPresent" ? els.researchIedsPresentPathInput : els.researchIedsAbsentPathInput;
  if (!target) return;
  target.value = "";
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  setStatus(kind === "iedsPresent" ? "IEDs-present path cleared" : "IEDs-absent path cleared");
  target.focus();
}

function resetResearchProfileForm() {
  const textInputs = [
    els.researchSetupReaderIdInput,
    els.researchSetupReaderNameInput,
    els.researchSetupReaderEmailInput,
    els.researchSetupReaderAffiliationInput,
    els.researchDoctorNameInput,
    els.researchMedicalYearsInput,
    els.researchNeurologyYearsInput,
    els.researchMonthlyReadsInput,
    els.researchEpilepsyCenterTrainingDurationInput,
  ];
  for (const input of textInputs.filter(Boolean)) input.value = "";
  for (const select of [
    els.researchSetupReaderSpecialtySelect,
    els.researchPositionSelect,
    els.researchEpilepsySpecialistSelect,
    els.researchClinicalNeurophysEegSpecialistSelect,
    els.researchEpilepsyCenterTrainingSelect,
    els.researchEegTrainingSelect,
  ].filter(Boolean)) select.value = "";
  const usualMontage = storedResearchProfile().usualMontage || activeMontageValue();
  try {
    localStorage.setItem(RESEARCH_PROFILE_KEY, JSON.stringify({ usualMontage }));
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
  els.researchEpilepsyCenterTrainingDurationInput.placeholder = hasTraining ? "例: 6か月、2年" : "専従歴なしの場合は不要";
}

function validateResearchProfileForStart() {
  updateEpilepsyCenterDurationRequirement();
  const requiredFields = [
    [els.researchSetupReaderNameInput, "回答者名"],
    [els.researchSetupReaderEmailInput, "メール"],
    [els.researchSetupReaderAffiliationInput, "所属"],
    [els.researchPositionSelect, "職位"],
    [els.researchSetupReaderSpecialtySelect, "診療科"],
    [els.researchMedicalYearsInput, "専門科目診療年数"],
    [els.researchEpilepsySpecialistSelect, "てんかん専門医"],
    [els.researchClinicalNeurophysEegSpecialistSelect, "臨床神経生理 EEG専門医"],
    [els.researchMonthlyReadsInput, "月間EEG読影数"],
    [els.researchEpilepsyCenterTrainingSelect, "てんかんセンター専従歴"],
    [els.researchSetupEpochCountInput, "テスト問題数"],
  ];
  if (els.researchEpilepsyCenterTrainingSelect?.value === "yes") {
    requiredFields.splice(requiredFields.length - 1, 0, [els.researchEpilepsyCenterTrainingDurationInput, "専従期間"]);
  }
  const missing = requiredFields.filter(([el]) => !String(el?.value ?? "").trim());
  const email = String(els.researchSetupReaderEmailInput?.value || "").trim();
  const invalidEmail = email && els.researchSetupReaderEmailInput?.validity?.valid === false;
  if (!missing.length && !invalidEmail) return true;
  const labels = missing.map(([, label]) => label);
  if (invalidEmail) labels.push("メール形式");
  const message = `未入力または確認が必要な項目があります: ${labels.join("、")}`;
  setResearchSetupMessage(message, true);
  setStatus(message, { error: true });
  window.alert(message);
  const first = missing[0]?.[0] || (invalidEmail ? els.researchSetupReaderEmailInput : null);
  first?.focus?.();
  return false;
}

function researchProfile() {
  const storedProfile = storedResearchProfile();
  return {
    datasetPath: els.researchSetupDatasetPathInput?.value.trim() || els.researchDatasetPathInput?.value.trim() || state.researchDatasetPath || "",
    outputPath: els.researchOutputPathInput?.value.trim() || "",
    readerId: els.researchSetupReaderIdInput?.value.trim() || "",
    readerName: els.researchSetupReaderNameInput?.value.trim() || els.researchDoctorNameInput?.value.trim() || "",
    email: els.researchSetupReaderEmailInput?.value.trim() || "",
    affiliation: els.researchSetupReaderAffiliationInput?.value.trim() || "",
    specialty: els.researchSetupReaderSpecialtySelect?.value || "",
    position: els.researchPositionSelect?.value || "",
    epilepsySpecialist: els.researchEpilepsySpecialistSelect?.value || "",
    clinicalNeurophysEegSpecialist: els.researchClinicalNeurophysEegSpecialistSelect?.value || "",
    usualMontage: els.researchSetupMontageSelect?.value || storedProfile.usualMontage || activeMontageValue(),
    doctorName: els.researchSetupReaderNameInput?.value.trim() || els.researchDoctorNameInput?.value.trim() || "",
    medicalPracticeYears: els.researchMedicalYearsInput?.value === "" ? "" : Number(els.researchMedicalYearsInput?.value || 0),
    neurologyYears: els.researchNeurologyYearsInput?.value === "" ? "" : Number(els.researchNeurologyYearsInput?.value || 0),
    eegTraining: els.researchEegTrainingSelect?.value || "",
    eegReadsPerMonth: els.researchMonthlyReadsInput?.value === "" ? "" : Number(els.researchMonthlyReadsInput?.value || 0),
    epilepsyCenterTraining: els.researchEpilepsyCenterTrainingSelect?.value || "",
    epilepsyCenterTrainingDuration: els.researchEpilepsyCenterTrainingDurationInput?.value.trim() || "",
  };
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
    profile.doctorName ||
    "reader"
  );
}

function researchJsonFilename(readerId, profile = researchProfile()) {
  const readerName = safeResultFilenamePart(profile.readerName || profile.doctorName || readerId, "reader");
  return `${readerName}.json`;
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
  if (!PUBLIC_WEB_MODE) {
    try {
      const profile = { ...storedResearchProfile(), ...researchProfile(), usualMontage: value };
      localStorage.setItem(RESEARCH_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore private-mode storage failures.
    }
  }
  if (els.researchSetupMontageSelect) els.researchSetupMontageSelect.value = value;
  return value;
}

function restoreResearchProfile() {
  const profile = storedResearchProfile();
  if (els.researchOutputPathInput) els.researchOutputPathInput.value = profile.outputPath || "";
  if (els.researchSetupDatasetPathInput) els.researchSetupDatasetPathInput.value = profile.datasetPath || "";
  if (els.researchDoctorNameInput) els.researchDoctorNameInput.value = profile.doctorName || "";
  if (els.researchSetupReaderIdInput) els.researchSetupReaderIdInput.value = profile.readerId || "";
  if (els.researchSetupReaderNameInput) els.researchSetupReaderNameInput.value = profile.readerName || profile.doctorName || "";
  if (els.researchSetupReaderEmailInput) els.researchSetupReaderEmailInput.value = profile.email || "";
  if (els.researchSetupReaderAffiliationInput) els.researchSetupReaderAffiliationInput.value = profile.affiliation || "";
  if (els.researchSetupReaderSpecialtySelect) els.researchSetupReaderSpecialtySelect.value = profile.specialty || "";
  if (els.researchPositionSelect) els.researchPositionSelect.value = profile.position || "";
  if (els.researchEpilepsySpecialistSelect) els.researchEpilepsySpecialistSelect.value = profile.epilepsySpecialist || "";
  if (els.researchClinicalNeurophysEegSpecialistSelect) els.researchClinicalNeurophysEegSpecialistSelect.value = profile.clinicalNeurophysEegSpecialist || "";
  if (els.researchSetupMontageSelect) els.researchSetupMontageSelect.value = profile.usualMontage || activeMontageValue();
  if (els.researchMedicalYearsInput) els.researchMedicalYearsInput.value = profile.medicalPracticeYears ?? "";
  if (els.researchNeurologyYearsInput) els.researchNeurologyYearsInput.value = profile.neurologyYears ?? "";
  if (els.researchEegTrainingSelect) els.researchEegTrainingSelect.value = profile.eegTraining || "";
  if (els.researchMonthlyReadsInput) els.researchMonthlyReadsInput.value = profile.eegReadsPerMonth ?? "";
  if (els.researchEpilepsyCenterTrainingSelect) els.researchEpilepsyCenterTrainingSelect.value = profile.epilepsyCenterTraining || "";
  if (els.researchEpilepsyCenterTrainingDurationInput) els.researchEpilepsyCenterTrainingDurationInput.value = profile.epilepsyCenterTrainingDuration || "";
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
  for (const [montage, seconds] of Object.entries(timing?.totalsSec || {})) {
    totals[montage] = Number(Number(seconds || 0).toFixed(3));
  }
  const summary = Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([montage, seconds]) => `${montage}:${seconds}`)
    .join(";");
  const timeline = (timing?.timeline || []).filter((row) => Number(row.durationSec || 0) > 0);
  const switches = timing?.switches || [];
  const montageUsage = timeline.map((row, index) => ({
    order: index + 1,
    montage: String(row.montage || "").trim(),
    startSec: Number(Number(row.startSec || 0).toFixed(3)),
    endSec: Number(Number(row.endSec || 0).toFixed(3)),
    durationSec: Number(Number(row.durationSec || 0).toFixed(3)),
  })).filter((row) => row.montage);
  const montageSequence = switches
    .map((row, index) => ({
      index: Number(row.index || index + 1),
      montage: String(row.to || "").trim(),
      atSec: Number(Number(row.atSec || 0).toFixed(3)),
    }))
    .filter((row) => row.montage);
  const montageOrder = montageSequence.map((row) => row.montage);
  return {
    displayedMontages: Object.keys(totals),
    montageDurationsSec: totals,
    montageDurationSummary: summary,
    montageOrder,
    montageSequence,
    montageUsage,
    montageTimeline: timeline,
    montageSwitches: switches,
    montageOrderSummary: montageSequence.map((row) => `${row.index}:${row.montage}@${row.atSec}s`).join(";"),
    montageUsageSummary: montageUsage.map((row) => `${row.order}:${row.montage}:${row.startSec}-${row.endSec}s(${row.durationSec}s)`).join(";"),
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
  const datasetMode = state.researchMode === "dataset";
  const validationMode = state.researchMode === "validation";
  for (const section of document.querySelectorAll("[data-research-section]")) {
    const key = section.dataset.researchSection || "";
    if (key === "mode") section.hidden = false;
    else if (key === "dataset") section.hidden = !(datasetMode || validationMode);
    else if (key === "cut") section.hidden = !datasetMode;
    else if (key === "validation") section.hidden = !validationMode;
    else if (key === "test") section.hidden = datasetMode || validationMode;
    else if (key === "output") section.hidden = datasetMode || validationMode;
  }
  setResearchControlVisible(els.researchCreateDatasetBtn, false);
  setResearchControlVisible(els.researchLoadDatasetBtn, false);
  setResearchControlVisible(els.researchDatasetPathInput, datasetMode || validationMode);
  setResearchControlVisible(els.researchClearDatasetPathBtn, datasetMode || validationMode);
  setResearchControlVisible(els.researchIedsPresentPathInput, !datasetMode && !validationMode);
  setResearchControlVisible(els.researchClearIedsPresentPathBtn, !datasetMode && !validationMode);
  setResearchControlVisible(els.researchIedsAbsentPathInput, !datasetMode && !validationMode);
  setResearchControlVisible(els.researchClearIedsAbsentPathBtn, !datasetMode && !validationMode);
  const datasetTitle = document.querySelector('[data-research-section="dataset"] .research-section-title');
  if (datasetTitle) datasetTitle.textContent = validationMode ? "Input" : "Output";
  if (els.researchDatasetPathInput) {
    els.researchDatasetPathInput.placeholder = validationMode ? "input path" : "output folder";
    els.researchDatasetPathInput.title = validationMode ? "Input path containing dataset.json" : "Output folder for cut EDF epochs";
  }
  updateResearchSetupScreen();
}

function updateResearchSetupScreen() {
  if (!els.researchSetupScreen) return;
  const showSetup = state.researchMode === "test" && !state.researchSession;
  els.researchSetupScreen.hidden = !showSetup;
  els.researchSetupScreen.setAttribute("aria-hidden", showSetup ? "false" : "true");
  if (showSetup) hideResearchCompletion();
}

function researchEmailBodyText(profile = researchProfile()) {
  const name = profile.readerName || profile.doctorName || "";
  const email = profile.email || "";
  return [
    "斉藤先生",
    "",
    "脳波読影テストの結果ファイルを送付します。",
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

function showResearchCompletion() {
  if (!els.researchCompleteScreen) return;
  const validationMode = state.researchMode === "validation";
  els.researchCompleteScreen.hidden = false;
  els.researchCompleteScreen.setAttribute("aria-hidden", "false");
  if (els.researchCompleteTitle) els.researchCompleteTitle.textContent = validationMode ? "Validation完了" : "お疲れ様でした!";
  if (els.researchCompleteMessage) {
    els.researchCompleteMessage.textContent = validationMode
      ? "結果ファイルをDesktopに保存してください。専門的な形式ですが、このボタンで作成されるファイルをそのまま送れば大丈夫です。"
      : "結果を送信してください。ローカル配布で実施している場合は、Desktop保存もできます。";
  }
  if (els.researchMailBox) els.researchMailBox.hidden = validationMode;
  if (els.researchCopyEmailBtn) els.researchCopyEmailBtn.hidden = validationMode;
  if (els.researchCompleteExportCsvBtn) {
    els.researchCompleteExportCsvBtn.textContent = validationMode ? "Validation結果ファイルをDesktopに保存" : "結果を送信";
  }
  if (els.researchCompleteSaveDesktopBtn) els.researchCompleteSaveDesktopBtn.hidden = validationMode;
  if (!validationMode) updateResearchEmailBody();
  if (els.researchSavedCsvName) {
    els.researchSavedCsvName.textContent = "結果ファイルはまだ保存されていません。";
  }
  hideResearchWaveProgress();
  if (validationMode) hideValidationWaveProgress();
}

function hideResearchCompletion() {
  if (!els.researchCompleteScreen) return;
  els.researchCompleteScreen.hidden = true;
  els.researchCompleteScreen.setAttribute("aria-hidden", "true");
  if (els.researchMailBox) els.researchMailBox.hidden = false;
  if (els.researchCopyEmailBtn) els.researchCopyEmailBtn.hidden = false;
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
    btn.textContent = isBusy ? "開始中..." : (btn === els.researchSetupStartBtn ? "開始" : "Start");
  }
}

function setResearchMode(mode) {
  state.researchMode = mode === "test" || mode === "validation" ? mode : "dataset";
  hideResearchCompletion();
  for (const btn of els.researchModeButtons || []) {
    const active = btn.dataset.researchMode === state.researchMode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }
  document.body.classList.add("research-mode");
  updateResearchControlsVisibility();
  if (state.researchMode !== "test") {
    state.researchTutorialDismissed = false;
    state.researchSampleCompletedPhases = {};
    hideResearchTutorial();
    state.researchSession = null;
    state.researchResponses = [];
    state.lastResearchResponse = null;
  }
  if (state.researchMode !== "validation") {
    state.validationSession = null;
    state.validationResponses = [];
    state.lastValidationResponse = null;
    hideValidationWaveProgress();
  }
  renderRightResearchPanels();
  hideResearchToast();
  updateResearchSetupScreen();
  renderResearchPanel();
}

function activeResearchCases() {
  if (state.researchMode === "validation" && state.validationSession) return state.validationSession.cases || [];
  if (state.researchMode === "test" && state.researchSession) {
    const phase = String(state.researchSession.phase || "");
    const cases = state.researchSession.cases || [];
    if (state.researchSampleCompletedPhases[phase] || Number(state.researchSession.answeredCount || 0) > 0) {
      return cases.filter((row) => !row.sampleEpoch);
    }
    return cases;
  }
  return state.researchDataset?.cases || [];
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

function updateResearchTutorial(item = currentResearchCase()) {
  if (!els.researchTutorial) return;
  const phase = String(state.researchSession?.phase || "");
  const hasAnswers = Number(state.researchSession?.answeredCount || 0) > 0;
  const show = isResearchPracticeCase(item) && !state.researchTutorialDismissed && !state.researchSampleCompletedPhases[phase] && !hasAnswers;
  els.researchTutorial.hidden = !show;
  els.researchTutorial.setAttribute("aria-hidden", show ? "false" : "true");
}

function hideResearchTutorial() {
  if (!els.researchTutorial) return;
  els.researchTutorial.hidden = true;
  els.researchTutorial.setAttribute("aria-hidden", "true");
}

function renderResearchPanel() {
  if (!els.researchPanel) return;
  const dataset = state.researchDataset;
  const session = state.researchSession;
  const cases = activeResearchCases();
  const current = currentResearchCase();
  if (!dataset) {
    els.researchPanel.innerHTML = state.researchMode === "dataset"
      ? '<div class="research-empty">Open an EDF, enter an output folder, then Save Epoch.</div>'
      : (state.researchMode === "validation" ? '<div class="research-empty">データセットパスを入力してStartしてください。</div>' : '<div class="research-empty">No dataset loaded.</div>');
    if (els.researchCaseEditor) els.researchCaseEditor.hidden = true;
    renderResearchProgress();
    renderRightResearchPanels();
    return;
  }
  const sampleCount = researchConfiguredQuestionCount(dataset.settings || {}, session);
  syncResearchDesignControls(dataset.settings || {});
  const validationSession = state.validationSession;
  const answered = state.researchMode === "validation" && validationSession
    ? `${validationSession.answeredCount || 0}/${validationSession.totalCount || cases.length} validated`
    : (session ? `${session.answeredCount || 0}/${session.totalCount || cases.length}` : `${cases.filter((row) => row.include !== false).length}/${cases.length} included · ${sampleCount} questions`);
  const modeLabel = state.researchMode === "validation" ? "Validation" : (state.researchMode === "test" ? `Phase ${escapeHtml(session?.phase || "")}` : "Cut");
  els.researchPanel.innerHTML = `
    <div class="research-summary"><strong>${escapeHtml(dataset.name || dataset.datasetId || "Dataset")}</strong></div>
    <div class="research-small">${escapeHtml(state.researchDatasetPath || dataset.datasetPath || "")}</div>
    <div class="research-progress">${modeLabel} · ${escapeHtml(answered)}</div>
    ${current ? `<div class="research-current"><strong>${state.researchCaseIndex + 1}/${cases.length}</strong> ${escapeHtml(current.recordingId || "")}<br>${escapeHtml(current.caseId || "")}<br>${formatSec(Number(current.epochStart || 0))} + ${Number(current.durationSec || 10)}s</div>` : '<div class="research-empty">No cases for this phase.</div>'}
  `;
  if (els.researchCaseEditor) els.researchCaseEditor.hidden = !current || state.researchMode === "test" || state.researchMode === "validation";
  if (current && state.researchMode !== "test" && state.researchMode !== "validation") {
    els.researchIncludeInput.checked = current.include !== false;
    els.researchExcludeReasonInput.value = current.excludeReason || "";
    els.researchQualityNotesInput.value = current.qualityNotes || "";
  }
  if (state.researchMode === "validation") renderValidationProgress();
  else renderResearchProgress();
  renderRightResearchPanels();
}

function syncResearchDesignControls(settings) {
  const sampleCount = researchConfiguredQuestionCount(settings);
  if (els.researchDesignEpochCountInput) els.researchDesignEpochCountInput.value = String(sampleCount);
  if (els.researchEpochCountInput) els.researchEpochCountInput.value = String(sampleCount);
  if (els.researchSetupEpochCountInput) els.researchSetupEpochCountInput.value = String(sampleCount);
}

function researchConfiguredQuestionCount(settings = {}, session = null) {
  const total = Number(settings.phase1TotalSampleCount || session?.requestedTotalCount || 0);
  if (Number.isFinite(total) && total > 0) return Math.max(1, Math.min(500, total));
  const legacyPerGroup = Number(settings.phase1SamplePerGroup || session?.samplePerGroup || 0);
  if (Number.isFinite(legacyPerGroup) && legacyPerGroup > 0) return Math.max(1, Math.min(500, legacyPerGroup * 2));
  return 20;
}

function researchDesignSettings() {
  const samplePerGroup = Math.max(1, Math.min(500, Number(els.researchDesignEpochCountInput?.value || els.researchSetupEpochCountInput?.value || els.researchEpochCountInput?.value || 20)));
  return {
    phase1TotalSampleCount: samplePerGroup,
  };
}

async function saveResearchTestDesign(datasetPathOverride = "") {
  const datasetPath = datasetPathOverride || state.researchDatasetPath || els.researchDatasetPathInput?.value.trim() || "";
  if (!datasetPath) return;
  const settings = researchDesignSettings();
  if (els.researchDesignEpochCountInput) els.researchDesignEpochCountInput.value = String(settings.phase1TotalSampleCount);
  if (els.researchEpochCountInput) els.researchEpochCountInput.value = String(settings.phase1TotalSampleCount);
  if (els.researchSetupEpochCountInput) els.researchSetupEpochCountInput.value = String(settings.phase1TotalSampleCount);
  try {
    const data = await fetchJson("/api/research/dataset/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath, updates: settings }),
    });
    state.researchDataset = data.dataset;
    renderResearchPanel();
    setStatus("Test design saved");
  } catch (err) {
    setStatus(`Test design save failed: ${err.message}`, { error: true });
  }
}

function hideResearchWaveProgress() {
  if (!els.researchWaveProgress) return;
  els.researchWaveProgress.hidden = true;
  els.researchWaveProgress.setAttribute("aria-hidden", "true");
  els.researchWaveProgress.innerHTML = "";
}

function researchProgressSnapshot() {
  const session = state.researchSession;
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

function renderResearchWaveProgress(snapshot = researchProgressSnapshot()) {
  if (!els.researchWaveProgress) return;
  const session = state.researchSession;
  if (!session || state.researchMode !== "test" || els.researchCompleteScreen?.hidden === false) {
    hideResearchWaveProgress();
    return;
  }
  const { total, answered, currentQuestion, remaining, pct, isPractice } = snapshot;
  const title = isPractice ? "練習サンプル" : `本番 ${currentQuestion}/${total || 0}`;
  const detail = isPractice ? `本番は未開始 · 全 ${total || 0} 問` : `回答済み ${answered}/${total || 0} · 残り ${remaining} 問`;
  els.researchWaveProgress.hidden = false;
  els.researchWaveProgress.setAttribute("aria-hidden", "false");
  els.researchWaveProgress.innerHTML = `
    <div class="research-wave-progress-main">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
    <div class="research-wave-progress-meter" aria-label="テスト進捗 ${pct}%"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
    <div class="research-wave-progress-pct">${pct}%</div>
  `;
}

function hideResearchInlineProgress() {
  for (const el of [els.researchInlineProgress, els.validationInlineProgress]) {
    if (!el) continue;
    el.hidden = true;
    el.textContent = "";
  }
}

function renderResearchInlineProgress(snapshot = null) {
  if (els.researchCompleteScreen?.hidden === false && (state.researchMode === "test" || state.researchMode === "validation")) {
    const el = state.researchMode === "validation" ? els.validationInlineProgress : els.researchInlineProgress;
    hideResearchInlineProgress();
    if (el) {
      el.hidden = false;
      el.textContent = "完了";
    }
    return;
  }
  if (state.researchMode === "test" && state.researchSession) {
    const data = snapshot || researchProgressSnapshot();
    const label = data.isPractice
      ? `本番 ${data.total || 0} 問`
      : `残り ${data.remaining} 問`;
    hideResearchInlineProgress();
    if (els.researchInlineProgress) {
      els.researchInlineProgress.hidden = false;
      els.researchInlineProgress.textContent = label;
    }
    return;
  }
  if (state.researchMode === "validation" && state.validationSession) {
    const data = snapshot || validationProgressSnapshot();
    hideResearchInlineProgress();
    if (els.validationInlineProgress) {
      els.validationInlineProgress.hidden = false;
      els.validationInlineProgress.textContent = `残り ${data.remaining} epoch`;
    }
    return;
  }
  hideResearchInlineProgress();
}

function renderResearchProgress() {
  if (!els.researchTestProgress) return;
  const session = state.researchSession;
  if (!session || state.researchMode !== "test") {
    els.researchTestProgress.innerHTML = '<div class="research-empty">No test running.</div>';
    renderResearchWaveProgress();
    renderResearchInlineProgress();
    renderRightResearchPanels();
    return;
  }
  const snapshot = researchProgressSnapshot();
  const { cases, current, total, answered, currentQuestion, remaining, pct, isPractice } = snapshot;
  const displayIndex = cases.length ? state.researchCaseIndex + 1 : 0;
  const currentLabel = isPractice ? "練習サンプル" : `本番 ${currentQuestion}/${total || 0}`;
  els.researchTestProgress.innerHTML = `
    <div class="research-progress-card">
      <div class="research-progress-head"><strong>${escapeHtml(currentLabel)}</strong><span>${pct}%</span></div>
      <div>回答済み ${answered}/${total} · 残り ${remaining} 問</div>
      <div class="research-progress-bar"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
      <div class="research-small">Showing ${displayIndex}/${cases.length || 0}${isPractice ? " · 説明用テスト問題" : (current?.sampleEpoch ? " · sample epoch" : "")}</div>
    </div>
  `;
  renderResearchWaveProgress(snapshot);
  renderResearchInlineProgress(snapshot);
  renderRightResearchPanels();
}

function validationProgressSnapshot() {
  const session = state.validationSession;
  const cases = activeResearchCases();
  const current = currentResearchCase();
  const total = Number(session?.totalCount || cases.length || 0);
  const answered = Number(session?.answeredCount || 0);
  const currentQuestion = current ? Math.min(total, answered + 1) : answered;
  const remaining = Math.max(0, total - answered);
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return { cases, current, total, answered, currentQuestion, remaining, pct };
}

function hideValidationWaveProgress() {
  hideResearchWaveProgress();
}

function renderValidationProgress() {
  const session = state.validationSession;
  if (!session || state.researchMode !== "validation") {
    hideResearchWaveProgress();
    renderResearchInlineProgress();
    return;
  }
  const snapshot = validationProgressSnapshot();
  const { total, answered, currentQuestion, remaining, pct } = snapshot;
  hideResearchWaveProgress();
  if (els.researchTestProgress) {
    els.researchTestProgress.innerHTML = `
      <div class="research-progress-card">
        <div class="research-progress-head"><strong>Validation ${currentQuestion}/${total || 0}</strong><span>${pct}%</span></div>
        <div>評価済み ${answered}/${total || 0} · 残り ${remaining} epoch</div>
        <div class="research-progress-bar"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
        <div class="research-small">Enter: dataset label通り / 右クリック: 矛盾する判定を選択</div>
      </div>
    `;
  }
  renderResearchInlineProgress(snapshot);
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
  renderRightAnswerPanel();
}

function renderRightTestPanel() {
  if (!els.rightTestPanel) return;
  if (state.researchMode === "validation") return renderRightValidationPanel();
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

function renderRightValidationPanel() {
  if (!els.rightTestPanel) return;
  const session = state.validationSession;
  const current = currentResearchCase();
  const responses = activeValidationResponses();
  const currentRows = current ? [
    ["Current", `${validationProgressSnapshot().currentQuestion}/${session?.totalCount || 0}`],
    ["Case", current.caseId || ""],
    ["Recording", current.recordingId || ""],
    ["Dataset label", researchCaseLabelGroup(current)],
    ["Enter saves", researchExpectedRating(current)],
    ["Epoch", `${formatSec(Number(current.epochStart || 0))} + ${Number(current.durationSec || 10)}s`],
  ] : [];
  const cards = responses.map((response, index) => {
    const rows = [
      ["Case", response.caseId || ""],
      ["Expert rating", researchRatingLabel(response.rating)],
      ["Expected", researchRatingLabel(response.expectedRating)],
      ["Dataset valid", response.datasetValid ? "OK" : "要確認"],
      ["Method", response.validationMethod || ""],
      ["Answered", response.answeredAt || ""],
    ];
    return `<div class="research-result-card ${response.datasetValid ? "correct" : "incorrect"}"><div class="research-result-head"><strong>#${index + 1} ${response.datasetValid ? "OK" : "要確認"}</strong><span>${escapeHtml(researchRatingLabel(response.rating) || "-")}</span></div>${researchDetailRows(rows)}</div>`;
  }).join("");
  els.rightTestPanel.innerHTML = `
    ${current ? `<div class="research-result-card"><div class="research-result-title">Current validation epoch</div>${researchDetailRows(currentRows)}</div>` : '<div class="research-empty">Validation complete.</div>'}
    <div class="research-result-title">Validation judgments (${responses.length})</div>
    <div class="research-result-list">${cards || '<div class="research-empty">No validation yet.</div>'}</div>
  `;
}

function renderRightAnswerPanel() {
  if (!els.rightAnswerPanel) return;
  if (state.researchMode === "validation") {
    const rejected = activeValidationResponses().filter((response) => !response.datasetValid);
    const cards = rejected.map((response, index) => {
      const rows = [
        ["Case", response.caseId || ""],
        ["Expert rating", researchRatingLabel(response.rating)],
        ["Expected", researchRatingLabel(response.expectedRating)],
        ["Method", response.validationMethod || ""],
        ["Answered", response.answeredAt || ""],
      ];
      return `<div class="research-result-card incorrect"><div class="research-result-head"><strong>#${index + 1} 要確認</strong><span>${escapeHtml(researchRatingLabel(response.rating) || "-")}</span></div>${researchDetailRows(rows)}</div>`;
    }).join("");
    els.rightAnswerPanel.innerHTML = `
      <div class="research-result-title">Rejected epochs (${rejected.length})</div>
      <div class="research-result-list">${cards || '<div class="research-empty">弾いたエポックはまだありません。</div>'}</div>
    `;
    return;
  }
  const response = state.lastResearchResponse;
  if (!response) {
    els.rightAnswerPanel.innerHTML = '<div class="research-empty">No saved judgment yet.</div>';
    return;
  }
  const caseRow = researchResponseCase(response);
  const result = researchResponseCorrectness(response);
  const rows = [
    ["Case", response.caseId || ""],
    ["Recording", caseRow?.recordingId || ""],
    ["True label", researchCaseLabelGroup(caseRow)],
    ["Your rating", researchRatingLabel(response.rating)],
    ["Expected", result.expected || ""],
    ["Phase", response.phase || ""],
    ...researchMontageUsageRows(response),
  ];
  els.rightAnswerPanel.innerHTML = `
    <div class="research-result-card ${escapeHtml(result.className)}">
      <div class="research-result-head"><strong>${escapeHtml(result.label)}</strong><span>${escapeHtml(researchRatingLabel(response.rating) || "-")}</span></div>
      ${researchDetailRows(rows)}
    </div>
  `;
}

async function createResearchDataset() {
  const iedsPresentPath = els.researchIedsPresentPathInput?.value.trim() || els.researchSetupIedsPresentPathInput?.value.trim() || "";
  const iedsAbsentPath = els.researchIedsAbsentPathInput?.value.trim() || els.researchSetupIedsAbsentPathInput?.value.trim() || "";
  const outputValue = state.researchMode === "dataset" ? (els.researchDatasetPathInput?.value.trim() || "") : "";
  const phase1Montage = storedResearchProfile().usualMontage || activeMontageValue() || "conventional";
  setStatus("Creating dataset...", { busy: true });
  try {
    const payload = {};
    if (iedsPresentPath || iedsAbsentPath) {
      payload.groupPaths = {
        epileptiform: iedsPresentPath,
        non_epileptiform: iedsAbsentPath,
      };
      payload.name = "manual_test_dataset";
      payload.phase1Montage = phase1Montage;
      payload.phase1TotalSampleCount = researchDesignSettings().phase1TotalSampleCount;
    }
    if (outputValue) payload.outputPath = outputValue;
    const data = await fetchJson("/api/research/dataset/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.researchDataset = data.dataset;
    state.researchDatasetPath = data.datasetPath;
    state.researchCaseIndex = 0;
    syncResearchDesignControls(data.dataset?.settings || {});
    if (state.researchMode === "dataset" && els.researchDatasetPathInput) {
      els.researchDatasetPathInput.value = data.datasetPath;
    }
    renderResearchPanel();
    setStatus(`Dataset created: ${data.caseCount || 0} cases`);
    return data;
  } catch (err) {
    setStatus(`Dataset create failed: ${err.message}`, { error: true });
    throw err;
  }
}

async function loadResearchDatasetFromInput() {
  const path = els.researchDatasetPathInput?.value.trim() || "";
  if (!path) return setStatus("Enter dataset folder path", { error: true });
  try {
    const dataset = await loadResearchDatasetFromPath(path);
    state.researchCaseIndex = 0;
    if (state.researchMode !== "validation") setResearchMode("dataset");
    setStatus(`Dataset loaded: ${(dataset.cases || []).length} cases`);
  } catch (err) {
    setStatus(`Dataset load failed: ${err.message}`, { error: true });
  }
}

async function loadResearchDatasetFromPath(path) {
  const datasetPath = String(path || "").trim();
  if (!datasetPath) throw new Error("Dataset path or URL is required.");
  const dataset = await fetchJson(`/api/research/dataset?${qs({ path: datasetPath })}`);
  state.researchDataset = dataset;
  state.researchDatasetPath = dataset.datasetPath || datasetPath;
  if (els.researchDatasetPathInput) els.researchDatasetPathInput.value = state.researchDatasetPath;
  if (els.researchSetupDatasetPathInput && !/^https?:\/\//i.test(datasetPath)) {
    els.researchSetupDatasetPathInput.value = state.researchDatasetPath;
  }
  syncResearchDesignControls(dataset.settings || {});
  renderResearchPanel();
  return dataset;
}

function moveResearchCase(delta) {
  const cases = activeResearchCases();
  if (!cases.length) return;
  state.researchCaseIndex = Math.max(0, Math.min(cases.length - 1, state.researchCaseIndex + delta));
  renderResearchPanel();
  if (state.researchMode === "test") showResearchCase(state.researchCaseIndex);
}

async function saveResearchCaseEdits() {
  const current = currentResearchCase();
  if (!current || !state.researchDatasetPath) return;
  try {
    const data = await fetchJson("/api/research/dataset/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetPath: state.researchDatasetPath,
        caseId: current.caseId,
        updates: {
          include: !!els.researchIncludeInput.checked,
          excludeReason: els.researchExcludeReasonInput.value.trim(),
          qualityNotes: els.researchQualityNotesInput.value.trim(),
        },
      }),
    });
    state.researchDataset = data.dataset;
    renderResearchPanel();
    setStatus("Case saved");
  } catch (err) {
    setStatus(`Case save failed: ${err.message}`, { error: true });
  }
}

function currentRecordingPayload() {
  return (state.recordings || []).find((rec) => rec.id === state.recordingId) || null;
}

function currentRecordingPath() {
  const rec = currentRecordingPayload();
  return rec?.eegPath || rec?.path || els.filePathInput?.value.trim() || "";
}

async function ensureResearchDatasetForCut() {
  if (state.researchDatasetPath && state.researchDataset) return;
  await createResearchDataset();
}

function selectedEpochCenterTime() {
  const selection = state.scalogramSelection || state.topomapSelection || state.dragSelection;
  const start = Number(selection?.start);
  const duration = Number(selection?.duration);
  if (Number.isFinite(start) && Number.isFinite(duration) && duration > 0) {
    return start + duration / 2;
  }
  if (Number.isFinite(Number(state.cursorTime))) return Number(state.cursorTime);
  return Number(state.start || 0) + visibleDuration() / 2;
}

async function cutCurrentResearchEpoch() {
  if (state.researchMode !== "dataset") setResearchMode("dataset");
  const edfPath = currentRecordingPath();
  if (!edfPath) return setStatus("Open an EDF file first", { error: true });
  const outputPath = els.researchDatasetPathInput?.value.trim() || "";
  if (!outputPath) return setStatus("Enter output folder", { error: true });
  const duration = 10;
  const totalDuration = recordingDuration();
  const centerTime = selectedEpochCenterTime();
  let epochStart = Math.max(0, centerTime - duration / 2);
  if (totalDuration > 0 && epochStart + duration > totalDuration) {
    epochStart = Math.max(0, totalDuration - duration);
  }
  const eventTime = Math.max(epochStart, Math.min(centerTime, epochStart + duration));
  const labelGroup = "epileptiform";
  if (els.researchCutEpochBtn) els.researchCutEpochBtn.disabled = true;
  setStatus("Saving epoch EDF...", { busy: true });
  try {
    const data = await fetchJson("/api/research/dataset/cut", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outputPath,
        edfPath,
        recordingId: state.recordingId,
        epochStart,
        durationSec: duration,
        eventTime,
        labelGroup,
        phase1Montage: activeMontageValue(),
      }),
    });
    state.researchDatasetPath = data.outputDir || outputPath;
    if (els.researchDatasetPathInput) els.researchDatasetPathInput.value = state.researchDatasetPath;
    renderResearchPanel();
    const savedLabel = data.filename || data.outputPath || "epoch EDF";
    setStatus(`Epoch EDF saved: ${savedLabel}`);
    showResearchToast(`Saved epoch: ${savedLabel}`);
  } catch (err) {
    setStatus(`Cut failed: ${err.message}`, { error: true });
    showResearchToast(`Save failed: ${err.message}`);
  } finally {
    if (els.researchCutEpochBtn) els.researchCutEpochBtn.disabled = false;
  }
}

async function saveResearchEpochCount() {
  if (!state.researchDatasetPath || !els.researchEpochCountInput) return;
  const value = Math.max(1, Math.min(500, Number(els.researchEpochCountInput.value || 20)));
  els.researchEpochCountInput.value = String(value);
  if (els.researchDesignEpochCountInput) els.researchDesignEpochCountInput.value = String(value);
  if (els.researchSetupEpochCountInput) els.researchSetupEpochCountInput.value = String(value);
  try {
    const data = await fetchJson("/api/research/dataset/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath: state.researchDatasetPath, updates: { phase1TotalSampleCount: value } }),
    });
    state.researchDataset = data.dataset;
    renderResearchPanel();
    setStatus(`Test question count set to ${value}`);
  } catch (err) {
    setStatus(`Question count save failed: ${err.message}`, { error: true });
  }
}

function setValidationResponsesFromSession(session = state.validationSession) {
  state.validationResponses = Array.isArray(session?.responses) ? [...session.responses] : [];
}

function activeValidationResponses() {
  return (Array.isArray(state.validationResponses) ? state.validationResponses : [])
    .filter((row) => row && !row.superseded && !row.undoneAt)
    .sort((a, b) => String(b.answeredAt || "").localeCompare(String(a.answeredAt || "")));
}

async function startValidationMode() {
  const datasetPath = els.researchDatasetPathInput?.value.trim() || state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Validation用のデータセットパスを入力してください", { error: true });
  hideResearchCompletion();
  hideResearchTutorial();
  setStatus("Starting validation...", { busy: true });
  try {
    const dataset = await fetchJson(`/api/research/dataset?${qs({ path: datasetPath })}`);
    state.researchDataset = dataset;
    state.researchDatasetPath = dataset.datasetPath || datasetPath;
    if (els.researchDatasetPathInput) els.researchDatasetPathInput.value = state.researchDatasetPath;
    const session = await fetchJson(`/api/research/validation/session?${qs({ dataset: state.researchDatasetPath })}`);
    state.validationSession = session;
    setValidationResponsesFromSession(session);
    state.researchCaseIndex = 0;
    setResearchMode("validation");
    renderResearchPanel();
    await showValidationCase(0);
  } catch (err) {
    setStatus(`Validation start failed: ${err.message}`, { error: true });
  }
}

async function showValidationCase(index) {
  const cases = activeResearchCases();
  if (!cases.length) {
    renderResearchPanel();
    showResearchCompletion();
    setStatus("Validation complete. 結果ファイルを保存できます");
    return;
  }
  state.researchCaseIndex = Math.max(0, Math.min(cases.length - 1, index));
  const item = cases[state.researchCaseIndex];
  renderResearchPanel();
  setStatus(`Loading validation epoch ${state.researchCaseIndex + 1}/${cases.length}...`, { busy: true });
  try {
    const opened = await fetchJson("/api/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.edfPath }),
    });
    applyOpenedRecording(opened);
    await loadMetadata();
    state.start = 0;
    state.cursorTime = null;
    state.rangeStart = null;
    state.scalogramSelection = null;
    state.topomapSelection = null;
    state.scalogramData = null;
    const montage = item.phase1Montage || storedResearchProfile().usualMontage || "conventional";
    if (els.sensitivitySelect) els.sensitivitySelect.value = "10uV";
    if (els.tcSelect) els.tcSelect.value = "0.3";
    if (els.hfSelect) els.hfSelect.value = "120";
    if (els.durationSelect) els.durationSelect.value = "10";
    state.viewMode = "single";
    els.montageSelect.value = montage;
    state.activeMontage = els.montageSelect.value;
    updateViewModeButtons();
    syncMultiMontageControls();
    setRightPanelVisible(false, { save: false });
    state.windowData = null;
    await loadWindow();
    scheduleLayoutRefresh();
    state.validationCaseStartedAt = new Date().toISOString();
    renderValidationProgress();
    renderRightResearchPanels();
    setStatus(`Validation: Enterで妥当 / 右クリックで矛盾判定 (${researchCaseLabelGroup(item)})`);
  } catch (err) {
    setStatus(`Validation epoch load failed: ${err.message}`, { error: true });
  }
}

function renderValidationRatingContextMenu() {
  const expected = researchExpectedRating(currentResearchCase());
  const opposite = expected === "てんかん性異常あり" ? "てんかん性異常なし" : "てんかん性異常あり";
  els.contextMenu.innerHTML = `
    <div class="context-menu-caption">Validation: labelと矛盾する場合のみ選択</div>
    <button data-action="validation-rating" data-rating="${escapeHtml(opposite)}">${escapeHtml(opposite)}として修正</button>
  `;
}

function validationPayload(rating, method) {
  const item = currentResearchCase();
  const answeredAt = new Date().toISOString();
  return {
    datasetPath: state.researchDatasetPath,
    caseId: item?.caseId || "",
    rating,
    validationMethod: method,
    startedAt: state.validationCaseStartedAt || answeredAt,
    answeredAt,
    elapsedMs: state.validationCaseStartedAt ? Date.now() - Date.parse(state.validationCaseStartedAt) : 0,
    usedMontage: activeMontageValue(),
    finalMontage: activeMontageValue(),
    sensitivity: els.sensitivitySelect?.value || "",
    tc: els.tcSelect?.value || "",
    hf: els.hfSelect?.value || "",
    timebaseSec: Number(els.durationSelect?.value || visibleDuration() || 0),
  };
}

async function saveValidationRating(rating, method = "manual_override") {
  const item = currentResearchCase();
  if (!item || !state.validationSession || state.validationSaving) return;
  state.validationSaving = true;
  try {
    const data = await fetchJson("/api/research/validation/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validationPayload(rating, method)),
    });
    state.validationSession = data.session;
    setValidationResponsesFromSession(data.session);
    state.lastValidationResponse = data.response;
    const label = data.response?.datasetValid ? "妥当" : "要確認";
    showResearchToast(`Validation保存: ${label} · ${researchRatingLabel(rating)} · やり直す場合は「前の問題をやりなおす」`, { undo: true });
    const cases = activeResearchCases();
    if (cases.length) await showValidationCase(0);
    else {
      renderResearchPanel();
      showResearchCompletion();
      setStatus("Validation complete. 結果ファイルを保存できます");
    }
  } catch (err) {
    setStatus(`Validation save failed: ${err.message}`, { error: true });
  } finally {
    state.validationSaving = false;
  }
}

async function acceptCurrentValidationEpoch() {
  const item = currentResearchCase();
  if (!item || state.researchMode !== "validation") return;
  hideContextMenu();
  await saveValidationRating(researchExpectedRating(item), "enter_accept");
}

async function exportValidationJson() {
  const datasetPath = els.researchDatasetPathInput?.value.trim() || state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Validation用のデータセットパスを入力してください", { error: true });
  try {
    setStatus("Validation結果ファイルをDesktopに保存中...", { busy: true });
    const jsonFilename = "validation_results.json";
    const jsonResult = await fetchJson("/api/research/validation/export-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath, filename: jsonFilename }),
    });
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = `Desktopに保存しました: ${jsonResult.path || jsonResult.filename || jsonFilename}`;
    }
    setStatus(`Validation結果ファイルをDesktopに保存しました: ${jsonResult.path || jsonResult.filename || jsonFilename}`);
  } catch (err) {
    setStatus(`Validation export failed: ${err.message}`, { error: true });
  }
}

async function startResearchTest() {
  setResearchSetupMessage("入力内容を確認中...");
  if (!validateResearchProfileForStart()) return;
  saveResearchProfile();
  hideResearchCompletion();
  state.researchTutorialDismissed = false;
  state.researchSampleCompletedPhases = {};
  hideResearchTutorial();
  const profile = researchProfile();
  const readerId = researchReaderDisplayId(profile);
  const phase = "1";
  const usualMontage = profile.usualMontage || activeMontageValue();
  const setupDatasetPath = els.researchSetupDatasetPathInput?.value.trim() || profile.datasetPath || "";
  const iedsPresentPath = els.researchIedsPresentPathInput?.value.trim() || els.researchSetupIedsPresentPathInput?.value.trim() || "";
  const iedsAbsentPath = els.researchIedsAbsentPathInput?.value.trim() || els.researchSetupIedsAbsentPathInput?.value.trim() || "";
  if (els.researchEpochCountInput && els.researchSetupEpochCountInput?.value) {
    els.researchEpochCountInput.value = els.researchSetupEpochCountInput.value;
  }
  if (els.researchReaderIdInput && readerId) els.researchReaderIdInput.value = readerId;
  if (els.montageSelect && usualMontage) {
    els.montageSelect.value = usualMontage;
    state.activeMontage = els.montageSelect.value || usualMontage;
  }
  if (!setupDatasetPath && (!iedsPresentPath || !iedsAbsentPath)) {
    const existingDatasetPath = state.researchDatasetPath || els.researchDatasetPathInput?.value.trim() || "";
    if (!existingDatasetPath) {
      const message = "GitHub dataset URL、local dataset path、またはIEDs present/absentのDataを入力してください";
      setResearchSetupMessage(message, true);
      setStatus(message, { error: true });
      return;
    }
  }
  setResearchSetupMessage("Starting test...");
  setResearchStartBusy(true);
  setStatus("Starting test...", { busy: true });
  try {
    const existingDatasetPath = setupDatasetPath || state.researchDatasetPath || els.researchDatasetPathInput?.value.trim() || "";
    const created = iedsPresentPath && iedsAbsentPath ? await createResearchDataset() : null;
    let datasetPath = created?.datasetPath || existingDatasetPath || state.researchDatasetPath || "";
    if (!created && datasetPath) {
      const dataset = await loadResearchDatasetFromPath(datasetPath);
      datasetPath = dataset.datasetPath || datasetPath;
    }
    await saveResearchTestDesign(datasetPath);
    const session = await fetchJson(`/api/research/test/session?${qs({ dataset: datasetPath, readerId, phase })}`);
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
    renderResearchPanel();
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
    renderResearchPanel();
    showResearchCompletion();
    setStatus("Test complete. 結果ファイルを保存できます");
    return;
  }
  state.researchCaseIndex = Math.max(0, Math.min(cases.length - 1, index));
  const item = cases[state.researchCaseIndex];
  renderResearchPanel();
  setStatus(`${isResearchPracticeCase(item) ? "Loading explanation practice epoch" : (item.sampleEpoch ? `Loading ${"Phase 1"} sample` : `Loading test epoch ${state.researchCaseIndex + 1}/${cases.length}`)}...`, { busy: true });
  try {
    const opened = await fetchJson("/api/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.edfPath }),
    });
    applyOpenedRecording(opened);
    await loadMetadata();
    state.start = 0;
    state.cursorTime = null;
    state.rangeStart = null;
    state.scalogramSelection = null;
    state.topomapSelection = null;
    state.scalogramData = null;
    const profile = researchProfile();
    const usualMontage = isResearchPracticeCase(item) ? "conventional" : (profile.usualMontage || item.phase1Montage || "conventional");
    if (els.sensitivitySelect) els.sensitivitySelect.value = "10uV";
    if (els.tcSelect) els.tcSelect.value = "0.3";
    if (els.hfSelect) els.hfSelect.value = "120";
    if (els.durationSelect) els.durationSelect.value = "10";
    state.viewMode = "single";
    els.montageSelect.value = usualMontage;
    state.activeMontage = els.montageSelect.value;
    updateViewModeButtons();
    syncMultiMontageControls();
    setRightPanelVisible(false, { save: false });
    state.windowData = null;
    await loadWindow();
    scheduleLayoutRefresh();
    updateResearchTutorial(item);
    state.researchCaseStartedAt = new Date().toISOString();
    startResearchMontageTiming();
    renderResearchInlineProgress();
    setStatus(isResearchPracticeCase(item) ? "練習サンプル: 波形を左クリックして三択から回答してください" : (item.sampleEpoch ? `Phase ${state.researchSession?.phase || ""} sample` : `Test ${state.researchSession?.phase || ""}: ${state.researchCaseIndex + 1}/${cases.length}`));
    renderRightResearchPanels();
  } catch (err) {
    hideResearchTutorial();
    setStatus(`Test epoch load failed: ${err.message}`, { error: true });
  }
}

function renderResearchRatingContextMenu() {
  const context = state.context || {};
  const channel = context.channel || context.montageChannel || "";
  const onset = Number(context.onset);
  const target = [channel, Number.isFinite(onset) ? formatSec(onset) : ""].filter(Boolean).join(" · ");
  els.contextMenu.innerHTML = `
    <div class="context-menu-caption">Test annotation${target ? `: ${escapeHtml(target)}` : ""}</div>
    ${RESEARCH_RATINGS.map((rating) => `<button data-action="research-rating" data-rating="${escapeHtml(rating)}">${escapeHtml(rating)}</button>`).join("")}
  `;
}

function researchSpikeSelectionPayload() {
  const context = state.context || {};
  const onset = Number(context.onset);
  const selected = state.scalogramSelection || null;
  const fallbackDuration = Math.min(1, Math.max(0.05, visibleDuration() || 1));
  const fallbackStart = Number.isFinite(onset) ? Math.max(0, onset - fallbackDuration / 2) : Math.max(0, Number(state.start || 0));
  const selectionStart = Number.isFinite(Number(selected?.start)) ? Number(selected.start) : fallbackStart;
  const selectionDuration = Number.isFinite(Number(selected?.duration)) ? Number(selected.duration) : fallbackDuration;
  return {
    usedMontage: activeMontageValue(),
    finalMontage: activeMontageValue(),
    sensitivity: els.sensitivitySelect?.value || "",
    tc: els.tcSelect?.value || "",
    hf: els.hfSelect?.value || "",
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
  const answeredAt = new Date().toISOString();
  const elapsedMs = state.researchCaseStartedAt ? Date.now() - Date.parse(state.researchCaseStartedAt) : 0;
  try {
    if (item.sampleEpoch) {
      hideResearchTutorial();
      state.researchTutorialDismissed = true;
      state.researchSampleCompletedPhases[String(state.researchSession.phase || "")] = true;
      if (isResearchPracticeCase(item)) {
        const usualMontage = saveUsualResearchMontage(activeMontageValue());
        showResearchToast("練習終了 · テスト開始");
      } else {
        showResearchToast("Sample shown");
      }
      const cases = activeResearchCases();
      if (cases.length) await showResearchCase(0);
      else {
        showResearchCompletion();
        setStatus("Test complete. 結果ファイルを保存できます");
      }
      return;
    }
    const data = await fetchJson("/api/research/test/response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetPath: state.researchDatasetPath,
        readerId: state.researchSession.readerId,
        outputPath: researchProfile().outputPath,
        readerProfile: researchProfile(),
        phase: state.researchSession.phase,
        caseId: item.caseId,
        rating,
        startedAt: state.researchCaseStartedAt || answeredAt,
        answeredAt,
        elapsedMs,
        displayMode: "phase1_single",
        ...researchSpikeSelectionPayload(),
        ...researchMontageTimingPayload(),
      }),
    });
    state.researchSession = data.session;
    setResearchResponsesFromSession(data.session);
    state.lastResearchResponse = data.response;
    state.lastResearchResponseCaseIndex = state.researchCaseIndex;
    renderRightResearchPanels();
    showResearchToast(`保存しました: ${researchRatingLabel(rating)} · やり直す場合は「前の問題をやりなおす」`, { undo: true });
    const cases = activeResearchCases();
    if (cases.length) await showResearchCase(0);
    else {
      state.researchCaseIndex = cases.length ? cases.length - 1 : 0;
      renderResearchPanel();
      showResearchCompletion();
      setStatus("Test complete. 結果ファイルを保存できます");
    }
  } catch (err) {
    setStatus(`Save failed: ${err.message}`, { error: true });
    showResearchToast(`保存できませんでした: ${err.message}`);
  }
}

function showResearchToast(message, options = {}) {
  if (!els.researchToast || !els.researchToastText) return;
  els.researchToastText.textContent = message;
  if (els.researchUndoBtn) els.researchUndoBtn.hidden = !options.undo;
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
        outputPath: researchProfile().outputPath,
        responseId: state.lastResearchResponse.responseId,
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

async function undoValidationResponse() {
  if (!state.lastValidationResponse || !state.validationSession) return;
  try {
    const data = await fetchJson("/api/research/validation/response/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetPath: state.researchDatasetPath,
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
    await showValidationCase(index >= 0 ? index : 0);
    setStatus("Validation undo complete");
  } catch (err) {
    setStatus(`Validation undo failed: ${err.message}`, { error: true });
  }
}

function undoLastResearchAction() {
  if (state.researchMode === "validation") {
    undoValidationResponse();
    return;
  }
  undoResearchResponse();
}

async function exportResearchJson() {
  if (state.researchMode === "validation") return exportValidationJson();
  const datasetPath = els.researchDatasetPathInput?.value.trim() || state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Enter dataset folder path", { error: true });
  saveResearchProfile();
  const profile = researchProfile();
  const readerId = researchReaderDisplayId(profile);
  try {
    setStatus("結果ファイルをDesktopに保存中...", { busy: true });
    const jsonFilename = researchJsonFilename(readerId, profile);
    const jsonResult = await fetchJson("/api/research/test/export-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath, readerId, filename: jsonFilename }),
    });
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = `Desktopに保存しました: ${jsonResult.path || jsonResult.filename || jsonFilename}`;
    }
    setStatus(`結果ファイルをDesktopに保存しました: ${jsonResult.path || jsonResult.filename || jsonFilename}`);
  } catch (err) {
    setStatus(`Export failed: ${err.message}`, { error: true });
  }
}

async function submitResearchJson() {
  if (state.researchMode === "validation") return exportValidationJson();
  const datasetPath = els.researchDatasetPathInput?.value.trim() || state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Enter dataset folder path", { error: true });
  saveResearchProfile();
  const profile = researchProfile();
  const readerId = researchReaderDisplayId(profile);
  try {
    setStatus("結果を送信中...", { busy: true });
    const jsonFilename = researchJsonFilename(readerId, profile);
    const result = await fetchJson("/api/research/test/submit-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath, readerId, filename: jsonFilename }),
    });
    const label = result.submissionId || result.filename || jsonFilename;
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = `送信しました: ${label}`;
    }
    setStatus(`結果を送信しました: ${label}`);
  } catch (err) {
    setStatus(`Submit failed: ${err.message}`, { error: true });
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
    showResearchToast("メール本文をコピーできました");
    setStatus("メール本文をコピーできました");
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
  applyPanelWidth("scalogram", Number(saved.scalogram));
}

function savePanelWidths() {
  const styles = getComputedStyle(document.documentElement);
  const workspaceStyles = els.workspace ? getComputedStyle(els.workspace) : styles;
  const right = parseFloat(workspaceStyles.getPropertyValue("--right-panel-width"));
  const scalogram = parseFloat(workspaceStyles.getPropertyValue("--scalogram-column-width"));
  localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify({ right, scalogram }));
}

function applyPanelWidth(panel, width) {
  if (!els.workspace || !Number.isFinite(width)) return;
  const min = panel === "right" ? 210 : 260;
  const max = Math.max(min, Math.floor(window.innerWidth * (panel === "right" ? 0.62 : 0.58)));
  const clamped = Math.max(min, Math.min(max, Math.round(width)));
  const property = panel === "right" ? "--right-panel-width" : "--scalogram-column-width";
  els.workspace.style.setProperty(property, clamped + "px");
}

function bindPanelResizers() {
  for (const handle of els.panelResizeHandles || []) {
    handle.addEventListener("pointerdown", onPanelResizePointerDown);
  }
  bindAnnotationListResizer();
  window.addEventListener("pointermove", onPanelResizePointerMove);
  window.addEventListener("pointerup", finishPanelResize);
  window.addEventListener("pointercancel", finishPanelResize);
}

function restoreAnnotationListHeight() {
  const saved = Number(localStorage.getItem(ANNOTATION_LIST_HEIGHT_KEY));
  applyAnnotationListHeight(saved);
}

function applyAnnotationListHeight(height) {
  if (!els.annotationList || !Number.isFinite(height)) return;
  const min = 86;
  const max = Math.max(min, Math.floor(window.innerHeight * 0.62));
  const clamped = Math.max(min, Math.min(max, Math.round(height)));
  els.annotationList.style.setProperty("--annotation-list-height", clamped + "px");
}

function saveAnnotationListHeight() {
  if (!els.annotationList) return;
  localStorage.setItem(ANNOTATION_LIST_HEIGHT_KEY, String(Math.round(els.annotationList.getBoundingClientRect().height)));
}

function bindAnnotationListResizer() {
  if (!els.annotationListResize || !els.annotationList) return;
  els.annotationListResize.addEventListener("pointerdown", onAnnotationListResizePointerDown);
  window.addEventListener("pointermove", onAnnotationListResizePointerMove);
  window.addEventListener("pointerup", finishAnnotationListResize);
  window.addEventListener("pointercancel", finishAnnotationListResize);
}

function onAnnotationListResizePointerDown(ev) {
  if (!els.annotationList) return;
  state.annotationResizeDrag = {
    startY: ev.clientY,
    startHeight: els.annotationList.getBoundingClientRect().height,
  };
  els.annotationListResize?.classList.add("dragging");
  ev.preventDefault();
}

function onAnnotationListResizePointerMove(ev) {
  const drag = state.annotationResizeDrag;
  if (!drag) return;
  applyAnnotationListHeight(drag.startHeight + (ev.clientY - drag.startY));
}

function finishAnnotationListResize() {
  if (!state.annotationResizeDrag) return;
  els.annotationListResize?.classList.remove("dragging");
  state.annotationResizeDrag = null;
  saveAnnotationListHeight();
}

function showEventControls() {
  if (els.eventControls) els.eventControls.open = true;
}

function onPanelResizePointerDown(ev) {
  const handle = ev.currentTarget;
  const panel = handle?.dataset?.resizePanel;
  if (!panel || !els.workspace) return;
  const styles = getComputedStyle(els.workspace);
  const property = panel === "right" ? "--right-panel-width" : "--scalogram-column-width";
  const startWidth = parseFloat(styles.getPropertyValue(property));
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

async function openFileFromPath() {
  const path = els.filePathInput.value.trim();
  if (!path) {
    setStatus("Enter an EEG/EDF file or folder path", { error: true });
    return;
  }
  setOpenFileBusy(true);
  setStatus("Opening path...", { busy: true, progress: 10 });
  try {
    const opened = await fetchJson("/api/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    state.recordingId = opened.id;
    state.start = 0;
    state.cursorTime = null;
    state.rangeStart = null;
    state.scalogramSelection = null;
    state.scalogramData = null;
    state.selectedScalogramIndex = 0;
    state.scalogramRequestId += 1;
    if (els.rangeCancelBtn) els.rangeCancelBtn.disabled = true;
    rememberRecentFile(path);
    const count = Array.isArray(opened.recordings) ? opened.recordings.length : 1;
    setStatus(
      opened.kind === "folder" ? `Loaded ${count} recording${count === 1 ? "" : "s"} from folder` : "Loaded recording",
      { busy: true, progress: 30 },
    );
    await loadRecordings(opened.id);
  } catch (err) {
    setStatus(`Open failed: ${err.message}`, { error: true });
  } finally {
    setOpenFileBusy(false);
  }
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
    setSelectValue(els.acSelect, settings.ac);
    setSelectValue(els.durationSelect, settings.duration);
    syncTimebaseButtons();
    setSelectValue(els.paperSelect, settings.paper);
    if (typeof settings.ecg === "boolean") els.ecgToggle.checked = settings.ecg;
    if (typeof settings.ecgFilter === "boolean" && els.ecgFilterToggle) {
      els.ecgFilterToggle.checked = settings.ecgFilter;
    }
    if (typeof settings.rightPanelVisible === "boolean") {
      state.rightPanelVisible = settings.rightPanelVisible;
    }
    state.scalogramVisible = false;
    if (typeof settings.showSourceAnnotations === "boolean") {
      state.showSourceAnnotations = settings.showSourceAnnotations;
      if (els.sourceAnnotationToggle) els.sourceAnnotationToggle.checked = settings.showSourceAnnotations;
    }
    state.topomapMode = "mean";
    state.topomapLayout = "system";
    state.scalogramDisplayScope = "all";
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
}

function saveSettings() {
  const settings = {
    montage: els.montageSelect.value,
    viewMode: "single",
    workspaceMode: "review",
    rightPanelTab: RIGHT_PANEL_TABS.includes(state.rightPanelTab) ? state.rightPanelTab : "topomap",
    sensitivity: els.sensitivitySelect.value,
    tc: els.tcSelect.value,
    hf: els.hfSelect.value,
    ac: els.acSelect.value,
    duration: els.durationSelect.value,
    paper: els.paperSelect.value,
    ecg: els.ecgToggle.checked,
    ecgFilter: els.ecgFilterToggle?.checked || false,
    rightPanelVisible: state.rightPanelVisible,
    showSourceAnnotations: state.showSourceAnnotations,
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
  for (const btn of els.viewModeButtons || []) {
    const mode = btn.dataset.viewMode || "single";
    const btnCount = normalizeMultiMontageCount(btn.dataset.montageCount);
    const active = mode === "single"
      ? !isMultiMontageMode()
      : isMultiMontageMode() && btnCount === count;
    btn.classList.toggle("active", active);
  }
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
  for (const select of els.multiMontageSelects || []) {
    const index = Number(select.dataset.multiMontageIndex || 0);
    if (state.multiMontages[index] && select.value !== state.multiMontages[index]) {
      select.value = state.multiMontages[index];
    }
    select.disabled = isMultiMontageMode() && index >= activeMultiMontageCount();
  }
}

function multiMontageViews() {
  return normalizeMultiMontages(state.multiMontages)
    .slice(0, activeMultiMontageCount())
    .map((montage) => ({ montage, label: MONTAGE_LABELS[montage] || montage }));
}

function onMultiMontageSelectChange(ev) {
  const index = Number(ev.target?.dataset?.multiMontageIndex || 0);
  state.multiMontages = normalizeMultiMontages(state.multiMontages);
  state.multiMontages[index] = ev.target.value || DEFAULT_MULTI_MONTAGES[index] || "longitudinal";
  state.multiMontages = normalizeMultiMontages(state.multiMontages);
  const visibleMontages = state.multiMontages.slice(0, activeMultiMontageCount());
  if (!visibleMontages.includes(activeMontageValue())) {
    setActiveMontage(visibleMontages[Math.min(index, visibleMontages.length - 1)] || visibleMontages[0], { reload: false, reloadScalogram: false });
  }
  syncMultiMontageControls();
  updateResearchMontageTiming();
  saveSettings();
  if (isMultiMontageMode()) {
    state.windowData = null;
    loadWindow();
  }
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

function syncActiveMontageData() {
  const data = state.windowData;
  if (!data || !Array.isArray(data.montageViews)) return;
  const active = activeMontageValue();
  const view = data.montageViews.find((item) => item.montage === active) || data.montageViews[0];
  if (!view) return;
  data.montage = view.montage;
  data.traces = view.traces || [];
  state.activeMontage = view.montage;
  if (els.montageSelect.value !== view.montage) els.montageSelect.value = view.montage;
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
  if (options.reloadScalogram !== false && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
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
    if (activeTab === "test" || activeTab === "answer") {
      renderRightResearchPanels();
    }
  });
}

function topomapPanelActive() {
  return false;
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
  if (els.rightPanelToggleBtn) {
    els.rightPanelToggleBtn.classList.toggle("active", state.rightPanelVisible);
    const label = els.rightPanelToggleBtn.querySelector(".switch-label");
    if (label) label.textContent = state.rightPanelVisible ? "Right ON" : "Right OFF";
    els.rightPanelToggleBtn.title = state.rightPanelVisible ? "Hide event and annotation column" : "Show event and annotation column";
    els.rightPanelToggleBtn.setAttribute("aria-checked", state.rightPanelVisible ? "true" : "false");
    els.rightPanelToggleBtn.setAttribute("aria-pressed", state.rightPanelVisible ? "true" : "false");
  }
  if (options.redraw === false) return;
  scheduleLayoutRefresh();
}

function setRightPanelVisible(visible, options = {}) {
  state.rightPanelVisible = Boolean(visible);
  if (options.save !== false) saveSettings();
  applyRightPanelVisibility(options);
}

function toggleRightPanel() {
  setRightPanelVisible(!state.rightPanelVisible);
}


function applyScalogramVisibility(options = {}) {
  state.scalogramVisible = false;
  document.body.classList.add("scalogram-hidden");
  if (options.redraw === false) return;
  scheduleLayoutRefresh();
}


function visibleAnnotations() {
  const rows = Array.isArray(state.allAnnotations) ? state.allAnnotations : [];
  return state.showSourceAnnotations ? rows : rows.filter((row) => !row.readOnly && row.source !== "file");
}

function applyAnnotationVisibility() {
  state.annotations = visibleAnnotations();
  renderAnnotations();
  draw();
  drawEventStrip();
}

function applyManualAnnotationUpdate(manualAnnotations) {
  const sourceRows = (Array.isArray(state.allAnnotations) ? state.allAnnotations : []).filter((row) => row.readOnly || row.source === "file");
  state.allAnnotations = [...(Array.isArray(manualAnnotations) ? manualAnnotations : []), ...sourceRows]
    .sort((a, b) => Number(a.onset || 0) - Number(b.onset || 0));
  applyAnnotationVisibility();
}

function setSelectValue(select, value) {
  if (!value) return;
  if ([...select.options].some((opt) => opt.value === value || opt.textContent === value)) {
    select.value = value;
  }
}

function restoreRecentFiles() {
  try {
    const files = JSON.parse(localStorage.getItem(RECENT_FILES_KEY) || "[]");
    state.recentFiles = trimRecentFiles(files);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(state.recentFiles));
  } catch {
    state.recentFiles = [];
    localStorage.removeItem(RECENT_FILES_KEY);
  }
  renderRecentFiles();
}

function rememberRecentFile(path) {
  state.recentFiles = trimRecentFiles([path, ...state.recentFiles]);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(state.recentFiles));
  renderRecentFiles();
}

function trimRecentFiles(files) {
  if (!Array.isArray(files)) return [];
  const seen = new Set();
  const recent = [];
  for (const item of files) {
    const path = String(item || "").trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    recent.push(path);
    if (recent.length >= RECENT_FILES_LIMIT) break;
  }
  return recent;
}

function renderRecentFiles() {
  els.recentFileSelect.innerHTML = "<option value=''>Recent</option>";
  for (const path of state.recentFiles) {
    const opt = document.createElement("option");
    opt.value = path;
    opt.textContent = shortPath(path);
    opt.title = path;
    els.recentFileSelect.appendChild(opt);
  }
  els.recentFileSelect.disabled = state.recentFiles.length === 0;
}

function shortPath(path) {
  const parts = String(path).split("/");
  return parts.length > 3 ? `.../${parts.slice(-3).join("/")}` : path;
}

function onKeyDown(ev) {
  const target = ev.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    els.annotationDialog.open
  ) {
    return;
  }
  if (state.researchMode === "validation" && state.validationSession && ev.key === "Enter" && !ev.isComposing) {
    ev.preventDefault();
    acceptCurrentValidationEpoch();
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
  } else if (["1", "2", "3", "4", "5", "6"].includes(ev.key)) {
    ev.preventDefault();
    const montageByKey = {
      1: "conventional",
      2: "conventional_average",
      3: "longitudinal",
      4: "transverse",
      5: "a1a2",
      6: "average",
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
    setActiveMontage(montage, { reloadScalogram: true });
    return;
  }
  els.montageSelect.value = montage;
  state.activeMontage = montage;
  saveSettings();
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
    state.rangeStart = null;
    state.scalogramSelection = null;
    state.scalogramData = null;
    state.selectedScalogramIndex = 0;
    state.scalogramRequestId += 1;
    if (els.rangeCancelBtn) els.rangeCancelBtn.disabled = true;
    await loadMetadata();
  } else if ([els.tcSelect, els.hfSelect, els.acSelect, els.ecgToggle, els.ecgFilterToggle].includes(ev.target)) {
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

async function loadWindow() {
  if (!state.recordingId) return;
  if (state.windowLoadInFlight) {
    state.windowLoadPending = true;
    setStatus("Loading waveform...", { busy: true, progress: 75 });
    return state.windowLoadPromise || undefined;
  }
  state.windowLoadInFlight = true;
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
          montages: "",
          tc: els.tcSelect.value,
          hf: els.hfSelect.value,
          ac: els.acSelect.value,
          ecg: els.ecgToggle.checked ? "1" : "0",
          ecgFilter: els.ecgFilterToggle?.checked ? "1" : "0",
          topomap: "0",
        };
        const data = await fetchJson(`${endpoint}?${qs(params)}`);
        if (state.windowLoadPending) continue;
        state.windowData = data;
        state.activeMontage = data.montage || requestedMontage;
        state.allAnnotations = state.windowData.annotations || [];
        state.annotations = visibleAnnotations();
        state.start = state.windowData.start || 0;
        state.scalogramData = null;
        renderStatus();
        updateWaveScrollbar();
        renderWarnings();
        renderAnnotations();
        draw();
      } while (state.windowLoadPending);
    } catch (err) {
      if (!state.windowLoadPending) setStatus(`Waveform failed: ${err.message}`, { error: true });
    } finally {
      state.windowLoadInFlight = false;
      state.windowLoadPending = false;
      state.windowLoadPromise = null;
    }
  })();
  return state.windowLoadPromise;
}

async function loadPreciseTopomap() {
  state.topomapRequestId += 1;
  state.preciseTopomap = null;
}

function setTopomapSelection(selection) {
  const normalized = normalizeScalogramSelection(selection);
  state.topomapSelection = normalized;
  return normalized;
}

function defaultTopomapSelection(centerTime) {
  const total = recordingDuration();
  const center = Number.isFinite(Number(centerTime)) ? Number(centerTime) : state.start + visibleDuration() / 2;
  const half = 0.01;
  const start = Math.max(0, center - half);
  const endLimit = total || state.start + visibleDuration();
  const end = Math.min(endLimit, center + half);
  return { start: preciseNumber(start), duration: preciseNumber(Math.max(0.002, end - start)) };
}

function fixedTopomapInterval(centerTime, halfWindowSec) {
  const total = recordingDuration();
  const center = Number.isFinite(Number(centerTime)) ? Number(centerTime) : state.start + visibleDuration() / 2;
  const half = Math.max(0.001, Number(halfWindowSec) || 0.005);
  const endLimit = total || state.start + visibleDuration();
  const start = Math.max(0, center - half);
  const end = Math.min(endLimit, center + half);
  return {
    start: preciseNumber(start),
    end: preciseNumber(end),
    duration: preciseNumber(Math.max(0.002, end - start)),
    center: preciseNumber(start + Math.max(0.002, end - start) / 2),
  };
}

function currentTopomapInterval() {
  const fallback = defaultTopomapSelection(state.cursorTime);
  const selection = normalizeScalogramSelection(state.topomapSelection || fallback) || fallback;
  const start = Number(selection.start || 0);
  const duration = Math.max(0.002, Number(selection.duration || 0.02));
  const end = start + duration;
  return {
    start: preciseNumber(start),
    end: preciseNumber(end),
    duration: preciseNumber(duration),
    center: preciseNumber(start + duration / 2),
  };
}

function renderMetadata() {
  const md = state.metadata;
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
  for (const panel of [els.resultWarningPanel]) {
    if (panel) panel.innerHTML = warningHtml;
  }
}

function renderStatus() {
  const duration = visibleDuration();
  const end = state.start + duration;
  const tc = tcText();
  const sensitivity = sensitivityValue();
  const ecgFilterText = els.ecgFilterToggle?.checked ? " · ECG filter" : "";
  const traceCount = isMultiWindowData()
    ? (state.windowData.montageViews || []).map((view) => (view.traces || []).length).join("/")
    : String((state.windowData?.traces || []).length);
  const traceText = traceCount && traceCount !== "0" ? ` · ${traceCount} traces` : "";
  const firstTrace = state.windowData?.traces?.[0]?.label ? ` · ${state.windowData.traces[0].label}` : "";
  const loadedDuration = Number(state.windowData?.duration || 0);
  const durationText = loadedDuration ? ` · loaded ${loadedDuration.toFixed(2)}s` : "";
  setStatus(`${state.recordingId} · ${labelForMontage()} · ${sensitivity}uV/mm · TC ${tc} · HF ${hfText()} · AC ${els.acSelect.options[els.acSelect.selectedIndex].text}${ecgFilterText}${traceText}${firstTrace}${durationText} · ${formatSec(state.start)}-${formatSec(end)}`);
  els.timeReadout.textContent = `${formatSec(state.start)} - ${formatSec(end)}`;
  els.calReadout.textContent = `${sensitivity}uV/mm · TC ${tc} · HF ${hfText()} · AC ${els.acSelect.options[els.acSelect.selectedIndex].text}${ecgFilterText} · ${els.paperSelect.value} mm/s`;
}

function renderAnnotations() {
  els.annotationList.innerHTML = "";
  if (!state.annotations.length) {
    els.annotationList.innerHTML = "<div class='annotation-row empty'><small>No annotations</small></div>";
    return;
  }
  for (const row of state.annotations) {
    const div = document.createElement("div");
    const isSource = row.source === "file" || row.readOnly;
    div.className = `annotation-row${isSource ? " source-annotation" : ""}`;
    div.tabIndex = 0;
    const dur = Number(row.duration || 0);
    const onset = preciseNumber(row.onset || 0);
    const note = row.note || "";
    const startText = formatSec(onset);
    const durationText = dur ? `+${dur.toFixed(3)}s` : "";
    const timeText = `${startText}${durationText ? ` ${durationText}` : ""}`;
    const label = row.label || "annotation";
    const channel = row.channel || (isSource ? "file" : "-");
    const comment = note || (isSource ? "embedded annotation" : "(no comment)");
    div.title = `${timeText}  ${label}  ${channel}  ${comment}`;
    div.innerHTML = `
      <span class="annotation-time">${escapeHtml(startText)}</span>
      <span class="annotation-duration">${escapeHtml(durationText)}</span>
      <strong class="annotation-label">${escapeHtml(label)}</strong>
      <small class="annotation-channel">${escapeHtml(channel)}</small>
      <span class="annotation-note">${escapeHtml(comment)}</span>
      <div class="annotation-actions">
        ${isSource ? "" : `<button data-edit="${row.id}">Edit</button><button data-delete="${row.id}">Del</button>`}
      </div>
    `;
    div.addEventListener("click", () => jumpToAnnotation(row));
    div.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        jumpToAnnotation(row);
      }
    });
    div.querySelector("[data-delete]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      deleteAnnotation(row.id, { confirm: true });
    });
    div.querySelector("[data-edit]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      editAnnotation(row);
    });
    div.addEventListener("contextmenu", (ev) => openAnnotationContextMenu(ev, row));
    els.annotationList.appendChild(div);
  }
}

async function loadScalogram() {
  return;
}

function renderScalogram() {
  return;
}

function renderTopomaps() {
  return;
}

function resizeTopomapCanvases() {
  return;
}

function applyTopomapLayout() {
  return;
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
    els.calReadout.textContent = `${sensitivityValue()} uV/mm · TC ${tcText()} · AC ${els.acSelect?.value || ""} · ${els.paperSelect?.value || "30"} mm/s`;
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
      drawWaveColumn(ctx, layout, displayTraces(view.traces || []), state.windowData?.times || [], {
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
  drawCalibration(ctx, left, top, plotW, plotH, duration, sensitivity, pxPerMm, ratio);
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
  drawAnnotations(ctx, left, top, plotW, plotH, start, duration);
  drawScalogramSelection(ctx, left, top, plotW, plotH, start, duration, ratio);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, plotW, plotH);
  ctx.clip();
  traces.forEach((trace, rowIndex) => {
    const centerY = top + rowH * (rowIndex + 0.5);
    const yScale = pxPerMm / Math.max(1e-6, traceUvPerMm(trace, sensitivity));
    drawViewerWaveformPath(ctx, trace.values, times, {
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
    const labelX = layout.labelLeft ?? (45 * ratio);
    const maxW = layout.labelMaxW ?? Math.max(45 * ratio, plotW - (labelX - left) - 3 * ratio);
    ctx.fillText(nkLabel(trace.label), labelX, centerY + labelPx * 0.35, maxW);
  });

  drawAnnotationLabels(ctx, left, top, plotW, plotH, start, duration, ratio);
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

function drawAnnotations(ctx, left, top, plotW, plotH, start, duration) {
  const end = start + duration;
  for (const ann of state.annotations) {
    const onset = Number(ann.onset || 0);
    const annEnd = onset + Number(ann.duration || 0);
    if (annEnd < start || onset > end) continue;
    const x = left + ((onset - start) / duration) * plotW;
    const isSource = ann.source === "file" || ann.readOnly;
    ctx.strokeStyle = isSource ? "#2d6792" : "#b0362f";
    ctx.fillStyle = isSource ? "rgba(45,103,146,.14)" : "rgba(176,54,47,.16)";
    if (ann.duration) {
      const x2 = left + ((annEnd - start) / duration) * plotW;
      ctx.fillRect(x, top, Math.max(2, x2 - x), plotH);
    }
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + plotH);
    ctx.stroke();
  }
}

function drawAnnotationLabels(ctx, left, top, plotW, plotH, start, duration, ratio) {
  const end = start + duration;
  ctx.save();
  ctx.font = `${11 * ratio}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  for (const ann of state.annotations) {
    const onset = Number(ann.onset || 0);
    const annEnd = onset + Number(ann.duration || 0);
    if (annEnd < start || onset > end) continue;
    const x = left + ((onset - start) / duration) * plotW;
    const isSource = ann.source === "file" || ann.readOnly;
    ctx.fillStyle = isSource ? "#245477" : "#8a1f19";
    ctx.fillText(ann.label || "event", x + 3 * ratio, top + plotH - 5 * ratio, Math.max(24 * ratio, left + plotW - x - 6 * ratio));
  }
  ctx.restore();
}

function drawScalogramSelection(ctx, left, top, plotW, plotH, start, duration, ratio) {
  if ((state.researchMode === "test" && state.researchSession) || (state.researchMode === "validation" && state.validationSession)) return;
  const selection = state.dragSelection || state.topomapSelection || state.scalogramSelection;
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

function drawEventStrip() {
  const duration = visibleDuration();
  const start = state.start;
  const end = start + duration;
  const ticks = state.annotations
    .filter((ann) => Number(ann.onset || 0) >= start && Number(ann.onset || 0) <= end)
    .map((ann) => {
      const pct = ((Number(ann.onset || 0) - start) / duration) * 100;
      const cls = ann.source === "file" || ann.readOnly ? " class=\"source-event\"" : "";
      return `<span${cls} title="${escapeHtml(ann.label || "event")}" style="left:${pct}%"></span>`;
    })
    .join("");
  els.eventStrip.innerHTML = ticks;
}

const TOPO_POSITIONS = {};

function renderTopomaps() {
  return;
}

function renderFzSpikeTopomap() {
  return;
}

async function loadFzSpikeTopomap() {
  return;
}

function loadPreciseTopomap() {
  return;
}

function setTopomapSelection() {
  return false;
}

function onWaveMouseDown(ev) {
  if (ev.button !== 0 || !state.windowData?.traces?.length) return;
  if ((state.researchMode === "test" && state.researchSession) || (state.researchMode === "validation" && state.validationSession)) {
    state.dragSelection = null;
    state.suppressNextClick = false;
    return;
  }
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reloadScalogram: false });
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
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reloadScalogram: false });
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

function defaultScalogramSelection(centerTime) {
  const total = recordingDuration();
  const visible = Math.max(0.05, visibleDuration() || 1);
  const duration = Math.min(1, visible, total || visible);
  const center = Number.isFinite(Number(centerTime)) ? Number(centerTime) : state.start + visible / 2;
  let start = center - duration / 2;
  start = Math.max(0, start);
  if (total) start = Math.min(start, Math.max(0, total - duration));
  return {
    start: preciseNumber(start),
    duration: preciseNumber(Math.max(0.05, duration)),
  };
}

function normalizeScalogramSelection(selection) {
  const total = recordingDuration();
  const visibleEnd = state.start + visibleDuration();
  const limit = total || visibleEnd;
  const rawStart = Number(selection?.start);
  const rawDuration = Number(selection?.duration);
  if (!Number.isFinite(rawStart)) return null;
  const start = Math.max(0, Math.min(rawStart, Math.max(0, limit)));
  const minDuration = 0.002;
  const duration = Math.max(minDuration, Number.isFinite(rawDuration) ? rawDuration : 1);
  const end = Math.min(limit, start + duration);
  return {
    start: preciseNumber(Math.max(0, Math.min(start, Math.max(0, end - minDuration)))),
    duration: preciseNumber(Math.max(minDuration, end - start)),
  };
}

function setScalogramSelection(selection, options = {}) {
  const normalized = normalizeScalogramSelection(selection);
  if (!normalized) return false;
  state.scalogramSelection = normalized;
  state.scalogramData = null;
  if (Number.isFinite(Number(options.cursorTime))) {
    state.cursorTime = Number(options.cursorTime);
  } else {
    state.cursorTime = normalized.start;
  }
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = true;
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = true;
  if (els.rangeCancelBtn) els.rangeCancelBtn.disabled = false;
  showEventControls();
  if (options.drawWave !== false) draw();
  return true;
}

function openContextMenu(ev) {
  ev.preventDefault();
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reloadScalogram: false });
  const annotation = nearestAnnotation(point.onset);
  state.context = { ...point, annotationId: annotation?.id || "", annotation };
  if (state.researchMode === "validation" && state.validationSession) renderValidationRatingContextMenu();
  else if (state.researchMode === "test" && state.researchSession) renderResearchRatingContextMenu();
  else renderWaveContextMenu(annotation);
  els.contextMenu.style.left = `${ev.clientX}px`;
  els.contextMenu.style.top = `${ev.clientY}px`;
  els.contextMenu.classList.remove("hidden");
}

function openResearchRatingMenu(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reloadScalogram: false });
  state.cursorTime = point.onset;
  state.context = { ...point, annotationId: "", annotation: null };
  draw();
  renderResearchRatingContextMenu();
  setStatus(`Selected ${point.channel || point.montageChannel || "waveform"} at ${formatSec(point.onset)}`);
  els.contextMenu.style.left = `${ev.clientX}px`;
  els.contextMenu.style.top = `${ev.clientY}px`;
  els.contextMenu.classList.remove("hidden");
}

function openAnnotationContextMenu(ev, annotation) {
  ev.preventDefault();
  ev.stopPropagation();
  state.context = { annotationId: annotation.id, annotation };
  if (state.researchMode === "validation" && state.validationSession) renderValidationRatingContextMenu();
  else if (state.researchMode === "test" && state.researchSession) renderResearchRatingContextMenu();
  else renderAnnotationContextMenu(annotation);
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
  if (state.researchMode === "validation" && state.validationSession) {
    return;
  }
  if (state.researchMode === "test" && state.researchSession) {
    openResearchRatingMenu(ev);
    return;
  }
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reloadScalogram: false });
  state.cursorTime = point.onset;
  draw();
}

function onWaveDoubleClick(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  const point = canvasToData(ev);
  if (isMultiMontageMode()) setActiveMontage(point.montage, { reloadScalogram: false });
  state.rangeStart = null;
  state.dragSelection = null;
  state.suppressNextClick = true;
  hideContextMenu();
  state.cursorTime = point.onset;
  draw();
}

function hideContextMenu() {
  els.contextMenu.classList.add("hidden");
}

function renderAnnotationContextMenu(annotation) {
  const label = annotation.label || "annotation";
  const time = formatSec(Number(annotation.onset || 0));
  if (annotation.readOnly) {
    els.contextMenu.innerHTML = `
      <button data-action="jump-annotation">Go to ${escapeHtml(label)} at ${escapeHtml(time)}</button>
    `;
    return;
  }
  els.contextMenu.innerHTML = `
    <button data-action="edit-annotation">Edit ${escapeHtml(label)} at ${escapeHtml(time)}</button>
    <button data-action="delete-annotation" class="danger-action">Delete annotation</button>
  `;
}

function renderWaveContextMenu(annotation) {
  const deleteButton = annotation
    ? `<button data-action="delete-annotation" class="danger-action">Delete ${escapeHtml(annotation.label || "annotation")} at ${escapeHtml(formatSec(Number(annotation.onset || 0)))}</button><hr />`
    : "";
  els.contextMenu.innerHTML = `
    ${deleteButton}
    <button data-action="point" data-label="spike">spike</button>
    <button data-action="point" data-label="focal">focal</button>
    <button data-action="point" data-label="generalized">generalized</button>
    <button data-action="point" data-label="seizure onset">seizure onset</button>
    <button data-action="point" data-label="seizure end">seizure end</button>
    <button data-action="point" data-label="artifact">artifact</button>
    <button data-action="point" data-label="sleep stage">sleep stage</button>
    <button data-action="point" data-label="ECG artifact">ECG artifact</button>
    <button data-action="point" data-label="comment">comment</button>
    <hr />
    <button data-action="range-start">Start range here</button>
    <button data-action="range-end">End range here</button>
  `;
}

function nearestAnnotation(onset) {
  const duration = visibleDuration();
  const threshold = Math.max(0.05, duration * 0.015);
  let nearest = null;
  let nearestDistance = Infinity;
  for (const ann of state.annotations) {
    const annStart = Number(ann.onset || 0);
    const annEnd = annStart + Number(ann.duration || 0);
    const distance = onset >= annStart && onset <= annEnd ? 0 : Math.min(Math.abs(onset - annStart), Math.abs(onset - annEnd));
    if (distance < nearestDistance && distance <= threshold) {
      nearest = ann;
      nearestDistance = distance;
    }
  }
  return nearest;
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
  hideContextMenu();
  if (action === "research-rating") {
    saveResearchRating(rating);
    return;
  }
  if (action === "validation-rating") {
    saveValidationRating(rating, "manual_override");
    return;
  }
  if (action === "delete-annotation") {
    if (state.context.annotationId) deleteAnnotation(state.context.annotationId, { confirm: true });
    return;
  }
  if (action === "edit-annotation") {
    if (state.context.annotation) editAnnotation(state.context.annotation);
    return;
  }
  if (action === "jump-annotation") {
    if (state.context.annotation) jumpToAnnotation(state.context.annotation);
    return;
  }
  if (action === "range-start") {
    state.rangeStart = { ...state.context };
    els.rangeCancelBtn.disabled = false;
    showEventControls();
    draw();
    return;
  }
  if (action === "range-end") {
    if (!state.rangeStart) return;
    const start = Math.min(state.rangeStart.onset, state.context.onset);
    const stop = Math.max(state.rangeStart.onset, state.context.onset);
    const startPoint = state.rangeStart.onset <= state.context.onset ? state.rangeStart : state.context;
    openAnnotationDialog({
      label: "artifact",
      onset: start,
      sampleIndex: startPoint.sampleIndex,
      sfreq: startPoint.sfreq,
      duration: preciseNumber(stop - start),
      channel: state.rangeStart.channel,
      montageChannel: state.rangeStart.montageChannel,
      montage: startPoint.montage || state.rangeStart.montage || activeMontageValue(),
    });
    state.rangeStart = null;
    els.rangeCancelBtn.disabled = true;
    return;
  }
  if (action === "point") {
    openAnnotationDialog({
      label,
      onset: state.context.onset,
      duration: 0,
      channel: state.context.channel,
      montageChannel: state.context.montageChannel,
      montage: state.context.montage || activeMontageValue(),
    });
  }
}

function openAnnotationDialog(annotation) {
  state.pendingAnnotation = annotation;
  els.dialogTitle.textContent = annotation.id ? "Edit annotation" : "New annotation";
  els.annotationLabel.value = annotation.label || "";
  els.annotationNote.value = annotation.note || "";
  els.annotationDialog.showModal();
}

async function saveDialogAnnotation() {
  const annotation = {
    ...state.pendingAnnotation,
    label: els.annotationLabel.value.trim() || "comment",
    note: els.annotationNote.value.trim(),
    settings: {
      montage: state.pendingAnnotation?.montage || activeMontageValue(),
      sensitivityUvPerMm: sensitivityValue(),
      tc: els.tcSelect.value,
      hf: els.hfSelect.value,
      ac: els.acSelect.value,
      timebaseSec: Number(els.durationSelect.value),
      paperSpeedMmPerSec: Number(els.paperSelect.value),
    },
  };
  const action = annotation.id ? "update" : "add";
  const manualAnnotations = await fetchJson(`/api/annotations?${qs({ id: state.recordingId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, annotation }),
  });
  els.annotationDialog.close();
  applyManualAnnotationUpdate(manualAnnotations);
}

function editAnnotation(annotation) {
  if (annotation?.readOnly) return;
  openAnnotationDialog({ ...annotation });
}

async function deleteAnnotation(id, options = {}) {
  if (!id) return;
  const annotation = state.annotations.find((row) => row.id === id);
  if (annotation?.readOnly) return;
  if (options.confirm && !window.confirm("Delete this annotation?")) return;
  const manualAnnotations = await fetchJson(`/api/annotations?${qs({ id: state.recordingId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  applyManualAnnotationUpdate(manualAnnotations);
}

function exportJson() {
  downloadFromUrl(`/api/annotations.json?${qs({ id: state.recordingId })}`, `${state.recordingId}.annotations.json`);
}

function exportViewerJpeg() {
  if (!els.waveCanvas) return;
  const start = Number.isFinite(Number(state.start)) ? Number(state.start).toFixed(3) : "window";
  exportCanvasAsJpeg(els.waveCanvas, `${state.recordingId}.viewer_${start}s.jpg`);
}

function exportTopomapJpeg() {
  if (!state.preciseTopomap?.available) {
    window.alert("Topomap data is not available yet.");
    return;
  }
  const items = [{ label: els.earlobeTopomapTitle?.textContent || "System reference", canvas: els.systemTopomapCanvas }].filter((item) => item.canvas);
  const start = Number(currentTopomapInterval()?.start || 0).toFixed(3);
  exportCanvasGroupAsJpeg(items, `${state.recordingId}.topomap_${start}s.jpg`, {
    title: `Topomap ${formatSec(currentTopomapInterval()?.start || 0)}`,
  });
}

function exportScalogramJpeg() {
  if (!state.scalogramData?.available) return;
  const panel = document.querySelector(".scalogram-panel");
  const items = Array.from(panel?.querySelectorAll("canvas") || [])
    .filter((canvas) => canvas.width > 0 && canvas.height > 0 && isElementVisible(canvas))
    .map((canvas) => ({ label: canvasExportLabel(canvas), canvas }));
  if (!items.length) return;
  const start = Number.isFinite(Number(state.scalogramData.start)) ? Number(state.scalogramData.start).toFixed(3) : "selection";
  exportCanvasGroupAsJpeg(items, `${state.recordingId}.${state.analysisKind}_${start}s.jpg`, {
    title: `${state.analysisKind} ${formatSec(state.scalogramData.start || 0)} + ${Number(state.scalogramData.duration || 0).toFixed(3)}s`,
  });
}

async function importJson(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const text = await file.text();
  const annotations = JSON.parse(text);
  const manualAnnotations = await fetchJson(`/api/annotations?${qs({ id: state.recordingId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replace", annotations }),
  });
  applyManualAnnotationUpdate(manualAnnotations);
  ev.target.value = "";
}

function downloadBlob(blob, filename) {
  saveBlobToDesktop(blob, filename).catch((err) => {
    console.error(err);
    window.alert(err.message || "Export failed");
  });
}

async function downloadFromUrl(url, filename) {
  try {
    const headers = new Headers();
    if (REQUEST_TOKEN) headers.set("X-EEG-Viewer-Token", REQUEST_TOKEN);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(res.statusText || "Export failed");
    await saveBlobToDesktop(await res.blob(), filename);
  } catch (err) {
    console.error(err);
    window.alert(err.message || "Export failed");
  }
}

async function saveBlobToDesktop(blob, filename) {
  const contentBase64 = await blobToBase64(blob);
  const result = await fetchJson("/api/export-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, mimeType: blob.type || "application/octet-stream", contentBase64 }),
  });
  setStatus(`Saved to Desktop: ${result.path || result.filename || filename}`);
  return result;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      resolve(text.includes(",") ? text.split(",").pop() : text);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read export file"));
    reader.readAsDataURL(blob);
  });
}

function canvasToWhiteJpegBlob(sourceCanvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) {
      reject(new Error("Canvas is empty"));
      return;
    }
    const out = document.createElement("canvas");
    out.width = sourceCanvas.width;
    out.height = sourceCanvas.height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(sourceCanvas, 0, 0);
    out.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create JPEG"));
    }, "image/jpeg", quality);
  });
}

async function exportCanvasAsJpeg(canvas, filename) {
  try {
    await saveBlobToDesktop(await canvasToWhiteJpegBlob(canvas), filename);
  } catch (err) {
    console.error(err);
    window.alert(err.message || "JPEG export failed");
  }
}

async function exportCanvasGroupAsJpeg(items, filename, options = {}) {
  try {
    const valid = (items || []).filter((item) => item.canvas?.width && item.canvas?.height);
    if (!valid.length) throw new Error("No canvas data to export");
    const padding = 24;
    const gap = 18;
    const labelH = 22;
    const titleH = options.title ? 34 : 0;
    const width = Math.max(360, ...valid.map((item) => item.canvas.width)) + padding * 2;
    const height = padding * 2 + titleH + valid.reduce((sum, item) => sum + labelH + item.canvas.height + gap, 0) - gap;
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#26313b";
    ctx.font = "600 18px system-ui, -apple-system, sans-serif";
    let y = padding;
    if (options.title) {
      ctx.fillText(String(options.title), padding, y + 18);
      y += titleH;
    }
    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    for (const item of valid) {
      ctx.fillStyle = "#3f4952";
      ctx.fillText(String(item.label || "Canvas").slice(0, 120), padding, y + 14);
      y += labelH;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(padding, y, item.canvas.width, item.canvas.height);
      ctx.drawImage(item.canvas, padding, y);
      y += item.canvas.height + gap;
    }
    await saveBlobToDesktop(await canvasToWhiteJpegBlob(out), filename);
  } catch (err) {
    console.error(err);
    window.alert(err.message || "JPEG export failed");
  }
}

function isElementVisible(el) {
  let current = el;
  while (current && current !== document.body) {
    if (current.hidden) return false;
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

function canvasExportLabel(canvas) {
  if (canvas === els.scalogramDetailCanvas) return els.scalogramDetailTitle?.textContent || "Scalogram detail";
  if (canvas === els.fzSpikeTopomapCanvas) return els.fzSpikeTopomapTitle?.textContent || "Fz spike topomap";
  if (canvas === els.fzAfterSlowTopomapCanvas) return els.fzAfterSlowTopomapTitle?.textContent || "Fz after-slow topomap";
  const card = canvas.closest(".scalogram-card, .psd-card, .attenuation-card, .topomap-card");
  const title = card?.querySelector(".scalogram-channel, .psd-channel, .attenuation-channel, .topomap-title");
  return title?.textContent?.trim() || canvas.id || "Canvas";
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
  if (montage === "conventional" || montage === "conventional_average") {
    const label = String(trace.label || "");
    if (/(^|-)Fz($|-)|(^|-)Cz($|-)/.test(label)) return "#23734f";
    if (trace.group === "midline") return "#303030";
    if (trace.group === "left_temporal" || trace.group === "left_parasagittal") return "#1b3298";
    if (trace.group === "right_temporal" || trace.group === "right_parasagittal") return "#b4232d";
  }
  if (montage === "transverse") {
    if (trace.group === "left_temporal" || trace.group === "left_parasagittal") return "#344bc2";
    if (trace.group === "right_temporal" || trace.group === "right_parasagittal") return "#bf3f4c";
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
