// Verify the back button and its handler. / 終了画面での戻る操作を検査する。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");

function setup() {
  const screen = () => ({ hidden: true, setAttribute() {} });
  const els = { researchUndoBtn: {}, researchDebriefScreen: screen(), researchCompleteScreen: screen() };
  const response = { caseId: "synthetic" };
  const calls = [];
  const context = vm.createContext({
    els, state: { researchResultAutoSubmitted: true },
    isValidationWorkflow: () => false, isMobileViewport: () => false,
    activeResearchResponses: () => [response], lastAnsweredResponse: rows => rows.at(-1),
    ensureAnsweredCaseIsAvailable: row => row, activeResearchCases: () => [response],
    showResearchCase: async index => calls.push(index), setStatus() {}, hideResearchToast() {},
    renderResearchInlineProgress: () => context.updateResearchUndoButton(),
    hideResearchWaveProgress() {}, updateResearchEmailBody() {}, renderMobileResearchSubmission() {},
  });
  for (const name of [
    "isResearchEndScreenVisible", "updateResearchUndoButton", "revisitLastAnsweredCase",
    "showResearchDebriefing", "showResearchCompletion", "hideResearchDebriefing", "hideResearchCompletion",
  ]) {
    const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, "m"));
    assert.ok(match, name);
    vm.runInContext(match[0], context);
  }
  return { context, els, calls };
}

(async () => {
  for (const [show, screen] of [
    ["showResearchDebriefing", "researchDebriefScreen"],
    ["showResearchCompletion", "researchCompleteScreen"],
  ]) {
    const { context, els, calls } = setup();
    context.updateResearchUndoButton();
    assert.equal(els.researchUndoBtn.disabled, false);
    context[show]();
    assert.equal(els.researchUndoBtn.disabled, true);
    await context.revisitLastAnsweredCase();
    assert.equal(els[screen].hidden, false);
    assert.deepEqual(calls, []);
    assert.equal(context.state.researchResultAutoSubmitted, true);
  }
  const { context, calls } = setup();
  await context.revisitLastAnsweredCase();
  assert.deepEqual(calls, [0]);
})().catch(error => { console.error(error); process.exitCode = 1; });
