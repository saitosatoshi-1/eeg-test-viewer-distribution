// ローカル表示確認専用。実データ/APIを使わず、本番HTML/CSS/完了関数を表示する。
// node tests/preview_mobile_submission.mjs
// http://127.0.0.1:8877/?scenario=success|failure|pending&view=mobile|desktop
import http from "node:http";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../static/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../static/styles.css", import.meta.url), "utf8");
function extract(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  const tail = source.slice(start);
  return tail.slice(0, tail.indexOf("\n}") + 2);
}
const fragment = index.slice(index.indexOf('          <div class="research-complete-screen"'), index.indexOf('          <div class="research-tutorial"'));
const functions = ["renderMobileResearchSubmission", "showResearchCompletion", "completeResearchTest", "submitResearchJson"].map(extract).join("\n");

http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8877");
  if (url.pathname === "/styles.css") {
    res.writeHead(200, { "Content-Type": "text/css" });
    res.end(styles);
    return;
  }
  const mobile = url.searchParams.get("view") !== "desktop";
  const requestedScenario = url.searchParams.get("scenario");
  const scenario = ["success", "failure", "pending"].includes(requestedScenario) ? requestedScenario : "success";
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mobile completion fixture</title><link rel="stylesheet" href="/styles.css"></head><body class="test-only-distribution research-mode ${mobile ? "mobile-viewport" : ""}">${fragment}<script>
const els = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
const state = {researchMode:'test', researchDebriefSubmitted:true, researchResultAutoSubmitted:false, researchResultSubmitting:false, researchResultSubmitError:'', researchDatasetPath:'private:fixture', researchSession:{readerId:'fixture',sessionToken:'fixture'}};
const isMobileViewport = () => ${mobile};
const isValidationWorkflow = () => false;
const hideResearchTutorial=()=>{}, refreshResearchDisplay=()=>{}, hideResearchDebriefing=()=>{}, hideResearchWaveProgress=()=>{}, updateResearchEmailBody=()=>{}, saveResearchProfile=()=>{};
const researchProfile=()=>({}), activeResearchReaderId=()=>state.researchSession.readerId, researchJsonFilename=()=> 'fixture.json', researchTestTimingPayload=()=>({}), retryPendingResearchResponses=async()=>{}, readPendingResearchResponses=()=>[], setStatus=()=>{};
let attempts=0;
const fetchJson=async()=> { attempts++; if (${JSON.stringify(scenario)} === 'pending') return new Promise(()=>{}); if (${JSON.stringify(scenario)} === 'failure' && attempts === 1) throw new Error('テスト用の通信失敗'); return {ok:true}; };
${functions}
els.researchRetrySubmitBtn.addEventListener('click',completeResearchTest);
completeResearchTest();
</script></body></html>`);
}).listen(8877, "127.0.0.1", () => console.log("Completion fixture: http://127.0.0.1:8877 (no real participant data or API requests)"));
