// Synthetic browser storage checks. / 模擬ブラウザーで参加者間のJSON混在を検査。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../static/request_errors.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
const state = { researchMode: "test", researchSession: { readerId: "a", datasetPath: "synthetic", sessionToken: "token-a" },
  windowCache: new Map(), recordings: [], windowData: null };
const localStorage = storage();
const sessionStorage = storage();
const downloads = [];
const context = vm.createContext({ state, localStorage, sessionStorage, PUBLIC_WEB_MODE: true,
  RESEARCH_PROFILE_KEY: "profile", RESEARCH_PENDING_RESPONSES_KEY: "pending", RESEARCH_RESULT_BACKUP_KEY: "backup",
  RESEARCH_ACTIVE_RUN_KEY: "active-run", RESEARCH_ACTIVE_RUN_MAX_AGE_MS: 86400000,
  researchProfile: () => ({ readerName: "Synthetic" }),
  isValidationWorkflow: () => state.researchMode === "validation", downloadTextFile: (...args) => downloads.push(args),
  Date, els: {}, draw: () => {} });
for (const name of ["clearSharedBrowserResearchState", "researchBackupOwner", "saveResearchResultBackup", "downloadResearchResultBackup",
  "clearResearchRunRecovery", "readPendingResearchResponses", "writePendingResearchResponses", "readActiveResearchRun", "saveActiveResearchRun", "clearActiveResearchRun"]) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf("\n}", start) + 2;
  vm.runInContext(source.slice(start, end), context);
}
for (const key of ["profile", "pending", "backup"]) localStorage.setItem(key, "legacy-sensitive-data");
context.clearSharedBrowserResearchState();
for (const key of ["profile", "pending", "backup"]) assert.equal(localStorage.getItem(key), null);
context.saveResearchResultBackup("a.json", '{"syntheticReader":"a"}');
assert.ok(context.downloadResearchResultBackup());
assert.equal(downloads.length, 1);
state.researchSession = { readerId: "b", datasetPath: "synthetic", sessionToken: "token-b" };
assert.equal(context.downloadResearchResultBackup(), null);
assert.equal(downloads.length, 1);
assert.equal(sessionStorage.getItem("backup"), null);
state.researchSession = { readerId: "a", datasetPath: "synthetic", sessionToken: "token-a" };
context.saveResearchResultBackup("a.json", '{"syntheticReader":"a"}');
state.researchSession = { readerId: "a", datasetPath: "another-dataset", sessionToken: "token-a" };
assert.equal(context.downloadResearchResultBackup(), null);
state.researchSession = { readerId: "a", datasetPath: "synthetic", sessionToken: "token-a" };
context.saveResearchResultBackup("a.json", '{"syntheticReader":"a"}');
const backup = JSON.parse(sessionStorage.getItem("backup"));
backup.savedAt = new Date(Date.now() - 86400001).toISOString();
sessionStorage.setItem("backup", JSON.stringify(backup));
assert.equal(context.downloadResearchResultBackup(), null);
context.clearResearchRunRecovery();
assert.equal(sessionStorage.getItem("backup"), null);
context.writePendingResearchResponses([{ queuedAt: new Date().toISOString(), payload: { readerId: "a", caseId: "case-1" } },
  { queuedAt: new Date(0).toISOString(), payload: { readerId: "old", caseId: "case-2" } }]);
assert.equal(context.readPendingResearchResponses().length, 1);
assert.equal(localStorage.getItem("pending"), null);
context.saveActiveResearchRun({ readerId: "a", datasetPath: "synthetic" });
assert.equal(context.readActiveResearchRun().sessionToken, "token-a");
state.researchSession = null;
assert.equal(context.readActiveResearchRun().sessionToken, "token-a", "reload keeps the run proof in its own tab");
sessionStorage.setItem("active-run", JSON.stringify({ readerId: "legacy", datasetPath: "synthetic", savedAt: new Date().toISOString() }));
assert.equal(context.readActiveResearchRun(), null, "a reader name alone cannot resume a legacy run");

async function checkRequestProofs() {
  const calls = [];
  const network = vm.createContext({
    state: { researchSession: { sessionToken: "test-proof" }, validationSession: { sessionToken: "review-proof" } },
    window: { location: { href: "https://viewer.example.invalid/", origin: "https://viewer.example.invalid" } },
    URL, Headers, REQUEST_TOKEN: "request-proof", isValidationWorkflow: () => true,
    cloneFetchOptions: (options) => ({ ...options }),
    shouldRetryFetchError: () => false,
    fetch: async (url, init) => { calls.push({ url, headers: init.headers }); return { ok: true }; },
  });
  const begin = source.indexOf("async function fetchWithRetry(");
  vm.runInContext(source.slice(begin, source.indexOf("\n}", begin) + 2), network);
  await network.fetchWithRetry("/api/window?id=synthetic");
  assert.equal(calls.at(-1).headers.get("X-EEG-Research-Session"), "review-proof");
  await network.fetchWithRetry("/api/research/test/response");
  assert.equal(calls.at(-1).headers.get("X-EEG-Research-Session"), "test-proof");
  await assert.rejects(network.fetchWithRetry("https://other.example.invalid/", { retryAttempts: 1 }));
  assert.equal(calls.length, 2, "external requests never receive credentials");

  const savedRun = { readerId: "resume-a", datasetPath: "synthetic", sessionToken: "resume-proof", profile: {}, savedAt: new Date().toISOString() };
  const session = { readerId: savedRun.readerId, datasetPath: savedRun.datasetPath, sessionToken: savedRun.sessionToken,
    cases: [{ caseId: "synthetic-1" }], answeredCount: 1, totalCount: 20 };
  const resumeCalls = [];
  const noop = () => {};
  const resume = vm.createContext({ state: {}, Date, qs: () => "synthetic", isValidationWorkflow: () => false,
    readActiveResearchRun: () => savedRun, hasResearchConsent: () => true,
    setResearchSetupMessage: noop, setResearchStartBusy: noop, setStatus: noop,
    loadResearchDatasetFromPath: async () => ({ datasetPath: "synthetic", cases: [] }),
    fetchJson: async (url, options) => {
      resumeCalls.push({ url, options });
      return url.startsWith("/api/research/test/session") ? session : { datasetPath: "synthetic", cases: session.cases };
    },
    setResearchResponsesFromSession: noop, setResearchMode: noop, updateResearchSetupScreen: noop,
    refreshResearchDisplay: noop, activeResearchCases: () => session.cases, firstUnansweredResearchCaseIndex: () => 0,
    showResearchCase: async () => true, saveActiveResearchRun: noop,
  });
  const start = source.indexOf("async function resumeActiveResearchRun(");
  vm.runInContext(source.slice(start, source.indexOf("\n}", start) + 2), resume);
  assert.equal(await resume.resumeActiveResearchRun(), true);
  assert.equal(resumeCalls[0].options.headers["X-EEG-Research-Session"], "resume-proof");
  assert.equal(resume.state.researchDataset.cases.length, 1, "revisit metadata is reloaded after authorization");
}

checkRequestProofs().then(() => console.log("Browser recovery, resume proof and request isolation checks passed.")).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
