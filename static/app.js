const REQUEST_TOKEN = document.querySelector('meta[name="eeg-viewer-token"]')?.content || "";
const SETTINGS_KEY = "eegViewerSettings.v1";
const RECENT_FILES_KEY = "eegViewerRecentFiles.v1";
const PANEL_WIDTHS_KEY = "eegViewerPanelWidths.v1";
const ANNOTATION_LIST_HEIGHT_KEY = "eegViewerAnnotationListHeight.v1";
const RESEARCH_PROFILE_KEY = "eegViewerResearchProfile.v1";
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
  selectedScalogramIndex: 0,
  suppressNextClick: false,
  lastWaveWheelPageAt: 0,
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
  exportSpikeCsvBtn: document.getElementById("exportSpikeCsvBtn"),
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
  exportTopomapCsvBtn: document.getElementById("exportTopomapCsvBtn"),
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
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  importJsonInput: document.getElementById("importJsonInput"),
  exportViewerJpegBtn: document.getElementById("exportViewerJpegBtn"),
  workspace: document.querySelector(".workspace"),
  panelResizeHandles: Array.from(document.querySelectorAll("[data-resize-panel]")),
  researchModeButtons: Array.from(document.querySelectorAll("[data-research-mode]")),
  researchDatasetPathInput: document.getElementById("researchDatasetPathInput"),
  researchIedsPresentPathInput: document.getElementById("researchIedsPresentPathInput"),
  researchIedsAbsentPathInput: document.getElementById("researchIedsAbsentPathInput"),
  researchSetupScreen: document.getElementById("researchSetupScreen"),
  researchSetupMessage: document.getElementById("researchSetupMessage"),
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

async function init() {
  restorePanelWidths();
  restoreAnnotationListHeight();
  scheduleLayoutRefresh();
  window.addEventListener("resize", scheduleLayoutRefresh);
  if (window.ResizeObserver && els.waveCanvas?.parentElement) {
    const observer = new ResizeObserver(scheduleLayoutRefresh);
    observer.observe(els.waveCanvas.parentElement);
  }
  restoreSettings();
  applyWorkspaceMode({ redraw: false });
  applyRightPanelTab();
  applyRightPanelVisibility({ redraw: false });
  applyScalogramVisibility({ redraw: false });
  applyTopomapLayout();
  restoreRecentFiles();
  restoreResearchProfile();
  state.rightPanelVisible = false;
  if (els.recordingLabel) els.recordingLabel.hidden = true;
  bindControls();
  bindPanelResizers();
  setResearchMode("test");
  await loadRecordings();
}

function scheduleLayoutRefresh() {
  const refresh = () => {
    resizeCanvas();
    resizeTopomapCanvases();
    draw();
    renderScalogram();
    renderTopomaps();
  };
  requestAnimationFrame(() => {
    refresh();
    requestAnimationFrame(refresh);
  });
  window.setTimeout(refresh, 80);
  window.setTimeout(refresh, 300);
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

  els.prevBtn.addEventListener("click", () => {
    pageWaveform(-1);
  });
  els.nextBtn.addEventListener("click", () => {
    pageWaveform(1);
  });
  els.stepBackBtn.addEventListener("click", () => {
    state.start = clampStart(state.start - 1);
    state.cursorTime = null;
    loadWindow();
  });
  els.stepForwardBtn.addEventListener("click", () => {
    state.start = clampStart(state.start + 1);
    state.cursorTime = null;
    loadWindow();
  });
  els.reloadBtn?.addEventListener("click", loadWindow);
  els.loadFileBtn.addEventListener("click", openFileFromPath);
  if (els.clearFilePathBtn) {
    els.clearFilePathBtn.addEventListener("click", () => {
      els.filePathInput.value = "";
      els.filePathInput.focus();
    });
  }
  els.recentFileSelect.addEventListener("change", () => {
    const path = els.recentFileSelect.value;
    if (!path) return;
    els.filePathInput.value = path;
    openFileFromPath();
  });
  els.filePathInput.addEventListener("keydown", (ev) => {
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
  els.rangeCancelBtn.addEventListener("click", () => {
    state.rangeStart = null;
    state.dragSelection = null;
    state.scalogramSelection = null;
    state.scalogramData = null;
    els.rangeCancelBtn.disabled = true;
    hideContextMenu();
    draw();
    renderScalogram();
  });

  els.waveCanvas.addEventListener("contextmenu", openContextMenu);
  els.waveCanvas.addEventListener("mousedown", onWaveMouseDown);
  els.waveCanvas.addEventListener("mousemove", onWaveMouseMove);
  els.waveCanvas.addEventListener("mouseup", onWaveMouseUp);
  window.addEventListener("mouseup", onWaveMouseUp);
  els.waveCanvas.addEventListener("mouseleave", onWaveMouseLeave);
  els.waveCanvas.addEventListener("wheel", onWaveWheel, { passive: false });
  els.waveCanvas.addEventListener("click", onWaveClick);
  els.waveCanvas.addEventListener("dblclick", onWaveDoubleClick);
  if (els.waveScrollbar) {
    els.waveScrollbar.addEventListener("input", onWaveScrollbarInput);
    els.waveScrollbar.addEventListener("change", onWaveScrollbarChange);
  }
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", (ev) => {
    if (!els.contextMenu.contains(ev.target)) hideContextMenu();
  });
  els.contextMenu.addEventListener("click", onContextMenuClick);

  els.saveAnnotationBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    saveDialogAnnotation();
  });
  els.annotationDialog.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.isComposing) return;
    if (ev.target === els.annotationNote && ev.shiftKey) return;
    if (ev.target instanceof HTMLButtonElement) return;
    ev.preventDefault();
    saveDialogAnnotation();
  });

  els.exportJsonBtn.addEventListener("click", exportJson);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  if (els.sourceAnnotationToggle) {
    els.sourceAnnotationToggle.addEventListener("change", () => {
      state.showSourceAnnotations = els.sourceAnnotationToggle.checked;
      saveSettings();
      applyAnnotationVisibility();
    });
  }
  if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.addEventListener("click", exportSpikeCsv);
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.addEventListener("click", exportAnalysisJson);
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.addEventListener("click", exportScalogramJpeg);
  if (els.rightPanelToggleBtn) {
    els.rightPanelToggleBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleRightPanel();
    });
  }
  for (const btn of els.analysisKindButtons || []) {
    btn.addEventListener("click", () => {
      state.analysisKind = btn.dataset.analysisKind || "scalogram";
      state.scalogramData = null;
      renderScalogram();
      if (state.scalogramSelection) loadScalogram();
    });
  }
  for (const btn of els.scalogramModeButtons || []) {
    btn.addEventListener("click", () => {
      state.scalogramMode = btn.dataset.scalogramMode || "signed";
      renderScalogram();
    });
  }
  for (const btn of els.scalogramScopeButtons || []) {
    btn.addEventListener("click", () => {
      state.scalogramDisplayScope = "all";
      saveSettings();
      renderScalogram();
    });
  }
  for (const btn of els.scalogramDetectionButtons || []) {
    btn.addEventListener("click", () => {
      state.scalogramDetectionMode = btn.dataset.scalogramDetection || "both";
      renderScalogram();
    });
  }
  for (const btn of els.attenuationScaleButtons || []) {
    btn.addEventListener("click", () => {
      state.attenuationScaleMode = btn.dataset.attenuationScale === "z" ? "z" : "db";
      saveSettings();
      renderScalogram();
    });
  }
  for (const btn of els.attenuationPresetButtons || []) {
    btn.addEventListener("click", () => applyAttenuationPreset(btn.dataset.attenuationPreset || "balanced"));
  }
  for (const btn of els.stftScaleButtons || []) {
    btn.addEventListener("click", () => {
      state.stftScaleMode = btn.dataset.stftScale === "z" ? "z" : "db";
      saveSettings();
      renderScalogram();
    });
  }
  for (const btn of els.scalogramPresetButtons || []) {
    btn.addEventListener("click", () => applyScalogramPreset(btn.dataset.scalogramPreset || "balanced"));
  }
  for (const btn of els.stftPresetButtons || []) {
    btn.addEventListener("click", () => applyStftPreset(btn.dataset.stftPreset || "balanced"));
  }
  [els.attenuationFreqLowInput, els.attenuationFreqHighInput].filter(Boolean).forEach((input) => {
    input.addEventListener("change", onAttenuationFreqInputChange);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        input.blur();
        onAttenuationFreqInputChange();
      }
    });
  });
  for (const input of [els.attenuationBaselineSecInput, els.attenuationFreqStepInput, els.attenuationTimeBinsInput].filter(Boolean)) {
    input.addEventListener("input", onAttenuationTuningInput);
    input.addEventListener("change", onAttenuationTuningChange);
  }
  [els.psdFreqLowInput, els.psdFreqHighInput].filter(Boolean).forEach((input) => {
    input.addEventListener("change", onPsdFreqInputChange);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        input.blur();
        onPsdFreqInputChange();
      }
    });
  });
  [els.stftFreqLowInput, els.stftFreqHighInput].filter(Boolean).forEach((input) => {
    input.addEventListener("change", onStftFreqInputChange);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        input.blur();
        onStftFreqInputChange();
      }
    });
  });
  if (els.stftPowerGainInput) {
    els.stftPowerGainInput.addEventListener("input", onStftPowerGainInput);
    els.stftPowerGainInput.addEventListener("change", () => {
      state.stftPowerGain = normalizeStftPowerGain(els.stftPowerGainInput.value);
      syncStftPowerGainInput();
      saveSettings();
      renderScalogram();
    });
  }
  if (els.scalogramFreqStepInput) {
    els.scalogramFreqStepInput.addEventListener("input", onScalogramTuningInput);
    els.scalogramFreqStepInput.addEventListener("change", onScalogramTuningChange);
  }
  if (els.scalogramTimeBinsInput) {
    els.scalogramTimeBinsInput.addEventListener("input", onScalogramTuningInput);
    els.scalogramTimeBinsInput.addEventListener("change", onScalogramTuningChange);
  }
  if (els.stftWindowMsInput) {
    els.stftWindowMsInput.addEventListener("input", onStftTuningInput);
    els.stftWindowMsInput.addEventListener("change", onStftTuningChange);
  }
  if (els.stftOverlapPctInput) {
    els.stftOverlapPctInput.addEventListener("input", onStftTuningInput);
    els.stftOverlapPctInput.addEventListener("change", onStftTuningChange);
  }
  if (els.fzPeakWindowMsInput) {
    els.fzPeakWindowMsInput.addEventListener("input", onFzPeakWindowInput);
    els.fzPeakWindowMsInput.addEventListener("change", onFzPeakWindowChange);
  }
  if (els.exportTopomapJsonBtn) els.exportTopomapJsonBtn.addEventListener("click", exportTopomapJson);
  if (els.exportTopomapCsvBtn) els.exportTopomapCsvBtn.addEventListener("click", exportTopomapCsv);
  if (els.exportTopomapJpegBtn) els.exportTopomapJpegBtn.addEventListener("click", exportTopomapJpeg);
  if (els.exportViewerJpegBtn) els.exportViewerJpegBtn.addEventListener("click", exportViewerJpeg);
  els.importJsonInput.addEventListener("change", importJson);
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
  els.researchEpochCountInput?.addEventListener("change", saveResearchEpochCount);
  els.researchCompleteExportCsvBtn?.addEventListener("click", exportResearchJson);
  els.researchCopyEmailBtn?.addEventListener("click", copyResearchEmailBody);
  els.researchTutorialDismissBtn?.addEventListener("click", () => {
    state.researchTutorialDismissed = true;
    updateResearchTutorial();
  });
  els.researchUndoBtn?.addEventListener("click", undoResearchResponse);
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
    [els.researchSetupEpochCountInput, "各群の問題数"],
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
  try {
    const profile = JSON.parse(localStorage.getItem(RESEARCH_PROFILE_KEY) || "{}");
    return profile && typeof profile === "object" ? profile : {};
  } catch {
    return {};
  }
}

