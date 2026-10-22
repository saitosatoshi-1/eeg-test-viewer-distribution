// Concurrent queue changes, synthetic data only. / 合成データによる再送中の並行更新検査。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
const start = source.indexOf("async function retryPendingResearchResponses(");
const code = source.slice(start, source.indexOf("\n}", start) + 2);
const row = (key, rating = "old") => ({ key, queuedAt: "synthetic", payload: { caseId: key, rating } });

async function scenario(initial, mutate, failure = null, storageOk = true) {
  let rows = structuredClone(initial), release, calls = 0;
  const messages = [];
  const context = vm.createContext({ state: {}, navigator: { onLine: true },
    readPendingResearchResponses: () => structuredClone(rows),
    writePendingResearchResponses: next => { if (storageOk) rows = next; return storageOk; },
    fetchJson: () => { calls++; return new Promise((resolve, reject) => { release = () => failure ? reject(failure) : resolve({}); }); },
    isRecoverableRequestError: error => error.retryable,
    researchSaveFailureMessage: () => "auth error", setStatus: message => messages.push(message),
  });
  vm.runInContext(code, context);
  const pending = context.retryPendingResearchResponses();
  await context.retryPendingResearchResponses();
  assert.equal(calls, 1, "overlapping retry is ignored");
  rows = mutate(rows);
  release();
  await pending;
  assert.equal(context.state.researchRetryingPending, false);
  return { rows, calls, messages };
}

(async () => {
  assert.deepEqual((await scenario([row("a")], rows => [...rows, row("b")])).rows, [row("b")]);
  assert.deepEqual((await scenario([row("a")], () => [row("a", "new")])).rows, [row("a", "new")]);
  assert.deepEqual((await scenario([row("a")], rows => [...rows, row("b")], { retryable: true })).rows, [row("a"), row("b")]);
  assert.deepEqual((await scenario([row("a")], rows => [...rows, row("b")], { retryable: false })).rows, [row("a"), row("b")]);
  assert.deepEqual((await scenario([row("a"), row("b")], rows => rows, { retryable: false })).rows, [row("a"), row("b")]);
  assert.deepEqual((await scenario([row("a"), row("b")], () => [row("a"), row("b", "new")])).rows, [row("b", "new")], "skip an obsolete snapshot not yet sent");
  assert.deepEqual((await scenario([row("a")], () => [], { retryable: true })).rows, [], "do not restore a deliberately cleared queue");
  assert.deepEqual((await scenario([row("a")], rows => rows, null, false)).rows, [row("a")]);
  assert.deepEqual((await scenario([row("a")], rows => rows)).rows, []);
  console.log("Pending queue concurrent append, edit, failure, reset and retry checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
