// Canvas rendering and display geometry. / canvas描画と表示座標。
// Uses shared state/els; filtering remains on the server.
// 共有state/elsを利用する。フィルターの数値処理はサーバー側に残す。

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
    els.calReadout.textContent = `${sensitivityValue()} uV/mm · TC ${tcText()} · HF ${hfText()} · ${els.paperSelect?.value || "30"} mm/s`;
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

