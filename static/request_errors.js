// Request failures are classified separately from the research workflow.
// 通信障害と認証・入力エラーを分離し、再送可否を一か所で定義する。
function requestFailure(message, status = 0, kind = "http") {
  const error = new Error(message);
  error.status = status;
  error.kind = kind;
  return error;
}

function isRecoverableRequestError(error) {
  if (error?.name === "AbortError") return false;
  if (error?.kind === "network") return true;
  const status = Number(error?.status || 0);
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function researchSaveFailureMessage(error) {
  if ([401, 403].includes(Number(error?.status))) {
    return "認証または参加セッションを確認できません。回答は確定していません。このタブを閉じず、管理者に連絡してください。";
  }
  return "回答を保存できませんでした。回答は確定していません。この画面のまま管理者に連絡してください。";
}

function cloneFetchOptions(options = {}) {
  const init = { ...options };
  if (options.headers) init.headers = new Headers(options.headers);
  return init;
}

function shouldRetryFetchError(err, response = null) {
  if (isAbortError(err)) return false;
  if (response) return isRecoverableRequestError({ status: response.status });
  return isRecoverableRequestError(err);
}

async function fetchWithRetry(url, options = {}) {
  const attempts = Math.max(1, Number(options.retryAttempts || 3));
  const retryDelayMs = Math.max(100, Number(options.retryDelayMs || 650));
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const init = cloneFetchOptions(options);
      delete init.retryAttempts;
      delete init.retryDelayMs;
      const headers = new Headers(init.headers || {});
      const target = new URL(url, window.location.href);
      if (target.origin !== window.location.origin) throw new Error("External API requests are not allowed.");
      if (REQUEST_TOKEN) headers.set("X-EEG-Viewer-Token", REQUEST_TOKEN);
      const validationRequest = target.pathname.startsWith("/api/research/validation/") || (isValidationWorkflow() && !target.pathname.startsWith("/api/research/test/"));
      const session = validationRequest ? state.validationSession : state.researchSession;
      if (session?.sessionToken) headers.set("X-EEG-Research-Session", session.sessionToken);
      init.headers = headers;
      let res;
      try {
        res = await fetch(url, init);
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw requestFailure("通信に失敗しました。", 0, "network");
      }
      if (res.ok || !shouldRetryFetchError(null, res) || attempt === attempts) return res;
      lastError = new Error(res.statusText || `HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (!shouldRetryFetchError(err) || attempt === attempts) throw err;
    }
    setStatus(`通信が不安定です。再試行中 ${attempt}/${attempts - 1}...`, { busy: true });
    await sleep(retryDelayMs * attempt, options.signal);
  }
  throw lastError || new Error("Network request failed");
}

async function fetchJson(url, options = {}) {
  const res = await fetchWithRetry(url, options);
  let data;
  try {
    data = await res.json();
  } catch {
    throw requestFailure("サーバー応答を確認できません。", res.status, "protocol");
  }
  if (!res.ok || data.error) throw requestFailure(data.error || res.statusText, res.status);
  return data;
}

async function fetchText(url, options = {}) {
  const res = await fetchWithRetry(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text;
}

