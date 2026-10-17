// Waveform interaction and hit testing. / 波形操作とタッチ座標判定。
// Preserve mobile menu toggle and sample-aligned selection.
// スマホの再タッチ開閉とサンプル単位の選択位置を維持する。
// Shared state/els and research menu callbacks remain in app.js.
// 共有state/elsと研究回答メニューの処理はapp.jsを利用する。

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
  // スマホでは波形の再タッチで三択メニューを閉じる。
  if (isMobileViewport() && !els.contextMenu.classList.contains("hidden")) {
    hideContextMenu();
    return;
  }
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

