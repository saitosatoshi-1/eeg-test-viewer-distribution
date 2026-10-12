const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../static/app.js'), 'utf8');
const begin = source.indexOf('function hasResearchConsent()');
const end = source.indexOf('function startWorkflow()', begin);
function input(value = '') {
  return { value, checked: false, disabled: false, listeners: {},
    checkValidity() { return !this.value.includes('invalid-email'); },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    focus() {}, scrollIntoView() {} };
}
const ids = ['researchIcNameInput', 'researchIcEmailInput', 'researchIcAffiliationInput',
  'researchIcConsentInput', 'researchIcAgreeBtn', 'researchIcDeclineBtn', 'researchIcMessage',
  'researchSetupReaderNameInput', 'researchSetupReaderEmailInput', 'researchSetupReaderAffiliationInput',
  'researchSetupReaderSpecialtySelect', 'researchExplanationOpenBtn', 'researchExplanationDialog',
  'researchDebriefRefuseBtn', 'researchDebriefContinueConsentInput', 'researchDebriefMessage'];
const els = Object.fromEntries(ids.map(id => [id, input()]));
const state = { researchConsent: null };
let transitions = 0;
const context = vm.createContext({ els, state, RESEARCH_IC_VERSION: '2026-10-12-v1', Date,
  document: { getElementById() { return { innerText: '研究説明の全文', addEventListener() {} }; } },
  saveResearchProfile() {}, updateResearchSetupScreen() { transitions++; }, downloadTextFile() {} });
vm.runInContext(source.slice(begin, end), context);
context.bindResearchConsentControls();
assert.equal(els.researchIcAgreeBtn.disabled, true);
els.researchIcAgreeBtn.listeners.click();
assert.equal(transitions, 0);
els.researchIcNameInput.value = 'QA Reader';
els.researchIcEmailInput.value = 'qa@example.invalid';
els.researchIcAffiliationInput.value = 'QA Facility';
els.researchIcAffiliationInput.listeners.input();
assert.equal(els.researchIcAgreeBtn.disabled, true);
els.researchIcConsentInput.checked = true;
els.researchIcConsentInput.listeners.input();
assert.equal(els.researchIcAgreeBtn.disabled, false);
els.researchIcAgreeBtn.listeners.click();
assert.equal(transitions, 1);
assert.equal(context.hasResearchConsent(), true);
assert.equal(state.researchConsent.version, '2026-10-12-v1');
assert.equal(state.researchConsent.explanationText, '研究説明の全文');
assert.ok(Number.isFinite(Date.parse(state.researchConsent.agreedAt)));
els.researchSetupReaderEmailInput.value = 'another@example.invalid';
assert.equal(context.hasResearchConsent(), false);
els.researchSetupReaderEmailInput.value = 'qa@example.invalid';
state.researchConsent.version = 'old';
assert.equal(context.hasResearchConsent(), false);
els.researchDebriefContinueConsentInput.checked = true;
els.researchDebriefRefuseBtn.listeners.click();
assert.equal(els.researchDebriefContinueConsentInput.checked, false);
assert.match(els.researchDebriefMessage.textContent, /このボタンだけではサーバー上のデータは削除されません/);
console.log('PASS: consent gate, identity binding, timestamp/version, stale consent, refusal guidance');
