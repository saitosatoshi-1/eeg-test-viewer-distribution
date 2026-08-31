import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../static/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../static/styles.css", import.meta.url), "utf8");

// 本番の関数をそのまま評価し、通信とDOMだけをテスト用に置き換える。
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  assert.ok(start >= 0, name);
  const tail = source.slice(start);
  return tail.slice(0, tail.indexOf("\n}") + 2);
}

function fixture({ mobile = true, validation = false, fetchResult } = {}) {
  const elements = Object.fromEntries([
    "researchCompleteScreen", "researchCompleteTitle", "researchCompleteMessage",
    "researchMailBox", "researchCopyEmailBtn", "researchCompleteSaveDesktopBtn",
    "researchRetrySubmitBtn", "researchSavedCsvName", "researchDebriefScreen",
  ].map((id) => [id, { hidden: true, disabled: false, textContent: "", setAttribute() {} }]));
  const state = {
    researchMode: validation ? "validation" : "test",
    researchDebriefSubmitted: true,
    researchResultAutoSubmitted: false,
    researchResultSubmitting: false,
    researchResultSubmitError: "",
    researchDatasetPath: "private:test_fixture",
    researchSession: { readerId: "test-reader-1", sessionToken: "test-token" },
    researchTestCompletedAt: "2026-08-31T00:00:00Z",
  };
  const calls = [];
  const statuses = [];
  const context = vm.createContext({
    state, els: elements, pending: [],
    isMobileViewport: () => mobile,
    isValidationWorkflow: () => validation,
    hideResearchTutorial() {}, refreshResearchDisplay() {}, hideResearchDebriefing() {},
    hideResearchWaveProgress() {}, updateResearchEmailBody() {}, saveResearchProfile() {},
    researchProfile: () => ({ readerName: "Test" }),
    activeResearchReaderId: () => state.researchSession.readerId,
    researchJsonFilename: (id) => `${id}.json`,
    researchTestTimingPayload: (completedAt) => ({ testCompletedAt: completedAt }),
    retryPendingResearchResponses: async () => {},
    readPendingResearchResponses: () => context.pending,
    setStatus: (message, options) => statuses.push({ message, ...options }),
    showResearchDebriefing: () => { elements.researchDebriefScreen.hidden = false; },
    submitValidationJson: async () => { calls.push({ validation: true }); },
    fetchJson: async (url, options) => {
      calls.push({ url, ...options, payload: JSON.parse(options.body) });
      return fetchResult ? fetchResult() : { ok: true, submissionId: "test_fixture/result.json" };
    },
  });
  vm.runInContext([
    "renderMobileResearchSubmission", "showResearchCompletion", "completeResearchTest", "submitResearchJson",
  ].map(functionSource).join("\n"), context);
  return { context, state, elements, calls, statuses };
}

test("mobile completion submits to server without export, share or email", async () => {
  const f = fixture();
  await f.context.completeResearchTest();
  assert.equal(f.state.researchResultAutoSubmitted, true);
  assert.equal(f.state.researchResultSubmitting, false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "/api/research/test/submit-result");
  assert.equal(f.calls[0].payload.readerId, "test-reader-1");
  assert.equal(f.calls[0].payload.sessionToken, "test-token");
  assert.equal(f.calls[0].payload.testCompletedAt, f.state.researchTestCompletedAt);
  for (const id of ["researchMailBox", "researchCompleteSaveDesktopBtn", "researchCopyEmailBtn", "researchRetrySubmitBtn"]) {
    assert.equal(f.elements[id].hidden, true, id);
  }
  assert.match(f.elements.researchCompleteMessage.textContent, /提出が完了しました/);
  assert.match(f.elements.researchCompleteMessage.textContent, /ダウンロードやメール送付は不要/);
  assert.match(f.statuses.at(-1).message, /メール送付は不要/);
  await f.context.completeResearchTest();
  assert.equal(f.calls.length, 1, "completed result must not submit again");
});

