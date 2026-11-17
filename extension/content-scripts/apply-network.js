(() => {
  // extension/studio/workday-submission.js
  var WORKDAY_ARM = "application-tracker:workday-arm";
  var WORKDAY_RESULT = "application-tracker:workday-result";
  function workdayFinalizeRequest(value, pageUrl, method = "POST") {
    try {
      const page = new URL(pageUrl), url = new URL(value, page);
      if (!/(^|\.)myworkday(?:jobs(?:-impl)?|site)?\.com$/.test(page.hostname) || page.protocol !== "https:" || url.origin !== page.origin || method.toUpperCase() !== "POST" || url.username || url.password || url.hash) return null;
      const match = url.pathname.match(/^\/wday\/cxs\/[\w-]+\/jobapplication\/([\w-]+)\/finalize$/);
      if (!match || [...url.searchParams].some(([key, value2]) => key !== "type" || value2 !== "completeAgencySubmission")) return null;
      return { applicationId: match[1], requestPath: url.pathname + url.search };
    } catch {
      return null;
    }
  }
  function successfulWorkdayFinalize(status, value) {
    return status === 200 && !!value && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string" && !!value.id.trim() && !("error" in value) && !("errors" in value);
  }
  function installWorkdaySubmissionObserver(win) {
    if (win.__applicationTrackerWorkdayObserver) return;
    win.__applicationTrackerWorkdayObserver = true;
    let recent = 0, armed = null;
    const click = (event) => {
      if (!event.isTrusted) return;
      const button = event.composedPath().find((node) => node?.matches?.('button[data-automation-id="pageFooterNextButton"],button[data-automation-id="bottom-navigation-next-button"]'));
      if (button && !button.disabled && /^submit(?: application)?$/i.test((button.getAttribute?.("aria-label") || button.textContent).trim())) recent = Date.now();
    };
    win.document.addEventListener("click", click, true);
    win.document.addEventListener("submit", (event) => {
      if (event.isTrusted) recent = Date.now();
    }, true);
    win.addEventListener(WORKDAY_ARM, (event) => {
      try {
        const value = JSON.parse(event.detail);
        if (Date.now() - recent < 1e3 && value.pageUrl === win.location.href && typeof value.attemptId === "string" && value.attemptId.length <= 128 && Number.isFinite(value.at) && Math.abs(Date.now() - value.at) < 1e3) armed = value;
      } catch {
      }
    });
    const capture = (url, method) => {
      if (!armed || Date.now() - armed.at > 3e5 || armed.pageUrl !== win.location.href) return null;
      const request = workdayFinalizeRequest(url, armed.pageUrl, method);
      return request ? { ...request, arm: armed, startedAt: Date.now() } : null;
    };
    const finish = (request, status, value) => {
      if (armed !== request.arm || !successfulWorkdayFinalize(status, value)) return;
      const proof = { ...request, attemptId: request.arm.attemptId, pageUrl: request.arm.pageUrl, status: 200, success: true };
      delete proof.arm;
      armed = null;
      win.dispatchEvent(new win.CustomEvent(WORKDAY_RESULT, { detail: JSON.stringify(proof) }));
    };
    const originalFetch = win.fetch;
    if (originalFetch) win.fetch = function(input, options) {
      const url = typeof input === "string" ? input : input.url, request = capture(url, options?.method || input.method || "GET"), work = originalFetch.call(this, input, options);
      if (request) void work.then(async (response) => {
        if (response.redirected || response.status !== 200) return;
        const reader = response.clone().body?.getReader();
        if (!reader) return;
        let size = 0, text = "";
        const decoder = new win.TextDecoder();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 65536) {
              await reader.cancel();
              return;
            }
            text += decoder.decode(chunk.value, { stream: true });
          }
          finish(request, response.status, JSON.parse(text + decoder.decode()));
        } catch {
        } finally {
          reader.releaseLock();
        }
      }).catch(() => {
      });
      return work;
    };
    const prototype = win.XMLHttpRequest?.prototype;
    if (!prototype) return;
    const open = prototype.open, send = prototype.send, requests = /* @__PURE__ */ new WeakMap();
    prototype.open = function(method, url, ...rest) {
      requests.set(this, { method, url });
      return open.call(this, method, url, ...rest);
    };
    prototype.send = function(...args) {
      const input = requests.get(this), request = input && capture(input.url, input.method);
      if (request) this.addEventListener("loadend", () => {
        try {
          if (this.responseURL && workdayFinalizeRequest(this.responseURL, request.arm.pageUrl)?.requestPath !== request.requestPath) return;
          const value = this.responseType === "json" ? this.response : (!this.responseType || this.responseType === "text") && this.responseText.length <= 65536 ? JSON.parse(this.responseText) : null;
          finish(request, this.status, value);
        } catch {
        }
      }, { once: true });
      return send.apply(this, args);
    };
  }

  // src/apply-network-content.js
  installWorkdaySubmissionObserver(window);
})();
