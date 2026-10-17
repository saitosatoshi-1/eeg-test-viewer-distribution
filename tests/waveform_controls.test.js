// Synthetic interaction regression checks. / 実データ不要の操作回帰テスト。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "../static");

async function checks() {
  let loads = 0, draws = 0, timings = 0, prefetch = 0;
  const noop = () => {};
  const state = { recordingId: "synthetic", start: 0 };
  const els = { sensitivitySelect: { value: "10uV" }, montageSelect: { value: "average" },
    durationSelect: { value: "4" }, tcSelect: { value: "0.3" }, hfSelect: { value: "120" },
    ecgToggle: { checked: true }, recordingSelect: { value: "synthetic" } };
  const c = vm.createContext({ state, els, FIXED_AC_FILTER: "60", TEST_ONLY_DISTRIBUTION: true,
    resetResearchPrefetch: noop, saveSettings: noop, renderStatus: noop, setStatus: noop,
    draw: () => draws++, loadWindow: async opts => { assert.equal(opts.activeMontageOnly, true); loads++; },
    schedulePrefetchAfterControlInteraction: () => prefetch++, updateResearchMontageTiming: () => timings++,
    syncActiveMontageData: () => true, activeMontageValue: () => els.montageSelect.value,
    visibleDuration: () => Number(els.durationSelect.value), cancelActiveWindowLoad: noop,
    updateWaveScrollbar: noop, currentResearchCase: () => ({ caseId: "synthetic" }),
    tcText: () => els.tcSelect.value, hfText: () => els.hfSelect.value,
    centeredStartForResearchCase: (_, duration) => 5 - duration / 2,
  });
  vm.runInContext(fs.readFileSync(path.join(root, "waveform_controls.js"), "utf8"), c);
  state.windowData = { id: "synthetic", montage: "average", traces: [{ values: [0, 1] }],
    start: 0, duration: 10, displayFilters: { tc: "0.3", hf: "120", ac: "60" } };
  await c.onControlChange({ target: els.sensitivitySelect });
  assert.equal(loads, 0, "sensitivity is draw-only");
  assert.equal(draws, 1);
  await c.handleMontageControlChange();
  assert.equal(loads, 0, "matching cached montage avoids a request");
  assert.equal(timings, 1);
  await c.handleDurationControlChange();
  assert.equal(state.start, 3, "4-second viewport keeps the 5-second target centered");
  assert.equal(loads, 0, "loaded filtered window covers the shorter viewport");
  els.hfSelect.value = "60";
  assert.equal(c.loadedWindowMatchesCurrentDisplay(3, 4), false);
  await c.handleFilterControlChange();
  assert.equal(loads, 1, "filter changes request the active montage first");
  assert.equal(prefetch, 3, "all interactions resume existing prefetch behavior");
  els.hfSelect.value = "120";
  els.tcSelect.value = "0.1";
  assert.equal(c.loadedWindowMatchesCurrentDisplay(3, 4), false);
  await c.handleFilterControlChange();
  assert.equal(loads, 2, "TC changes also request the active montage first");

  let hidden = false, menuDraws = 0;
  const menu = { classList: { contains: () => hidden, add: () => { hidden = true; }, remove: () => { hidden = false; } }, style: {} };
  const input = vm.createContext({ state: {}, els: { contextMenu: menu }, isMobileViewport: () => true,
    canvasToData: () => ({ onset: 5, channel: "Cz" }), isMultiMontageMode: () => false,
    draw: () => menuDraws++, renderResearchRatingContextMenu: noop, setStatus: noop, formatSec: () => "5" });
  vm.runInContext(fs.readFileSync(path.join(root, "waveform_input.js"), "utf8"), input);
  input.canvasToData = () => ({ onset: 5, channel: "Cz" });
  const ev = { preventDefault: noop, stopPropagation: noop, clientX: 10, clientY: 20 };
  input.openResearchRatingMenu(ev);
  assert.equal(hidden, true, "touching again closes an open menu");
  assert.equal(menuDraws, 0);
  input.openResearchRatingMenu(ev);
  assert.equal(hidden, false, "next touch reopens the rating menu");
  assert.equal(input.state.context.onset, 5);
  assert.equal(menuDraws, 1);
  console.log("Sensitivity, montage, TC/HF, centered timebase and mobile menu checks passed.");
}
checks().catch(error => { console.error(error); process.exitCode = 1; });