test("pending request is not success and duplicate completion does not send twice", async () => {
  let finish;
  const waiting = new Promise((resolve) => { finish = resolve; });
  const f = fixture({ fetchResult: () => waiting });
  const completion = f.context.completeResearchTest();
  await Promise.resolve();
  assert.equal(f.state.researchResultAutoSubmitted, false);
  assert.equal(f.state.researchResultSubmitting, true);
  assert.match(f.elements.researchCompleteMessage.textContent, /保存しています/);
  assert.doesNotMatch(f.elements.researchCompleteMessage.textContent, /提出が完了しました/);
  await f.context.completeResearchTest();
  assert.equal(f.calls.length, 1);
  finish({ ok: true });
  await completion;
  assert.equal(f.state.researchResultAutoSubmitted, true);
});

test("failed request offers retry and reuses participant/session/timing", async () => {
  let fail = true;
  const f = fixture({ fetchResult: () => {
    if (fail) throw new Error("offline");
    return { ok: true };
  } });
  await f.context.completeResearchTest();
  assert.equal(f.state.researchResultAutoSubmitted, false);
  assert.equal(f.elements.researchRetrySubmitBtn.hidden, false);
  assert.equal(f.elements.researchRetrySubmitBtn.disabled, false);
  assert.match(f.elements.researchCompleteMessage.textContent, /提出はまだ完了していません/);
  assert.equal(f.statuses.at(-1).error, true);
  fail = false;
  await f.context.completeResearchTest();
  assert.equal(f.state.researchResultAutoSubmitted, true);
  assert.deepEqual(f.calls[1].payload, f.calls[0].payload);
  assert.equal(f.elements.researchRetrySubmitBtn.hidden, true);
});

test("absent or negative save acknowledgement is not success", async () => {
  for (const result of [null, {}, { ok: false }]) {
    const f = fixture({ fetchResult: () => result });
    await f.context.completeResearchTest();
    assert.equal(f.state.researchResultAutoSubmitted, false);
    assert.equal(f.elements.researchRetrySubmitBtn.hidden, false);
  }
});

test("unsent answers block final result until successfully retried", async () => {
  const f = fixture();
  f.context.pending = [{ payload: { readerId: "test-reader-1" } }];
  await f.context.completeResearchTest();
  assert.equal(f.calls.length, 0);
  assert.equal(f.state.researchResultAutoSubmitted, false);
  assert.match(f.state.researchResultSubmitError, /未送信/);
  f.context.retryPendingResearchResponses = async () => { f.context.pending = []; };
  await f.context.completeResearchTest();
  assert.equal(f.state.researchResultAutoSubmitted, true);
});

test("pending answers from another participant do not block submission", async () => {
  const f = fixture();
  f.context.pending = [{ payload: { readerId: "other-reader" } }];
  await f.context.completeResearchTest();
  assert.equal(f.state.researchResultAutoSubmitted, true);
});

test("debriefing remains required before completion", async () => {
  const f = fixture();
  f.state.researchDebriefSubmitted = false;
  await f.context.completeResearchTest();
  assert.equal(f.elements.researchDebriefScreen.hidden, false);
  assert.equal(f.elements.researchCompleteScreen.hidden, true);
  assert.equal(f.calls.length, 0);
});

test("desktop download and mail workflow remains visible", async () => {
  const f = fixture({ mobile: false });
  await f.context.completeResearchTest();
  assert.equal(f.elements.researchMailBox.hidden, false);
  assert.equal(f.elements.researchCompleteSaveDesktopBtn.hidden, false);
  assert.equal(f.elements.researchCopyEmailBtn.hidden, false);
  assert.equal(f.elements.researchRetrySubmitBtn.hidden, true);
  assert.match(f.elements.researchCompleteMessage.textContent, /メールに添付して送って/);
});

test("Validation uses its existing submission workflow", async () => {
  const f = fixture({ validation: true });
  await f.context.completeResearchTest();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].validation, true);
  assert.equal(f.elements.researchRetrySubmitBtn.hidden, true);
  assert.match(f.elements.researchCompleteMessage.textContent, /Validation結果JSON/);
});

test("retry is wired, old share action removed, hidden controls override display CSS", () => {
  assert.match(source, /researchRetrySubmitBtn\?\.addEventListener\("click", completeResearchTest\)/);
  assert.doesNotMatch(source + html, /researchShareJsonBtn|shareResearchJsonByEmail|prepareResearchJsonShare/);
  assert.match(html, /id="researchCompleteMessage" role="status" aria-live="polite"/);
  assert.match(css, /\.research-complete-panel \[hidden\]\s*\{\s*display: none !important;/);
});