function safeCsvFilenamePart(value, fallback = "reader") {
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

function researchCsvFilename(readerId, profile = researchProfile()) {
  const readerName = safeCsvFilenamePart(profile.readerName || profile.doctorName || readerId, "reader");
  return `${readerName}.csv`;
}

function researchJsonFilename(readerId, profile = researchProfile()) {
  const readerName = safeCsvFilenamePart(profile.readerName || profile.doctorName || readerId, "reader");
  return `${readerName}.json`;
}

function saveResearchProfile() {
  try {
    localStorage.setItem(RESEARCH_PROFILE_KEY, JSON.stringify(researchProfile()));
  } catch {
    // Ignore private-mode storage failures.
  }
}

function saveUsualResearchMontage(montage) {
  const value = String(montage || "").trim() || activeMontageValue();
  if (!value) return "";
  try {
    const profile = { ...storedResearchProfile(), ...researchProfile(), usualMontage: value };
    localStorage.setItem(RESEARCH_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore private-mode storage failures.
  }
  if (els.researchSetupMontageSelect) els.researchSetupMontageSelect.value = value;
  return value;
}

function restoreResearchProfile() {
  const profile = storedResearchProfile();
  if (els.researchOutputPathInput) els.researchOutputPathInput.value = profile.outputPath || "";
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
  state.researchMontageTiming = {
    lastAtMs: performance.now(),
    activeMontages: currentResearchDisplayedMontages(),
    totalsSec: {},
  };
}

function updateResearchMontageTiming(nextMontages = currentResearchDisplayedMontages()) {
  const timing = state.researchMontageTiming;
  if (!timing) return;
  const now = performance.now();
  const elapsedSec = Math.max(0, (now - Number(timing.lastAtMs || now)) / 1000);
  for (const montage of timing.activeMontages || []) {
    timing.totalsSec[montage] = Number(timing.totalsSec[montage] || 0) + elapsedSec;
  }
  timing.lastAtMs = now;
  timing.activeMontages = [...new Set((nextMontages || []).filter(Boolean))];
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
  return {
    displayedMontages: Object.keys(totals),
    montageDurationsSec: totals,
    montageDurationSummary: summary,
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
  setResearchControlVisible(els.researchIedsPresentPathInput, !datasetMode && !validationMode);
  setResearchControlVisible(els.researchIedsAbsentPathInput, !datasetMode && !validationMode);
  if (els.researchDatasetPathInput) {
    els.researchDatasetPathInput.placeholder = validationMode ? "validation dataset folder" : "output folder";
    els.researchDatasetPathInput.title = validationMode ? "Dataset folder containing dataset.json" : "Output folder for cut EDF epochs";
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
    "脳波読影テストの結果JSONを送付します。",
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
      ? "Validation結果JSONをDesktopに保存してください。"
      : "結果JSONをDesktopに保存し、メールに添付して送信してください。";
  }
  if (els.researchMailBox) els.researchMailBox.hidden = validationMode;
  if (els.researchCopyEmailBtn) els.researchCopyEmailBtn.hidden = validationMode;
  if (els.researchCompleteExportCsvBtn) els.researchCompleteExportCsvBtn.textContent = validationMode ? "Validation JSONをDesktopに保存" : "結果JSONをDesktopに保存";
  if (!validationMode) updateResearchEmailBody();
  if (els.researchSavedCsvName) {
    els.researchSavedCsvName.textContent = "JSONはまだ保存されていません。";
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
  const sampleCount = dataset.settings?.phase1SamplePerGroup || session?.samplePerGroup || 20;
  syncResearchDesignControls(dataset.settings || {});
  const validationSession = state.validationSession;
  const answered = state.researchMode === "validation" && validationSession
    ? `${validationSession.answeredCount || 0}/${validationSession.totalCount || cases.length} validated`
    : (session ? `${session.answeredCount || 0}/${session.totalCount || cases.length}` : `${cases.filter((row) => row.include !== false).length}/${cases.length} included · ${sampleCount}/group`);
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
  const sampleCount = Number(settings.phase1SamplePerGroup || 20);
  if (els.researchDesignEpochCountInput) els.researchDesignEpochCountInput.value = String(sampleCount);
  if (els.researchEpochCountInput) els.researchEpochCountInput.value = String(sampleCount);
}

function researchDesignSettings() {
  const samplePerGroup = Math.max(1, Math.min(500, Number(els.researchDesignEpochCountInput?.value || els.researchSetupEpochCountInput?.value || els.researchEpochCountInput?.value || 20)));
  return {
    phase1SamplePerGroup: samplePerGroup,
  };
}

async function saveResearchTestDesign(datasetPathOverride = "") {
  const datasetPath = datasetPathOverride || state.researchDatasetPath || els.researchDatasetPathInput?.value.trim() || "";
  if (!datasetPath) return;
  const settings = researchDesignSettings();
  if (els.researchDesignEpochCountInput) els.researchDesignEpochCountInput.value = String(settings.phase1SamplePerGroup);
  if (els.researchEpochCountInput) els.researchEpochCountInput.value = String(settings.phase1SamplePerGroup);
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

function renderResearchProgress() {
  if (!els.researchTestProgress) return;
  const session = state.researchSession;
  if (!session || state.researchMode !== "test") {
    els.researchTestProgress.innerHTML = '<div class="research-empty">No test running.</div>';
    renderResearchWaveProgress();
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
  if (!session || state.researchMode !== "validation") return hideResearchWaveProgress();
  const snapshot = validationProgressSnapshot();
  const { total, answered, currentQuestion, remaining, pct } = snapshot;
  if (els.researchWaveProgress && els.researchCompleteScreen?.hidden !== false) {
    els.researchWaveProgress.hidden = false;
    els.researchWaveProgress.setAttribute("aria-hidden", "false");
    els.researchWaveProgress.innerHTML = `
      <div class="research-wave-progress-main">
        <strong>Validation ${currentQuestion}/${total || 0}</strong>
        <span>評価済み ${answered}/${total || 0} · 残り ${remaining} epoch</span>
      </div>
      <div class="research-wave-progress-meter" aria-label="Validation進捗 ${pct}%"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
      <div class="research-wave-progress-pct">${pct}%</div>
    `;
  }
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
    .sort((a, b) => String(b.answeredAt || "").localeCompare(String(a.answeredAt || "")));
}

function researchDetailRows(rows) {
  return `<dl class="research-detail-list">${rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value === undefined || value === null || value === "" ? "-" : String(value))}</dd>`).join("")}</dl>`;
}

function researchMontageTimingSummaryText(response) {
  if (!response) return "";
  if (response.montageDurationSummary) return response.montageDurationSummary;
  const durations = response.montageDurationsSec || {};
  return Object.entries(durations)
    .map(([montage, seconds]) => `${montage}:${Number(seconds || 0).toFixed(3)}`)
    .join(";");
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
      ["Epoch", `${formatSec(Number(response.epochStart || caseRow?.epochStart || 0))} + ${Number(caseRow?.durationSec || 10)}s`],
      ["Spike time", response.spikeTime === "" ? "" : formatSec(Number(response.spikeTime || 0))],
      ["Channel", response.spikeChannel || response.clickedElectrode || ""],
      ["Montage", response.usedMontage || response.spikeMontage || ""],
      ["Montage seconds", researchMontageTimingSummaryText(response)],
      ["Answered", response.answeredAt || ""],
    ];
    return `<div class="research-result-card ${escapeHtml(result.className)}"><div class="research-result-head"><strong>#${index + 1} ${escapeHtml(result.label)}</strong><span>${escapeHtml(researchRatingLabel(response.rating) || "-")}</span></div>${researchDetailRows(rows)}</div>`;
  }).join("");
  els.rightTestPanel.innerHTML = `
    ${current ? `<div class="research-result-card"><div class="research-result-title">Current epoch</div>${researchDetailRows(currentRows)}</div>` : '<div class="research-empty">No test epoch loaded.</div>'}
    <div class="research-result-title">All judgments (${responses.length})</div>
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
    const response = state.lastValidationResponse;
    if (!response) {
      els.rightAnswerPanel.innerHTML = '<div class="research-empty">No validation yet.</div>';
      return;
    }
    const rows = [
      ["Case", response.caseId || ""],
      ["Expert rating", researchRatingLabel(response.rating)],
      ["Expected", researchRatingLabel(response.expectedRating)],
      ["Dataset valid", response.datasetValid ? "OK" : "要確認"],
      ["Method", response.validationMethod || ""],
    ];
    els.rightAnswerPanel.innerHTML = `<div class="research-result-card ${response.datasetValid ? "correct" : "incorrect"}"><div class="research-result-head"><strong>${response.datasetValid ? "OK" : "要確認"}</strong><span>${escapeHtml(researchRatingLabel(response.rating) || "-")}</span></div>${researchDetailRows(rows)}</div>`;
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
    ["Epoch", `${formatSec(Number(response.epochStart || caseRow?.epochStart || 0))} + ${Number(caseRow?.durationSec || 10)}s`],
    ["Montage seconds", researchMontageTimingSummaryText(response)],
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
    if (els.researchEpochCountInput) els.researchEpochCountInput.value = data.dataset?.settings?.phase1SamplePerGroup || 20;
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
    const dataset = await fetchJson(`/api/research/dataset?${qs({ path })}`);
    state.researchDataset = dataset;
    state.researchDatasetPath = dataset.datasetPath || path;
    state.researchCaseIndex = 0;
    if (els.researchEpochCountInput) els.researchEpochCountInput.value = dataset.settings?.phase1SamplePerGroup || 20;
    if (state.researchMode !== "validation") setResearchMode("dataset");
    renderResearchPanel();
    setStatus(`Dataset loaded: ${(dataset.cases || []).length} cases`);
  } catch (err) {
    setStatus(`Dataset load failed: ${err.message}`, { error: true });
  }
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
  try {
    const data = await fetchJson("/api/research/dataset/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetPath: state.researchDatasetPath, updates: { phase1SamplePerGroup: value } }),
    });
    state.researchDataset = data.dataset;
    renderResearchPanel();
    setStatus(`Epoch/group set to ${value}`);
  } catch (err) {
    setStatus(`Epoch count save failed: ${err.message}`, { error: true });
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
    setStatus("Validation complete. JSON export is ready");
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
    await loadRecordings(opened.id);
    state.recordingId = opened.id;
    els.recordingSelect.value = opened.id;
    state.start = Number(item.epochStart || 0);
    state.cursorTime = Number(item.eventTime ?? item.epochStart ?? 0);
    state.rangeStart = null;
    state.scalogramSelection = null;
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
    state.rightPanelVisible = false;
    applyRightPanelVisibility({ redraw: false });
    state.windowData = null;
    await loadWindow();
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
  els.contextMenu.innerHTML = `
    <div class="context-menu-caption">Validation: データセットlabelと矛盾する場合に選択</div>
    ${["てんかん性異常あり", "てんかん性異常なし"].map((rating) => `<button data-action="validation-rating" data-rating="${escapeHtml(rating)}">${escapeHtml(rating)}${rating === expected ? " (label通り)" : ""}</button>`).join("")}
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
    showResearchToast(`Validation保存: ${label} · ${researchRatingLabel(rating)}`);
    const cases = activeResearchCases();
    if (cases.length) await showValidationCase(0);
    else {
      renderResearchPanel();
      showResearchCompletion();
      setStatus("Validation complete. JSON export is ready");
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
  await saveValidationRating(researchExpectedRating(item), "enter_accept");
}

async function exportValidationJson() {
  const datasetPath = els.researchDatasetPathInput?.value.trim() || state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Validation用のデータセットパスを入力してください", { error: true });
  try {
    setStatus("Saving validation JSON to Desktop...", { busy: true });
    const headers = new Headers();
    if (REQUEST_TOKEN) headers.set("X-EEG-Viewer-Token", REQUEST_TOKEN);
    const jsonRes = await fetch(`/api/research/validation/export.json?${qs({ dataset: datasetPath })}`, { headers });
    if (!jsonRes.ok) throw new Error(jsonRes.statusText);
    const jsonFilename = "validation_results.json";
    const jsonResult = await saveBlobToDesktop(new Blob([await jsonRes.text()], { type: "application/json;charset=utf-8" }), jsonFilename);
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = `Desktopに保存しました: ${jsonResult.filename || jsonFilename}`;
    }
    setStatus(`Validation JSON saved to Desktop: ${jsonResult.filename || jsonFilename}`);
  } catch (err) {
    setStatus(`Validation export failed: ${err.message}`, { error: true });
  }
}

async function startResearchTest() {
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
  if (!iedsPresentPath || !iedsAbsentPath) {
    const existingDatasetPath = state.researchDatasetPath || els.researchDatasetPathInput?.value.trim() || "";
    if (!existingDatasetPath) {
      const message = "先にCutモードでデータセットを作成してください";
      setResearchSetupMessage(message, true);
      setStatus(message, { error: true });
      return;
    }
  }
  setResearchSetupMessage("Starting test...");
  setResearchStartBusy(true);
  setStatus("Starting test...", { busy: true });
  try {
    const existingDatasetPath = state.researchDatasetPath || els.researchDatasetPathInput?.value.trim() || "";
    const created = iedsPresentPath && iedsAbsentPath ? await createResearchDataset() : null;
    const datasetPath = created?.datasetPath || existingDatasetPath || state.researchDatasetPath || "";
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
    setStatus("Test complete. JSON export is ready");
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
    await loadRecordings(opened.id);
    state.recordingId = opened.id;
    els.recordingSelect.value = opened.id;
    state.start = Number(item.epochStart || 0);
    state.cursorTime = Number(item.eventTime ?? item.epochStart ?? 0);
    state.rangeStart = null;
    state.scalogramSelection = null;
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
    state.rightPanelVisible = false;
    applyRightPanelVisibility({ redraw: false });
    state.windowData = null;
    await loadWindow();
    updateResearchTutorial(item);
    state.researchCaseStartedAt = new Date().toISOString();
    startResearchMontageTiming();
    const total = Number(state.researchSession?.totalCount || cases.filter((row) => !row.sampleEpoch).length || 0);
    const answered = Number(state.researchSession?.answeredCount || 0);
    const remaining = Math.max(0, total - answered);
    setStatus(isResearchPracticeCase(item) ? "練習サンプル: 波形を左クリックして三択から回答してください" : (item.sampleEpoch ? `Phase ${state.researchSession?.phase || ""} sample` : `Test ${state.researchSession?.phase || ""}: ${state.researchCaseIndex + 1}/${cases.length} · 残り ${remaining} 問`));
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
        setStatus("Test complete. JSON export is ready");
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
      setStatus("Test complete. JSON export is ready");
    }
  } catch (err) {
    setStatus(`Save failed: ${err.message}`, { error: true });
  }
}

function showResearchToast(message, options = {}) {
  if (!els.researchToast) return;
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

async function exportResearchJson() {
  if (state.researchMode === "validation") return exportValidationJson();
  const datasetPath = els.researchDatasetPathInput?.value.trim() || state.researchDatasetPath || "";
  if (!datasetPath) return setStatus("Enter dataset folder path", { error: true });
  saveResearchProfile();
  const profile = researchProfile();
  const readerId = researchReaderDisplayId(profile);
  try {
    setStatus("Saving result JSON to Desktop...", { busy: true });
    const headers = new Headers();
    if (REQUEST_TOKEN) headers.set("X-EEG-Viewer-Token", REQUEST_TOKEN);
    const query = qs({ dataset: datasetPath, readerId, outputPath: profile.outputPath });
    const jsonRes = await fetch(`/api/research/test/export.json?${query}`, { headers });
    if (!jsonRes.ok) throw new Error(jsonRes.statusText);
    const jsonFilename = researchJsonFilename(readerId, profile);
    const jsonResult = await saveBlobToDesktop(new Blob([await jsonRes.text()], { type: "application/json;charset=utf-8" }), jsonFilename);
    if (els.researchSavedCsvName) {
      els.researchSavedCsvName.textContent = `Desktopに保存しました: ${jsonResult.filename || jsonFilename}`;
    }
    setStatus(`Result JSON saved to Desktop: ${jsonResult.filename || jsonFilename}`);
  } catch (err) {
    setStatus(`Export failed: ${err.message}`, { error: true });
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
  resizeTopomapCanvases();
  draw();
  renderScalogram();
  renderTopomaps();
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
    setSelectValue(els.paperSelect, settings.paper);
    if (typeof settings.ecg === "boolean") els.ecgToggle.checked = settings.ecg;
    if (typeof settings.ecgFilter === "boolean" && els.ecgFilterToggle) {
      els.ecgFilterToggle.checked = settings.ecgFilter;
    }
    state.rightPanelVisible = false;
    if (typeof settings.scalogramVisible === "boolean") {
      state.scalogramVisible = settings.scalogramVisible;
    }
    if (typeof settings.showSourceAnnotations === "boolean") {
      state.showSourceAnnotations = settings.showSourceAnnotations;
      if (els.sourceAnnotationToggle) els.sourceAnnotationToggle.checked = settings.showSourceAnnotations;
    }
    if (settings.attenuationScaleMode === "z" || settings.attenuationScaleMode === "db") {
      state.attenuationScaleMode = settings.attenuationScaleMode;
    }
    if (settings.stftScaleMode === "z" || settings.stftScaleMode === "db") {
      state.stftScaleMode = settings.stftScaleMode;
    }
    state.topomapMode = "mean";
    state.topomapLayout = "system";
    state.stftPowerGain = normalizeStftPowerGain(settings.stftPowerGain);
    if (settings.attenuationFreqRange && typeof settings.attenuationFreqRange === "object") {
      state.attenuationFreqRange = normalizeAttenuationFreqRange(settings.attenuationFreqRange.low, settings.attenuationFreqRange.high);
    }
    state.attenuationBaselineSec = normalizeAttenuationBaselineSec(settings.attenuationBaselineSec);
    state.attenuationFreqStepHz = normalizeAttenuationFreqStep(settings.attenuationFreqStepHz);
    state.attenuationTimeBins = normalizeAttenuationTimeBins(settings.attenuationTimeBins);
    if (settings.psdFreqRange && typeof settings.psdFreqRange === "object") {
      state.psdFreqRange = normalizeAnalysisFreqRange(settings.psdFreqRange.low, settings.psdFreqRange.high);
    }
    if (settings.stftFreqRange && typeof settings.stftFreqRange === "object") {
      state.stftFreqRange = normalizeStftFreqRange(settings.stftFreqRange.low, settings.stftFreqRange.high);
    }
    state.scalogramDisplayScope = "all";
    syncAttenuationFreqInputs();
    syncAttenuationTuningInputs();
    syncPsdFreqInputs();
    syncStftFreqInputs();
    syncStftPowerGainInput();
    state.scalogramFreqStepHz = normalizeScalogramFreqStep(settings.scalogramFreqStepHz);
    state.scalogramTimeBins = normalizeScalogramTimeBins(settings.scalogramTimeBins);
    state.stftWindowMs = normalizeStftWindowMs(settings.stftWindowMs);
    state.stftOverlapPct = normalizeStftOverlapPct(settings.stftOverlapPct);
    syncScalogramTuningInputs();
    syncStftTuningInputs();
    state.fzPeakWindowMs = normalizeFzPeakWindowMs(settings.fzPeakWindowMs);
    syncFzPeakWindowInput();
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
    scalogramVisible: state.scalogramVisible,
    showSourceAnnotations: state.showSourceAnnotations,
    attenuationScaleMode: state.attenuationScaleMode === "z" ? "z" : "db",
    stftScaleMode: stftScaleMode(),
    stftPowerGain: normalizeStftPowerGain(state.stftPowerGain),
    topomapMode: topomapMode(),
    topomapLayout: topomapLayout(),
    attenuationFreqRange: normalizeAttenuationFreqRange(state.attenuationFreqRange.low, state.attenuationFreqRange.high),
    attenuationBaselineSec: normalizeAttenuationBaselineSec(state.attenuationBaselineSec),
    attenuationFreqStepHz: normalizeAttenuationFreqStep(state.attenuationFreqStepHz),
    attenuationTimeBins: normalizeAttenuationTimeBins(state.attenuationTimeBins),
    psdFreqRange: normalizeAnalysisFreqRange(state.psdFreqRange.low, state.psdFreqRange.high),
    stftFreqRange: normalizeStftFreqRange(state.stftFreqRange.low, state.stftFreqRange.high),
    scalogramFreqStepHz: normalizeScalogramFreqStep(state.scalogramFreqStepHz),
    scalogramTimeBins: normalizeScalogramTimeBins(state.scalogramTimeBins),
    stftWindowMs: normalizeStftWindowMs(state.stftWindowMs),
    stftOverlapPct: normalizeStftOverlapPct(state.stftOverlapPct),
    fzPeakWindowMs: normalizeFzPeakWindowMs(state.fzPeakWindowMs),
    scalogramDisplayScope: "all",
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
    state.rightPanelVisible = true;
    applyRightPanelVisibility({ redraw: false });
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

function toggleRightPanel() {
  state.rightPanelVisible = !state.rightPanelVisible;
  saveSettings();
  applyRightPanelVisibility();
}


function applyScalogramVisibility(options = {}) {
  const visible = state.scalogramVisible;
  document.body.classList.toggle("scalogram-hidden", !visible);
  if (options.redraw === false) return;
  scheduleLayoutRefresh();
  if (visible && state.scalogramSelection && !state.scalogramData) loadScalogram();
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
  renderScalogram();
}

async function loadRecordings(preferredId = "") {
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
    if (preferredId) {
      await loadWindow();
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
  if (ev.target === els.montageSelect) updateResearchMontageTiming();
  if (ev.target === els.sensitivitySelect) {
    renderStatus();
    draw();
    renderScalogram();
    return;
  }
  if (ev.target === els.montageSelect && isMultiMontageMode()) {
    setActiveMontage(els.montageSelect.value, { reloadScalogram: true });
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
  } else if ([els.tcSelect, els.hfSelect, els.acSelect].includes(ev.target)) {
  }
  await loadWindow();
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
    return;
  }
  state.windowLoadInFlight = true;
  state.windowLoadPending = false;
  setStatus("Loading waveform...", { busy: true, progress: 75 });
  const params = {
    id: state.recordingId,
    start: state.start,
    duration: els.durationSelect.value,
    montage: activeMontageValue(),
    montages: "",
    tc: els.tcSelect.value,
    hf: els.hfSelect.value,
    ac: els.acSelect.value,
    ecg: els.ecgToggle.checked ? "1" : "0",
    ecgFilter: els.ecgFilterToggle?.checked ? "1" : "0",
    topomap: "0",
  };
  const endpoint = "/api/window";
  try {
    const data = await fetchJson(`${endpoint}?${qs(params)}`);
    if (state.windowLoadPending) return;
    state.windowData = data;
    state.activeMontage = els.montageSelect.value;
    state.allAnnotations = state.windowData.annotations || [];
    state.annotations = visibleAnnotations();
    state.start = state.windowData.start || 0;
    state.scalogramData = null;
    renderStatus();
    updateWaveScrollbar();
    renderWarnings();
    renderAnnotations();
    draw();
  } catch (err) {
    if (!state.windowLoadPending) setStatus(`Waveform failed: ${err.message}`, { error: true });
  } finally {
    state.windowLoadInFlight = false;
    if (state.windowLoadPending) {
      state.windowLoadPending = false;
      setTimeout(() => loadWindow(), 0);
    }
  }
}

async function loadPreciseTopomap() {
  if (!topomapPanelActive()) {
    state.topomapRequestId += 1;
    return;
  }
  if (!state.recordingId || state.cursorTime === null) {
    state.preciseTopomap = null;
    renderTopomaps();
    return;
  }
  const interval = fixedTopomapInterval(state.cursorTime, 0.005);
  const requestId = ++state.topomapRequestId;
  const params = {
    id: state.recordingId,
    time: interval.center,
    start: interval.start,
    end: interval.end,
    tc: els.tcSelect.value,
    hf: els.hfSelect.value,
    ac: els.acSelect.value,
    halfWindowSec: String(Math.max(0.001, interval.duration / 2)),
  };
  try {
    const data = await fetchJson(`/api/topomap?${qs(params)}`);
    if (requestId !== state.topomapRequestId) return;
    state.preciseTopomap = data;
  } catch (err) {
    if (requestId !== state.topomapRequestId) return;
    state.preciseTopomap = { available: false, reason: err.message };
  }
  renderTopomaps();
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
  setStatus(`${state.recordingId} · ${labelForMontage()} · ${sensitivity}uV/mm · TC ${tc} · HF ${hfText()} · AC ${els.acSelect.options[els.acSelect.selectedIndex].text}${ecgFilterText}${traceText} · ${formatSec(state.start)}-${formatSec(end)}`);
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
  if (!state.recordingId || !state.scalogramSelection || !state.scalogramVisible) return;
  const selection = state.scalogramSelection;
  const requestId = ++state.scalogramRequestId;
  const requestKind = state.analysisKind;
  const requestRecordingId = state.recordingId;
  const requestStart = Number(selection.start);
  const requestDuration = Number(selection.duration || 1);
  els.scalogramReadout.textContent = `Loading ${formatSec(selection.start)} + ${Number(selection.duration || 1).toFixed(3)}s...`;
  const params = {
    id: state.recordingId,
    start: selection.start,
    duration: state.analysisKind === "attenuation" ? Math.min(selection.duration || 3, 3) : (selection.duration || 1),
    montage: activeMontageValue(),
    tc: els.tcSelect.value,
    hf: els.hfSelect.value,
    ac: els.acSelect.value,
    ...(state.analysisKind === "attenuation" ? {
      freqLow: normalizeAttenuationFreqRange(state.attenuationFreqRange.low, state.attenuationFreqRange.high).low,
      freqHigh: normalizeAttenuationFreqRange(state.attenuationFreqRange.low, state.attenuationFreqRange.high).high,
      baselineSec: normalizeAttenuationBaselineSec(state.attenuationBaselineSec),
      freqStepHz: normalizeAttenuationFreqStep(state.attenuationFreqStepHz),
      timeBins: normalizeAttenuationTimeBins(state.attenuationTimeBins),
    } : {}),
    ...(state.analysisKind === "psd" ? {
      freqLow: normalizeAnalysisFreqRange(state.psdFreqRange.low, state.psdFreqRange.high).low,
      freqHigh: normalizeAnalysisFreqRange(state.psdFreqRange.low, state.psdFreqRange.high).high,
    } : {}),
    ...(state.analysisKind === "stft" ? {
      freqLow: normalizeStftFreqRange(state.stftFreqRange.low, state.stftFreqRange.high).low,
      freqHigh: normalizeStftFreqRange(state.stftFreqRange.low, state.stftFreqRange.high).high,
      windowSec: normalizeStftWindowMs(state.stftWindowMs) / 1000,
      overlapPct: normalizeStftOverlapPct(state.stftOverlapPct),
    } : {}),
    ecg: els.ecgToggle.checked ? "1" : "0",
    ecgFilter: els.ecgFilterToggle?.checked ? "1" : "0",
    ...(state.analysisKind === "scalogram" ? {
      eventHalfWindowSec: normalizeFzPeakWindowMs(state.fzPeakWindowMs) / 1000,
      freqStepHz: normalizeScalogramFreqStep(state.scalogramFreqStepHz),
      timeBins: normalizeScalogramTimeBins(state.scalogramTimeBins),
      iedPhenotype: selectedIedPhenotype(),
      ...(isAdditionalPhenotype(selectedIedPhenotype()) && state.additionalManualAnchor ? {
        manualAnchorTime: state.additionalManualAnchor.time,
        manualAnchorElectrode: state.additionalManualAnchor.electrode || "",
      } : {}),
    } : {}),
  };
  try {
    const endpoint = state.analysisKind === "attenuation" ? "/api/attenuation" : (state.analysisKind === "psd" ? "/api/psd" : (state.analysisKind === "stft" ? "/api/stft" : "/api/scalogram"));
    const data = await fetchJson(`${endpoint}?${qs(params)}`);
    if (
      requestId !== state.scalogramRequestId ||
      requestKind !== state.analysisKind ||
      requestRecordingId !== state.recordingId ||
      !state.scalogramVisible ||
      !state.scalogramSelection ||
      Number(state.scalogramSelection.start) !== requestStart ||
      Number(state.scalogramSelection.duration || 1) !== requestDuration
    ) {
      return;
    }
    state.scalogramData = data;
    state.selectedScalogramIndex = Math.min(
      state.selectedScalogramIndex || 0,
      Math.max(0, (state.scalogramData.traces || []).length - 1)
    );
  } catch (err) {
    if (
      requestId !== state.scalogramRequestId ||
      requestKind !== state.analysisKind ||
      requestRecordingId !== state.recordingId ||
      !state.scalogramVisible
    ) {
      return;
    }
    state.scalogramData = { available: false, reason: err.message, traces: [], freqs: [], bands: [] };
  }
  try {
    renderScalogram();
  } catch (err) {
    console.error("Scalogram render failed", err);
    state.scalogramData = { available: false, reason: `Scalogram render failed: ${err.message}`, traces: [], freqs: [], bands: [] };
    renderScalogram();
  }
  if (state.analysisKind === "attenuation" || state.analysisKind === "psd" || state.analysisKind === "stft") {
    state.fzSpikeTopomap = null;
    state.fzAfterSlowTopomap = null;
    renderFzSpikeTopomap();
  } else {
    loadFzSpikeTopomap();
  }
  draw();
}


function percentileAbs(values, percentile) {
  const sorted = (values || [])
    .map((value) => Math.abs(Number(value)))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((Number(percentile || 0) / 100) * (sorted.length - 1))));
  return sorted[index];
}

function renderScalogram() {
  if (!state.scalogramVisible) return;
  const kind = state.analysisKind === "attenuation" ? "attenuation" : (state.analysisKind === "psd" ? "psd" : (state.analysisKind === "stft" ? "stft" : "scalogram"));
  updateAnalysisKindUi(kind);
  const data = state.scalogramData;
  if (!state.scalogramSelection) {
    const emptyLabel = kind === "attenuation" ? "Drag waveform to create attenuation fingerprint" : (kind === "psd" ? "Drag waveform to create PSD" : (kind === "stft" ? "Drag waveform to create STFT spectrogram" : "Drag waveform to create scalogram"));
    els.scalogramReadout.textContent = "Drag waveform";
    els.scalogramDetailTitle.textContent = "No selection";
    els.scalogramDetailTitle.hidden = kind === "attenuation" || kind === "psd" || kind === "stft";
    els.scalogramDetailCanvas.hidden = kind === "attenuation" || kind === "psd" || kind === "stft";
    els.scalogramList.innerHTML = `<div class='annotation-row empty'><small>${emptyLabel}</small></div>`;
    if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.disabled = true;
    if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = true;
    if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = true;
    state.fzSpikeTopomap = null;
    state.fzAfterSlowTopomap = null;
    setFzTopomapVisible(kind !== "attenuation" && kind !== "psd" && kind !== "stft");
    renderFzSpikeTopomap();
    return;
  }
  if (!data || data.available === false) {
    const label = kind === "attenuation" ? "Attenuation" : (kind === "psd" ? "PSD" : (kind === "stft" ? "STFT" : "Scalogram"));
    els.scalogramReadout.textContent = data?.reason || `${label} unavailable`;
    els.scalogramDetailTitle.textContent = "Unavailable";
    els.scalogramDetailTitle.hidden = kind === "attenuation" || kind === "psd" || kind === "stft";
    els.scalogramDetailCanvas.hidden = kind === "attenuation" || kind === "psd" || kind === "stft";
    els.scalogramList.innerHTML = `<div class='annotation-row empty'><small>${label} unavailable</small></div>`;
    if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.disabled = true;
    if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = true;
    if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = true;
    state.fzSpikeTopomap = null;
    state.fzAfterSlowTopomap = null;
    setFzTopomapVisible(kind !== "attenuation" && kind !== "psd" && kind !== "stft");
    renderFzSpikeTopomap(data?.reason || `${label} unavailable`);
    return;
  }

  const traces = data.traces || [];
  if (kind === "attenuation") {
    renderAttenuation(data, traces);
    return;
  }
  if (kind === "psd") {
    renderPsd(data, traces);
    return;
  }
  if (kind === "stft") {
    renderStft(data, traces);
    return;
  }

  const freqs = data.freqs || [];
  const upper = freqs.length ? Number(freqs[freqs.length - 1]) : 70;
  const band = data.spikeBand || { low: 14, high: Math.min(70, upper) };
  els.scalogramReadout.textContent = `${formatSec(data.start)} + ${Number(data.duration || 1).toFixed(3)}s · ${selectedIedPhenotype()} · step ${metricNumber(data.freqStepHz || state.scalogramFreqStepHz, 1)}Hz · ${Number(data.timeBinCount || state.scalogramTimeBins)} bins · signed polarity: displayed negativity blue / positivity red · raw EEG overlay · spike ${Number(band.low).toFixed(0)}-${Number(band.high).toFixed(0)}Hz`;
  const displayTracesForScope = scalogramDisplayTraces(traces);
  const displayTraceSet = new Set(displayTracesForScope.map((item) => item.index));
  const detailTrace = (displayTraceSet.has(state.selectedScalogramIndex) ? traces[state.selectedScalogramIndex] : displayTracesForScope[0]?.trace) || traces[state.selectedScalogramIndex] || traces[0];
  els.scalogramDetailTitle.hidden = false;
  els.scalogramDetailCanvas.hidden = false;
  els.scalogramDetailTitle.textContent = detailTrace ? spikeMetricText(detailTrace, true) : "No data";
  if (detailTrace) drawScalogramCanvas(els.scalogramDetailCanvas, detailTrace, data, true, "signed");
  if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.disabled = !traces.length;
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = !traces.length;
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = !traces.length;

  const mode = state.scalogramMode === "magnitude" ? "magnitude" : "signed";
  const detectionMode = scalogramDetectionMode();
  for (const btn of els.scalogramModeButtons || []) {
    btn.classList.toggle("active", (btn.dataset.scalogramMode || "signed") === mode);
  }
  for (const btn of els.scalogramScopeButtons || []) {
    btn.classList.toggle("active", (btn.dataset.scalogramScope || "all") === scalogramDisplayScope());
  }
  for (const btn of els.scalogramDetectionButtons || []) {
    btn.classList.toggle("active", (btn.dataset.scalogramDetection || "both") === detectionMode);
  }
  els.scalogramList.innerHTML = "";
  const layout = document.createElement("div");
  layout.className = "scalogram-display-layout";
  const scopeTitle = mode === "magnitude" ? "Magnitude" : "Signed polarity";
  layout.append(createScalogramModeGroup(mode, scopeTitle, traces, data, scalogramDisplayScope()));
  layout.append(createScalogramAnalysisPanel(traces, data));
  els.scalogramList.appendChild(layout);
  setFzTopomapVisible(true);
}

function updateAnalysisKindUi(kind) {
  for (const btn of els.analysisKindButtons || []) {
    btn.classList.toggle("active", (btn.dataset.analysisKind || "scalogram") === kind);
  }
  for (const el of els.scalogramModeControls || []) {
    el.hidden = kind === "attenuation" || kind === "psd" || kind === "stft";
  }
  for (const el of document.querySelectorAll(".attenuation-scale-controls")) {
    el.hidden = kind !== "attenuation";
  }
  for (const el of document.querySelectorAll(".stft-scale-controls")) {
    el.hidden = kind !== "stft";
  }
  for (const el of document.querySelectorAll(".attenuation-freq-controls")) {
    el.hidden = kind !== "attenuation";
  }
  for (const el of document.querySelectorAll(".attenuation-tuning-control")) {
    el.hidden = kind !== "attenuation";
  }
  for (const el of document.querySelectorAll(".psd-freq-controls")) {
    el.hidden = kind !== "psd";
  }
  for (const el of document.querySelectorAll(".stft-freq-controls")) {
    el.hidden = kind !== "stft";
  }
  for (const el of document.querySelectorAll(".stft-power-control")) {
    el.hidden = kind !== "stft";
  }
  for (const el of document.querySelectorAll(".scalogram-tuning-control")) {
    el.hidden = kind !== "scalogram";
  }
  for (const el of document.querySelectorAll(".stft-tuning-control")) {
    el.hidden = kind !== "stft";
  }
  syncAttenuationFreqInputs();
  syncAttenuationTuningInputs();
  syncPsdFreqInputs();
  syncStftFreqInputs();
  syncStftPowerGainInput();
  syncScalogramTuningInputs();
  syncStftTuningInputs();
  syncAnalysisPresetButtons();
  syncFzPeakWindowInput();
  for (const btn of els.attenuationScaleButtons || []) {
    btn.classList.toggle("active", (btn.dataset.attenuationScale || "db") === attenuationScaleMode());
  }
  for (const btn of els.stftScaleButtons || []) {
    btn.classList.toggle("active", (btn.dataset.stftScale || "db") === stftScaleMode());
  }
}

function attenuationScaleMode() {
  return state.attenuationScaleMode === "z" ? "z" : "db";
}

function stftScaleMode() {
  return state.stftScaleMode === "z" ? "z" : "db";
}

function topomapMode() {
  return "mean";
}

function topomapLayout() {
  return "system";
}

function applyTopomapLayout() {
  state.topomapLayout = "system";
}

function normalizeAttenuationFreqRange(low, high) {
  let lo = Number(low);
  let hi = Number(high);
  if (!Number.isFinite(lo)) lo = 0;
  if (!Number.isFinite(hi)) hi = 120;
  lo = Math.max(0, Math.min(120, lo));
  hi = Math.max(1, Math.min(120, hi));
  if (hi <= lo) hi = Math.min(120, lo + 1);
  return { low: Number(lo.toFixed(1)), high: Number(hi.toFixed(1)) };
}

function syncAttenuationFreqInputs() {
  const range = normalizeAttenuationFreqRange(state.attenuationFreqRange.low, state.attenuationFreqRange.high);
  state.attenuationFreqRange = range;
  if (els.attenuationFreqLowInput) els.attenuationFreqLowInput.value = String(range.low);
  if (els.attenuationFreqHighInput) els.attenuationFreqHighInput.value = String(range.high);
}

function normalizeAttenuationBaselineSec(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 3;
  return Math.max(0.5, Math.min(10, Math.round(number * 2) / 2));
}

function normalizeAttenuationFreqStep(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(0.5, Math.min(5, Math.round(number * 2) / 2));
}

function normalizeAttenuationTimeBins(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 120;
  return Math.max(40, Math.min(240, Math.round(number / 20) * 20));
}

function syncAttenuationTuningInputs() {
  state.attenuationBaselineSec = normalizeAttenuationBaselineSec(state.attenuationBaselineSec);
  state.attenuationFreqStepHz = normalizeAttenuationFreqStep(state.attenuationFreqStepHz);
  state.attenuationTimeBins = normalizeAttenuationTimeBins(state.attenuationTimeBins);
  if (els.attenuationBaselineSecInput) els.attenuationBaselineSecInput.value = String(state.attenuationBaselineSec);
  if (els.attenuationBaselineSecValue) els.attenuationBaselineSecValue.value = state.attenuationBaselineSec.toFixed(1);
  if (els.attenuationFreqStepInput) els.attenuationFreqStepInput.value = String(state.attenuationFreqStepHz);
  if (els.attenuationFreqStepValue) els.attenuationFreqStepValue.value = state.attenuationFreqStepHz.toFixed(1);
  if (els.attenuationTimeBinsInput) els.attenuationTimeBinsInput.value = String(state.attenuationTimeBins);
  if (els.attenuationTimeBinsValue) els.attenuationTimeBinsValue.value = String(state.attenuationTimeBins);
  syncAnalysisPresetButtons();
}

function onAttenuationTuningInput() {
  state.attenuationBaselineSec = normalizeAttenuationBaselineSec(els.attenuationBaselineSecInput?.value);
  state.attenuationFreqStepHz = normalizeAttenuationFreqStep(els.attenuationFreqStepInput?.value);
  state.attenuationTimeBins = normalizeAttenuationTimeBins(els.attenuationTimeBinsInput?.value);
  syncAttenuationTuningInputs();
}

function onAttenuationTuningChange() {
  onAttenuationTuningInput();
  saveSettings();
  if (state.analysisKind === "attenuation" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function matchingAttenuationPreset() {
  const baselineSec = normalizeAttenuationBaselineSec(state.attenuationBaselineSec);
  const freqStepHz = normalizeAttenuationFreqStep(state.attenuationFreqStepHz);
  const timeBins = normalizeAttenuationTimeBins(state.attenuationTimeBins);
  for (const [name, preset] of Object.entries(ATTENUATION_PRESETS)) {
    if (baselineSec === preset.baselineSec && freqStepHz === preset.freqStepHz && timeBins === preset.timeBins) return name;
  }
  return "custom";
}

function applyAttenuationPreset(name) {
  const preset = ATTENUATION_PRESETS[name] || ATTENUATION_PRESETS.balanced;
  state.attenuationBaselineSec = preset.baselineSec;
  state.attenuationFreqStepHz = preset.freqStepHz;
  state.attenuationTimeBins = preset.timeBins;
  syncAttenuationTuningInputs();
  saveSettings();
  if (state.analysisKind === "attenuation" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function normalizeAnalysisFreqRange(low, high) {
  let lo = Number(low);
  let hi = Number(high);
  if (!Number.isFinite(lo)) lo = 0;
  if (!Number.isFinite(hi)) hi = 120;
  lo = Math.max(0, Math.min(120, lo));
  hi = Math.max(0.1, Math.min(120, hi));
  if (hi <= lo) hi = Math.min(120, lo + 0.1);
  return { low: Number(lo.toFixed(1)), high: Number(hi.toFixed(1)) };
}

function syncPsdFreqInputs() {
  const range = normalizeAnalysisFreqRange(state.psdFreqRange.low, state.psdFreqRange.high);
  state.psdFreqRange = range;
  if (els.psdFreqLowInput) els.psdFreqLowInput.value = String(range.low);
  if (els.psdFreqHighInput) els.psdFreqHighInput.value = String(range.high);
}

function onPsdFreqInputChange() {
  state.psdFreqRange = normalizeAnalysisFreqRange(
    els.psdFreqLowInput?.value,
    els.psdFreqHighInput?.value
  );
  syncPsdFreqInputs();
  saveSettings();
  if (state.analysisKind === "psd" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function normalizeStftFreqRange(low, high) {
  let lo = Number(low);
  let hi = Number(high);
  if (!Number.isFinite(lo)) lo = 0;
  if (!Number.isFinite(hi)) hi = 120;
  lo = Math.max(0, Math.min(120, lo));
  hi = Math.max(0.1, Math.min(120, hi));
  if (hi <= lo) hi = Math.min(120, lo + 0.1);
  return { low: Number(lo.toFixed(1)), high: Number(hi.toFixed(1)) };
}

function syncStftFreqInputs() {
  const range = normalizeStftFreqRange(state.stftFreqRange.low, state.stftFreqRange.high);
  state.stftFreqRange = range;
  if (els.stftFreqLowInput) els.stftFreqLowInput.value = String(range.low);
  if (els.stftFreqHighInput) els.stftFreqHighInput.value = String(range.high);
}

function onStftFreqInputChange() {
  state.stftFreqRange = normalizeStftFreqRange(
    els.stftFreqLowInput?.value,
    els.stftFreqHighInput?.value
  );
  syncStftFreqInputs();
  saveSettings();
  if (state.analysisKind === "stft" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function normalizeStftPowerGain(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(0.5, Math.min(4, Math.round(number * 10) / 10));
}

function syncStftPowerGainInput() {
  state.stftPowerGain = normalizeStftPowerGain(state.stftPowerGain);
  if (els.stftPowerGainInput) els.stftPowerGainInput.value = String(state.stftPowerGain);
  if (els.stftPowerGainValue) els.stftPowerGainValue.value = state.stftPowerGain.toFixed(1);
}

function onStftPowerGainInput() {
  state.stftPowerGain = normalizeStftPowerGain(els.stftPowerGainInput?.value);
  syncStftPowerGainInput();
  renderScalogram();
}

function normalizeScalogramFreqStep(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(0.5, Math.min(5, Math.round(number * 2) / 2));
}

function normalizeScalogramTimeBins(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 120;
  return Math.max(40, Math.min(240, Math.round(number / 20) * 20));
}

function syncScalogramTuningInputs() {
  state.scalogramFreqStepHz = normalizeScalogramFreqStep(state.scalogramFreqStepHz);
  state.scalogramTimeBins = normalizeScalogramTimeBins(state.scalogramTimeBins);
  if (els.scalogramFreqStepInput) els.scalogramFreqStepInput.value = String(state.scalogramFreqStepHz);
  if (els.scalogramFreqStepValue) els.scalogramFreqStepValue.value = state.scalogramFreqStepHz.toFixed(1);
  if (els.scalogramTimeBinsInput) els.scalogramTimeBinsInput.value = String(state.scalogramTimeBins);
  if (els.scalogramTimeBinsValue) els.scalogramTimeBinsValue.value = String(state.scalogramTimeBins);
  syncAnalysisPresetButtons();
}

function onScalogramTuningInput() {
  state.scalogramFreqStepHz = normalizeScalogramFreqStep(els.scalogramFreqStepInput?.value);
  state.scalogramTimeBins = normalizeScalogramTimeBins(els.scalogramTimeBinsInput?.value);
  syncScalogramTuningInputs();
}

function onScalogramTuningChange() {
  onScalogramTuningInput();
  saveSettings();
  if (state.analysisKind === "scalogram" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function matchingScalogramPreset() {
  const freqStepHz = normalizeScalogramFreqStep(state.scalogramFreqStepHz);
  const timeBins = normalizeScalogramTimeBins(state.scalogramTimeBins);
  for (const [name, preset] of Object.entries(SCALOGRAM_PRESETS)) {
    if (freqStepHz === preset.freqStepHz && timeBins === preset.timeBins) return name;
  }
  return "custom";
}

function applyScalogramPreset(name) {
  const preset = SCALOGRAM_PRESETS[name] || SCALOGRAM_PRESETS.balanced;
  state.scalogramFreqStepHz = preset.freqStepHz;
  state.scalogramTimeBins = preset.timeBins;
  syncScalogramTuningInputs();
  saveSettings();
  if (state.analysisKind === "scalogram" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function normalizeStftWindowMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 125;
  return Math.max(50, Math.min(1000, Math.round(number / 25) * 25));
}

function normalizeStftOverlapPct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 95;
  return Math.max(50, Math.min(98, Math.round(number)));
}

function syncStftTuningInputs() {
  state.stftWindowMs = normalizeStftWindowMs(state.stftWindowMs);
  state.stftOverlapPct = normalizeStftOverlapPct(state.stftOverlapPct);
  if (els.stftWindowMsInput) els.stftWindowMsInput.value = String(state.stftWindowMs);
  if (els.stftWindowMsValue) els.stftWindowMsValue.value = String(state.stftWindowMs);
  if (els.stftOverlapPctInput) els.stftOverlapPctInput.value = String(state.stftOverlapPct);
  if (els.stftOverlapPctValue) els.stftOverlapPctValue.value = String(state.stftOverlapPct);
  syncAnalysisPresetButtons();
}

function onStftTuningInput() {
  state.stftWindowMs = normalizeStftWindowMs(els.stftWindowMsInput?.value);
  state.stftOverlapPct = normalizeStftOverlapPct(els.stftOverlapPctInput?.value);
  syncStftTuningInputs();
}

function onStftTuningChange() {
  onStftTuningInput();
  saveSettings();
  if (state.analysisKind === "stft" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function matchingStftPreset() {
  const windowMs = normalizeStftWindowMs(state.stftWindowMs);
  const overlapPct = normalizeStftOverlapPct(state.stftOverlapPct);
  for (const [name, preset] of Object.entries(STFT_PRESETS)) {
    if (windowMs === preset.windowMs && overlapPct === preset.overlapPct) return name;
  }
  return "custom";
}

function applyStftPreset(name) {
  const preset = STFT_PRESETS[name] || STFT_PRESETS.balanced;
  state.stftWindowMs = preset.windowMs;
  state.stftOverlapPct = preset.overlapPct;
  syncStftTuningInputs();
  saveSettings();
  if (state.analysisKind === "stft" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function syncAnalysisPresetButtons() {
  const attenuationPreset = matchingAttenuationPreset();
  for (const btn of els.attenuationPresetButtons || []) {
    btn.classList.toggle("active", (btn.dataset.attenuationPreset || "") === attenuationPreset);
  }
  const scalogramPreset = matchingScalogramPreset();
  for (const btn of els.scalogramPresetButtons || []) {
    btn.classList.toggle("active", (btn.dataset.scalogramPreset || "") === scalogramPreset);
  }
  const stftPreset = matchingStftPreset();
  for (const btn of els.stftPresetButtons || []) {
    btn.classList.toggle("active", (btn.dataset.stftPreset || "") === stftPreset);
  }
}

function normalizeFzPeakWindowMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 10;
  return Math.max(4, Math.min(30, Math.round(number)));
}

function normalizeIedPhenotype(value) {
  const text = String(value || "generalized-like").trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
  if (["generalized-like", "typical-generalized", "focal-spike", "fragmented-ied"].includes(text)) return text;
  return "generalized-like";
}

function selectedIedPhenotype() {
  return "generalized-like";
}

function isAdditionalPhenotype(value = selectedIedPhenotype()) {
  const phenotype = normalizeIedPhenotype(value);
  return phenotype === "focal-spike" || phenotype === "fragmented-ied";
}

function syncFzPeakWindowInput() {
  state.fzPeakWindowMs = normalizeFzPeakWindowMs(state.fzPeakWindowMs);
  if (els.fzPeakWindowMsInput) els.fzPeakWindowMsInput.value = String(state.fzPeakWindowMs);
  if (els.fzPeakWindowMsValue) els.fzPeakWindowMsValue.value = String(state.fzPeakWindowMs);
}

function onFzPeakWindowInput() {
  state.fzPeakWindowMs = normalizeFzPeakWindowMs(els.fzPeakWindowMsInput?.value);
  syncFzPeakWindowInput();
  renderFzSpikeTopomap();
}

function onFzPeakWindowChange() {
  state.fzPeakWindowMs = normalizeFzPeakWindowMs(els.fzPeakWindowMsInput?.value);
  syncFzPeakWindowInput();
  saveSettings();
  if (state.analysisKind === "scalogram" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    loadFzSpikeTopomap();
  }
}

function onAttenuationFreqInputChange() {
  state.attenuationFreqRange = normalizeAttenuationFreqRange(
    els.attenuationFreqLowInput?.value,
    els.attenuationFreqHighInput?.value
  );
  syncAttenuationFreqInputs();
  saveSettings();
  if (state.analysisKind === "attenuation" && state.scalogramSelection) {
    state.scalogramData = null;
    loadScalogram();
  } else {
    renderScalogram();
  }
}

function renderStft(data, traces) {
  const band = data.band || {};
  const gain = normalizeStftPowerGain(state.stftPowerGain);
  const scaleText = stftScaleMode() === "z" ? "z-score per trace" : "dB percentile scale";
  els.scalogramReadout.textContent = `${formatSec(data.start)} + ${Number(data.duration || 0).toFixed(3)}s · STFT spectrogram ${metricNumber(band.low, 0)}-${metricNumber(band.high, 0)}Hz · ${scaleText} · power ×${gain.toFixed(1)} · window ${Number(data.windowSec || 0).toFixed(3)}s · overlap ${metricNumber(data.overlapPct, 0)}% · step ${Number(data.stepSec || 0).toFixed(3)}s · freq bin ${metricNumber(data.freqStepHz, 3)}Hz`;
  if (els.scalogramDetailTitle) els.scalogramDetailTitle.hidden = true;
  if (els.scalogramDetailCanvas) els.scalogramDetailCanvas.hidden = true;
  if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.disabled = true;
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = true;
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = !(traces || []).length;
  setFzTopomapVisible(false);
  els.scalogramList.innerHTML = "";
  const layout = document.createElement("div");
  layout.className = "psd-display-layout";
  layout.append(createStftGroup(traces, data));
  els.scalogramList.appendChild(layout);
}

function createStftGroup(traces, data) {
  const panel = document.createElement("div");
  panel.className = "psd-mode-group";
  const heading = document.createElement("div");
  heading.className = "scalogram-mode-title";
  const band = data.band || {};
  heading.textContent = `STFT spectrogram ${metricNumber(band.low, 0)}-${metricNumber(band.high, 0)} Hz`;
  panel.appendChild(heading);
  const groups = groupScalogramTraces(traces);
  const columns = document.createElement("div");
  columns.className = "psd-columns";
  const leftColumn = document.createElement("div");
  leftColumn.className = "scalogram-column left";
  const rightColumn = document.createElement("div");
  rightColumn.className = "scalogram-column right";
  columns.append(leftColumn, rightColumn);
  panel.appendChild(columns);
  groups.left.forEach((item) => leftColumn.appendChild(createStftRow(item.trace, data)));
  groups.right.forEach((item) => rightColumn.appendChild(createStftRow(item.trace, data)));
  if (groups.full.length) {
    const fullWidth = document.createElement("div");
    fullWidth.className = "scalogram-fullwidth";
    groups.full.forEach((item) => fullWidth.appendChild(createStftRow(item.trace, data)));
    panel.appendChild(fullWidth);
  }
  return panel;
}

function createStftRow(trace, data) {
  const row = document.createElement("div");
  row.className = "psd-row";
  const summary = stftScaleMode() === "z"
    ? `z-score · peak ${metricNumber(trace.peakFreq, 1)}Hz`
    : `peak ${metricNumber(trace.peakFreq, 1)}Hz · ${metricNumber(trace.peakDb, 1)}dB`;
  row.innerHTML = `<div class="psd-row-header"><strong>${escapeHtml(nkLabel(trace.label))}</strong><small>${escapeHtml(summary)}</small></div><canvas width="280" height="116"></canvas>`;
  drawStftSpectrogramCanvas(row.querySelector("canvas"), trace, data);
  return row;
}

function drawStftSpectrogramCanvas(canvas, trace, data) {
  sizeCanvasToDisplay(canvas, 280, 116);
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const left = 24 * ratio;
  const right = 5 * ratio;
  const top = 5 * ratio;
  const bottom = 15 * ratio;
  const plotW = Math.max(1, w - left - right);
  const plotH = Math.max(1, h - top - bottom);
  const freqs = data.freqs || [];
  const timeBins = data.timeBins || [];
  const matrix = stftDisplayMatrix(trace);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, w, h);
  if (!freqs.length || !timeBins.length || !matrix.length) return;
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  if (!rows || !cols) return;
  const xEdges = stftTimeEdges(data, cols);
  for (let r = 0; r < rows; r++) {
    const y0 = top + (1 - (r + 1) / rows) * plotH;
    const y1 = top + (1 - r / rows) * plotH;
    for (let c = 0; c < cols; c++) {
      const x0 = left + (xEdges[c] / Math.max(1e-6, Number(data.duration || 1))) * plotW;
      const x1 = left + (xEdges[c + 1] / Math.max(1e-6, Number(data.duration || 1))) * plotW;
      ctx.fillStyle = stftSpectrogramColor(applyStftPowerGain(Number(matrix[r][c] || 0)));
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0 + 0.5), Math.max(1, y1 - y0 + 0.5));
    }
  }
  drawStftWaveformOverlay(ctx, trace, data, left, top, plotW, plotH, ratio);
  ctx.strokeStyle = "rgba(80,80,75,.45)";
  ctx.lineWidth = Math.max(1, 0.7 * ratio);
  ctx.strokeRect(left, top, plotW, plotH);
  const minFreq = Number(freqs[0] || 1);
  const maxFreq = Number(freqs[freqs.length - 1] || data.band?.high || 120);
  ctx.fillStyle = "#555650";
  ctx.font = `${8 * ratio}px Arial`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const freq of [1, 10, 30, 70, 120]) {
    if (freq < minFreq || freq > maxFreq) continue;
    const y = top + (1 - (freq - minFreq) / Math.max(1, maxFreq - minFreq)) * plotH;
    ctx.fillText(`${freq}`, left - 3 * ratio, y);
  }
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("0s", left, top + plotH + 3 * ratio);
  ctx.textAlign = "right";
  ctx.fillText(`${Number(data.duration || 0).toFixed(1)}s`, left + plotW, top + plotH + 3 * ratio);
}

function stftTimeEdges(data, cols) {
  const duration = Math.max(1e-6, Number(data?.duration || 1));
  const start = Number(data?.start || 0);
  const bins = (data?.timeBins || []).map((time) => Number(time) - start);
  if (bins.length !== cols || bins.some((time) => !Number.isFinite(time))) {
    return Array.from({ length: cols + 1 }, (_, index) => (index / Math.max(1, cols)) * duration);
  }
  const edges = new Array(cols + 1);
  if (cols === 1) {
    const half = Math.max(1e-6, Number(data?.stepSec || duration)) * 0.5;
    edges[0] = bins[0] - half;
    edges[1] = bins[0] + half;
  } else {
    edges[0] = bins[0] - (bins[1] - bins[0]) * 0.5;
    for (let index = 1; index < cols; index++) {
      edges[index] = (bins[index - 1] + bins[index]) * 0.5;
    }
    edges[cols] = bins[cols - 1] + (bins[cols - 1] - bins[cols - 2]) * 0.5;
  }
  for (let index = 0; index < edges.length; index++) {
    const previous = index > 0 ? edges[index - 1] : 0;
    edges[index] = Math.max(previous, Math.min(duration, Math.max(0, Number(edges[index]) || 0)));
  }
  return edges;
}

function stftDisplayMatrix(trace) {
  if (stftScaleMode() !== "z") return trace.values || [];
  const db = trace.valuesDb || [];
  const finite = [];
  for (const row of db) {
    for (const raw of row || []) {
      const value = Number(raw);
      if (Number.isFinite(value)) finite.push(value);
    }
  }
  if (!finite.length) return trace.values || [];
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length;
  const sd = Math.sqrt(Math.max(variance, 1e-9));
  return db.map((row) => (row || []).map((raw) => {
    const z = (Number(raw) - mean) / sd;
    return Math.max(0, Math.min(1, (Math.max(-3, Math.min(3, z)) + 3) / 6));
  }));
}

function applyStftPowerGain(value) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const gain = normalizeStftPowerGain(state.stftPowerGain);
  return Math.max(0, Math.min(1, (v - 0.5) * gain + 0.5));
}

function percentile(sortedValues, pct) {
  if (!Array.isArray(sortedValues) || !sortedValues.length) return 0;
  const position = Math.max(0, Math.min(sortedValues.length - 1, (sortedValues.length - 1) * pct));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  const fraction = position - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * fraction;
}

function autoEcgUvPerMm(values) {
  const finite = (values || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (finite.length < 8) return ECG_UV_PER_MM;
  finite.sort((a, b) => a - b);
  const median = percentile(finite, 0.5);
  const deviations = finite
    .map((value) => Math.abs(value - median))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!deviations.length) return ECG_UV_PER_MM;
  const robustHalfRangeUv = percentile(deviations, 0.98);
  const uvPerMm = robustHalfRangeUv / ECG_AUTO_TARGET_MM;
  if (!Number.isFinite(uvPerMm) || uvPerMm <= 0) return ECG_UV_PER_MM;
  return Math.max(ECG_AUTO_MIN_UV_PER_MM, Math.min(ECG_AUTO_MAX_UV_PER_MM, uvPerMm));
}

function traceUvPerMm(trace, fallbackSensitivity, values = null) {
  if (trace?.role !== "ecg") return fallbackSensitivity;
  return autoEcgUvPerMm(values || trace.values || trace.waveformUv || trace.waveform || []);
}

function drawStftWaveformOverlay(ctx, trace, data, left, top, plotW, plotH, ratio) {
  const overlay = scalogramOverlayFromWaveViewer(trace, data);
  const waveform = overlay.values.length >= 2
    ? overlay.values
    : (Array.isArray(trace?.waveformUv) ? trace.waveformUv : trace?.waveform || []);
  if (!Array.isArray(waveform) || waveform.length < 2) return;
  const sensitivity = sensitivityValue();
  const uvPerMm = traceUvPerMm(trace, sensitivity, waveform);
  const pxPerMm = 3.78 * ratio;
  const yScale = pxPerMm / Math.max(1e-6, uvPerMm);
  const centerY = top + plotH * 0.5;
  const start = Number(data?.start || state.scalogramSelection?.start || state.start || 0);
  const duration = Math.max(1e-6, Number(data?.duration || state.scalogramSelection?.duration || 1));
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, plotW, plotH);
  ctx.clip();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  waveform.forEach((raw, index) => {
    const valueUv = Number(raw) || 0;
    const t = overlay.times.length === waveform.length ? Number(overlay.times[index]) : start + (index / Math.max(1, waveform.length - 1)) * duration;
    const x = left + ((t - start) / duration) * plotW;
    const y = centerY - valueUv * yScale;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 3.2 * ratio;
  ctx.stroke();
  ctx.strokeStyle = "rgba(5,9,12,.82)";
  ctx.lineWidth = 1.25 * ratio;
  ctx.stroke();
  ctx.restore();
}


function stftSpectrogramColor(value) {
  return spectrogramColor(value);
}


function renderPsd(data, traces) {
  const band = data.band || {};
  els.scalogramReadout.textContent = `${formatSec(data.start)} + ${Number(data.duration || 0).toFixed(3)}s · Welch PSD ${metricNumber(band.low, 0)}-${metricNumber(band.high, 0)}Hz · ${data.valueLabel || "dB uV^2/Hz"}`;
  if (els.scalogramDetailTitle) els.scalogramDetailTitle.hidden = true;
  if (els.scalogramDetailCanvas) els.scalogramDetailCanvas.hidden = true;
  if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.disabled = true;
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = true;
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = !(traces || []).length;
  setFzTopomapVisible(false);
  els.scalogramList.innerHTML = "";
  const layout = document.createElement("div");
  layout.className = "psd-display-layout";
  const yRange = computePsdCommonYRange(traces, data.freqs || []);
  layout.append(createPsdGroup(traces, data, yRange));
  els.scalogramList.appendChild(layout);
}

function createPsdGroup(traces, data, yRange) {
  const panel = document.createElement("div");
  panel.className = "psd-mode-group";
  const heading = document.createElement("div");
  heading.className = "scalogram-mode-title";
  const band = data.band || {};
  heading.textContent = `Welch PSD ${metricNumber(band.low, 0)}-${metricNumber(band.high, 0)} Hz`;
  panel.appendChild(heading);
  const groups = groupScalogramTraces(traces);
  const columns = document.createElement("div");
  columns.className = "psd-columns";
  const leftColumn = document.createElement("div");
  leftColumn.className = "scalogram-column left";
  const rightColumn = document.createElement("div");
  rightColumn.className = "scalogram-column right";
  columns.append(leftColumn, rightColumn);
  panel.appendChild(columns);
  groups.left.forEach((item) => leftColumn.appendChild(createPsdRow(item.trace, item.index, data, yRange)));
  groups.right.forEach((item) => rightColumn.appendChild(createPsdRow(item.trace, item.index, data, yRange)));
  if (groups.full.length) {
    const fullWidth = document.createElement("div");
    fullWidth.className = "scalogram-fullwidth";
    groups.full.forEach((item) => fullWidth.appendChild(createPsdRow(item.trace, item.index, data, yRange)));
    panel.appendChild(fullWidth);
  }
  return panel;
}

function createPsdRow(trace, index, data, yRange) {
  const row = document.createElement("div");
  row.className = "psd-row";
  const summary = `peak ${metricNumber(trace.peakFreq, 1)}Hz · ${metricNumber(trace.peakDb, 1)}dB`;
  row.innerHTML = `<div class="psd-row-header"><strong>${escapeHtml(nkLabel(trace.label))}</strong><small>${escapeHtml(summary)} · envelope</small></div><canvas width="280" height="116"></canvas>`;
  drawPsdCanvas(row.querySelector("canvas"), trace, data, yRange);
  return row;
}

function drawPsdCanvas(canvas, trace, data, yRange = null) {
  sizeCanvasToDisplay(canvas, 280, 116);
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const left = 24 * ratio;
  const right = 5 * ratio;
  const top = 5 * ratio;
  const bottom = 14 * ratio;
  const plotW = Math.max(1, w - left - right);
  const plotH = Math.max(1, h - top - bottom);
  const freqs = data.freqs || [];
  const values = trace.values || [];
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, w, h);
  if (!freqs.length || !values.length) return;
  const finite = values.map(Number).filter(Number.isFinite);
  const localMinDb = finite.length ? Math.min(...finite) : -80;
  const localMaxDb = finite.length ? Math.max(...finite) : 0;
  const useSharedRange = trace.role !== "ecg" && yRange && Number.isFinite(yRange.yMin) && Number.isFinite(yRange.yMax);
  const yMin = useSharedRange ? yRange.yMin : localMinDb - Math.max(3, (localMaxDb - localMinDb) * 0.08);
  const yMax = useSharedRange ? yRange.yMax : localMaxDb + Math.max(3, (localMaxDb - localMinDb) * 0.08);
  const minDb = useSharedRange ? yMin : localMinDb;
  const maxDb = useSharedRange ? yMax : localMaxDb;
  const fMin = Number(freqs[0] || 0);
  const fMax = Number(freqs[freqs.length - 1] || data.band?.high || 120);
  ctx.save();
  ctx.strokeStyle = "rgba(80,80,75,.18)";
  ctx.lineWidth = Math.max(1, 0.7 * ratio);
  for (const freq of [0, 10, 20, 30, 50, 70, 90, 120]) {
    if (freq < fMin || freq > fMax) continue;
    const x = left + ((freq - fMin) / Math.max(1e-6, fMax - fMin)) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + plotH);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(80,80,75,.45)";
  ctx.strokeRect(left, top, plotW, plotH);
  const envelope = psdEnvelope(values, freqs);
  ctx.strokeStyle = trace.role === "ecg" ? "rgba(95,103,98,.36)" : "rgba(40,79,159,.28)";
  ctx.lineWidth = Math.max(1, 0.9 * ratio);
  drawPsdLine(ctx, values, freqs, left, top, plotW, plotH, fMin, fMax, yMin, yMax);
  ctx.strokeStyle = trace.role === "ecg" ? "#4e5752" : "#1f4f9d";
  ctx.lineWidth = Math.max(1.5, 2.1 * ratio);
  drawPsdLine(ctx, envelope, freqs, left, top, plotW, plotH, fMin, fMax, yMin, yMax);
  ctx.fillStyle = "#555650";
  ctx.font = `${8 * ratio}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${metricNumber(fMin, 0)}Hz`, left, top + plotH + 3 * ratio);
  ctx.textAlign = "right";
  ctx.fillText(`${metricNumber(fMax, 0)}Hz`, left + plotW, top + plotH + 3 * ratio);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(`${metricNumber(maxDb, 0)}`, left - 3 * ratio, top + 5 * ratio);
  ctx.fillText(`${metricNumber(minDb, 0)}`, left - 3 * ratio, top + plotH - 5 * ratio);
  ctx.restore();
}


function computePsdCommonYRange(traces, freqs) {
  const values = [];
  for (const trace of traces || []) {
    if (trace?.role === "ecg") continue;
    const traceValues = Array.isArray(trace?.values) ? trace.values : [];
    for (const value of traceValues) {
      const number = Number(value);
      if (Number.isFinite(number)) values.push(number);
    }
    for (const value of psdEnvelope(traceValues, freqs || [])) {
      const number = Number(value);
      if (Number.isFinite(number)) values.push(number);
    }
  }
  if (!values.length) return null;
  const minDb = Math.min(...values);
  const maxDb = Math.max(...values);
  const pad = Math.max(3, (maxDb - minDb) * 0.08);
  return { yMin: minDb - pad, yMax: maxDb + pad };
}

function psdEnvelope(values, freqs) {
  const numeric = values.map((value) => Number(value));
  const frequencyValues = freqs.map((freq) => Number(freq));
  if (numeric.length < 3) return numeric;
  const step = Math.max(0.25, Math.abs((frequencyValues[1] ?? 1) - (frequencyValues[0] ?? 0)) || 1);
  const halfBins = Math.max(1, Math.round(1.5 / step));
  return numeric.map((value, index) => {
    let weighted = 0;
    let weightSum = 0;
    const lo = Math.max(0, index - halfBins);
    const hi = Math.min(numeric.length - 1, index + halfBins);
    for (let j = lo; j <= hi; j++) {
      const sample = numeric[j];
      if (!Number.isFinite(sample)) continue;
      const weight = 1 + halfBins - Math.abs(j - index);
      weighted += sample * weight;
      weightSum += weight;
    }
    return weightSum ? weighted / weightSum : value;
  });
}

function drawPsdLine(ctx, values, freqs, left, top, plotW, plotH, fMin, fMax, yMin, yMax) {
  ctx.beginPath();
  values.forEach((raw, index) => {
    const value = Number(raw);
    const freq = Number(freqs[index]);
    if (!Number.isFinite(value) || !Number.isFinite(freq)) return;
    const x = left + ((freq - fMin) / Math.max(1e-6, fMax - fMin)) * plotW;
    const y = top + (1 - (value - yMin) / Math.max(1e-6, yMax - yMin)) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderAttenuation(data, traces) {
  const band = data.band || {};
  const mode = attenuationScaleMode();
  const dbScale = data.colorScaleDb || { min: -15, max: 6 };
  const zScale = data.zScale || { min: -3, max: 3 };
  const scaleText = mode === "z"
    ? `baseline z-score ${metricNumber(zScale.min, 0)} to +${metricNumber(zScale.max, 0)} fixed scale`
    : `${metricNumber(dbScale.min, 0)} to +${metricNumber(dbScale.max, 0)} dB fixed scale`;
  const baselineText = mode === "z" ? "baseline z-score" : `dB vs preceding ${Number(data.baselineDuration || 0).toFixed(2)}s baseline`;
  const requested = band.requestedLow !== undefined ? ` requested ${metricNumber(band.requestedLow, 0)}-${metricNumber(band.requestedHigh, 0)}Hz` : "";
  els.scalogramReadout.textContent = `${formatSec(data.start)} + ${Number(data.duration || 0).toFixed(3)}s · Morlet power attenuation ${metricNumber(band.low, 0)}-${metricNumber(band.high, 0)}Hz${requested} · ${baselineText} · step ${metricNumber(data.freqStepHz || state.attenuationFreqStepHz, 1)}Hz · ${Number(data.timeBinCount || state.attenuationTimeBins)} bins · ${scaleText}`;
  if (els.scalogramDetailTitle) els.scalogramDetailTitle.hidden = true;
  if (els.scalogramDetailCanvas) els.scalogramDetailCanvas.hidden = true;
  if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.disabled = true;
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = true;
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = !(traces || []).length;
  setFzTopomapVisible(false);
  els.scalogramList.innerHTML = "";
  const layout = document.createElement("div");
  layout.className = "attenuation-display-layout";
  layout.append(createAttenuationGroup(traces, data));
  els.scalogramList.appendChild(layout);
}

function setFzTopomapVisible(visible) {
  const row = document.querySelector(".scalogram-fz-topomap-row");
  if (row) row.hidden = !visible;
}

function createAttenuationGroup(traces, data) {
  const panel = document.createElement("div");
  panel.className = "attenuation-mode-group";
  const heading = document.createElement("div");
  heading.className = "scalogram-mode-title";
  const band = data.band || {};
  heading.textContent = `${attenuationScaleMode() === "z" ? "Morlet attenuation fingerprint z-score" : "Morlet attenuation fingerprint dB"} ${metricNumber(band.low, 0)}-${metricNumber(band.high, 0)} Hz`;
  panel.appendChild(heading);
  const groups = groupScalogramTraces(traces);
  const columns = document.createElement("div");
  columns.className = "attenuation-columns";
  const leftColumn = document.createElement("div");
  leftColumn.className = "scalogram-column left";
  const rightColumn = document.createElement("div");
  rightColumn.className = "scalogram-column right";
  columns.append(leftColumn, rightColumn);
  panel.appendChild(columns);
  groups.left.forEach((item) => leftColumn.appendChild(createAttenuationRow(item.trace, item.index, data)));
  groups.right.forEach((item) => rightColumn.appendChild(createAttenuationRow(item.trace, item.index, data)));
  if (groups.full.length) {
    const fullWidth = document.createElement("div");
    fullWidth.className = "scalogram-fullwidth";
    groups.full.forEach((item) => fullWidth.appendChild(createAttenuationRow(item.trace, item.index, data)));
    panel.appendChild(fullWidth);
  }
  return panel;
}

function createAttenuationRow(trace, index, data) {
  const row = document.createElement("div");
  row.className = "attenuation-row";
  const mode = attenuationScaleMode();
  const dbScale = data.colorScaleDb || { min: -15, max: 6 };
  const zScale = data.zScale || { min: -3, max: 3 };
  const summary = mode === "z"
    ? `median z ${metricNumber(trace.medianZ, 2)} · ${metricNumber(zScale.min, 0)}..+${metricNumber(zScale.max, 0)}`
    : `median ${metricNumber(trace.medianDb, 1)} dB · ${metricNumber(dbScale.min, 0)}..+${metricNumber(dbScale.max, 0)}dB`;
  row.innerHTML = `<span class="scalogram-label">${escapeHtml(nkLabel(trace.label))}<small>${escapeHtml(summary)}</small></span><canvas width="220" height="116"></canvas>`;
  drawAttenuationCanvas(row.querySelector("canvas"), trace, data);
  return row;
}

function drawAttenuationCanvas(canvas, trace, data) {
  sizeCanvasToDisplay(canvas, 220, 116);
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const left = 24 * ratio;
  const right = 4 * ratio;
  const top = 4 * ratio;
  const bottom = 13 * ratio;
  const plotW = Math.max(1, w - left - right);
  const plotH = Math.max(1, h - top - bottom);
  const values = attenuationScaleMode() === "z" ? (trace.zDisplayValues || trace.values || []) : (trace.values || []);
  const freqs = data.freqs || [];
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#091017";
  ctx.fillRect(0, 0, w, h);
  if (!values.length || !freqs.length) return;
  const rows = values.length;
  const cols = values[0]?.length || 0;
  for (let r = 0; r < rows; r++) {
    const row = values[r] || [];
    const y = top + ((rows - 1 - r) / rows) * plotH;
    const y2 = top + ((rows - r) / rows) * plotH;
    for (let c = 0; c < cols; c++) {
      const x = left + (c / cols) * plotW;
      const x2 = left + ((c + 1) / cols) * plotW;
      ctx.fillStyle = attenuationColor(Number(row[c] || 0));
      ctx.fillRect(x, y, Math.max(1, x2 - x + 0.5), Math.max(1, y2 - y + 0.5));
    }
  }
  drawStftWaveformOverlay(ctx, trace, data, left, top, plotW, plotH, ratio);
  drawAttenuationAxes(ctx, data, left, top, plotW, plotH, ratio);
}

function drawAttenuationAxes(ctx, data, left, top, plotW, plotH, ratio) {
  const freqs = data.freqs || [];
  const minFreq = Number(data.band?.low ?? freqs[0] ?? 0);
  const maxFreq = Number(freqs[freqs.length - 1] || data.band?.high || 120);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = Math.max(1, 0.6 * ratio);
  const ticks = [0, 5, 10, 20, 30, 50, 70, 90, 120].filter((freq) => freq >= minFreq && freq <= maxFreq);
  if (!ticks.includes(minFreq)) ticks.unshift(minFreq);
  if (!ticks.includes(maxFreq)) ticks.push(maxFreq);
  for (const freq of ticks) {
    if (freq < minFreq || freq > maxFreq) continue;
    const y = top + (1 - (freq - minFreq) / Math.max(1, maxFreq - minFreq)) * plotH;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = `${7.5 * ratio}px Arial`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${freq}`, left - 3 * ratio, y);
  }
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.strokeRect(left, top, plotW, plotH);
  ctx.fillStyle = "rgba(255,255,255,.76)";
  ctx.font = `${8 * ratio}px Arial`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("0s", left, top + plotH + 3 * ratio);
  ctx.textAlign = "right";
  const timeBins = data.timeBins || [];
  const endSec = Number(timeBins[timeBins.length - 1] ?? data.duration ?? 0);
  ctx.fillText(`${endSec.toFixed(2)}s`, left + plotW, top + plotH + 3 * ratio);
  ctx.restore();
}

function attenuationColor(value) {
  const v = Math.max(-1, Math.min(1, Number(value) || 0));
  const t = (v + 1) / 2;
  const stops = [
    [0.00, 0, 0, 4],
    [0.18, 29, 12, 64],
    [0.36, 87, 16, 110],
    [0.54, 151, 43, 108],
    [0.72, 224, 93, 75],
    [0.88, 252, 178, 64],
    [1.00, 252, 253, 191],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const r = Math.round(a[1] + (b[1] - a[1]) * f);
      const g = Math.round(a[2] + (b[2] - a[2]) * f);
      const bl = Math.round(a[3] + (b[3] - a[3]) * f);
      return `rgb(${r},${g},${bl})`;
    }
  }
  return "rgb(252,253,191)";
}

function createScalogramAnalysisPanel(traces, data) {
  const panel = document.createElement("div");
  panel.className = "scalogram-analysis-panel";
  const title = document.createElement("div");
  title.className = "scalogram-mode-title";
  title.textContent = "Spike analysis";
  panel.appendChild(title);
  const rows = [
    ["Spike anchor", data?.globalSpikeAnchor?.available ? `${formatSec(data.globalSpikeAnchor.time || 0)} · ${nkLabel(data.globalSpikeAnchor.traceLabel || data.globalSpikeAnchor.electrode || "Fz")}` : "-"],
    ["After-slow anchor", data?.globalAfterSlowAnchor?.available ? `${formatSec(data.globalAfterSlowAnchor.time || 0)} · ${nkLabel(data.globalAfterSlowAnchor.traceLabel || data.globalAfterSlowAnchor.electrode || "Fz")}` : "-"],
    ["Traces", String(Array.isArray(traces) ? traces.length : 0)],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "scalogram-analysis-row";
    row.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    panel.appendChild(row);
  }
  return panel;
}

function appendScwtLateralitySection(panel, data, showingSpike, showingSlow) {
  const scwt = data?.scwtLaterality;
  const title = document.createElement("div");
  title.className = "scalogram-analysis-subtitle";
  title.textContent = "sCWT-LI frontal ROI";
  panel.appendChild(title);
  if (!scwt?.available) {
    const empty = document.createElement("div");
    empty.className = "scalogram-analysis-empty";
    empty.textContent = scwt?.reason || "Unavailable";
    panel.appendChild(empty);
    return;
  }
  const help = document.createElement("div");
  help.className = "scalogram-analysis-help";
  help.textContent = `L ${scwt.leftRoi?.join("/") || "Fp1/F3/F7"} · R ${scwt.rightRoi?.join("/") || "Fp2/F4/F8"} · ${metricNumber(scwt.eventWindowHalfMs, 0)} ms half-window`;
  panel.appendChild(help);
  const events = (scwt.events || []).filter((event) => (event.event === "spike" && showingSpike) || (event.event === "afterSlow" && showingSlow));
  events.forEach((event) => {
    const eventTitle = document.createElement("div");
    eventTitle.className = "scalogram-analysis-row metric-header";
    eventTitle.innerHTML = `<span>${escapeHtml(event.label || event.event || "event")}</span><strong>LI · VL / VR</strong>`;
    panel.appendChild(eventTitle);
    if (!event.available) {
      const empty = document.createElement("div");
      empty.className = "scalogram-analysis-empty";
      empty.textContent = event.reason || "Unavailable";
      panel.appendChild(empty);
      return;
    }
    (event.bands || []).forEach((band) => {
      const row = document.createElement("div");
      row.className = "scalogram-analysis-row";
      const role = band.role === "primary" ? "main" : "sens";
      const value = Number(band.value);
      const valueClass = Number.isFinite(value) && value < 0 ? " class=\"negative-latency\"" : "";
      const actualHigh = Number.isFinite(Number(band.actualHighHz)) && Number(band.actualHighHz) !== Number(band.highHz)
        ? `→${metricNumber(band.actualHighHz, 0)}`
        : "";
      row.innerHTML = `<span>${escapeHtml(band.label || "band")} ${actualHigh} · ${role}</span><strong${valueClass}>${band.available ? metricNumber(band.value, 3) : "-"} · ${band.available ? metricNumber(band.VL, 2) : "-"}/${band.available ? metricNumber(band.VR, 2) : "-"}</strong>`;
      panel.appendChild(row);
    });
  });
}

function appendLatencySection(panel, titleText, pairs) {
  const latencyTitle = document.createElement("div");
  latencyTitle.className = "scalogram-analysis-subtitle";
  latencyTitle.textContent = titleText;
  panel.appendChild(latencyTitle);
  if (!pairs.length) {
    const empty = document.createElement("div");
    empty.className = "scalogram-analysis-empty";
    empty.textContent = "No paired traces";
    panel.appendChild(empty);
    return;
  }
  for (const pair of pairs.slice(0, 12)) {
    const row = document.createElement("div");
    const latency = Number(pair.latencyMsRightMinusLeft);
    const latencyClass = Number.isFinite(latency) && latency < 0 ? " class=\"negative-latency\"" : "";
    row.className = "scalogram-analysis-row";
    row.innerHTML = `<span>${escapeHtml(nkLabel(pair.leftTraceLabel))} / ${escapeHtml(nkLabel(pair.rightTraceLabel))}</span><strong${latencyClass}>${Number.isFinite(latency) ? latency.toFixed(1) : "-"} ms</strong>`;
    panel.appendChild(row);
  }
}

function fzSpikeTrace(traces) {
  const candidates = (traces || []).filter((trace) => /(^|[^A-Za-z])Fz([^A-Za-z]|$|-)/i.test(String(trace?.label || "")));
  if (!candidates.length) return null;
  return (
    candidates.find((trace) => /^Fz-/i.test(String(trace.label || ""))) ||
    candidates.find((trace) => /Fz-(AVG|Lap|C3\/C4)/i.test(String(trace.label || ""))) ||
    candidates[0]
  );
}

async function loadFzSpikeTopomap() {
  const traces = state.scalogramData?.traces || [];
  if (!state.recordingId || !state.scalogramSelection || !state.scalogramVisible || !traces.length) {
    state.fzSpikeTopomap = null;
    state.fzAfterSlowTopomap = null;
    renderFzSpikeTopomap();
    return;
  }
  const trace = fzSpikeTrace(traces);
  const spikeTime = Number(state.scalogramData?.globalSpikeAnchor?.time ?? trace?.spikeMetrics?.peakTime);
  const slowTime = Number(state.scalogramData?.globalAfterSlowAnchor?.time ?? trace?.spikeMetrics?.afterSlowTime);
  const traceLabel = state.scalogramData?.globalSpikeAnchor?.traceLabel || trace?.label || "Fz";
  const slowTraceLabel = state.scalogramData?.globalAfterSlowAnchor?.traceLabel || trace?.label || "Fz";
  if (!trace || !Number.isFinite(spikeTime)) {
    state.fzSpikeTopomap = { available: false, reason: "Fz spike peak unavailable", traceLabel };
    state.fzAfterSlowTopomap = { available: false, reason: "Fz after-slow peak unavailable", traceLabel: slowTraceLabel };
    renderFzSpikeTopomap();
    return;
  }
  const requestId = ++state.fzSpikeTopomapRequestId;
  state.fzSpikeTopomap = {
    loading: true,
    kind: "spike",
    traceLabel,
    peakTime: spikeTime,
    zeroTime: spikeTime,
    anchorType: anchorTypeLabel("fz_peak"),
  };
  state.fzAfterSlowTopomap = Number.isFinite(slowTime)
    ? { loading: true, kind: "after-slow", traceLabel: slowTraceLabel, peakTime: slowTime, zeroTime: spikeTime }
    : { available: false, kind: "after-slow", reason: "Fz after-slow peak unavailable", traceLabel: slowTraceLabel, zeroTime: spikeTime };
  renderFzSpikeTopomap();
  const baseParams = {
    id: state.recordingId,
    tc: els.tcSelect.value,
    hf: els.hfSelect.value,
    ac: els.acSelect.value,
    halfWindowSec: normalizeFzPeakWindowMs(state.fzPeakWindowMs) / 1000,
  };
  try {
    const spikeData = await fetchJson(`/api/topomap?${qs({ ...baseParams, time: spikeTime })}`);
    if (requestId !== state.fzSpikeTopomapRequestId) return;
    state.fzSpikeTopomap = {
      ...spikeData,
      kind: "spike",
      traceLabel,
      peakTime: spikeTime,
      zeroTime: spikeTime,
      anchorType: anchorTypeLabel("fz_peak"),
      anchorElectrode: "Fz",
    };
  } catch (err) {
    if (requestId !== state.fzSpikeTopomapRequestId) return;
    state.fzSpikeTopomap = { available: false, kind: "spike", reason: err.message, traceLabel, peakTime: spikeTime, zeroTime: spikeTime };
  }
  if (Number.isFinite(slowTime)) {
    try {
      const slowData = await fetchJson(`/api/topomap?${qs({ ...baseParams, time: slowTime })}`);
      if (requestId !== state.fzSpikeTopomapRequestId) return;
      state.fzAfterSlowTopomap = { ...slowData, kind: "after-slow", traceLabel: slowTraceLabel, peakTime: slowTime, zeroTime: spikeTime };
    } catch (err) {
      if (requestId !== state.fzSpikeTopomapRequestId) return;
      state.fzAfterSlowTopomap = { available: false, kind: "after-slow", reason: err.message, traceLabel: slowTraceLabel, peakTime: slowTime, zeroTime: spikeTime };
    }
  }
  renderFzSpikeTopomap();
}

function renderFzSpikeTopomap(reason = "") {
  if (els.fzSpikeTopomapTitle) {
    els.fzSpikeTopomapTitle.textContent = "Fz spike topomap";
  }
  if (els.fzAfterSlowTopomapTitle) {
    els.fzAfterSlowTopomapTitle.textContent = "Fz after-slow topomap";
  }
  renderFzEventTopomap({
    canvas: els.fzSpikeTopomapCanvas,
    readout: els.fzSpikeTopomapReadout,
    ftliReadout: els.fzSpikeFtliReadout,
    data: state.fzSpikeTopomap,
    kind: "spike",
    emptyText: "Drag waveform to select a spike",
    unavailableText: "Fz spike topomap unavailable",
    reason,
  });
  renderFzEventTopomap({
    canvas: els.fzAfterSlowTopomapCanvas,
    readout: els.fzAfterSlowTopomapReadout,
    ftliReadout: els.fzAfterSlowFtliReadout,
    data: state.fzAfterSlowTopomap,
    kind: "after-slow",
    emptyText: "Drag waveform to select after-slow",
    unavailableText: "Fz after-slow topomap unavailable",
    reason,
  });
}

function renderFzEventTopomap({ canvas, readout, ftliReadout, data, kind, emptyText, unavailableText, reason = "" }) {
  if (!canvas) return;
  if (!state.scalogramSelection || !state.scalogramVisible) {
    if (readout) readout.textContent = emptyText;
    if (ftliReadout) ftliReadout.textContent = "FTLI -";
    clearTopomap(canvas, "No selection");
    return;
  }
  if (data?.loading) {
    const relMs = Number.isFinite(Number(data.peakTime)) && Number.isFinite(Number(data.zeroTime))
      ? (Number(data.peakTime) - Number(data.zeroTime)) * 1000
      : 0;
    if (readout) readout.textContent = `${nkLabel(data.traceLabel || "Fz")} ${kind} ${relMs.toFixed(0)} ms · loading ±${normalizeFzPeakWindowMs(state.fzPeakWindowMs)} ms`;
    if (ftliReadout) ftliReadout.textContent = "FTLI loading";
    clearTopomap(canvas, "Loading");
    return;
  }
  if (!data?.available || !Array.isArray(data.channels)) {
    if (readout) readout.textContent = reason || data?.reason || unavailableText;
    if (ftliReadout) ftliReadout.textContent = "FTLI unavailable";
    clearTopomap(canvas, "Unavailable");
    return;
  }
  const channels = data.channels;
  const earlobe = channels.map((ch) => Number(data.system?.[ch] || 0));
  const scale = Math.max(5, ...earlobe.map((v) => Math.abs(v)));
  if (readout) {
    const trace = nkLabel(data.traceLabel || "Fz");
    const relMs = Number.isFinite(Number(data.peakTime)) && Number.isFinite(Number(data.zeroTime))
      ? (Number(data.peakTime) - Number(data.zeroTime)) * 1000
      : 0;
    const anchorText = data.anchorType ? ` · anchor: ${data.anchorType}` : "";
    readout.textContent = `${trace} ${kind} ${relMs.toFixed(0)} ms · ${formatSec(data.peakTime ?? data.time)} · earlobe avg ±${Number(data.windowHalfMs || normalizeFzPeakWindowMs(state.fzPeakWindowMs)).toFixed(0)} ms${anchorText}`;
  }
  drawTopomap(canvas, channels, earlobe, scale, { mode: "voltage" });
  renderFzSpikeFtli(data.ftli, ftliReadout);
}

function renderFzSpikeFtli(ftli, target = els.fzSpikeFtliReadout) {
  if (!target) return;
  if (!ftli?.available) {
    target.textContent = "FTLI unavailable";
    return;
  }
  target.textContent = `FTLI ${Number(ftli.value).toFixed(3)} · VL ${Number(ftli.VL).toFixed(1)}uV · VR ${Number(ftli.VR).toFixed(1)}uV`;
}

function scalogramDetectionMode() {
  const mode = state.scalogramDetectionMode || "both";
  return mode === "spike" || mode === "slow" ? mode : "both";
}

function detectionModeLabel(mode = scalogramDetectionMode()) {
  if (mode === "spike") return "Spike peak";
  if (mode === "slow") return "After-slow";
  return "Spike + after-slow";
}

function scalogramDisplayScope() {
  return "all";
}

function createScalogramModeGroup(mode, title, traces, data, scope = "all") {
  const panel = document.createElement("div");
  panel.className = `scalogram-mode-group ${mode}`;
  const heading = document.createElement("div");
  heading.className = "scalogram-mode-title";
  heading.textContent = title;
  panel.appendChild(heading);

  const groups = groupScalogramTraces(traces);
  const columns = document.createElement("div");
  columns.className = "scalogram-columns";
  const leftColumn = document.createElement("div");
  leftColumn.className = "scalogram-column left";
  const rightColumn = document.createElement("div");
  rightColumn.className = "scalogram-column right";
  columns.append(leftColumn, rightColumn);
  panel.appendChild(columns);

  groups.left.forEach((item) => leftColumn.appendChild(createScalogramRow(item.trace, item.index, data, mode)));
  groups.right.forEach((item) => rightColumn.appendChild(createScalogramRow(item.trace, item.index, data, mode)));
  groups.full.forEach((item, fullIndex) => {
    const leftCount = groups.left.length + Math.ceil(fullIndex / 2);
    const rightCount = groups.right.length + Math.floor(fullIndex / 2);
    const target = leftCount <= rightCount ? leftColumn : rightColumn;
    target.appendChild(createScalogramRow(item.trace, item.index, data, mode));
  });
  return panel;
}

function groupScalogramTraces(traces) {
  const groups = { left: [], right: [], full: [] };
  traces.forEach((trace, index) => {
    const item = { trace, index };
    const group = String(trace.group || "");
    if (group === "left_temporal" || group === "left_parasagittal") {
      groups.left.push(item);
    } else if (group === "right_temporal" || group === "right_parasagittal") {
      groups.right.push(item);
    } else {
      groups.full.push(item);
    }
  });
  return groups;
}

function createScalogramRow(trace, index, data, mode = "signed") {
  const row = document.createElement("div");
  row.className = `scalogram-row${index === state.selectedScalogramIndex ? " active" : ""}`;
  row.tabIndex = 0;
  const metric = mode === "magnitude" ? "magnitude" : "signed";
  row.innerHTML = `<span class="scalogram-label">${escapeHtml(nkLabel(trace.label))}<small>${escapeHtml(metric)}</small></span><canvas width="104" height="104"></canvas>`;
  row.addEventListener("click", () => {
    state.selectedScalogramIndex = index;
    renderScalogram();
  });
  row.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      state.selectedScalogramIndex = index;
      renderScalogram();
    }
  });
  drawScalogramCanvas(row.querySelector("canvas"), trace, data, false, mode);
  return row;
}

function metricNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "-";
}

function topMetricTraceIndexes(traces, getter, limit = 3) {
  return new Set(
    traces
      .map((trace, index) => ({ index, role: trace?.role || "", value: Number(getter(trace)) }))
      .filter((item) => item.role !== "ecg" && Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map((item) => item.index)
  );
}

function spikeMetricText(trace, detailed) {
  const m = trace?.spikeMetrics;
  const mode = scalogramDetectionMode();
  if (!m?.available) return detailed ? `${nkLabel(trace?.label || "")} · spike unavailable` : "score -";
  if (detailed && mode === "slow") {
    const slowLatency = m.afterSlowPairedLatency?.available ? ` · ΔR-L ${Number(m.afterSlowPairedLatency.latencyMsRightMinusLeft).toFixed(1)}ms vs ${nkLabel(m.afterSlowPairedLatency.pairedTraceLabel)}` : "";
    if (!m.afterSlowAvailable) return `${nkLabel(trace.label)} · after-slow unavailable · ${m.afterSlowReason || ""}`;
    const slowCurv = m.afterSlowCurvatureUvPerMs2 != null ? ` · curv ${Number(m.afterSlowCurvatureUvPerMs2).toFixed(4)}` : "";
    return `${nkLabel(trace.label)} · after-slow abs ${Number(m.afterSlowAbsAmplitudeUv).toFixed(1)}uV · amp ${Number(m.afterSlowAmplitudeUv).toFixed(1)}uV · ${formatSec(m.afterSlowTime)} · +${Number(m.afterSlowLatencyMs).toFixed(1)}ms${slowCurv}${slowLatency}`;
  }
  if (detailed && mode === "both") {
    const sharp = m.sharpnessAvailable ? ` · sharp ${Number(m.sharpnessUvPerMs).toFixed(2)}uV/ms · curv ${Number(m.curvatureUvPerMs2).toFixed(4)}` : "";
    const slow = m.afterSlowAvailable ? ` · slow ${Number(m.afterSlowAbsAmplitudeUv).toFixed(1)}uV @ +${Number(m.afterSlowLatencyMs).toFixed(0)}ms${m.afterSlowCurvatureUvPerMs2 != null ? ` · slow curv ${Number(m.afterSlowCurvatureUvPerMs2).toFixed(4)}` : ""}` : "";
    const latency = m.pairedLatency?.available ? ` · ΔR-L ${Number(m.pairedLatency.latencyMsRightMinusLeft).toFixed(1)}ms vs ${nkLabel(m.pairedLatency.pairedTraceLabel)}` : "";
    const refined = m.peakRefined ? " · wf-refined" : "";
    return `${nkLabel(trace.label)} · score ${Number(m.spikeScore).toFixed(2)} · ${formatSec(m.peakTime)} · ${Number(m.peakFreq).toFixed(0)}Hz${sharp}${slow}${latency}${refined}`;
  }
  if (detailed) {
    const sharp = m.sharpnessAvailable ? ` · sharp ${Number(m.sharpnessUvPerMs).toFixed(2)}uV/ms · curv ${Number(m.curvatureUvPerMs2).toFixed(4)}` : "";
    const latency = m.pairedLatency?.available ? ` · ΔR-L ${Number(m.pairedLatency.latencyMsRightMinusLeft).toFixed(1)}ms vs ${nkLabel(m.pairedLatency.pairedTraceLabel)}` : "";
    const refined = m.peakRefined ? " · wf-refined" : "";
    return `${nkLabel(trace.label)} · score ${Number(m.spikeScore).toFixed(2)} · neg-up ${Number(m.negativityPeak ?? m.negativePeak).toFixed(2)} · ${formatSec(m.peakTime)} · ${Number(m.peakFreq).toFixed(0)}Hz${sharp}${latency}${refined}`;
  }
  const sharp = m.sharpnessAvailable ? ` · sh ${Number(m.sharpnessUvPerMs).toFixed(1)}` : "";
  const slow = mode === "both" && m.afterSlowAvailable ? ` · slow ${Number(m.afterSlowAbsAmplitudeUv).toFixed(0)}` : "";
  const latency = m.pairedLatency?.available ? ` · Δ ${Number(m.pairedLatency.latencyMsRightMinusLeft).toFixed(0)}ms` : "";
  const refined = m.peakRefined ? " · wf" : "";
  return `score ${Number(m.spikeScore).toFixed(1)}${sharp}${slow}${latency}${refined}`;
}

function clearScalogramCanvas(canvas, text) {
  sizeCanvasToDisplay(canvas, 180, 60);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#68707c";
  ctx.font = `${11 * (window.devicePixelRatio || 1)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function drawScalogramCanvas(canvas, trace, data, detailed, mode = "signed") {
  sizeCanvasToDisplay(canvas, detailed ? 220 : 112, detailed ? 96 : 104);
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const left = detailed ? 34 * ratio : 0;
  const right = detailed ? 7 * ratio : 0;
  const top = 4 * ratio;
  const bottom = detailed ? 12 * ratio : 2 * ratio;
  const plotW = Math.max(1, w - left - right);
  const plotH = Math.max(1, h - top - bottom);
  const values = mode === "magnitude" ? trace.magnitudeValues || trace.values || [] : trace.values || [];
  const freqs = data.freqs || [];

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#050509";
  ctx.fillRect(0, 0, w, h);
  if (!values.length || !freqs.length) return;

  const rows = values.length;
  const cols = values[0]?.length || 0;
  for (let r = 0; r < rows; r++) {
    const row = values[r] || [];
    const y = top + ((rows - 1 - r) / rows) * plotH;
    const y2 = top + ((rows - r) / rows) * plotH;
    for (let c = 0; c < cols; c++) {
      const x = left + (c / cols) * plotW;
      const x2 = left + ((c + 1) / cols) * plotW;
      ctx.fillStyle = mode === "magnitude" ? scalogramMagnitudeColor(Number(row[c] || 0)) : scalogramColor(Number(row[c] || 0));
      ctx.fillRect(x, y, Math.max(1, x2 - x + 0.5), Math.max(1, y2 - y + 0.5));
    }
  }
  drawScalogramWaveform(ctx, trace, data, left, top, plotW, plotH, ratio, detailed);
  drawScalogramBands(ctx, data.bands || [], freqs, data.duration || 1, left, top, plotW, plotH, ratio, detailed);
  drawScalogramDetectionMarkers(ctx, trace, data, left, top, plotW, plotH, ratio, detailed);
}

function drawScalogramWaveform(ctx, trace, data, left, top, plotW, plotH, ratio, detailed) {
  const overlay = scalogramOverlayFromWaveViewer(trace, data);
  const waveform = overlay.values.length >= 2
    ? overlay.values
    : (Array.isArray(trace?.waveformUv) ? trace.waveformUv : trace?.waveform || []);
  if (!Array.isArray(waveform) || waveform.length < 2) return;
  const sensitivity = sensitivityValue();
  const uvPerMm = traceUvPerMm(trace, sensitivity, waveform);
  const pxPerMm = 3.78 * ratio;
  const yScale = pxPerMm / Math.max(1e-6, uvPerMm);
  const centerY = top + plotH * 0.5;
  const start = Number(data?.start || state.scalogramSelection?.start || state.start || 0);
  const duration = Math.max(1e-6, Number(data?.duration || state.scalogramSelection?.duration || 1));
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, plotW, plotH);
  ctx.clip();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  waveform.forEach((raw, index) => {
    const valueUv = Number(raw) || 0;
    const t = overlay.times.length === waveform.length ? Number(overlay.times[index]) : start + (index / Math.max(1, waveform.length - 1)) * duration;
    const x = left + ((t - start) / duration) * plotW;
    const y = centerY - valueUv * yScale;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = detailed ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.82)";
  ctx.lineWidth = (detailed ? 4.2 : 3.4) * ratio;
  ctx.stroke();
  ctx.strokeStyle = detailed ? "rgba(5,9,12,.9)" : "rgba(5,9,12,.78)";
  ctx.lineWidth = (detailed ? 1.75 : 1.35) * ratio;
  ctx.stroke();
  if (detailed) {
    ctx.fillStyle = "rgba(5,9,12,.78)";
    ctx.font = `${8 * ratio}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const source = overlay.values.length >= 2 ? "viewer" : "api";
    ctx.fillText(`overlay ${uvPerMm.toFixed(0)}uV/mm · ${source}`, left + 3 * ratio, top + 3 * ratio);
  }
  ctx.restore();
}

function scalogramOverlayFromWaveViewer(trace, data) {
  const empty = { times: [], values: [] };
  const windowData = state.windowData;
  if (!windowData) return empty;
  const times = Array.isArray(windowData.times) ? windowData.times : [];
  if (times.length < 2) return empty;
  const label = String(trace?.label || "");
  const role = String(trace?.role || "eeg");
  let sourceTraces = windowData.traces || [];
  if (isMultiWindowData()) {
    const active = data?.montage || activeMontageValue();
    const view = (windowData.montageViews || []).find((item) => item.montage === active) || windowData.montageViews?.[0];
    sourceTraces = view?.traces || [];
  }
  const source = sourceTraces.find((item) => String(item?.label || "") === label && String(item?.role || "eeg") === role)
    || sourceTraces.find((item) => String(item?.label || "") === label);
  const values = Array.isArray(source?.values) ? source.values : [];
  if (values.length !== times.length) return empty;
  const start = Number(data?.start || state.scalogramSelection?.start || state.start || 0);
  const end = start + Math.max(1e-6, Number(data?.duration || state.scalogramSelection?.duration || 1));
  const outTimes = [];
  const outValues = [];
  for (let i = 0; i < times.length; i++) {
    const time = Number(times[i]);
    if (!Number.isFinite(time) || time < start || time > end) continue;
    outTimes.push(time);
    outValues.push(Number(values[i]) || 0);
  }
  return outValues.length >= 2 ? { times: outTimes, values: outValues } : empty;
}

function drawScalogramDetectionMarkers(ctx, trace, data, left, top, plotW, plotH, ratio, detailed) {
  const m = trace?.spikeMetrics;
  if (!m) return;
  const mode = scalogramDetectionMode();
  if (mode === "spike" || mode === "both") {
    drawSpikeMarker(ctx, m, data, left, top, plotW, plotH, ratio, detailed);
  }
  if (mode === "slow" || mode === "both") {
    drawAfterSlowMarker(ctx, m, data, left, top, plotW, plotH, ratio, detailed);
  }
}

function drawSpikeMarker(ctx, m, data, left, top, plotW, plotH, ratio, detailed) {
  if (!m?.available || !Number.isFinite(Number(m.peakTime))) return;
  const x = timeToScalogramX(m.peakTime, data, left, plotW);
  if (x === null) return;
  ctx.save();
  ctx.strokeStyle = m.sharpnessAvailable ? "rgba(255,221,64,.95)" : "rgba(255,255,255,.7)";
  ctx.lineWidth = (detailed ? 2.4 : 2.0) * ratio;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + plotH);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(x, top + 2 * ratio);
  ctx.lineTo(x - 4.5 * ratio, top + 9 * ratio);
  ctx.lineTo(x + 4.5 * ratio, top + 9 * ratio);
  ctx.closePath();
  ctx.fill();
  if (detailed && m.sharpnessAvailable) {
    ctx.fillStyle = "rgba(31,37,42,.82)";
    ctx.font = `${8 * ratio}px Arial`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`sharp ${Number(m.sharpnessUvPerMs).toFixed(2)}uV/ms`, left + plotW - 3 * ratio, top + 3 * ratio);
  }
  ctx.restore();
}

function drawAfterSlowMarker(ctx, m, data, left, top, plotW, plotH, ratio, detailed) {
  if (!m?.afterSlowAvailable || !Number.isFinite(Number(m.afterSlowTime))) return;
  const x = timeToScalogramX(m.afterSlowTime, data, left, plotW);
  if (x === null) return;
  ctx.save();
  ctx.strokeStyle = "rgba(52,211,235,.95)";
  ctx.lineWidth = (detailed ? 2.2 : 1.8) * ratio;
  ctx.setLineDash([4 * ratio, 3 * ratio]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(x, top + plotH - 8 * ratio, 4 * ratio, 0, Math.PI * 2);
  ctx.fill();
  if (detailed) {
    ctx.fillStyle = "rgba(31,37,42,.82)";
    ctx.font = `${8 * ratio}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`slow ${Number(m.afterSlowLatencyMs).toFixed(0)}ms`, left + 3 * ratio, top + plotH - 14 * ratio);
  }
  ctx.restore();
}

function drawScalogramBands(ctx, bands, freqs, duration, left, top, plotW, plotH, ratio, detailed) {
  const minFreq = Number(freqs[0] || 1);
  const maxFreq = Number(freqs[freqs.length - 1] || 70);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.66)";
  ctx.fillStyle = detailed ? "#37414a" : "rgba(42,48,54,.72)";
  ctx.font = `${(detailed ? 8 : 7) * ratio}px Arial`;
  ctx.textBaseline = "middle";
  for (const band of bands) {
    const low = Math.max(minFreq, Number(band.low));
    const high = Math.min(maxFreq, Number(band.high));
    if (high < minFreq || low > maxFreq) continue;
    const yHigh = top + (1 - (high - minFreq) / Math.max(1, maxFreq - minFreq)) * plotH;
    const yLow = top + (1 - (low - minFreq) / Math.max(1, maxFreq - minFreq)) * plotH;
    ctx.beginPath();
    ctx.moveTo(left, yLow);
    ctx.lineTo(left + plotW, yLow);
    ctx.stroke();
    if (detailed) {
      const labelY = Math.max(top + 5 * ratio, Math.min(top + plotH - 5 * ratio, (yHigh + yLow) / 2));
      ctx.textAlign = "right";
      ctx.fillText(band.label, left - 4 * ratio, labelY);
    }
  }
  drawScalogramFreqTicks(ctx, minFreq, maxFreq, left, top, plotW, plotH, ratio, detailed);
  if (detailed) {
    ctx.strokeStyle = "#9da39a";
    ctx.strokeRect(left, top, plotW, plotH);
    ctx.fillStyle = "#4e555c";
    ctx.textAlign = "left";
    ctx.fillText("0s", left, top + plotH + 8 * ratio);
    ctx.textAlign = "right";
    ctx.fillText(`${Number(duration || 1).toFixed(3)}s`, left + plotW, top + plotH + 8 * ratio);
  }
  ctx.restore();
}

function drawScalogramFreqTicks(ctx, minFreq, maxFreq, left, top, plotW, plotH, ratio, detailed) {
  const candidates = [5, 10, 20, 30, 50, 70, 100, 120];
  const ticks = candidates.filter((freq) => freq >= minFreq && freq <= maxFreq);
  if (!ticks.length) return;
  ctx.save();
  ctx.font = `${(detailed ? 8 : 7.5) * ratio}px Arial`;
  ctx.textBaseline = "middle";
  ctx.textAlign = detailed ? "left" : "right";
  for (const freq of ticks) {
    const y = top + (1 - (freq - minFreq) / Math.max(1, maxFreq - minFreq)) * plotH;
    ctx.strokeStyle = detailed ? "rgba(45,54,60,.3)" : "rgba(255,255,255,.42)";
    ctx.lineWidth = Math.max(1, 0.65 * ratio);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.stroke();
    const label = `${freq}Hz`;
    const labelX = detailed ? left + 3 * ratio : left + plotW - 3 * ratio;
    const labelY = Math.max(top + 6 * ratio, Math.min(top + plotH - 6 * ratio, y));
    ctx.fillStyle = detailed ? "rgba(31,37,42,.82)" : "rgba(5,9,12,.72)";
    const textW = ctx.measureText(label).width;
    ctx.fillRect(
      detailed ? labelX - 2 * ratio : labelX - textW - 3 * ratio,
      labelY - 5.5 * ratio,
      textW + 4 * ratio,
      10.5 * ratio
    );
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(label, labelX, labelY);
  }
  ctx.restore();
}

function sizeCanvasToDisplay(canvas, minW, minH) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(minW, Math.floor((rect.width || minW) * ratio));
  canvas.height = Math.max(minH, Math.floor((rect.height || minH) * ratio));
}

function scalogramColor(value) {
  const v = Math.max(-1, Math.min(1, Number(value) || 0));
  const neg = [36, 91, 170];
  const mid = [248, 248, 244];
  const pos = [190, 48, 48];
  const t = Math.abs(v);
  const a = v > 0 ? neg : pos;
  const r = Math.round(mid[0] + (a[0] - mid[0]) * t);
  const g = Math.round(mid[1] + (a[1] - mid[1]) * t);
  const b = Math.round(mid[2] + (a[2] - mid[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function scalogramMagnitudeColor(value) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const low = [250, 249, 242];
  const high = [44, 110, 92];
  const r = Math.round(low[0] + (high[0] - low[0]) * v);
  const g = Math.round(low[1] + (high[1] - low[1]) * v);
  const b = Math.round(low[2] + (high[2] - low[2]) * v);
  return `rgb(${r},${g},${b})`;
}

function jumpToAnnotation(row) {
  const onset = Number(row.onset || 0);
  const duration = visibleDuration();
  state.start = clampStart(onset - duration / 2, duration);
  state.cursorTime = onset;
  hideContextMenu();
  loadWindow();
}

function recordingDuration() {
  return Number(
    state.metadata?.raw?.durationSec ||
      state.windowData?.metadata?.raw?.durationSec ||
      state.metadata?.directReader?.durationSec ||
      0
  );
}

function clampStart(start, duration = visibleDuration()) {
  const total = recordingDuration();
  const minStart = 0;
  if (!Number.isFinite(start)) return minStart;
  if (total && total <= duration) return minStart;
  if (!total) return Math.max(minStart, start);
  return Math.min(Math.max(minStart, start), Math.max(minStart, total - duration));
}

function spectrogramColor(value) {
  const t = Math.max(0, Math.min(1, Number(value || 0)));
  const stops = [
    [0.0, 0, 0, 131],
    [0.125, 0, 60, 170],
    [0.375, 5, 255, 255],
    [0.625, 255, 255, 0],
    [0.875, 250, 0, 0],
    [1.0, 128, 0, 0],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t <= b[0]) {
      const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const r = Math.round(a[1] + (b[1] - a[1]) * f);
      const g = Math.round(a[2] + (b[2] - a[2]) * f);
      const blue = Math.round(a[3] + (b[3] - a[3]) * f);
      return `rgb(${r},${g},${blue})`;
    }
  }
  return "rgb(128,0,0)";
}

function draw() {
  const canvas = els.waveCanvas;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const ratio = window.devicePixelRatio || 1;
  const { left, right, top, bottom } = plotLayout(canvas);
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const data = state.windowData;
  if (!data || !data.traces || !data.traces.length) {
    ctx.fillStyle = "#333";
    ctx.fillText("No decoded waveform data available.", left, top + 24);
    return;
  }

  const duration = visibleDuration();
  const start = state.start;
  const pxPerMm = 3.78 * ratio;
  const sensitivity = sensitivityValue();

  if (isMultiWindowData(data)) {
    const layouts = multiMontageColumnLayouts(left, top, plotW, plotH, ratio);
    const views = data.montageViews || [];
    layouts.forEach((layout, index) => {
      const view = views[index];
      if (!view) return;
      drawWaveColumn(ctx, layout, displayTraces(view.traces || []), data.times || [], {
        duration,
        start,
        pxPerMm,
        sensitivity,
        ratio,
        montage: view.montage,
        label: view.label || view.montage,
        active: view.montage === activeMontageValue(),
      });
    });
    drawEventStrip();
    return;
  }

  const traces = displayTraces(data.traces);
  drawWaveColumn(ctx, { left, top, plotW, plotH, labelLeft: 45 * ratio, numberRight: 35 * ratio }, traces, data.times || [], {
    duration,
    start,
    pxPerMm,
    sensitivity,
    ratio,
    montage: activeMontageValue(),
    label: labelForMontage(),
    active: true,
    single: true,
  });
  drawEventStrip();
}


function isMultiWindowData(data = state.windowData) {
  return isMultiMontageMode() && Array.isArray(data?.montageViews) && data.montageViews.length > 0;
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
  const selection = state.dragSelection || state.topomapSelection || state.scalogramSelection;
  if (!selection) return;
  const selStart = Number(selection.start || 0);
  const selEnd = selStart + Number(selection.duration || 1);
  if (selEnd < start || selStart > start + duration) return;
  const x1 = left + ((Math.max(selStart, start) - start) / duration) * plotW;
  const x2 = left + ((Math.min(selEnd, start + duration) - start) / duration) * plotW;
  ctx.save();
  ctx.fillStyle = "rgba(79, 176, 104, .13)";
  ctx.strokeStyle = "rgba(79, 176, 104, .72)";
  ctx.lineWidth = Math.max(0.35, 0.35 * ratio);
  ctx.fillRect(x1, top, Math.max(2 * ratio, x2 - x1), plotH);
  ctx.strokeRect(x1, top, Math.max(2 * ratio, x2 - x1), plotH);
  ctx.restore();
}

function drawCursorLine(ctx, left, top, plotW, plotH, start, duration, ratio) {
  if (state.cursorTime === null) return;
  if (state.cursorTime < start || state.cursorTime > start + duration) return;
  const x = left + ((state.cursorTime - start) / duration) * plotW;
  ctx.save();
  ctx.strokeStyle = "rgba(79, 176, 104, .55)";
  ctx.lineWidth = Math.max(0.35, 0.32 * ratio);
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

const TOPO_POSITIONS = {
  Fp1: [-0.32, 0.88],
  Fp2: [0.32, 0.88],
  F7: [-0.78, 0.48],
  F8: [0.78, 0.48],
  T7: [-0.94, 0.0],
  T8: [0.94, 0.0],
  P7: [-0.78, -0.48],
  P8: [0.78, -0.48],
  F3: [-0.43, 0.46],
  F4: [0.43, 0.46],
  C3: [-0.5, 0.0],
  C4: [0.5, 0.0],
  P3: [-0.43, -0.46],
  P4: [0.43, -0.46],
  O1: [-0.32, -0.88],
  O2: [0.32, -0.88],
  Fz: [0.0, 0.52],
  Cz: [0.0, 0.0],
  Pz: [0.0, -0.52],
};

function renderTopomaps() {
  applyTopomapLayout();
  const sample = currentTopomapSample();
  if (!sample) {
    els.topomapReadout.textContent = "No topomap data";
    clearTopomap(els.systemTopomapCanvas, "No data");
    return;
  }
  const precise = preciseTopomapSample();
  if (els.earlobeTopomapTitle) {
    els.earlobeTopomapTitle.textContent = "System reference average";
  }
  const systemChannels = precise?.channels || sample.channels;
  const systemValues = precise?.system || sample.system || [];
  const systemScale = Math.max(5, ...systemValues.map((v) => Math.abs(v)));
  const readoutParts = [`${formatSec(precise?.time ?? sample.time)}`, `mean scale ±${systemScale.toFixed(0)}uV`];
  if (precise) {
    readoutParts.push(`system ref ${precise.referenceChannels.join("/")}`);
    if (Number.isFinite(Number(precise.windowStart)) && Number.isFinite(Number(precise.windowEnd))) {
      readoutParts.push(`avg ${formatSec(Number(precise.windowStart))}-${formatSec(Number(precise.windowEnd))}`);
    } else {
      readoutParts.push(`avg ±${Number(precise.windowHalfMs || 10).toFixed(0)}ms`);
    }
  } else if (state.preciseTopomap?.available === false) {
    readoutParts.push(state.preciseTopomap.reason || "system ref unavailable");
  } else {
    readoutParts.push("loading system ref");
  }
  els.topomapReadout.textContent = readoutParts.join(" · ");
  drawTopomap(els.systemTopomapCanvas, systemChannels, systemValues, systemScale);
}

function preciseTopomapSample() {
  const data = state.preciseTopomap;
  if (!data?.available || !Array.isArray(data.channels)) return null;
  const channels = data.channels;
  const system = channels.map((ch) => Number(data.system?.[ch] || 0));
  if (!system.length) return null;
  return {
    channels,
    system,
    time: Number(data.time || state.cursorTime || 0),
    windowHalfMs: Number(data.windowHalfMs || 10),
    referenceChannels: data.referenceChannels || [],
    windowStart: Number(data.windowStart),
    windowEnd: Number(data.windowEnd),
  };
}

function currentTopomapSample() {
  const topomap = state.windowData?.topomap;
  const times = state.windowData?.times || [];
  if (!topomap?.channels?.length || !times.length) return null;
  const duration = visibleDuration();
  let target = state.cursorTime;
  if (target === null || target < state.start || target > state.start + duration) {
    target = state.start + duration / 2;
  }
  let index = 0;
  let best = Infinity;
  times.forEach((time, i) => {
    const delta = Math.abs(Number(time) - target);
    if (delta < best) {
      best = delta;
      index = i;
    }
  });
  const system = valuesAtTopomapIndex(topomap.system, index);
  const average = valuesAtTopomapIndex(topomap.average, index);
  const earlobe = valuesAtTopomapIndex(topomap.earlobe || topomap.system, index);
  const cz = valuesAtTopomapIndex(topomap.cz, index);
  if (!system.length || system.length !== average.length) return null;
  return {
    channels: topomap.channels,
    system,
    average,
    earlobe,
    cz,
    time: Number(times[index] || target),
  };
}

function valuesAtTopomapIndex(series, index) {
  if (!Array.isArray(series)) return [];
  return series.map((row) => Number(row?.[index] || 0));
}

function clearTopomap(canvas, text) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#68707c";
  ctx.font = `${11 * (window.devicePixelRatio || 1)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function drawTopomap(canvas, channels, values, scale, options = {}) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.54;
  const radius = Math.min(w, h) * 0.36;
  const electrodes = channels
    .map((ch, i) => ({ ch, value: values[i], pos: TOPO_POSITIONS[ch] }))
    .filter((item) => item.pos && Number.isFinite(item.value));

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  const step = Math.max(2, Math.round(3 * ratio));
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += step) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += step) {
      const nx = (x - cx) / radius;
      const ny = -(y - cy) / radius;
      if (nx * nx + ny * ny > 1) continue;
      const value = interpolateTopomapValue(nx, ny, electrodes);
      ctx.fillStyle = topomapColor(value, scale);
      ctx.fillRect(x, y, step + 0.5, step + 0.5);
    }
  }
  ctx.restore();

  ctx.strokeStyle = "#333a3f";
  ctx.lineWidth = 1.2 * ratio;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.12, cy - radius * 0.98);
  ctx.lineTo(cx, cy - radius * 1.13);
  ctx.lineTo(cx + radius * 0.12, cy - radius * 0.98);
  ctx.stroke();

  ctx.font = `${8.5 * ratio}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const electrode of electrodes) {
    const [px, py] = electrode.pos;
    const x = cx + px * radius;
    const y = cy - py * radius;
    ctx.fillStyle = "#1f252a";
    ctx.beginPath();
    ctx.arc(x, y, 1.8 * ratio, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#27324b";
    ctx.fillText(nkLabel(electrode.ch), x, y - 6 * ratio);
  }

  drawTopomapScale(ctx, w, h, scale, ratio);
}

function interpolateTopomapValue(x, y, electrodes) {
  let weighted = 0;
  let weights = 0;
  for (const electrode of electrodes) {
    const [ex, ey] = electrode.pos;
    const dx = x - ex;
    const dy = y - ey;
    const dist2 = dx * dx + dy * dy;
    const weight = 1 / Math.max(0.015, dist2);
    weighted += electrode.value * weight;
    weights += weight;
  }
  return weights ? weighted / weights : 0;
}

function topomapColor(value, scale) {
  const t = Math.max(-1, Math.min(1, value / Math.max(1, scale)));
  if (t >= 0) {
    const r = Math.round(255 - t * 190);
    const g = Math.round(255 - t * 145);
    const b = Math.round(255 - t * 35);
    return `rgb(${r},${g},${b})`;
  }
  const p = -t;
  const c = Math.round(255 - p * 92);
  const g = Math.round(255 - p * 175);
  const b = Math.round(255 - p * 190);
  return `rgb(${c},${g},${b})`;
}

function drawTopomapScale(ctx, w, h, scale, ratio) {
  const barW = 54 * ratio;
  const barH = 6 * ratio;
  const x = w - barW - 8 * ratio;
  const y = h - 13 * ratio;
  const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
  grad.addColorStop(0, topomapColor(-scale, scale));
  grad.addColorStop(0.5, topomapColor(0, scale));
  grad.addColorStop(1, topomapColor(scale, scale));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, barW, barH);
  ctx.strokeStyle = "#9da39a";
  ctx.strokeRect(x, y, barW, barH);
  ctx.font = `${8 * ratio}px Arial`;
  ctx.fillStyle = "#4e555c";
  ctx.textAlign = "right";
  ctx.fillText(`±${scale.toFixed(0)}uV`, x - 4 * ratio, y + barH);
}

function onWaveMouseDown(ev) {
  if (ev.button !== 0 || !state.windowData?.traces?.length) return;
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
  setTopomapSelection(selection);
  setScalogramSelection(selection, { cursorTime: selection.start });
  loadPreciseTopomap();
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
  if (els.scalogramReadout) {
    els.scalogramReadout.textContent = `Loading ${formatSec(normalized.start)} + ${normalized.duration.toFixed(3)}s...`;
  }
  if (els.scalogramDetailTitle) els.scalogramDetailTitle.textContent = "Loading";
  if (els.scalogramList) els.scalogramList.innerHTML = "<div class='annotation-row empty'><small>Loading scalogram...</small></div>";
  if (els.exportSpikeCsvBtn) els.exportSpikeCsvBtn.disabled = true;
  if (els.exportAnalysisJsonBtn) els.exportAnalysisJsonBtn.disabled = true;
  if (els.exportScalogramJpegBtn) els.exportScalogramJpegBtn.disabled = true;
  if (els.rangeCancelBtn) els.rangeCancelBtn.disabled = false;
  showEventControls();
  if (options.drawWave !== false) draw();
  if (options.load !== false) loadScalogram();
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
  state.context = { ...point, annotationId: "", annotation: null };
  state.cursorTime = point.onset;
  const selection = defaultTopomapSelection(point.onset);
  setTopomapSelection(selection);
  setScalogramSelection(selection, { cursorTime: point.onset, load: false });
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
  const selection = defaultTopomapSelection(point.onset);
  setTopomapSelection(selection);
  setScalogramSelection(selection, { cursorTime: point.onset, load: false });
  renderTopomaps();
  loadPreciseTopomap();
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
  const halfWindow = 0.005;
  const selection = { start: point.onset - halfWindow, duration: halfWindow * 2 };
  setTopomapSelection(selection);
  setScalogramSelection(
    selection,
    { cursorTime: point.onset }
  );
  loadPreciseTopomap();
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

function currentTopomapExport() {
  const data = state.preciseTopomap;
  if (!data?.available) {
    window.alert("Topomap data is not available yet.");
    return null;
  }
  return {
    recordingId: state.recordingId,
    exportedAt: new Date().toISOString(),
    selection: currentTopomapInterval(),
    topomap: data,
  };
}

function exportTopomapJson() {
  const payload = currentTopomapExport();
  if (!payload) return;
  const start = Number(payload.selection.start || 0).toFixed(3);
  const json = JSON.stringify(payload, null, 2);
  downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), `${state.recordingId}.topomap_${start}s.json`);
}

function exportTopomapCsv() {
  const payload = currentTopomapExport();
  if (!payload) return;
  const topo = payload.topomap || {};
  const channels = topo.channels || [];
  const fields = [
    "recordingId",
    "time",
    "windowStart",
    "windowEnd",
    "duration",
    "sampleCount",
    "sfreq",
    "referenceChannels",
    "tc",
    "hf",
    "ac",
    "channel",
    "earlobe_uV",
    "cz_uV",
    "average_uV",
    "laplacian_uV",
  ];
  const rows = [fields.join(",")];
  for (const ch of channels) {
    const row = [
      state.recordingId,
      topo.time,
      topo.windowStart,
      topo.windowEnd,
      Number(topo.windowEnd || 0) - Number(topo.windowStart || 0),
      topo.sampleCount,
      topo.sfreq,
      (topo.referenceChannels || []).join("/"),
      topo.filters?.tc || "",
      topo.filters?.hf || "",
      topo.filters?.ac || "",
      ch,
      topo.earlobe?.[ch] ?? topo.system?.[ch] ?? "",
      topo.cz?.[ch] ?? "",
      topo.average?.[ch] ?? "",
      topo.laplacian?.[ch] ?? "",
    ];
    rows.push(row.map(csvCell).join(","));
  }
  const start = Number(payload.selection.start || 0).toFixed(3);
  downloadBlob(new Blob([rows.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }), `${state.recordingId}.topomap_${start}s.csv`);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportJson() {
  downloadFromUrl(`/api/annotations.json?${qs({ id: state.recordingId })}`, `${state.recordingId}.annotations.json`);
}

function exportCsv() {
  downloadFromUrl(`/api/annotations.csv?${qs({ id: state.recordingId })}`, `${state.recordingId}.annotations.csv`);
}

function scalogramExportPayload(data, selection) {
  return {
    schema: "eeg-viewer.scalogram_event.v1",
    exportedAt: new Date().toISOString(),
    recordingId: state.recordingId,
    selection: {
      start: preciseNumber(selection.start),
      duration: preciseNumber(selection.duration || 0),
      end: preciseNumber((selection.start || 0) + (selection.duration || 0)),
    },
    viewer: {
      montage: data.montage || els.montageSelect.value,
      sensitivityUvPerMm: Number(els.sensitivitySelect.value),
      timebaseSec: Number(els.durationSelect.value),
      scalogramMode: state.scalogramMode,
      detectionMode: scalogramDetectionMode(),
    },
    filters: {
      tc: data.filters?.tc ?? els.tcSelect.value,
      hf: data.filters?.hf ?? els.hfSelect.value,
      ac: data.filters?.ac ?? els.acSelect.value,
      ecgIncluded: Boolean(els.ecgToggle?.checked),
      ecgFilter: Boolean(els.ecgFilterToggle?.checked),
    },
    sfreq: data.sfreq ?? null,
    globalSpikeAnchor: data.globalSpikeAnchor || null,
    globalAfterSlowAnchor: data.globalAfterSlowAnchor || null,
    pairedLatencies: data.pairedLatencies || [],
    afterSlowPairedLatencies: data.afterSlowPairedLatencies || [],
    scwtLaterality: data.scwtLaterality || null,
    traces: data.traces || [],
    fzTopomap: {
      spike: state.fzSpikeTopomap || null,
      afterSlow: state.fzAfterSlowTopomap || null,
    },
  };
}

function exportAnalysisJson() {
  const data = state.scalogramData;
  const selection = state.scalogramSelection;
  if (!data?.available || !selection) return;
  const payload = scalogramExportPayload(data, selection);
  const json = JSON.stringify(payload, null, 2) + "\n";
  const start = Number.isFinite(Number(selection.start)) ? Number(selection.start).toFixed(3) : "selection";
  downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), `${state.recordingId}.scalogram_event_${start}s.json`);
}

function exportSpikeCsv() {
  const data = state.scalogramData;
  const selection = state.scalogramSelection;
  if (!data?.available || !selection) return;
  const headers = [
    "recordingId",
    "selectionStart",
    "selectionDuration",
    "selectionEnd",
    "sfreq",
    "tc",
    "hf",
    "ac",
    "traceLabel",
    "role",
    "spikeAvailable",
    "spikeScore",
    "spikePeakTime",
    "spikePeakFreq",
    "sharpnessUvPerMs",
    "curvatureUvPerMs2",
    "afterSlowAvailable",
    "afterSlowTime",
    "afterSlowLatencyMs",
    "afterSlowAmplitudeUv",
    "afterSlowCurvatureUvPerMs2",
  ];
  const base = {
    recordingId: state.recordingId,
    selectionStart: preciseNumber(selection.start),
    selectionDuration: preciseNumber(selection.duration || 0),
    selectionEnd: preciseNumber((selection.start || 0) + (selection.duration || 0)),
    sfreq: data.sfreq ?? "",
    tc: data.filters?.tc ?? els.tcSelect.value,
    hf: data.filters?.hf ?? els.hfSelect.value,
    ac: data.filters?.ac ?? els.acSelect.value,
  };
  const rows = [headers.join(",")];
  for (const trace of data.traces || []) {
    const m = trace.spikeMetrics || {};
    const row = {
      ...base,
      traceLabel: nkLabel(trace.label || ""),
      role: trace.role || "",
      spikeAvailable: m.available ?? "",
      spikeScore: m.spikeScore ?? "",
      spikePeakTime: m.peakTime ?? "",
      spikePeakFreq: m.peakFreq ?? "",
      sharpnessUvPerMs: m.sharpnessUvPerMs ?? "",
      curvatureUvPerMs2: m.curvatureUvPerMs2 ?? "",
      afterSlowAvailable: m.afterSlowAvailable ?? "",
      afterSlowTime: m.afterSlowTime ?? "",
      afterSlowLatencyMs: m.afterSlowLatencyMs ?? "",
      afterSlowAmplitudeUv: m.afterSlowAmplitudeUv ?? "",
      afterSlowCurvatureUvPerMs2: m.afterSlowCurvatureUvPerMs2 ?? "",
    };
    rows.push(headers.map((key) => csvCell(row[key])).join(","));
  }
  const start = Number.isFinite(Number(selection.start)) ? Number(selection.start).toFixed(3) : "selection";
  downloadBlob(new Blob([rows.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }), `${state.recordingId}.scalogram_event_${start}s.csv`);
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
  setStatus(`Saved to Desktop: ${result.filename || filename}`);
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
  const duration = Number(state.windowData?.duration || els.durationSelect.value);
  return Number.isFinite(duration) && duration > 0 ? duration : 10;
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
