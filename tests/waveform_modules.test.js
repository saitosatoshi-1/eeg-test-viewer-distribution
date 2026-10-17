// Synthetic data only. / 合成波形だけで分割後の読み込み・取得・描画を検証する。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "static/index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"?]+)[^"]*"><\/script>/g)].map(m => m[1].slice(1));
const ctx = vm.createContext({
  document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    body: { classList: { contains: () => true } } },
  window: { location: { hostname: "localhost", search: "" } }, URLSearchParams, console,
});
for (const file of scripts) {
  let code = fs.readFileSync(path.join(root, file), "utf8");
  if (file === "static/app.js") {
    assert.equal((code.match(/init\(\)\.catch/g) || []).length, 1);
    code = code.slice(0, code.lastIndexOf("init().catch("));
  }
  vm.runInContext(code, ctx, { filename: file });
}
for (const name of ["loadWindow", "draw", "scheduleResearchPrefetch", "handleFilterControlChange", "canvasToData"]) {
  assert.equal(typeof ctx[name], "function", name);
}
assert.ok(scripts.indexOf("static/waveform_render.js") < scripts.indexOf("static/app.js"));
assert.equal(ctx.windowCacheKey({ id: "s", montage: "average", tc: "0.3", hf: "120", ac: "60" }),
  "s|0.000|0.000|average||0.3|120|60||||");
vm.runInContext("state.windowCache.clear()", ctx);
ctx.rememberWindowCache("synthetic", { traces: [] });
assert.equal(vm.runInContext("state.windowCache.size", ctx), 1);

const operations = [];
const canvasContext = new Proxy({}, { get: (_, name) => (...args) => operations.push([name, ...args]), set: () => true });
ctx.drawViewerWaveformPath(canvasContext, [0, 10, -10], [0, 1, 2], {
  left: 10, plotW: 200, centerY: 50, start: 0, duration: 2, yScale: 2,
  strokeStyle: "blue", lineWidth: 1,
});
assert.deepEqual(operations.filter(x => ["moveTo", "lineTo"].includes(x[0])),
  [["moveTo", 10, 50], ["lineTo", 110, 30], ["lineTo", 210, 70]]);

async function checkWindow() {
  let requests = 0;
  const applied = [];
  Object.assign(ctx, {
    cancelActiveWindowLoad: () => {}, activeMontageValue: () => "average",
    preferredResearchWindowMontages: () => ["average"], windowMaxPoints: () => 5000,
    fetchJson: async () => { requests++; return { montage: "average", traces: [], times: [] }; },
    applyWindowData: data => applied.push(data), setStatus: () => {}, setWaveLoading: () => {}, AbortController,
  });
  vm.runInContext(`state.recordingId = "synthetic"; state.windowLoadRequestId = 0;
    els.durationSelect = { value: "10" }; els.tcSelect = { value: "0.3" };
    els.hfSelect = { value: "120" }; els.ecgToggle = { checked: true };`, ctx);
  await ctx.loadWindow({ activeMontageOnly: true });
  await ctx.loadWindow({ activeMontageOnly: true });
  assert.equal(requests, 1, "same settings reuse the response cache");
  assert.equal(applied.length, 2);
  console.log("Waveform script loading, coordinates and response-cache checks passed.");
}
checkWindow().catch(error => { console.error(error); process.exitCode = 1; });
