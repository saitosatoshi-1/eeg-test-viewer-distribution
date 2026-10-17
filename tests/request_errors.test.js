// Synthetic failures only. / 実データを使わず保存失敗の分類を検証する。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const c = vm.createContext({ navigator: { onLine: false }, isAbortError: e => e?.name === "AbortError" });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../static/request_errors.js"), "utf8"), c);
for (const status of [400, 401, 403, 404, 409, 422]) {
  assert.equal(c.isRecoverableRequestError(c.requestFailure("bad", status)), false);
  assert.equal(c.shouldRetryFetchError(null, { status }), false);
}
for (const status of [408, 425, 429, 500, 502, 503]) assert.equal(c.isRecoverableRequestError(c.requestFailure("temporary", status)), true);
assert.equal(c.isRecoverableRequestError(c.requestFailure("offline", 0, "network")), true);
assert.equal(c.isRecoverableRequestError(new Error("render failure")), false);
assert.equal(c.isRecoverableRequestError({ name: "AbortError", kind: "network" }), false);
assert.match(c.researchSaveFailureMessage({ status: 403 }), /認証/);

async function checks() {
  c.fetchWithRetry = async () => ({ ok: false, status: 403, json: async () => { throw new Error("HTML"); } });
  await assert.rejects(c.fetchJson("/api/test"), e => e.status === 403 && !c.isRecoverableRequestError(e));
  c.fetchWithRetry = async () => ({ ok: false, status: 503, json: async () => { throw new Error("HTML"); } });
  await assert.rejects(c.fetchJson("/api/test"), e => e.status === 503 && c.isRecoverableRequestError(e));
  const source = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
  for (const name of ["writePendingResearchResponses"]) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf("\n}", start) + 2), c);
  }
  c.RESEARCH_PENDING_RESPONSES_KEY = "synthetic";
  c.sessionStorage = { setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.equal(c.writePendingResearchResponses([]), false);
  c.sessionStorage = { setItem: () => {} };
  assert.equal(c.writePendingResearchResponses([]), true);
  // 実際の回答ハンドラーでも、失敗時の遷移と二重登録を検査する。
  const start = source.indexOf("async function saveResearchRating(");
  const handler = source.slice(start, source.indexOf("\n}\n", start) + 2);
  async function saveScenario(error, storageOk, afterSaveFailure = false) {
    const calls = { queued: 0, advanced: 0, alerts: 0 };
    const noop = () => {};
    Object.assign(c, {
      state: { researchSession: { readerId: "synthetic", responses: [] }, researchDatasetPath: "synthetic" },
      currentResearchCase: () => ({ caseId: "one" }),
      researchProfile: () => ({}), researchTestTimingPayload: () => ({}),
      researchSpikeSelectionPayload: () => ({}), researchMontageTimingPayload: () => ({}),
      fetchJson: async () => { if (error) throw error; return { session: { responses: [] } }; },
      setStatus: noop, window: { alert: () => calls.alerts++ },
      queuePendingResearchResponse: () => { calls.queued++; return storageOk; },
      setResearchResponsesFromSession: noop, saveActiveResearchRun: noop,
      renderRightResearchPanels: noop, showResearchToast: noop, researchRatingLabel: x => x,
      readPendingResearchResponses: () => [], writePendingResearchResponses: noop,
      activeResearchCases: () => [{ caseId: "one" }, { caseId: "two" }],
      firstUnansweredResearchCaseIndex: () => 1,
      showResearchCase: async () => { calls.advanced++; if (afterSaveFailure) throw new Error("layout"); },
    });
    vm.runInContext(handler, c);
    await c.saveResearchRating("synthetic");
    assert.equal(c.state.researchSaving, false);
    return calls;
  }
  assert.deepEqual(await saveScenario(c.requestFailure("auth", 403), true), { queued: 0, advanced: 0, alerts: 1 });
  assert.deepEqual(await saveScenario(c.requestFailure("bad input", 400), true), { queued: 0, advanced: 0, alerts: 1 });
  assert.deepEqual(await saveScenario(c.requestFailure("offline", 0, "network"), false), { queued: 1, advanced: 0, alerts: 1 });
  assert.deepEqual(await saveScenario(c.requestFailure("offline", 0, "network"), true), { queued: 1, advanced: 1, alerts: 0 });
  assert.deepEqual(await saveScenario(null, true, true), { queued: 0, advanced: 1, alerts: 0 });
  console.log("Request classification and storage failure checks passed.");
}
checks().catch(error => { console.error(error); process.exitCode = 1; });
