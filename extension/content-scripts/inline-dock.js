(() => {
  // extension/studio/reference-dashboard-markup.js
  var DASHBOARD_MARKUP = '<div id="at-reference-dock">\r\n  \r\n  <section class="rd-dock" aria-label="Application Tracker dock design">\r\n    <header class="rd-header">\r\n      <button type="button" class="rd-brand" data-action="Web Dashboard" aria-label="Open Dashboard" title="Open Dashboard"><span class="rd-logo"><svg aria-hidden="true" focusable="false" style="width:100%;height:100%" xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">\r\n  <rect width="128" height="128" rx="28" fill="#4f46e5"/>\r\n  <path d="M39 23h34l22 22v50a10 10 0 0 1-10 10H39a10 10 0 0 1-10-10V33a10 10 0 0 1 10-10Z" fill="#fff"/>\r\n  <path d="M73 23v15a7 7 0 0 0 7 7h15Z" fill="#c7d2fe"/>\r\n  <path d="M44 57h34M44 71h23M44 85h16" fill="none" stroke="#818cf8" stroke-width="6" stroke-linecap="round"/>\r\n  <circle cx="91" cy="92" r="25" fill="#6ee7b7" stroke="#4f46e5" stroke-width="6"/>\r\n  <path d="m79 92 8 8 17-19" fill="none" stroke="#065f46" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>\r\n</svg></span><span class="rd-brand-name">Application Tracker 2.1</span></button>\r\n      <label class="rd-person"><span class="rd-avatar" id="rd-avatar">\u2013</span></label>\r\n    </header>\r\n    <main class="rd-main">\r\n      <div class="rd-welcome"><p>Welcome back,<strong id="rd-name">\u2026</strong></p><button type="button" class="rd-refresh cursor-interaction" id="rd-refresh" aria-label="Refresh activity"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg></button></div>\r\n      <h2 class="rd-section-title">Today</h2>\r\n      <div class="rd-stats">\r\n        <div class="rd-stat rd-stat-resume"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users-round" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"></path><circle cx="10" cy="8" r="5"></circle><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"></path></svg><strong>\u2014</strong><span class="rd-stat-label">Resume Prepared Today</span></div>\r\n        <div class="rd-stat rd-stat-applications"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg><strong>\u2014</strong><span class="rd-stat-label">Applications<br>Today</span></div>\r\n        <div class="rd-stat rd-stat-meetings"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-days" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg><strong>\u2014</strong><span class="rd-stat-label">Meetings</span></div>\r\n      </div>\r\n      <h2 class="rd-section-title">Quick Actions</h2>\r\n      <nav class="rd-actions" aria-label="Quick actions">\r\n        <button type="button" class="rd-action rd-action-browse cursor-interaction" data-action="Browse Jobs" aria-pressed="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase-business" aria-hidden="true"><path d="M12 12h.01"></path><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M22 13a18.15 18.15 0 0 1-20 0"></path><rect width="20" height="14" x="2" y="6" rx="2"></rect></svg><span class="rd-action-label">Browse Jobs</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>\r\n        <button type="button" class="rd-action rd-action-apply cursor-interaction" data-action="Apply to Job" aria-pressed="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase-business" aria-hidden="true"><path d="M12 12h.01"></path><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M22 13a18.15 18.15 0 0 1-20 0"></path><rect width="20" height="14" x="2" y="6" rx="2"></rect></svg><span class="rd-action-label">Apply to Job</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>\r\n        <button type="button" class="rd-action rd-action-applications cursor-interaction" data-action="Applications" aria-pressed="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-notebook-tabs" aria-hidden="true"><path d="M2 6h4"></path><path d="M2 10h4"></path><path d="M2 14h4"></path><path d="M2 18h4"></path><rect width="16" height="20" x="4" y="2" rx="2"></rect><path d="M15 2v20"></path><path d="M15 7h5"></path><path d="M15 12h5"></path><path d="M15 17h5"></path></svg><span class="rd-action-label">Applications</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>\r\n        <button type="button" class="rd-action rd-action-meeting cursor-interaction" data-action="Meetings" aria-pressed="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-days" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg><span class="rd-action-label">Meetings</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>\r\n      <button type="button" class="rd-action rd-action-profile cursor-interaction" data-action="Profile settings" aria-pressed="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round-cog" aria-hidden="true"><path d="M2 21a8 8 0 0 1 10.434-7.62"></path><circle cx="10" cy="8" r="5"></circle><circle cx="18" cy="18" r="3"></circle><path d="m19.5 14.3-.4.9"></path><path d="m16.9 20.8-.4.9"></path><path d="m21.7 19.5-.9-.4"></path><path d="m15.2 16.9-.9-.4"></path><path d="m21.7 16.5-.9.4"></path><path d="m15.2 19.1-.9.4"></path><path d="m19.5 21.7-.4-.9"></path><path d="m16.9 15.2-.4-.9"></path></svg><span class="rd-action-label">Profile settings</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>\r\n        </nav>\r\n      <h2 class="rd-section-title">Recent Activity</h2>\r\n      <section class="rd-recent" aria-label="Recent activity"><p class="rd-empty">Loading activity\u2026</p></section>\r\n    </main>\r\n    <div class="rd-feedback" id="rd-feedback" role="status" aria-live="polite" hidden></div>\r\n  </section>\r\n  \r\n</div>';
  var ACTIVITY_MARKUP = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg><span class="rd-activity-copy"><span class="rd-activity-title"></span><span class="rd-activity-company"></span></span><span class="rd-time"></span>';

  // extension/studio/reference-dashboard-data.js
  function timestamp(value) {
    const time = typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(time) && Math.abs(time) <= 864e13 ? time : null;
  }
  function safeJobUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }
  function referenceDashboardData(saved = {}, session = {}, now = /* @__PURE__ */ new Date(), candidateId = null) {
    if (saved.appliedList !== void 0 && !Array.isArray(saved.appliedList)) throw new Error("Saved application history could not be read.");
    const start2 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), end = now.getTime();
    const today = (value) => value !== null && value >= start2 && value <= end;
    const activity = (saved.appliedList || []).flatMap((record, index) => {
      if (!record || typeof record !== "object") return [];
      const title = String(record.jobTitle || record.title || "").trim(), company = String(record.companyName || record.company || "").trim(), url = safeJobUrl(record.jobLink || record.url);
      if (!title && !company && !url) return [];
      return [{ id: String(record.id || index), title: title || "Untitled role", company: company || "Company not provided", url, timestamp: timestamp(record.date ?? record.appliedAt) }];
    }).sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
    const exports = Object.entries(session).filter(([key, ticket]) => key.startsWith("pdf-export:") && ticket && (!candidateId || ticket.candidateId === candidateId) && today(timestamp(ticket.createdAt)) && ticket.files?.some((file) => file.kind === "cv" && file.state === "complete"));
    return { applications: activity.filter((record) => today(record.timestamp)).length, resumes: exports.length, activity: activity.slice(0, 6) };
  }
  function activityTime(value, now = Date.now()) {
    if (value === null) return "Date unavailable";
    const hours = Math.max(0, Math.floor((now - value) / 36e5));
    if (!hours) return "less than an hour ago";
    if (hours < 24) return `about ${hours} hour${hours === 1 ? "" : "s"} ago`;
    return new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric" }).format(value);
  }

  // extension/studio/branding.js
  var APP_NAME = "Application Tracker 2.1";

  // extension/studio/navigation-flush.js
  var NAVIGATION_FLUSH = "flush-studio-navigation:v1";
  async function flushStudioTab(tabId, browser = globalThis.chrome) {
    const response = await browser.runtime.sendMessage({ target: NAVIGATION_FLUSH, previewTabId: tabId });
    if (!response?.ok) throw new Error(response?.error || "Your Resume Studio edits could not be saved. Try again before switching pages.");
  }

  // extension/studio/dock.js
  async function openDashboard(route = "/", browser = globalThis.chrome) {
    if (!["/", "/profile", "/profile/new", "/settings", "/settings/profile", "/settings/profile/new", "/settings/prompts", "/settings/other", "/resume-studio", "/dashboard", "/meetings"].includes(route)) {
      throw new Error(`Unknown ${APP_NAME} page.`);
    }
    const base = browser.runtime.getURL("options.html");
    const current = globalThis.location?.href?.split(/[?#]/)[0];
    const preview = browser.runtime.getURL("preview.html");
    if (current === base || current === preview) {
      if (route === "/resume-studio") return openStudioPreview((await browser.windows.getCurrent()).id, browser);
      if (current === preview) {
        const tab = await browser.tabs.getCurrent();
        if (!Number.isSafeInteger(tab?.id)) throw new Error("Reload Resume Studio before switching pages.");
        await flushStudioTab(tab.id, browser);
        globalThis.location.assign(`${base}#${route}`);
      } else {
        globalThis.location.hash = route;
        globalThis.window.dispatchEvent(new Event("popstate"));
      }
      return;
    }
    const window2 = await browser.windows.getCurrent();
    const tabs = await browser.tabs.query({ windowId: window2.id });
    const existing = tabs.find((tab) => (tab.url || "").split("#")[0] === base);
    const url = `${base}#${route}`;
    if (existing?.id !== void 0) return browser.tabs.update(existing.id, { url, active: true });
    return browser.tabs.create({ url, windowId: window2.id, active: true });
  }
  async function requestStudioPreview(windowId, browser = globalThis.chrome, tabId) {
    if (!Number.isSafeInteger(windowId) || windowId < 0) throw new Error("The current browser window is not ready. Please try again.");
    const reply = await browser.runtime.sendMessage({
      version: 1,
      operation: "OPEN_STUDIO_PREVIEW",
      requestId: crypto.randomUUID(),
      payload: { windowId, ...tabId === void 0 ? {} : { tabId } }
    });
    if (!reply?.ok) throw new Error(reply?.error?.message || "Resume Studio could not open. Please try again.");
    return reply.result;
  }
  async function openStudioPreview(windowId, browser = globalThis.chrome) {
    const current = globalThis.location?.href?.split(/[?#]/)[0];
    if (current && current === browser.runtime.getURL?.("preview.html")) return;
    if (current && current === browser.runtime.getURL?.("options.html")) {
      const tab = await browser.tabs.getCurrent();
      if (!Number.isSafeInteger(tab?.id) || tab.windowId !== windowId) throw new Error("Reload this page to find its Chrome tab.");
      return requestStudioPreview(windowId, browser, tab.id);
    }
    return requestStudioPreview(windowId, browser);
  }

  // extension/studio/reference-dashboard.js
  function mountReferenceDashboard(root, browser = globalThis.chrome, { onApplications, onApply, showProfileSelector = true } = {}) {
    const document2 = root.ownerDocument;
    if (!showProfileSelector) root.querySelector("#rd-candidate")?.remove();
    let alive = true, revision = 0, selecting = false;
    const feedback = root.querySelector("#rd-feedback"), picker = root.querySelector("#rd-candidate");
    const show = (message) => {
      if (alive) {
        feedback.textContent = message;
        feedback.hidden = !message;
      }
    };
    async function request(operation, payload = {}) {
      const reply = await browser.runtime.sendMessage({ version: 1, operation, requestId: crypto.randomUUID(), payload });
      if (!reply?.ok) throw new Error(reply?.error?.message || "The dashboard could not load. Please refresh.");
      return reply.result;
    }
    async function refresh() {
      const current = ++revision;
      try {
        const [state, saved, session] = await Promise.all([request("DASHBOARD_STATE"), browser.storage.local.get(["appliedList"]), browser.storage.session.get(null)]);
        if (!alive || current !== revision) return;
        const data = referenceDashboardData(saved, session, /* @__PURE__ */ new Date(), state.candidate?.document.candidate.id);
        const name = state.candidate?.document.candidate.name || "Create your profile";
        root.querySelector("#rd-name").textContent = name;
        const avatar = root.querySelector("#rd-avatar");
        if (avatar) {
          avatar.textContent = state.candidate ? name.charAt(0).toUpperCase() : "\u2013";
          avatar.title = name;
          avatar.setAttribute("aria-label", name);
        }
        if (picker) {
          picker.replaceChildren();
          if (!state.candidate) {
            const option = document2.createElement("option");
            option.value = "";
            option.textContent = "Candidate";
            picker.append(option);
          }
          for (const candidate of state.candidates) {
            const option = document2.createElement("option");
            option.value = candidate.id;
            option.textContent = candidate.name;
            picker.append(option);
          }
          picker.value = state.candidate?.document.candidate.id || "";
          picker.disabled = selecting || !state.candidates.length;
          picker.title = name;
        }
        root.querySelector(".rd-stat-resume strong").textContent = String(data.resumes);
        root.querySelector(".rd-stat-applications strong").textContent = String(data.applications);
        root.querySelector(".rd-stat-meetings strong").textContent = "\u2014";
        root.querySelector(".rd-stat-meetings").title = "Calendar is not connected.";
        const recent = root.querySelector(".rd-recent");
        recent.replaceChildren();
        for (const record of data.activity) {
          const row = document2.createElement("button");
          row.type = "button";
          row.className = "rd-activity application cursor-interaction";
          row.innerHTML = ACTIVITY_MARKUP;
          row.dataset.url = record.url || "";
          row.title = `${record.title} \xB7 ${record.company}`;
          row.querySelector(".rd-activity-title").textContent = record.title;
          row.querySelector(".rd-activity-company").textContent = record.company;
          row.querySelector(".rd-time").textContent = activityTime(record.timestamp);
          recent.append(row);
        }
        if (!data.activity.length) {
          const empty = document2.createElement("p");
          empty.className = "rd-empty";
          empty.textContent = "No recent activity";
          recent.append(empty);
        }
      } catch (error) {
        if (alive && current === revision) show(error.message);
      }
    }
    async function select() {
      selecting = true;
      picker.disabled = true;
      show("");
      try {
        await request("DASHBOARD_SELECT_PROFILE", { candidateId: picker.value });
      } catch (error) {
        show(error.message);
      } finally {
        selecting = false;
        if (alive) await refresh();
      }
    }
    async function click(event) {
      if (event.target.closest("#job-records-design,#apply-ready-queue-design")) return;
      const button = event.target.closest("button");
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.id === "rd-refresh") {
        root.querySelectorAll("button[aria-pressed]").forEach((item) => item.setAttribute("aria-pressed", "false"));
        show("");
        await refresh();
        return;
      }
      const action = button.dataset.action;
      if (action) root.querySelectorAll(".rd-action").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      else if (button.classList.contains("rd-activity")) root.querySelectorAll(".rd-activity").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      button.disabled = true;
      show("");
      try {
        if (action === "Web Dashboard") await openDashboard("/dashboard", browser);
        else if (action === "Settings") await openDashboard("/settings", browser);
        else if (action === "Browse Jobs") await browser.tabs.create({ url: "https://www.linkedin.com/jobs/", active: true });
        else if (action === "Applications") {
          if (onApplications) await onApplications("applications");
          else await openDashboard("/", browser);
        } else if (action === "Profile settings") await openDashboard("/settings/profile", browser);
        else if (action === "Meetings") await openDashboard("/meetings", browser);
        else if (action === "Apply to Job") {
          if (onApply) {
            await onApply();
            return;
          }
          const window2 = await browser.windows.getCurrent(), tabs = await browser.tabs.query({ windowId: window2.id });
          const eligible = tabs.filter((tab2) => Number.isSafeInteger(tab2.id) && safeJobUrl(tab2.url));
          const tab = eligible.find((tab2) => tab2.active) || eligible.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
          if (!tab) throw new Error("Open a job listing before applying.");
          await browser.tabs.update(tab.id, { active: true });
          const capture = await request("CAPTURE_COMMAND", { command: "capture-job", sourceTabId: tab.id });
          if (!capture?.captureId) throw new Error("The job could not be captured. Review the listing in Resume Studio.");
        } else if (button.classList.contains("rd-activity")) {
          if (onApplications) {
            await onApplications("applications", button.dataset.url);
            return;
          }
          const url = safeJobUrl(button.dataset.url);
          if (url) await browser.tabs.create({ url, active: true });
          else await openDashboard("/", browser);
        }
      } catch (error) {
        show(error.message || "The action could not open. Please try again.");
      } finally {
        if (alive) button.disabled = false;
      }
    }
    const changed = (changes, area) => {
      if (area === "local" && (changes.profile || changes.appliedList) || area === "session" && Object.keys(changes).some((key) => key.startsWith("pdf-export:"))) refresh();
    };
    picker?.addEventListener("change", select);
    root.addEventListener("click", click);
    browser.storage.onChanged.addListener(changed);
    refresh();
    const timer = setInterval(refresh, 6e4);
    return () => {
      alive = false;
      revision++;
      clearInterval(timer);
      picker?.removeEventListener("change", select);
      root.removeEventListener("click", click);
      browser.storage.onChanged.removeListener(changed);
    };
  }

  // extension/studio/job-records-markup.js
  var JOB_RECORDS_MARKUP = '<div id="job-records-design" class="viz-dotted-background">\r\n  \r\n  <section class="jr-window" aria-label="Applications and job queues dock">\r\n    <header class="jr-header"><button type="button" class="jr-back" data-command="dashboard"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"></path></svg>Dashboard</button><h2>Application Workspace</h2></header>\r\n    <div class="jr-tabs" role="tablist" aria-label="Record type">\r\n      <button type="button" class="jr-tab cursor-interaction" id="jr-tab-applications" data-tab="applications" role="tab" aria-selected="true" aria-controls="jr-main-panel">Applications <span class="jr-tab-count" id="jr-app-count">0</span></button>\r\n      <button type="button" class="jr-tab cursor-interaction" id="jr-tab-queue" data-tab="queue" role="tab" aria-selected="false" aria-controls="jr-main-panel">Job Queues <span class="jr-tab-count" id="jr-queue-count">0</span></button>\r\n    </div>\r\n    <div class="jr-toolbar"><button type="button" class="jr-button primary" data-command="add">Add manually</button><button type="button" class="jr-button danger" data-command="delete-all" hidden="">Delete all</button><button type="button" class="jr-icon" data-command="refresh" aria-label="Refresh records"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg></button></div><div class="jr-body" id="jr-main-panel" role="tabpanel" aria-labelledby="jr-tab-applications">\r\n      <div class="jr-list" id="jr-list"></div>\r\n      <section id="jr-detail" aria-label="Record details" hidden="">\r\n        <div class="jr-detail-top"><button type="button" class="jr-back cursor-interaction" data-command="back"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"></path></svg><span id="jr-back-label">Applications</span></button><span class="jr-demo" id="jr-record-number"></span></div>\r\n        <div class="jr-detail-card">\r\n          <header class="jr-detail-heading"><div class="jr-detail-title"><h3 class="jr-detail-company" id="jr-detail-company"></h3><span id="jr-detail-status" hidden=""></span></div><p class="jr-detail-role" id="jr-detail-role"></p><div class="jr-detail-meta"><span id="jr-detail-candidate"></span><time class="jr-updated" id="jr-detail-updated"></time></div></header><div class="jr-detail-actions" id="jr-detail-actions"></div>\r\n          <div class="jr-detail-navigation"><div class="jr-detail-subnav" role="tablist" aria-label="Record view"><button type="button" class="jr-detail-tab cursor-interaction" id="jr-view-description" role="tab" aria-controls="jr-description-pane" aria-selected="true" data-mode="description" tabindex="0">Job description</button>\r\n            <button type="button" class="jr-detail-tab cursor-interaction" id="jr-view-details" role="tab" aria-controls="jr-details-pane" aria-selected="false" data-mode="details" tabindex="-1">Details</button>\r\n            \r\n          </div><div id="jr-edit-slot"></div></div>\r\n          <section id="jr-description-pane" role="tabpanel" aria-labelledby="jr-view-description"><span class="jr-preview-kind" id="jr-description-kind"></span><div id="jr-description-content"></div></section><section id="jr-details-pane" role="tabpanel" aria-labelledby="jr-view-details" hidden="">\r\n            <div id="jr-read-view"><div class="jr-fields" id="jr-record-fields"></div><p class="jr-note" id="jr-record-note"></p><h4 class="jr-section-label">Activity</h4><div class="jr-timeline" id="jr-timeline"></div></div>\r\n            <form class="jr-edit-form" id="jr-edit-form" hidden="">\r\n              <label id="jr-status-field"><span class="jr-label">Application status</span><select class="jr-select" id="jr-status-select" aria-label="Update application status"></select></label>\r\n              <div id="jr-queue-status-field" hidden=""><span class="jr-label">Queue status</span><div class="jr-locked-status"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-workflow"><rect width="8" height="8" x="3" y="3" rx="2"></rect><path d="M7 11v4a2 2 0 0 0 2 2h4"></path><rect width="8" height="8" x="13" y="13" rx="2"></rect></svg><span id="jr-queue-status-text"></span></div></div>\r\n              <label id="jr-job-description-field" hidden=""><span class="jr-label">Job description / context</span><textarea class="jr-textarea" id="jr-job-description" rows="5"></textarea></label>\r\n              \r\n              <div class="jr-document-fields"><label><span class="jr-label">Resume (CV JSON)</span><textarea class="jr-textarea" id="jr-resume-input" rows="7" spellcheck="false"></textarea></label><label class="jr-cover-letter-control"><input type="checkbox" id="jr-letter-enabled"> Include cover letter</label><label><span class="jr-label">Cover letter</span><textarea class="jr-textarea" id="jr-letter-input" rows="5"></textarea></label></div><div class="jr-detail-actions"><button type="submit" class="jr-button primary cursor-interaction"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>Save update</button><button type="button" class="jr-button cursor-interaction" data-command="cancel-edit">Cancel</button></div>\r\n            </form>\r\n            <div class="jr-chat-panel" id="jr-chat-panel" hidden=""><span class="jr-preview-kind"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-messages-square"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"></path><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path></svg>GPT conversation</span><div class="jr-alert" id="jr-chat-error"></div><div class="jr-chat-context" id="jr-chat-context"></div><div class="jr-detail-actions"><button type="button" class="jr-button primary cursor-interaction" data-command="retry" id="jr-retry-task"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>Queue another attempt</button><button type="button" class="jr-button cursor-interaction" data-command="close-chat">Back to record</button></div></div>\r\n          </section>\r\n          \r\n        </div>\r\n      </section>\r\n      <div class="jr-feedback" id="jr-feedback" role="status" aria-live="polite" hidden=""><span id="jr-feedback-text"></span><button type="button" class="jr-undo cursor-interaction" data-command="undo-delete" id="jr-undo" hidden="">Undo</button></div>\r\n    </div>\r\n  </section>\r\n  </div>';
  var JOB_RECORD_ICONS = { "chevron-left": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"></path></svg>', "plus": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-plus"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>', "scan-text": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-scan-text"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M7 8h8"></path><path d="M7 12h10"></path><path d="M7 16h6"></path></svg>', "check-check": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-check-check"><path d="M18 6 7 17l-5-5"></path><path d="m22 10-7.5 7.5L13 16"></path></svg>', "calendar-days": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-calendar-days"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>', "badge-check": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-badge-check"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path><path d="m9 12 2 2 4-4"></path></svg>', "circle-x": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-circle-x"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>', "archive": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-archive"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path></svg>', "clock-3": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-clock-3"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16.5 12"></polyline></svg>', "loader-circle": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-loader-circle"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>', "file-check-2": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-file-check-2"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="m3 15 2 2 4-4"></path></svg>', "circle-alert": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-circle-alert"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>', "panel-right-open": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-panel-right-open"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M15 3v18"></path><path d="m10 15-3-3 3-3"></path></svg>', "eye": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg>', "arrow-up-right": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-arrow-up-right"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>', "messages-square": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-messages-square"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"></path><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path></svg>', "square-pen": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-square-pen"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>', "trash-2": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-trash-2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>', "inbox": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-inbox"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>', "file-text": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>', "check": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>', "workflow": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-workflow"><rect width="8" height="8" x="3" y="3" rx="2"></rect><path d="M7 11v4a2 2 0 0 0 2 2h4"></path><rect width="8" height="8" x="13" y="13" rx="2"></rect></svg>', "rotate-ccw": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>', "refresh-cw": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>', "folder-open": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-folder-open"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"></path></svg>', "save": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path><path d="M7 3v4a1 1 0 0 0 1 1h7"></path></svg>', "download": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>', "upload": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" x2="12" y1="3" y2="15"></line></svg>', "x": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-x"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>' };

  // extension/studio/storage.js
  function createStudioStorage({
    indexedDB = globalThis.indexedDB,
    BroadcastChannel = globalThis.BroadcastChannel,
    databaseName = "autofill-resume-studio-v1"
  } = {}) {
    const listeners = /* @__PURE__ */ new Set();
    let database;
    let channel;
    function emit(changes) {
      for (const listener of listeners) {
        try {
          listener(structuredClone(changes), "local");
        } catch (error) {
          console.error("Resume Studio storage listener failed.", error);
        }
      }
    }
    function connect() {
      if (!channel && BroadcastChannel) {
        channel = new BroadcastChannel(`${databaseName}:changes`);
        channel.unref?.();
        channel.onmessage = (event) => {
          if (event.data?.version === 1 && event.data.changes) emit(event.data.changes);
        };
      }
      return channel;
    }
    function publish(changes) {
      if (!Object.keys(changes).length) return;
      emit(changes);
      connect()?.postMessage({ version: 1, changes });
    }
    function open() {
      if (!indexedDB) return Promise.reject(new Error("Resume Studio storage is unavailable."));
      return database ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("records");
        request.onerror = () => {
          database = void 0;
          reject(request.error);
        };
        request.onblocked = () => {
          database = void 0;
          reject(new Error("Close other Resume Studio pages and retry the storage operation."));
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            database = void 0;
          };
          resolve(db);
        };
      });
    }
    function putProperty(object, key, value) {
      Object.defineProperty(object, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    async function get(keys = null) {
      const all = keys === null || keys === void 0;
      const defaults = !all && typeof keys === "object" && !Array.isArray(keys) ? keys : null;
      const selected = all ? null : typeof keys === "string" ? [keys] : defaults ? Object.keys(defaults) : keys;
      if (selected !== null && (!Array.isArray(selected) || selected.some((key) => typeof key !== "string"))) {
        throw new TypeError("Storage keys must be strings, an array, defaults, or null.");
      }
      const db = await open();
      return new Promise((resolve, reject) => {
        const result = {};
        const transaction = db.transaction("records", "readonly");
        const store = transaction.objectStore("records");
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("Storage read failed."));
        if (all) {
          const request = store.openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            putProperty(result, cursor.key, cursor.value);
            cursor.continue();
          };
        } else {
          for (const key of selected) {
            const request = store.get(key);
            request.onsuccess = () => {
              if (request.result !== void 0) putProperty(result, key, request.result);
              else if (defaults) putProperty(result, key, structuredClone(defaults[key]));
            };
          }
        }
      });
    }
    async function mutate(items, remove) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const changes = {};
        const transaction = db.transaction("records", "readwrite");
        const store = transaction.objectStore("records");
        transaction.oncomplete = () => {
          publish(changes);
          resolve();
        };
        transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("Storage write failed."));
        for (const [key, value] of items) {
          const request = store.get(key);
          request.onsuccess = () => {
            const oldValue = request.result;
            if (remove) {
              if (oldValue === void 0) return;
              store.delete(key);
              putProperty(changes, key, { oldValue });
            } else if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
              store.put(value, key);
              putProperty(changes, key, {
                ...oldValue === void 0 ? {} : { oldValue },
                newValue: value
              });
            }
          };
        }
      });
    }
    return {
      get,
      set(values) {
        if (!values || typeof values !== "object" || Array.isArray(values)) {
          return Promise.reject(new TypeError("Storage values must be an object."));
        }
        return mutate(Object.entries(structuredClone(values)), false);
      },
      remove(keys) {
        const list = typeof keys === "string" ? [keys] : keys;
        if (!Array.isArray(list) || list.some((key) => typeof key !== "string")) {
          return Promise.reject(new TypeError("Storage keys must be strings."));
        }
        return mutate(list.map((key) => [key]), true);
      },
      async setAccessLevel({ accessLevel }) {
        if (accessLevel !== "TRUSTED_CONTEXTS") throw new Error("Studio records are private to extension pages.");
      },
      onChanged: {
        addListener(listener) {
          listeners.add(listener);
          connect();
        },
        removeListener(listener) {
          listeners.delete(listener);
        },
        hasListener(listener) {
          return listeners.has(listener);
        }
      },
      async close() {
        channel?.close();
        channel = void 0;
        listeners.clear();
        const pending = database;
        database = void 0;
        if (pending) (await pending).close();
      }
    };
  }
  var studioStorage = createStudioStorage();

  // src/inline-cv-input.js
  function mountQueueResumeInput() {
    return { sync() {
    }, close() {
    }, open() {
      throw Error("Open CV input in the extension page.");
    } };
  }

  // extension/studio/request-deadline.js
  function withRequestDeadline(request, timeoutMs = 1e4, message = "The extension did not respond. Refresh this page to reconnect, then try again.") {
    let timer;
    return Promise.race([Promise.resolve(request), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(Error(message), { code: "RESPONSE_TIMEOUT" })), timeoutMs);
    })]).finally(() => clearTimeout(timer));
  }

  // extension/studio/job-records-view.js
  var labels = { applied: "Applied", screen: "Screening", interview: "Interview", offer: "Offer", rejected: "Rejected", archived: "Archived", Queued: "Queued", Generating: "Generating", Ready: "Ready", Failed: "Failed" };
  var statusIcons = { applied: "check-check", screen: "scan-text", interview: "calendar-days", offer: "badge-check", rejected: "circle-x", archived: "archive", Queued: "clock-3", Generating: "loader-circle", Ready: "file-check-2", Failed: "circle-alert" };
  function mountJobRecords(host, { browser = globalThis.chrome, onDashboard = () => {
  }, onApply, onResumeInput, privateStorage = studioStorage, directoryStore, requestTimeoutMs = 1e4 } = {}) {
    host.innerHTML = JOB_RECORDS_MARKUP;
    const root = host.querySelector("#job-records-design"), doc = host.ownerDocument, $ = (selector) => root.querySelector(selector);
    let alive = true, busy = false, version = 0, loaded = false, windowId, uiKey, pendingRefresh = false, persistTail = Promise.resolve(), resumeInput;
    let data = { candidate: null, applications: [], jobs: [] };
    const state = { tab: "applications", selected: null, mode: "description", editing: false, chat: false, adding: false, drafts: {}, deleted: null };
    let pendingState = null, writingState = false, chosenTab = null;
    const el = (tag, text, className) => {
      const node = doc.createElement(tag);
      if (text !== void 0 && text !== null) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    const icon = (name) => {
      const holder = el("span");
      holder.innerHTML = JOB_RECORD_ICONS[name] || JOB_RECORD_ICONS["circle-alert"];
      return holder.firstElementChild;
    };
    const current = () => [...data.applications, ...data.jobs].find((item) => item.id === state.selected);
    const format = (value) => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date) : "Date unavailable";
    };
    function show(message = "", error = false, undo = false) {
      if (!alive) return;
      $("#jr-feedback-text").textContent = message;
      $("#jr-feedback").hidden = !message;
      $("#jr-feedback").dataset.error = String(error);
      $("#jr-feedback").setAttribute("role", error ? "alert" : "status");
      $("#jr-undo").hidden = !undo;
    }
    function persist() {
      if (!uiKey) return Promise.resolve();
      pendingState = structuredClone({ tab: state.tab, selected: state.selected, mode: state.mode, editing: state.editing, adding: state.adding, drafts: state.drafts, deleted: state.deleted });
      if (writingState) return persistTail;
      writingState = true;
      persistTail = (async () => {
        while (pendingState) {
          const next = pendingState;
          pendingState = null;
          try {
            await withRequestDeadline(browser.storage.session.set({ [uiKey]: next }), Math.min(3e3, requestTimeoutMs));
          } catch {
            show("Unsaved edits remain in this dock. Saving for reopening failed. Save the record before closing the dock.", true);
          }
        }
      })().finally(() => {
        writingState = false;
        if (pendingState) void persist();
      });
      return persistTail;
    }
    async function request(operation, payload = {}) {
      const requestId = crypto.randomUUID(), reply = await withRequestDeadline(browser.runtime.sendMessage({ version: 1, operation, requestId, payload }), requestTimeoutMs);
      if (!reply?.ok || reply.requestId && reply.requestId !== requestId) throw Object.assign(new Error(reply?.error?.message || "The dock could not reach its saved records. Try refreshing."), { code: reply?.error?.code });
      return reply.result;
    }
    function setBusy(value) {
      busy = value;
      root.setAttribute("aria-busy", String(value));
      root.querySelectorAll("button").forEach((button2) => {
        button2.disabled = button2.dataset.command === "dashboard" ? false : value;
      });
      $('[data-command="delete-all"]').disabled = value || !data.jobs.length;
      root.querySelectorAll('[data-unavailable="true"]').forEach((button2) => {
        button2.disabled = true;
      });
      if (!value) resumeInput?.sync();
    }
    async function run(action2) {
      if (busy || !loaded) return;
      setBusy(true);
      show("");
      try {
        await action2();
      } catch (error) {
        show(error.message, true);
      } finally {
        if (alive) {
          setBusy(false);
          if (pendingRefresh) {
            pendingRefresh = false;
            void refresh();
          }
        }
      }
    }
    async function refresh() {
      if (busy) {
        pendingRefresh = true;
        return;
      }
      const revision = ++version;
      try {
        const next = await request("DOCK_RECORDS_STATE");
        if (alive && revision === version) {
          data = next;
          render();
        }
      } catch (error) {
        if (alive && revision === version) show(error.message, true);
      }
    }
    async function mutate(action2, record, fields, extra = {}) {
      const next = await request("DOCK_RECORDS_MUTATE", { action: action2, type: record?.type || "queue", id: record?.id, expectedRevision: record?.revision, fields, mutationId: crypto.randomUUID(), ...extra });
      data = next;
      return next;
    }
    function badge(status) {
      const node = el("span", null, `jr-status ${status === "screen" ? "screening" : status.toLowerCase()}`);
      node.append(icon(statusIcons[status]), doc.createTextNode(labels[status] || status));
      return node;
    }
    function button(label, command2, glyph, className = "", record) {
      const node = el("button", null, className || "jr-button");
      node.type = "button";
      node.dataset.command = command2;
      if (record) node.dataset.record = record.id;
      if (glyph) node.append(icon(glyph));
      node.append(doc.createTextNode(label));
      return node;
    }
    function action(record, command2, glyph, label, danger = false) {
      const node = button("", command2, glyph, `jr-icon${danger ? " danger" : ""}`, record);
      node.setAttribute("aria-label", `${label} \xB7 ${record.company}`);
      node.title = label;
      return node;
    }
    function recordActions(record, rail = false) {
      const nodes = [], queue = record.type === "queue";
      const add = (label, command2, glyph, danger = false) => nodes.push(rail ? action(record, command2, glyph, label, danger) : button(label, command2, glyph, `jr-button${danger ? " danger" : ""}`, record));
      if (rail) add("View job description", "description", "scan-text");
      add("Update record", "edit", "square-pen");
      if (!rail) {
        const edit = nodes.at(-1);
        edit.setAttribute("aria-pressed", String(state.editing));
        edit.setAttribute("aria-controls", "jr-edit-form");
      }
      if (record.url) add("Go to apply", "apply", "arrow-up-right");
      if (!queue && record.conversationUrl) add("Open GPT conversation", "chat", "messages-square");
      if (queue) add("Delete", "delete", "trash-2", true);
      return nodes;
    }
    function renderList() {
      const list = $("#jr-list");
      list.replaceChildren();
      const records = (state.tab === "queue" ? data.jobs : data.applications).slice().sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
      list.classList.toggle("jr-queue-list", state.tab === "queue");
      if (!records.length) {
        const empty = el("div", null, "jr-empty");
        empty.append(icon("inbox"), el("span", state.tab === "queue" ? "No jobs in this queue. Use Add manually to add a job." : "No recorded applications yet."));
        list.append(empty);
      }
      for (const record of records) {
        const queue = record.type === "queue", card = el("article", null, `jr-record${queue ? " jr-queue-record" : ""}`);
        card.dataset.id = record.id;
        card.setAttribute("aria-label", `${record.company} \xB7 ${record.role} \xB7 ${labels[record.status] || record.status}`);
        const head = el("div", null, "jr-record-head"), company = el("div", null, "jr-company"), stamp = el("div", null, "jr-stamp");
        company.append(el("h3", record.company), el("p", record.role));
        if (queue) {
          head.classList.add("jr-card-main");
          head.setAttribute("role", "button");
          head.tabIndex = 0;
          head.dataset.command = "details";
          head.dataset.record = record.id;
          head.setAttribute("aria-label", `View details for ${record.role} at ${record.company}`);
          company.append(el("p", record.salary || "Salary not listed", "jr-card-salary"));
        }
        const time = el("time", `Updated ${format(record.updatedAt)}`, "jr-updated");
        if (Number.isFinite(Date.parse(record.updatedAt))) time.dateTime = new Date(record.updatedAt).toISOString();
        const status = el("div", null, "jr-queue-status");
        status.append(badge(record.status));
        if (queue) stamp.append(status, time);
        else stamp.append(badge(record.status), time);
        head.append(company, stamp);
        card.append(head);
        if (record.status === "Failed") card.append(el("p", record.error || "Resume preparation failed. Retry when ready.", "jr-error"));
        if (state.drafts[record.id]) card.append(el("p", "Unsaved edits kept in this dock", "jr-unsaved"));
        const footer = el("div", null, "jr-record-actions");
        footer.setAttribute("role", "group");
        footer.setAttribute("aria-label", `Actions for ${record.company}`);
        if (queue) {
          const resume = button("Resume", "open-resume", "file-text", "jr-button", record), letter = button("Cover letter", "cover-letter", "file-text", "jr-button", record);
          resume.disabled = !record.resume?.snapshot;
          resume.dataset.unavailable = String(resume.disabled);
          resume.title = resume.disabled ? "Create a resume using Update first." : "Open saved resume";
          letter.disabled = !(record.coverLetterEnabled ?? record.resume?.coverLetterEnabled) || !(record.coverLetterRaw ?? record.resume?.coverLetterRaw)?.trim();
          letter.dataset.unavailable = String(letter.disabled);
          letter.title = letter.disabled ? "Create and save a cover letter using Update first." : "Open saved cover letter";
          footer.append(resume, letter, button("Update", "update-resume", "square-pen", "jr-button", record), button("Delete", "delete", "trash-2", "jr-button danger", record));
        } else {
          const view = button("View", "view", "panel-right-open", "jr-view", record), actions = el("div", null, "jr-action-rail");
          actions.append(...recordActions(record, true));
          footer.append(view, actions);
        }
        card.append(footer);
        list.append(card);
      }
    }
    function field(container, label, value) {
      const row = el("div", null, "jr-field");
      row.append(el("span", label), el("span", value));
      container.append(row);
    }
    function renderDescription(record) {
      const target = $("#jr-description-content");
      target.replaceChildren();
      $("#jr-description-kind").replaceChildren(icon("scan-text"), doc.createTextNode("Job description"));
      const url = safeJobUrl(record.url);
      if (url) {
        const link = el("a", void 0, "jr-source-link");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.append(icon("arrow-up-right"), doc.createTextNode("Open original listing"));
        target.append(link);
      }
      target.append(el("div", (record.isMock ? record.description?.replace(/\bsample\b\s*/gi, "") : record.description) || "No job description is saved for this record.", "jr-description-copy"));
    }
    function formFields(record) {
      return { salary: record.salary || "", notes: record.notes || "", cvJsonRaw: record.resume?.cvJsonRaw || "", coverLetterRaw: record.coverLetterRaw ?? record.resume?.coverLetterRaw ?? "", coverLetterEnabled: record.coverLetterEnabled ?? !!record.resume?.coverLetterEnabled, description: (record.isMock ? record.description?.replace(/\bsample\b\s*/gi, "") : record.description) || "", url: record.url || "", conversationUrl: record.conversationUrl || "", status: record.status };
    }
    function draftFor(record) {
      return state.drafts[record.id] || { revision: record.revision, fields: formFields(record) };
    }
    const urlLabel = el("label");
    urlLabel.append(el("span", "Job URL", "jr-label"));
    const urlInput = el("input");
    urlInput.id = "jr-job-url";
    urlInput.className = "jr-select";
    urlInput.type = "url";
    urlInput.required = true;
    urlLabel.append(urlInput);
    const chatLabel = el("label");
    chatLabel.append(el("span", "AI conversation URL (optional)", "jr-label"));
    const chatInput = el("input");
    chatInput.id = "jr-conversation-url";
    chatInput.className = "jr-select";
    chatInput.type = "url";
    chatInput.placeholder = "https://chatgpt.com/c/\u2026";
    chatLabel.append(chatInput);
    const salaryLabel = el("label");
    salaryLabel.append(el("span", "Salary (optional)", "jr-label"));
    const salaryInput = el("input");
    salaryInput.id = "jr-salary";
    salaryInput.className = "jr-select";
    salaryInput.maxLength = 200;
    salaryInput.placeholder = "e.g. $100,000-$130,000 / year";
    salaryLabel.append(salaryInput);
    $("#jr-resume-input").closest("label").after(salaryLabel);
    $("#jr-edit-form").insertBefore(urlLabel, $("#jr-job-description-field"));
    $("#jr-edit-form").insertBefore(chatLabel, $("#jr-edit-form .jr-detail-actions"));
    const unsaved = el("p", "Edits are kept when switching dock tabs. Save update to commit them.", "jr-unsaved");
    $("#jr-edit-form").append(unsaved);
    $('#jr-edit-form [data-command="cancel-edit"]').textContent = "Discard edits";
    function renderDetail(record) {
      $("#jr-back-label").textContent = record.type === "queue" ? "Job Queues" : "Applications";
      $("#jr-record-number").textContent = record.isMock ? "" : record.id.slice(0, 16);
      $("#jr-detail-company").textContent = record.company;
      $("#jr-detail-role").textContent = record.role;
      $("#jr-detail-updated").textContent = `Updated ${format(record.updatedAt)}`;
      const readyStatus = $("#jr-detail-status");
      readyStatus.hidden = true;
      readyStatus.replaceChildren(...record.status === "Ready" ? [badge("Ready")] : []);
      if (Number.isFinite(Date.parse(record.updatedAt))) $("#jr-detail-updated").dateTime = new Date(record.updatedAt).toISOString();
      else $("#jr-detail-updated").removeAttribute("datetime");
      for (const mode of ["description", "details"]) {
        const selected = state.mode === mode;
        $(`#jr-view-${mode}`).setAttribute("aria-selected", String(selected));
        $(`#jr-view-${mode}`).tabIndex = selected ? 0 : -1;
        $(`#jr-${mode}-pane`).hidden = !selected;
      }
      $("#jr-detail-candidate").textContent = `Candidate: ${record.candidateName || data.candidate?.name || ""}`;
      $("#jr-read-view").hidden = true;
      $("#jr-edit-form").hidden = state.chat;
      $("#jr-edit-form").querySelectorAll("input,textarea,select").forEach((control) => control.disabled = !state.editing);
      $("#jr-edit-form .jr-detail-actions").hidden = record.type === "queue" || !state.editing;
      unsaved.hidden = !state.editing && !state.drafts[record.id];
      $("#jr-chat-panel").hidden = !state.chat;
      unsaved.textContent = state.editing ? "Edits are kept when switching dock tabs. Save update to commit them." : "Unsaved edits are kept. Turn on Update record to continue editing or save them.";
      const templateName = record.resume?.documentTemplate.id.replace(/^rendercv-/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
      const fields = $("#jr-record-fields");
      fields.replaceChildren();
      field(fields, "Record type", record.type === "queue" ? "Job Queue" : "Application");
      field(fields, "Status", labels[record.status] || record.status);
      field(fields, "Candidate", record.candidateName);
      field(fields, "Resume", record.resume ? `${templateName} \xB7 Version ${record.resume.version}` : "No saved resume");
      field(fields, "Created", format(record.createdAt));
      if (record.type === "queue") {
        field(fields, "Attempt", String(record.attempt || 0));
        field(fields, "Workflow", "Manual preparation in Resume Studio");
        if (!record.isMock) field(fields, "Prompt at capture", record.promptSnapshot?.title || "Assigned prompt");
      }
      $("#jr-record-note").textContent = (record.isMock ? record.notes?.replace(/\bsample\b\s*/gi, "") : record.notes) || "No notes yet.";
      if (record.syncWarning) $("#jr-record-note").textContent += `
${record.syncWarning}`;
      const actions = recordActions(record), edit = actions.find((node) => node.dataset.command === "edit");
      if (state.editing) {
        edit.replaceChildren(icon("save"), doc.createTextNode("Save record"));
        edit.type = "submit";
        edit.setAttribute("form", "jr-edit-form");
        delete edit.dataset.command;
        edit.removeAttribute("aria-pressed");
        edit.classList.add("primary");
      }
      $("#jr-edit-slot").replaceChildren(edit);
      $(".jr-detail-navigation").classList.toggle("jr-editing", state.editing);
      $("#jr-detail-actions").replaceChildren(...actions.filter((node) => node !== edit && (record.type !== "queue" || ["apply", "delete"].includes(node.dataset.command))));
      const timeline = $("#jr-timeline");
      timeline.replaceChildren();
      for (const event of record.events || []) {
        const item = el("div", null, "jr-timeline-item"), text = el("div");
        text.append(el("p", event.label), el("time", format(event.at)));
        item.append(el("span", null, "jr-history-dot"), text);
        timeline.append(item);
      }
      const queue = record.type === "queue";
      salaryLabel.hidden = !queue;
      $("#jr-status-field").hidden = queue || !state.editing;
      $("#jr-queue-status-field").hidden = true;
      $("#jr-job-description-field").hidden = !queue;
      urlLabel.hidden = !queue;
      $("#jr-queue-status-text").textContent = record.status;
      const select = $("#jr-status-select");
      select.replaceChildren();
      for (const status of ["applied", "screen", "interview", "offer", "rejected", "archived"]) {
        const option = el("option", labels[status]);
        option.value = status;
        select.append(option);
      }
      const draft = draftFor(record);
      salaryInput.value = draft.fields.salary ?? record.salary ?? "";
      $("#jr-resume-input").value = draft.fields.cvJsonRaw ?? record.resume?.cvJsonRaw ?? "";
      $("#jr-letter-input").value = draft.fields.coverLetterRaw ?? record.resume?.coverLetterRaw ?? "";
      $("#jr-letter-enabled").checked = !!draft.fields.coverLetterEnabled;
      $("#jr-letter-input").disabled = !state.editing;
      $("#jr-job-description").value = draft.fields.description;
      urlInput.value = draft.fields.url;
      chatInput.value = draft.fields.conversationUrl;
      select.value = draft.fields.status;
      $("#jr-chat-error").hidden = !record.error;
      $("#jr-chat-error").textContent = record.error || "";
      $("#jr-chat-context").textContent = record.conversationUrl || "Save a GPT conversation link in Update record to reopen it here.";
      $("#jr-retry-task").hidden = !queue || record.status !== "Failed";
      renderDescription(record);
    }
    let addForm;
    function renderAdd() {
      addForm?.remove();
      addForm = void 0;
      if (!state.adding) return;
      addForm = el("form", null, "jr-add-form");
      addForm.id = "jr-add-form";
      addForm.append(el("h3", state.tab === "applications" ? "Add application record manually" : "Add job to queue"));
      const draft = state.drafts.$new?.fields || {};
      for (const [name, label, type, required, max] of [["company", "Company", "text", true, 300], ["role", "Role", "text", true, 500], ["salary", "Salary (optional)", "text", false, 200], ["url", "Job URL", "url", true, 4e3], ["description", "Job description", "textarea", true, 16e4], ["notes", "Notes", "textarea", false, 1e4], ["conversationUrl", "AI conversation URL (optional)", "url", false, 4e3]]) {
        if (name === "salary" && state.tab !== "queue") continue;
        const wrapper = el("label");
        const caption = el("span", label, "jr-label");
        if (required && (state.tab !== "applications" || ["company", "role"].includes(name))) {
          const star = el("span", "*", "jr-required");
          star.setAttribute("aria-hidden", "true");
          caption.append(star);
        }
        wrapper.append(caption);
        const control = el(type === "textarea" ? "textarea" : "input");
        if (type !== "textarea") control.type = type;
        else {
          control.rows = name === "description" ? 6 : 3;
          control.className = "jr-textarea";
        }
        control.name = name;
        control.value = draft[name] || "";
        control.required = required && (state.tab !== "applications" || ["company", "role"].includes(name));
        control.maxLength = max;
        wrapper.append(control);
        addForm.append(wrapper);
      }
      const actions = el("div", null, "jr-detail-actions"), save = button(state.tab === "applications" ? "Add application record" : "Add to queue", "", "plus", "jr-button primary");
      save.type = "submit";
      actions.append(save, button("Cancel", "cancel-add"));
      addForm.append(actions);
      $("#jr-body-anchor")?.remove();
      $("#jr-main-panel").prepend(addForm);
    }
    function render(force = false) {
      if (!alive) return;
      $("#jr-app-count").textContent = String(data.applications.length);
      $("#jr-queue-count").textContent = String(data.jobs.length);
      for (const tab of ["applications", "queue"]) {
        const selected = state.tab === tab;
        $(`[data-tab="${tab}"]`).setAttribute("aria-selected", String(selected));
        $(`[data-tab="${tab}"]`).tabIndex = selected ? 0 : -1;
      }
      $("#jr-main-panel").setAttribute("aria-labelledby", state.tab === "queue" ? "jr-tab-queue" : "jr-tab-applications");
      $('[data-command="delete-all"]').hidden = state.tab !== "queue";
      $('[data-command="delete-all"]').disabled = busy || !data.jobs.length;
      if (!force && (state.editing || state.adding)) return;
      const record = current();
      if (!record) {
        state.selected = null;
        state.editing = false;
        state.chat = false;
      }
      $("#jr-list").hidden = !!state.selected || state.adding;
      $("#jr-detail").hidden = !state.selected || state.adding;
      $(".jr-toolbar").hidden = !!state.selected || state.adding;
      renderAdd();
      if (record && !state.adding) renderDetail(record);
      else if (!state.adding) renderList();
    }
    async function command(name, record) {
      if (name === "refresh") {
        data = await request("DOCK_RECORDS_STATE");
        render(true);
        return;
      }
      if (name === "delete-all") {
        if (state.tab !== "queue" || !data.jobs.length) return;
        const count = data.jobs.length;
        await mutate("delete-all", null, void 0, { candidateId: data.candidate?.id, jobs: data.jobs.map(({ id, revision }) => ({ id, revision })) });
        state.selected = null;
        state.editing = false;
        state.deleted = null;
        await persist();
        render(true);
        show(`${count} jobs removed from Job Queues.`);
        return;
      }
      if (name === "add" || name === "cancel-add") {
        state.adding = name === "add";
        if (!state.adding) delete state.drafts.$new;
        state.editing = false;
        state.selected = null;
        await persist();
        render(true);
        return;
      }
      if (name === "undo-delete") {
        if (!state.deleted) return;
        const restored = await mutate("restore", state.deleted);
        state.deleted = null;
        state.selected = restored.selectedId;
        state.tab = "queue";
        await persist();
        render(true);
        show("Job restored.");
        return;
      }
      if (name === "back") {
        state.selected = null;
        state.editing = false;
        state.chat = false;
        await persist();
        render(true);
        return;
      }
      if (!record) return;
      if (name === "details") {
        state.selected = record.id;
        state.tab = "queue";
        state.mode = "details";
        state.editing = false;
        state.adding = false;
        state.chat = false;
        await persist();
        render(true);
        $("#jr-view-details").focus();
        return;
      }
      if (name === "update-resume" || name === "cover-letter") {
        const options = { letter: name === "cover-letter" };
        if (onResumeInput) await onResumeInput(record, options);
        else await resumeInput.open(record, options);
        return;
      }
      if (name === "edit") {
        state.editing = true;
        state.selected = record.id;
        state.tab = record.type === "queue" ? "queue" : "applications";
        state.mode = "details";
        state.chat = false;
        render(true);
        $("#jr-edit-slot button").focus();
        void persist();
        return;
      }
      if (["view", "description", "edit", "chat"].includes(name)) {
        state.selected = record.id;
        state.tab = record.type === "queue" ? "queue" : "applications";
        state.mode = ["edit", "chat"].includes(name) ? "details" : "description";
        state.chat = false;
        state.editing = name === "edit";
        if (name === "chat") {
          if (!record.conversationUrl) throw Error("Save a GPT conversation URL in Update record first.");
          await browser.tabs.create({ url: record.conversationUrl, active: true });
        }
        await persist();
        render(true);
        return;
      }
      if (name === "cancel-edit") {
        delete state.drafts[record.id];
        state.editing = false;
        await persist();
        render(true);
        return;
      }
      if (name === "apply") {
        if (record.type === "queue" && onApply) {
          await persist();
          await onApply(record.id);
          return;
        }
        if (!safeJobUrl(record.url)) throw Error("This record has no valid application URL.");
        await browser.tabs.create({ url: record.url, active: true });
        return;
      }
      if (name === "open-resume") {
        await persist();
        data = await request("DOCK_RECORDS_OPEN_RESUME", { id: record.id, expectedRevision: record.revision, windowId });
        render(true);
        return;
      }
      if (name === "studio" || name === "save-resume") {
        data = await request(name === "studio" ? "DOCK_RECORDS_STUDIO" : "DOCK_RECORDS_RESUME", { id: record.id, expectedRevision: record.revision, windowId });
        state.selected = record.id;
        render(true);
        show(name === "studio" ? "Prepare this resume in Resume Studio, then return here and choose Save Studio result." : "Validated resume saved. Review it before applying.");
        return;
      }
      const actions = { retry: "retry", delete: "delete", fail: "fail", "mark-applied": "apply" };
      if (actions[name]) {
        const result = await mutate(actions[name], record);
        if (name === "delete") {
          const deleted = { ...record, revision: record.revision + 1 };
          state.deleted = deleted;
          state.selected = null;
        } else {
          state.selected = result.selectedId;
          if (name === "mark-applied") state.tab = "applications";
        }
        state.editing = false;
        await persist();
        render(true);
        show(name === "delete" ? `${record.company} removed from Job Queues.` : name === "mark-applied" ? "Submission recorded in Applications." : "Queue record updated.", false, name === "delete");
      }
    }
    function click(event) {
      const target = event.target.closest("button,.jr-card-main");
      if (!target || !root.contains(target)) return;
      if (target.dataset.command === "dashboard") {
        onDashboard();
        void persist().catch((error) => show(`Dashboard opened. Unsaved edits remain in this dock: ${error.message}`, true));
        return;
      }
      if (target.disabled) return;
      if (target.dataset.tab) {
        if (busy) return;
        chosenTab = target.dataset.tab;
        state.tab = chosenTab;
        state.selected = null;
        state.editing = false;
        state.chat = false;
        state.adding = false;
        render(true);
        target.focus();
        void persist();
        return;
      }
      if (target.dataset.mode) {
        void run(async () => {
          state.mode = target.dataset.mode;
          await persist();
          render(true);
          target.focus();
        });
        return;
      }
      if (target.dataset.command) void run(() => command(target.dataset.command, target.dataset.record ? [...data.applications, ...data.jobs].find((item) => item.id === target.dataset.record) : current()));
    }
    function input(event) {
      if (!loaded || busy) return;
      if (event.target.closest("#jr-add-form")) {
        const fields = {};
        for (const control of addForm.querySelectorAll("[name]")) fields[control.name] = control.value;
        state.drafts.$new = { fields };
        void persist().catch(() => {
        });
        return;
      }
      if (!state.editing || !event.target.closest("#jr-edit-form")) return;
      const record = current();
      if (!record) return;
      state.drafts[record.id] = { revision: draftFor(record).revision, fields: { salary: salaryInput.value, notes: record.notes || "", cvJsonRaw: $("#jr-resume-input").value, coverLetterRaw: $("#jr-letter-input").value, coverLetterEnabled: $("#jr-letter-enabled").checked, description: $("#jr-job-description").value, url: urlInput.value, conversationUrl: chatInput.value, status: $("#jr-status-select").value } };
      $("#jr-letter-input").disabled = !state.editing;
      void persist().catch(() => {
      });
    }
    function submit(event) {
      if (!["jr-add-form", "jr-edit-form"].includes(event.target.id)) return;
      event.preventDefault();
      void run(async () => {
        if (event.target.id === "jr-add-form") {
          const fields = {};
          for (const control of addForm.querySelectorAll("[name]")) fields[control.name] = control.value;
          const result = await mutate(state.tab === "applications" ? "create-application" : "create", null, fields);
          delete state.drafts.$new;
          state.adding = false;
          state.selected = result.selectedId;
          state.mode = "description";
        } else {
          if (!state.editing) return;
          const record = current();
          if (!record) throw Error("This record is no longer available. Your form text is retained.");
          const draft = draftFor(record), result = await mutate("update", { ...record, revision: draft.revision }, draft.fields);
          delete state.drafts[record.id];
          state.selected = result.selectedId;
          state.editing = false;
        }
        await persist();
        render(true);
        show("Record saved.");
      });
    }
    function keydown(event) {
      if (event.key === "Escape" && !event.isComposing && !event.defaultPrevented && state.editing && current()?.type === "queue" && !root.querySelector("dialog[open]")) {
        if (busy) return;
        event.preventDefault();
        event.stopPropagation();
        delete state.drafts[current().id];
        state.editing = false;
        render(true);
        void persist();
        $("#jr-edit-slot button").focus();
        show("Edits discarded.");
        return;
      }
      const main = event.target.closest(".jr-card-main");
      if (main && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        main.click();
        return;
      }
      const tab = event.target.closest('[role="tab"]');
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const siblings = [...tab.parentElement.querySelectorAll('[role="tab"]')], index = siblings.indexOf(tab);
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? siblings.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + siblings.length) % siblings.length;
      siblings[next].click();
      siblings[next].focus();
    }
    const changed = (changes, area) => {
      if (area === "local" && (changes.appliedList || changes.profile)) void refresh();
    };
    root.addEventListener("click", click);
    root.addEventListener("input", input);
    root.addEventListener("change", input);
    root.addEventListener("submit", submit);
    root.addEventListener("keydown", keydown);
    browser.storage.onChanged.addListener(changed);
    const privateChanged = (changes) => {
      if (changes["dock-job-records:v1"]) void refresh();
    };
    privateStorage.onChanged.addListener(privateChanged);
    resumeInput = mountQueueResumeInput(root, { request, privateStorage, directoryStore, getWindowId: () => windowId, icons: JOB_RECORD_ICONS, onUpdated(next) {
      data = next;
      render(true);
    } });
    const ready = (async () => {
      try {
        windowId = (await withRequestDeadline(browser.windows.getCurrent(), requestTimeoutMs)).id;
        uiKey = `dock-records-ui:v1:${windowId}`;
        const previous = (await withRequestDeadline(browser.storage.session.get(uiKey), requestTimeoutMs))[uiKey];
        if (!alive) return;
        if (previous && ["applications", "queue"].includes(previous.tab)) Object.assign(state, previous, { chat: false, drafts: previous.drafts || {} });
        if (chosenTab) state.tab = chosenTab;
        state.mode = state.editing ? "details" : "description";
        data = await request("DOCK_RECORDS_STATE");
        loaded = true;
        render(true);
      } catch (error) {
        loaded = true;
        render(true);
        show(error.message, true);
      }
    })();
    return {
      root,
      ready,
      refresh,
      async select(id) {
        await ready;
        await refresh();
        const record = [...data.applications, ...data.jobs].find((record2) => record2.id === id);
        if (record) {
          state.tab = record.type === "queue" ? "queue" : "applications";
          state.selected = id;
          state.mode = "description";
          state.editing = false;
          state.adding = false;
          state.chat = false;
          render(true);
        }
      },
      async show(tab, matchUrl) {
        await ready;
        if (tab) {
          state.tab = tab;
          state.selected = null;
          state.editing = false;
          state.adding = false;
        }
        await refresh();
        if (matchUrl) {
          const match = data.applications.find((record) => record.url === matchUrl);
          if (match) {
            state.selected = match.id;
            state.mode = "description";
            render(true);
          }
        }
      },
      async editResume(id, options) {
        await ready;
        await refresh();
        const record = data.jobs.find((item) => item.id === id);
        if (!record) throw Error("This queue record is no longer available.");
        await resumeInput.open(record, options);
      },
      close() {
        alive = false;
        version++;
        resumeInput.close();
        void persist().catch(() => {
        });
        root.removeEventListener("click", click);
        root.removeEventListener("input", input);
        root.removeEventListener("change", input);
        root.removeEventListener("submit", submit);
        root.removeEventListener("keydown", keydown);
        browser.storage.onChanged.removeListener(changed);
        privateStorage.onChanged.removeListener(privateChanged);
      }
    };
  }

  // extension/studio/apply-dock-markup.js
  var APPLY_DOCK_MARKUP = `<div id="apply-ready-queue-design" class="viz-dotted-background"><nav class="aj-navigation" aria-label="Dock navigation"><button type="button" class="aj-button aj-quiet" data-action="dashboard"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>Dashboard</button><h2>Apply to Job</h2><span class="aj-badge" id="aj-header-state">Draft</span></nav>\r
  \r
  <section class="aj-window" aria-label="Apply to Job dock workflow">\r
    \r
    <nav class="aj-steps" aria-label="Application steps">\r
      <button type="button" class="aj-step cursor-interaction" data-step="setup" aria-current="step"><span>1</span>Details</button>\r
      <button type="button" class="aj-step cursor-interaction" data-step="autofill"><span>2</span>Autofill</button>\r
      <button type="button" class="aj-step cursor-interaction" data-step="review"><span>3</span>Review</button>\r
    </nav>\r
    <div class="aj-body">\r
      <section class="aj-stack" id="aj-setup" aria-label="Application details">\r
        <div class="aj-card"><label><span class="aj-label">Profile</span><span id="aj-profile" class="aj-profile-name"></span></label>\r
            </div><section class="aj-card aj-prepared-job" aria-label="Selected resume-ready job">\r
  <div class="aj-row aj-between" style="margin-bottom:12px"><span class="aj-section-title">From Job Queues</span><div class="aj-job-pager" role="group" aria-label="Job queue card navigation"><button type="button" data-action="job-first" aria-label="First queued job"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 17-5-5 5-5"></path><path d="m18 17-5-5 5-5"></path></svg></button><button type="button" data-action="job-prev" aria-label="Previous queued job"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg></button><span id="aj-job-position" aria-live="polite">0/0</span><button type="button" data-action="job-next" aria-label="Next queued job"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button><button type="button" data-action="job-last" aria-label="Last queued job"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 17 5-5-5-5"></path><path d="m13 17 5-5-5-5"></path></svg></button></div></div>\r
  <div id="aj-selected-job">\r
    <div class="aj-prepared-head"><div><h3 id="aj-prepared-company">Selected company</h3><p id="aj-prepared-title">Software Engineer</p></div><div class="aj-prepared-state"><span class="aj-badge" id="aj-sample-label" hidden=""></span><span class="aj-badge good" id="aj-prepared-status"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="m3 15 2 2 4-4"></path></svg>Resume ready</span><span class="aj-small" id="aj-prepared-date">Updated Nov 8</span></div></div>\r
    <div class="aj-prepared-document"><span class="aj-small aj-prepared-file"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg><span id="aj-saved-filename">Prepared resume</span></span><button type="button" class="aj-button aj-quiet cursor-interaction" data-action="preview-prepared-job" aria-label="Preview selected prepared resume" data-tooltip="Preview prepared resume"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg></button></div>\r
    <div class="aj-preview" id="aj-prepared-preview" hidden=""></div>\r
    <details style="margin-top:11px"><summary>Job description<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><textarea class="aj-textarea aj-job-description" id="aj-jd" rows="4" aria-label="Job description from the selected queue item" readonly=""></textarea></details>\r
  <div class="aj-card-actions"><button type="button" class="aj-button" data-action="job-url"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>Go to URL</button><button type="button" class="aj-button" data-action="job-details"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M15 3v18"></path><path d="m10 15-3-3 3-3"></path></svg>View details</button></div></div>\r
  <p class="aj-small" id="aj-no-ready-jobs" hidden="">No prepared resumes in this profile's job queue yet.</p><button type="button" class="aj-button aj-wide" id="aj-open-queue" data-action="queue">Open Job Queues</button>\r
  \r
</section>\r
<div class="aj-card">\r
          <label class="aj-toggle-label"><span class="aj-toggle-copy"><strong>Tailor resume to this job</strong><span>Update the current profile before Autofill</span></span><input type="checkbox" class="aj-toggle" id="aj-tailor" aria-label="Tailor resume to this job" checked=""></label>\r
          <div class="aj-upload" id="aj-upload"><div class="aj-import-sources"><button type="button" class="aj-button aj-source-button" data-action="import-queue-file"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg><span>Import from Queue</span></button><button type="button" class="aj-button aj-source-button" data-action="manual-upload"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" x2="12" y1="3" y2="15"></line></svg><span>Manual upload</span></button></div>\r
            \r
            <input class="aj-file-hidden" type="file" id="aj-file" accept=".pdf,.docx" aria-label="Resume to update the selected profile" hidden=""><strong id="aj-upload-name" class="aj-small" hidden="">Choose a resume</strong>\r
            \r
            <div class="aj-import-review" id="aj-import-review" hidden=""><div class="aj-row aj-between"><span class="aj-section-title">Update current profile</span><span class="aj-badge ai" id="aj-import-source">Resume import</span></div><div class="aj-import-line"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 21a8 8 0 0 1 13.292-6"></path><circle cx="10" cy="8" r="5"></circle><path d="m16 19 2 2 4-4"></path></svg><span id="aj-import-person">Selected profile</span></div><div class="aj-import-line"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M2 15h10"></path><path d="m9 18 3-3-3-3"></path></svg><span>Import resume experience, education, and skills</span></div><details class="aj-import-facts"><summary>Review imported details</summary><p id="aj-import-summary" class="aj-small"></p><div id="aj-import-details" class="aj-import-details"></div></details><button type="button" class="aj-button aj-wide cursor-interaction" data-action="update-profile" id="aj-update-profile">Update candidate's profile</button></div>\r
            <div class="aj-row" id="aj-profile-updated" hidden="" style="margin-top:10px"><span class="aj-badge good"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 7 17l-5-5"></path><path d="m22 10-7.5 7.5L13 16"></path></svg>Current profile updated</span><span class="aj-small" id="aj-profile-revision"></span></div>\r
          </div>\r
        </div>\r
        <details class="aj-card"><summary><span class="aj-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" x2="14" y1="4" y2="4"></line><line x1="10" x2="3" y1="4" y2="4"></line><line x1="21" x2="12" y1="12" y2="12"></line><line x1="8" x2="3" y1="12" y2="12"></line><line x1="21" x2="16" y1="20" y2="20"></line><line x1="12" x2="3" y1="20" y2="20"></line><line x1="14" x2="14" y1="2" y2="6"></line><line x1="8" x2="8" y1="10" y2="14"></line><line x1="16" x2="16" y1="18" y2="22"></line></svg>Autofill options</span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="aj-option-list">\r
          <label class="aj-check"><input type="checkbox" data-option="reuse" checked="">Reuse approved saved answers</label>\r
          <label class="aj-check"><input type="checkbox" data-option="reviewAI" checked="">Review AI drafts before filling</label>\r
          <label class="aj-check"><input type="checkbox" data-option="autoNext" checked="">Automatically go to the next form page</label>\r
          <label class="aj-check"><input type="checkbox" data-option="saveAnswers" checked="">Save approved reusable answers</label>\r
          <label class="aj-check"><input type="checkbox" data-option="record" checked="">Record completed applications</label>\r
          <label class="aj-check"><input type="checkbox" data-option="autoSubmit">Auto-submit when every field is complete</label>\r
        </div></details>\r
        <button type="button" class="aj-button aj-primary aj-wide cursor-interaction" data-action="start" id="aj-start"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"></path><path d="m14 7 3 3"></path><path d="M5 6v4"></path><path d="M19 14v4"></path><path d="M10 2v2"></path><path d="M7 8H3"></path><path d="M21 16h-4"></path><path d="M11 3H9"></path></svg><span id="aj-start-label">Start Autofill</span></button>\r
        <p class="aj-small" id="aj-start-note">Saved resume selected. No upload required.</p>\r
      </section>\r
\r
      <section class="aj-stack" id="aj-autofill" aria-label="Autofill and unsupported questions" hidden="">\r
        <div class="aj-context"><div class="aj-row aj-between"><h3 data-context-title="">Software Engineer</h3><button type="button" class="aj-button aj-quiet cursor-interaction" data-action="edit-details">Edit details</button></div><p class="aj-small" data-context-summary="">Selected profile \xB7 Selected company</p></div>\r
        <div class="aj-card"><div class="aj-row aj-between"><h3 class="aj-run-title" id="aj-run-title">Filling your application</h3><span class="aj-badge" id="aj-form-page">Current page</span></div><p class="aj-run-description" id="aj-run-description" role="status"></p><div class="aj-progress" role="progressbar" aria-label="Form fields filled" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" id="aj-progress"><span id="aj-progress-fill" style="width:0%"></span></div><div class="aj-status-rows">\r
          <div class="aj-status-row"><span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>Resume</span><span id="aj-resume-state">Waiting</span></div>\r
          <div class="aj-status-row"><span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg>Profile fields</span><span id="aj-profile-fields-state">Not scanned</span></div>\r
          <div class="aj-status-row"><span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"></path><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path></svg>Custom questions</span><span id="aj-questions-state">Not scanned</span></div>\r
        </div><div class="aj-row" style="margin-top:14px"><button type="button" class="aj-button cursor-interaction" data-action="pause" id="aj-pause">Pause</button><button type="button" class="aj-button aj-quiet cursor-interaction" data-action="cancel" id="aj-cancel">Cancel run</button></div><button type="button" class="aj-button aj-primary aj-wide cursor-interaction" data-action="next-page" id="aj-next-page" style="margin-top:10px" hidden="">Go to next form page<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></button></div>\r
        <div class="aj-card" id="aj-question-section" hidden="">\r
          <div class="aj-row aj-between"><span class="aj-section-title">Unsupported questions</span><span class="aj-badge ai" id="aj-question-count">Not scanned</span></div>\r
          <div class="aj-row aj-between" style="margin-top:13px"><div class="aj-question-navigation"><button type="button" class="aj-question-nav cursor-interaction" data-question="0" aria-label="Question one" aria-pressed="true">1</button><button type="button" class="aj-question-nav cursor-interaction" data-question="1" aria-label="Question two" aria-pressed="false">2</button><button type="button" class="aj-question-nav cursor-interaction" data-question="2" aria-label="Question three" aria-pressed="false">3</button></div><span class="aj-badge ai" id="aj-question-type">AI draft</span></div>\r
          <h3 class="aj-question-title" id="aj-question-title"></h3><textarea class="aj-textarea" id="aj-answer" rows="5" aria-label="Answer to the selected application question" placeholder="Generate or enter an answer."></textarea><p class="aj-question-hint" id="aj-question-hint"></p>\r
          <label class="aj-check" id="aj-remember-wrap" hidden="" style="margin-top:10px"><input type="checkbox" id="aj-remember" checked=""><span id="aj-remember-label">Remember for candidate</span></label>\r
          <div class="aj-question-actions"><button type="button" class="aj-button aj-quiet cursor-interaction" data-action="draft" id="aj-draft"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path></svg>Generate AI drafts</button><button type="button" class="aj-button aj-primary cursor-interaction" data-action="fill-answer" id="aj-fill-answer"><span id="aj-fill-label">Approve &amp; fill</span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg></button></div>\r
        </div>\r
        <div class="aj-row aj-between"><button type="button" class="aj-button aj-quiet cursor-interaction" data-action="rescan" id="aj-rescan"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M7 12h10"></path></svg>Rescan page</button><button type="button" class="aj-button aj-quiet cursor-interaction" data-action="refill" id="aj-refill"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>Refill missing</button></div>\r
        <button type="button" class="aj-button aj-wide cursor-interaction" data-action="review" id="aj-review" disabled="">Review application<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></button>\r
      </section>\r
\r
      <section class="aj-stack" id="aj-review-panel" aria-label="Review and submit application" hidden="">\r
        <div class="aj-card"><div class="aj-row aj-between"><span class="aj-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="m9 14 2 2 4-4"></path></svg>Ready for your review</span><span class="aj-badge good" id="aj-review-count">0 of 0 fields</span></div><div class="aj-review-grid">\r
          <div class="aj-review-row"><span>Profile</span><span id="aj-review-person"></span></div><div class="aj-review-row"><span>Company</span><span id="aj-review-company"></span></div><div class="aj-review-row"><span>Job title</span><span id="aj-review-title"></span></div><div class="aj-review-row"><span>Resume</span><span id="aj-review-resume"></span></div><div class="aj-review-row"><span>Answers</span><span>All required answers filled</span></div>\r
        </div><div class="aj-row" style="margin-top:12px"><button type="button" class="aj-button cursor-interaction" data-action="preview-resume"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg>Preview resume</button><button type="button" class="aj-button aj-quiet cursor-interaction" data-action="open-application"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>Open application</button></div><div class="aj-preview" id="aj-resume-preview" hidden=""></div></div>\r
        <div class="aj-card"><span class="aj-section-title">After submission</span><div class="aj-status-rows"><div class="aj-status-row"><span>Application recording</span><span id="aj-review-record-setting">On</span></div><div class="aj-status-row"><span>Reusable answer saving</span><span id="aj-review-save-setting">On</span></div></div></div>\r
        <button type="button" class="aj-button aj-primary aj-wide cursor-interaction" data-action="submit" id="aj-submit"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>Submit application</button>\r
        <button type="button" class="aj-button aj-quiet cursor-interaction" data-action="back-to-fields" id="aj-back-fields">Back to fields</button>\r
        <div id="aj-confirm-submission" class="aj-card" hidden=""><p class="aj-small">Check the employer page for its submission confirmation.</p><button type="button" class="aj-button aj-wide" data-action="confirm-submission" style="margin-top:10px">I submitted the application</button></div><div class="aj-success" id="aj-success" hidden=""><h3>Application submitted</h3><p id="aj-success-text"></p><button type="button" class="aj-button cursor-interaction" data-action="view-record" id="aj-view-record">View application record<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg></button></div>\r
        <div class="aj-card" id="aj-record" hidden=""><span class="aj-section-title">Application record</span><div class="aj-review-grid" id="aj-record-fields"></div></div>\r
      </section>\r
      <div class="aj-feedback" id="aj-feedback" role="status" aria-live="polite" hidden=""></div>\r
    </div>\r
  </section>\r
  \r
</div>`;

  // extension/studio/apply-dock-view.js
  function mountApplyDock(host, { browser = globalThis.chrome, privateStorage = studioStorage, onDashboard = () => {
  }, onQueue = () => {
  }, onApplication = () => {
  } } = {}) {
    host.innerHTML = APPLY_DOCK_MARKUP;
    const root = host.querySelector("#apply-ready-queue-design"), doc = host.ownerDocument, $ = (selector) => root.querySelector(selector);
    let alive = true, busy = false, windowId, uiKey, loaded = false, revision = 0, imported = null, pdfUrl = null, pdfIdentity = "", timer;
    let data = { candidate: null, candidates: [], jobs: [], tabs: [], run: null, defaults: {} }, ui = { jobId: null, tabId: 0, tailor: true, tailorPreferenceSet: false, step: "setup", question: null, answers: {}, remember: {}, options: {} };
    const running = () => data.run && !["submitted", "cancelled"].includes(data.run.phase);
    const selected = () => data.jobs.find((job) => job.id === ui.jobId);
    const isPrepared = (job) => job?.status === "Ready" && job.resume?.snapshot && job.resume.inputRevision === job.inputRevision;
    const el = (tag, text, className) => {
      const node = doc.createElement(tag);
      if (text !== void 0) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    function tell(message, error = false) {
      if (!alive) return;
      $("#aj-feedback").textContent = message;
      $("#aj-feedback").className = `aj-feedback${error ? " error" : ""}`;
      $("#aj-feedback").hidden = !message;
    }
    async function request(operation, payload = {}) {
      const response = await withRequestDeadline(browser.runtime.sendMessage({ version: 1, requestId: crypto.randomUUID(), operation, payload: { windowId, ...payload } }));
      if (!response?.ok) throw Error(response?.error?.message || "The dock could not complete this action.");
      return response.result;
    }
    const persist = () => loaded ? withRequestDeadline(privateStorage.set({ [uiKey]: ui }), 3e3) : Promise.resolve();
    function accept(next) {
      data = { ...next, jobs: next.jobs.filter(isPrepared) };
      if (!data.jobs.some((job) => job.id === ui.jobId)) ui.jobId = data.jobs[0]?.id || null;
      if (data.run && running()) ui.jobId = data.run.jobId;
      if (!Object.keys(ui.options).length) ui.options = { ...data.defaults };
    }
    async function refresh() {
      const current = ++revision;
      try {
        const next = await request("DOCK_APPLY_STATE");
        if (alive && current === revision) {
          accept(next);
          render();
        }
      } catch (error) {
        tell(error.message, true);
      }
    }
    async function run(action) {
      if (busy) return;
      busy = true;
      tell("");
      render();
      try {
        await action();
      } catch (error) {
        tell(error.message, true);
      } finally {
        busy = false;
        if (alive) render();
      }
    }
    function value(selector, next) {
      const node = $(selector);
      if ((root.getRootNode().activeElement || doc.activeElement) !== node && node.value !== String(next || "")) node.value = next || "";
    }
    const option = (value2, text) => {
      const node = el("option", text);
      node.value = String(value2);
      return node;
    };
    const question = () => data.run?.questions.find((field) => field.key === ui.question) || data.run?.questions.find((field) => !field.filled) || data.run?.questions[0];
    async function command(action, extra = {}) {
      accept(await request("DOCK_APPLY_ACTION", { runId: data.run?.id, action, ...extra }));
      await persist();
      render();
    }
    function render() {
      if (!alive) return;
      const job = selected(), isRunning = running(), current = ui.step === "setup" && !isRunning ? null : data.run, q = current ? question() : null;
      if (q) ui.question = q.key;
      const step = ui.step === "setup" && !isRunning ? "setup" : current?.step || "setup";
      $("#aj-setup").hidden = step !== "setup";
      $("#aj-autofill").hidden = step !== "autofill";
      $("#aj-review-panel").hidden = step !== "review";
      root.querySelectorAll("[data-step]").forEach((button) => {
        if (button.dataset.step === step) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
        button.disabled = busy;
      });
      const picker = $("#aj-profile");
      picker.textContent = data.candidate?.name || "Create your profile in Settings";
      const tabPicker = $("#aj-target-tab");
      tabPicker.replaceChildren(option(0, "Open the selected job in a new tab"), ...data.tabs.map((tab) => option(tab.id, `${tab.active ? "Current: " : ""}${tab.title}`)));
      tabPicker.value = String(ui.tabId);
      tabPicker.disabled = busy || !!isRunning;
      $("#aj-selected-job").hidden = !job;
      $("#aj-no-ready-jobs").hidden = !!job;
      $("#aj-open-queue").hidden = !!job;
      const index = data.jobs.findIndex((item) => item.id === ui.jobId);
      $("#aj-job-position").textContent = `${index < 0 ? 0 : index + 1}/${data.jobs.length}`;
      for (const action of ["job-first", "job-prev"]) $(`[data-action="${action}"]`).disabled = busy || !!isRunning || index <= 0;
      for (const action of ["job-next", "job-last"]) $(`[data-action="${action}"]`).disabled = busy || !!isRunning || index < 0 || index >= data.jobs.length - 1;
      if (job) {
        $("#aj-prepared-company").textContent = job.company;
        $("#aj-prepared-title").textContent = job.role;
        const updated = new Date(job.resume?.savedAt || job.updatedAt);
        $("#aj-prepared-date").textContent = Number.isFinite(updated.getTime()) ? `Updated ${new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric" }).format(updated)}` : "";
        $("#aj-saved-filename").textContent = isPrepared(job) ? `${job.candidateName}_${job.company}.pdf` : "No prepared resume yet";
        value("#aj-jd", job.description);
      }
      $("#aj-prepared-status").textContent = isPrepared(job) ? "Ready" : job?.status || "Queued";
      $("#aj-prepared-status").classList.toggle("good", !!isPrepared(job));
      $("#aj-sample-label").hidden = true;
      $('[data-action="preview-prepared-job"]').disabled = busy || !isPrepared(job);
      $('[data-action="job-url"]').disabled = busy || !safeJobUrl(job?.url);
      $('[data-action="job-details"]').disabled = busy || !job;
      $("#aj-tailor").checked = ui.tailor;
      $("#aj-tailor").disabled = busy || !!isRunning;
      $("#aj-upload").hidden = !ui.tailor;
      $("#aj-file").disabled = busy || !!isRunning || !job;
      $('[data-action="import-queue-file"]').disabled = busy || !!isRunning || !isPrepared(job);
      $('[data-action="manual-upload"]').disabled = busy || !!isRunning || !job;
      $("#aj-import-review").hidden = !imported;
      $("#aj-import-summary").textContent = imported?.summary || "";
      $("#aj-update-profile").disabled = busy || !!isRunning || !!imported?.previewOnly;
      $("#aj-import-source").textContent = imported?.previewOnly ? "Preview only" : "Resume import";
      const name = data.candidate?.name || "current profile";
      $("#aj-import-person").textContent = name;
      $("#aj-update-profile").textContent = `Update ${name}\u2019s profile`;
      const importDetails = $("#aj-import-details");
      if (importDetails) {
        importDetails.replaceChildren();
        if (imported) for (const [key, title] of [["work", "Work history"], ["education", "Education"], ["skills", "Skills"]]) {
          importDetails.append(el("h4", title));
          for (const item of imported.changes?.[key] || []) importDetails.append(el("p", item));
        }
      }
      root.querySelectorAll("[data-option]").forEach((control) => {
        control.checked = !!ui.options[control.dataset.option];
        control.disabled = busy || !!isRunning;
      });
      $("#aj-start").disabled = busy || !isPrepared(job) || !!job?.isMock || !!isRunning;
      $("#aj-start-note").textContent = job?.isMock ? "Preview queue item. Add a real job to autofill." : !isPrepared(job) ? "Prepare and save this job\u2019s resume in Application Workspace." : ui.tailor ? `Use a resume to update ${name}\u2019s profile before autofill.` : "Uses the selected prepared resume. No upload required.";
      const status = { filling: "Filling application", drafting: "Drafting answer", questions: "Needs review", ready: "Ready for review", paused: "Paused", cancelled: "Cancelled", error: "Needs attention", "submission-pending": "Check submission", submitted: "Applied" };
      $("#aj-header-state").textContent = current ? status[current.phase] || "Draft" : "Draft";
      $("#aj-header-state").className = `aj-badge${["ready", "submitted"].includes(current?.phase) ? " good" : ""}`;
      $("#aj-run-title").textContent = current ? status[current.phase] || "Autofill" : "Ready to start";
      $("#aj-run-description").textContent = current?.message || "";
      const fields = current?.fields || [], filled = fields.filter((field) => field.filled).length, required = fields.filter((field) => field.required), requiredFilled = required.filter((field) => field.filled).length;
      $("#aj-form-page").textContent = "Current page";
      $("#aj-review-count").textContent = `${filled} of ${fields.length} fields`;
      $("#aj-progress").setAttribute("aria-valuenow", String(filled));
      $("#aj-progress").setAttribute("aria-valuemax", String(fields.length));
      $("#aj-progress").setAttribute("aria-valuetext", `${filled} of ${fields.length} detected fields filled`);
      $("#aj-progress-fill").style.width = `${fields.length ? filled / fields.length * 100 : 0}%`;
      $("#aj-resume-state").textContent = current ? `Prepared \xB7 Version ${current.resumeVersion}` : "Ready in queue";
      $("#aj-profile-fields-state").textContent = `${requiredFilled} of ${required.length} required filled`;
      $("#aj-questions-state").textContent = `${(current?.questions || []).filter((field) => !field.filled).length} remaining`;
      root.querySelectorAll("[data-context-title]").forEach((node) => node.textContent = current?.role || job?.role || "");
      root.querySelectorAll("[data-context-summary]").forEach((node) => node.textContent = `${current?.candidateName || data.candidate?.name || ""} \xB7 ${current?.company || job?.company || ""}`);
      $("#aj-pause").textContent = current?.phase === "paused" ? "Resume" : "Pause";
      $("#aj-pause").disabled = busy || !["filling", "drafting", "paused"].includes(current?.phase);
      $("#aj-cancel").disabled = busy || !isRunning || current?.phase === "submission-pending";
      if ($("#aj-rescan")) $("#aj-rescan").disabled = busy || !current || ["submitted", "cancelled", "submission-pending", "filling", "drafting"].includes(current.phase);
      $("#aj-next-page").hidden = !current?.hasNextPage;
      $("#aj-next-page").disabled = busy || !["questions", "ready"].includes(current?.phase);
      $("#aj-question-section").hidden = !q || ["cancelled", "submitted"].includes(current?.phase);
      const nav = root.querySelector("[data-question]")?.parentElement || $("#aj-question-buttons");
      if (nav) {
        nav.id = "aj-question-buttons";
        nav.replaceChildren(...(current?.questions || []).map((field, index2) => {
          const button = el("button", String(index2 + 1), "aj-question-nav");
          button.type = "button";
          button.dataset.question = field.key;
          button.setAttribute("aria-label", field.label);
          button.setAttribute("aria-pressed", String(field.key === q?.key));
          button.classList.toggle("done", field.filled);
          return button;
        }));
      }
      $("#aj-question-count").textContent = `${(current?.questions || []).filter((field) => !field.filled).length} remaining`;
      $("#aj-question-title").textContent = q?.label || "";
      $("#aj-question-type").textContent = q?.filled ? "Filled" : q?.kind === "ai" ? "AI answer" : "Needs your input";
      $("#aj-question-type").className = `aj-badge ${q?.filled ? "good" : q?.kind === "ai" ? "ai" : "warn"}`;
      const answer = q ? ui.answers[`${current.id}:${q.key}`] ?? current.drafts[q.key] ?? q.answer ?? "" : "";
      value("#aj-answer", answer);
      const choices2 = $("#aj-answer-choice"), signature = JSON.stringify(q?.options || []);
      if (choices2.dataset.options !== signature) {
        choices2.replaceChildren(option("", "Choose an answer"), ...(q?.options || []).map((item) => option(item.value, item.label)));
        choices2.dataset.options = signature;
      }
      if (doc.activeElement !== choices2) choices2.value = answer;
      choices2.hidden = !q?.options?.length;
      $("#aj-answer").hidden = !!q?.options?.length;
      $("#aj-answer").disabled = busy || !q || q.type === "file" || !["questions", "ready"].includes(current?.phase);
      choices2.disabled = $("#aj-answer").disabled;
      $("#aj-question-hint").textContent = q?.type === "file" ? "Upload this document on the employer page, then rescan." : q?.kind === "ai" ? "Generate a draft from your synced profile, review it, then approve it." : "Enter the missing fact. Your profile will not be used to guess it.";
      $("#aj-remember-wrap").hidden = q?.kind !== "fact" || !current?.options.saveAnswers;
      $("#aj-remember-label").textContent = `Remember for ${data.candidate?.name || "this profile"}`;
      $("#aj-remember").checked = !!(q && ui.remember[`${current.id}:${q.key}`]);
      $("#aj-draft").hidden = q?.kind !== "ai";
      $("#aj-draft").disabled = busy || !["questions", "ready"].includes(current?.phase);
      $("#aj-fill-answer").disabled = busy || !q || !answer.trim() || q.type === "file" || !["questions", "ready"].includes(current?.phase);
      $("#aj-fill-label").textContent = q?.filled ? "Update filled answer" : q?.kind === "fact" ? "Fill answer" : "Approve & fill";
      $("#aj-review").disabled = busy || !fields.length || requiredFilled !== required.length || !["questions", "ready"].includes(current?.phase);
      $("#aj-refill").disabled = busy || !current || !["questions", "ready", "error"].includes(current.phase);
      for (const [id, text] of [["aj-review-person", current?.candidateName || data.candidate?.name || ""], ["aj-review-company", current?.company || ""], ["aj-review-title", current?.role || ""], ["aj-review-resume", current ? `Prepared resume \xB7 Version ${current.resumeVersion}` : ""], ["aj-review-record-setting", current?.options.record ? "On" : "Off"], ["aj-review-save-setting", current?.options.saveAnswers ? "On" : "Off"]]) $("#" + id).textContent = text;
      $("#aj-submit").hidden = ["submitted", "submission-pending"].includes(current?.phase);
      $("#aj-submit").disabled = busy || current?.phase !== "ready" || !current?.canSubmit;
      $("#aj-submit").title = current?.canSubmit ? "" : "Submit on the employer page, then confirm below.";
      $("#aj-back-fields").hidden = ["submitted", "submission-pending"].includes(current?.phase);
      $("#aj-confirm-submission").hidden = !current || !(current.phase === "submission-pending" || current.phase === "ready" && !current.canSubmit);
      $("#aj-success").hidden = current?.phase !== "submitted";
      $("#aj-success-text").textContent = current?.message || "";
      $("#aj-view-record").hidden = !current?.applicationId;
      root.setAttribute("aria-busy", String(busy));
    }
    const targetLabel = el("label", void 0, "aj-target-tab");
    targetLabel.append(el("span", "Application tab", "aj-label"));
    const targetSelect = el("select", void 0, "aj-select");
    targetSelect.id = "aj-target-tab";
    targetLabel.append(targetSelect);
    root.querySelector(".aj-option-list").append(targetLabel);
    const choices = el("select", void 0, "aj-select");
    choices.id = "aj-answer-choice";
    choices.setAttribute("aria-label", "Answer to the selected application question");
    $("#aj-answer").after(choices);
    $("#aj-no-ready-jobs").textContent = "No Ready jobs in this profile\u2019s Job Queue. Prepare and save a resume in Job Queues first.";
    function selectJob(index) {
      ui.jobId = data.jobs[index]?.id || null;
      ui.tabId = data.tabs.find((tab) => tab.url === selected()?.url)?.id || 0;
      imported = null;
      $("#aj-file").value = "";
      $("#aj-upload-name").hidden = true;
      $("#aj-prepared-preview").hidden = true;
      $("#aj-profile-updated").hidden = true;
      tell("");
      void persist();
      render();
    }
    async function preview(selector) {
      const job = selected(), useRun = data.run && ui.step !== "setup", id = useRun ? data.run.jobId : job?.id;
      if (!id) throw Error("Choose a prepared job first.");
      const container = $(selector);
      if (!container.hidden) {
        container.hidden = true;
        return;
      }
      if (!useRun && !isPrepared(job)) throw Error("Prepare this job\u2019s resume first.");
      const identity = `${id}:${useRun ? data.run.id : `${job?.resume?.version}:${job?.resume?.savedAt}`}`;
      if (identity !== pdfIdentity) {
        const result = await request("DOCK_APPLY_PDF", { jobId: id, runId: useRun ? data.run.id : void 0 });
        if (!alive) return;
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        pdfUrl = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.resumeBase64), (char) => char.charCodeAt(0))], { type: "application/pdf" }));
        pdfIdentity = identity;
      }
      container.replaceChildren();
      const iframe = el("iframe", void 0, "aj-pdf");
      iframe.src = pdfUrl;
      iframe.title = "Selected prepared resume PDF";
      container.append(iframe);
      container.hidden = false;
    }
    function click(event) {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.action === "dashboard") {
        onDashboard();
        void persist().catch((error) => tell(`Dashboard opened. Unsaved setup remains in this dock: ${error.message}`, true));
        return;
      }
      if (button.disabled) return;
      if (button.dataset.question) {
        ui.question = button.dataset.question;
        render();
        void persist();
        return;
      }
      const name = button.dataset.action || button.dataset.step;
      if (["job-first", "job-prev", "job-next", "job-last"].includes(name)) {
        const index = data.jobs.findIndex((job) => job.id === ui.jobId);
        selectJob(name === "job-first" ? 0 : name === "job-last" ? data.jobs.length - 1 : index + (name === "job-prev" ? -1 : 1));
        return;
      }
      if (name === "manual-upload") {
        $("#aj-file").click();
        return;
      }
      void run(async () => {
        if (name === "queue") {
          await persist();
          await onQueue();
          return;
        }
        if (name === "job-details") {
          await persist();
          await onQueue(selected()?.id);
          return;
        }
        if (name === "job-url") {
          const url = safeJobUrl(selected()?.url);
          if (!url) throw Error("This job has no valid URL.");
          const tab = await browser.tabs.create({ windowId, url, active: true });
          await refresh();
          ui.tabId = tab.id;
          await persist();
          return;
        }
        if (name === "preview-prepared-job" || name === "preview-resume") {
          await preview(name === "preview-resume" ? "#aj-resume-preview" : "#aj-prepared-preview");
          return;
        }
        if (name === "import-queue-file") {
          imported = null;
          imported = await request("DOCK_APPLY_IMPORT", { action: "queue-file", jobId: ui.jobId });
          $("#aj-upload-name").textContent = imported.fileName || "Saved resume PDF";
          $("#aj-upload-name").hidden = false;
          return;
        }
        if (name === "update-profile") {
          if (!imported) throw Error("Parse a resume first.");
          accept(await request("DOCK_APPLY_IMPORT", { action: "apply", jobId: ui.jobId, token: imported.token }));
          imported = null;
          $("#aj-profile-updated").hidden = false;
          $("#aj-profile-revision").textContent = "Profile updated";
          tell("Profile updated from the reviewed resume.");
          return;
        }
        if (name === "start" || name === "autofill" && (!data.run || data.run.phase === "cancelled")) {
          accept(await request("DOCK_APPLY_START", { jobId: ui.jobId, tabId: Number(ui.tabId) || void 0, options: ui.options }));
          ui.step = "autofill";
          await persist();
          return;
        }
        if (name === "setup" || name === "edit-details") {
          if (running()) await command("cancel");
          ui.step = "setup";
          await persist();
          return;
        }
        if (name === "view-record") {
          await onApplication(data.run?.applicationId);
          return;
        }
        if (name === "open-application") {
          await command("open");
          return;
        }
        if (name === "pause") {
          await command(data.run.phase === "paused" ? "resume" : "pause");
          return;
        }
        if (name === "autofill") {
          ui.step = "autofill";
          await command("back-to-fields");
          return;
        }
        if (name === "fill-answer") {
          const q = question();
          await command(name, { fieldKey: q.key, answer: ui.answers[`${data.run.id}:${q.key}`] ?? data.run.drafts[q.key] ?? q.answer, remember: !!ui.remember[`${data.run.id}:${q.key}`] });
          return;
        }
        if (name === "draft") {
          await command(name, { fieldKey: question()?.key });
          return;
        }
        if (["cancel", "next-page", "rescan", "refill", "review", "submit", "back-to-fields", "confirm-submission"].includes(name)) {
          await command(name);
          return;
        }
      });
    }
    function input(event) {
      const node = event.target;
      if (node.id === "aj-target-tab") {
        ui.tabId = Number(node.value);
        void persist();
        return;
      }
      if (node.id === "aj-tailor") {
        ui.tailor = node.checked;
        ui.tailorPreferenceSet = true;
        render();
        void persist();
        return;
      }
      if (node.dataset.option) {
        ui.options[node.dataset.option] = node.checked;
        void persist();
        return;
      }
      if (["aj-answer", "aj-answer-choice", "aj-remember"].includes(node.id)) {
        const q = question();
        if (!q) return;
        const key = `${data.run.id}:${q.key}`;
        if (node.id === "aj-remember") ui.remember[key] = node.checked;
        else ui.answers[key] = node.value;
        void persist();
        if (node.id === "aj-answer-choice") value("#aj-answer", node.value);
        $("#aj-fill-answer").disabled = busy || !String(ui.answers[key] ?? data.run.drafts[q.key] ?? q.answer).trim();
        return;
      }
      if (node.id === "aj-file" && node.files?.[0]) {
        const file = node.files[0];
        void run(async () => {
          imported = null;
          if (file.size > 6 * 1024 * 1024) throw Error("Choose a resume up to 6 MiB.");
          const bytes = new Uint8Array(await file.arrayBuffer());
          let raw = "";
          for (let index = 0; index < bytes.length; index += 8192) raw += String.fromCharCode(...bytes.subarray(index, index + 8192));
          imported = await request("DOCK_APPLY_IMPORT", { action: "parse", jobId: ui.jobId, fileName: file.name, base64: btoa(raw) });
          $("#aj-upload-name").textContent = file.name;
          $("#aj-upload-name").hidden = false;
        });
      }
    }
    const change = (event) => {
      if (["aj-profile", "aj-file", "aj-answer-choice"].includes(event.target.id)) input(event);
    };
    root.addEventListener("click", click);
    root.addEventListener("input", input);
    root.addEventListener("change", change);
    const changed = (changes) => {
      if (changes[`dock-apply-run:v1:${windowId}`] || changes["dock-job-records:v1"]) void refresh();
    };
    privateStorage.onChanged.addListener(changed);
    const storageChanged = (changes, area) => {
      if (area === "local" && (changes.profile || changes["ui-theme:v1"])) void refresh();
    };
    browser.storage.onChanged.addListener(storageChanged);
    const ready = (async () => {
      try {
        windowId = (await browser.windows.getCurrent()).id;
        uiKey = `dock-apply-ui:v1:${windowId}`;
        const previous = (await privateStorage.get(uiKey))[uiKey];
        if (previous) {
          ui = { ...ui, ...previous };
          if (!previous.tailorPreferenceSet) ui.tailor = true;
        }
        accept(await request("DOCK_APPLY_STATE"));
        if (!alive) return;
        loaded = true;
        if (!ui.tabId) ui.tabId = data.tabs.find((tab) => tab.url === selected()?.url)?.id || 0;
        render();
        timer = setInterval(() => {
          if (!root.hidden && running()) void refresh();
        }, 1200);
      } catch (error) {
        loaded = true;
        render();
        tell(error.message, true);
      }
    })();
    return { root, ready, async show(jobId) {
      await ready;
      await refresh();
      if (jobId && data.jobs.some((job) => job.id === jobId) && !running()) {
        ui.step = "setup";
        selectJob(data.jobs.findIndex((job) => job.id === jobId));
        await persist();
      }
    }, close() {
      alive = false;
      revision++;
      clearInterval(timer);
      void persist().catch(() => {
      });
      root.removeEventListener("click", click);
      root.removeEventListener("input", input);
      root.removeEventListener("change", change);
      privateStorage.onChanged.removeListener(changed);
      browser.storage.onChanged.removeListener(storageChanged);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    } };
  }

  // extension/studio/dock-dashboard-view.js
  function mountDockDashboard(host, { browser = globalThis.chrome, privateStorage = studioStorage, onResumeInput, showProfileSelector = false } = {}) {
    host.innerHTML = DASHBOARD_MARKUP;
    const doc = host.ownerDocument, root = host.querySelector("#at-reference-dock"), main = root.querySelector(".rd-main");
    const recordsHost = doc.createElement("div"), applyHost = doc.createElement("div");
    recordsHost.hidden = applyHost.hidden = true;
    main.before(recordsHost, applyHost);
    let records, apply;
    async function ensureSamples() {
      const reply = await withRequestDeadline(browser.runtime.sendMessage({ version: 1, requestId: crypto.randomUUID(), operation: "DOCK_RECORDS_SEED_SAMPLES", payload: {} }));
      if (!reply?.ok) throw Error(reply?.error?.message || "The queue could not load.");
    }
    function showView(name) {
      main.hidden = name !== "dashboard";
      recordsHost.hidden = name !== "records";
      applyHost.hidden = name !== "apply";
      if (records) records.root.hidden = recordsHost.hidden;
      if (apply) apply.root.hidden = applyHost.hidden;
      root.querySelector("#rd-feedback").hidden = true;
    }
    async function showApplications(tab = "applications", url) {
      await ensureSamples();
      records ||= mountJobRecords(recordsHost, { browser, privateStorage, onResumeInput, onDashboard() {
        showView("dashboard");
      }, onApply: showApply });
      showView("records");
      await records.show(tab, url);
    }
    async function showApply(jobId) {
      await ensureSamples();
      apply ||= mountApplyDock(applyHost, { browser, privateStorage, onDashboard() {
        showView("dashboard");
      }, onQueue: async (id) => {
        await showApplications("queue");
        if (id) await records.select(id);
      }, onApplication: async (id) => {
        await showApplications("applications");
        await records.select(id);
      } });
      showView("apply");
      await apply.show(jobId);
    }
    const unmount = mountReferenceDashboard(root, browser, { onApplications: showApplications, onApply: () => showApply(), showProfileSelector });
    return { root, showApply, showApplications, async editResume(id, options) {
      await showApplications("queue");
      await records.editResume(id, options);
    }, close() {
      records?.close();
      apply?.close();
      unmount();
    } };
  }

  // extension/studio/inline-dock-client.js
  async function createInlineDockClient(browser = globalThis.chrome, scope = globalThis) {
    async function call(action, payload = {}) {
      const reply = await withRequestDeadline(browser.runtime.sendMessage({ type: "inline-dock:request", token: scope.__applicationTrackerInlineConfig?.token, action, payload }));
      if (!reply?.ok) throw Error(reply?.error?.message || "The dock could not connect. Click the toolbar icon to reconnect.");
      return reply.result;
    }
    const context = await call("context"), listeners = /* @__PURE__ */ new Set();
    const scoped = (key) => `${key}:${context.tabId}`;
    const read = async (action, key) => {
      const values = await call(action, { key: typeof key === "string" ? scoped(key) : key });
      return typeof key === "string" ? { [key]: values[scoped(key)] } : values;
    };
    const write = async (action, values) => {
      for (const [key, value] of Object.entries(values)) await call(action, { key: scoped(key), value });
    };
    const changed = (message, sender) => {
      if (sender.id === browser.runtime.id && message?.type === "inline-dock:changed") {
        const changes = Object.fromEntries(message.keys.map((key) => [key, {}]));
        for (const listener of listeners) listener(changes, "local");
      }
    };
    browser.runtime.onMessage.addListener(changed);
    return {
      call,
      context,
      browser: {
        runtime: { getURL: (path) => browser.runtime.getURL(path), sendMessage: (envelope) => call("request", envelope) },
        windows: { getCurrent: async () => ({ id: context.windowId }) },
        tabs: { query: () => call("tabs-query"), create: (payload) => call("tabs-create", payload), update: (id, payload) => call("tabs-update", { id, ...payload }) },
        storage: { local: { get: () => call("local-read") }, session: { get: (key) => read("session-read", key), set: (values) => write("session-write", values) }, onChanged: browser.storage.onChanged }
      },
      privateStorage: { get: (key) => read("private-read", key), set: (values) => write("private-write", values), onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) } },
      close() {
        browser.runtime.onMessage.removeListener(changed);
        listeners.clear();
      }
    };
  }

  // extension/studio/inline-dock-layout.js
  function reserveDockSpace(document2, host, width = 384) {
    const win = document2.defaultView, saved = /* @__PURE__ */ new Map();
    let observer, scheduled = 0, open = false;
    function set(node, name, value) {
      if (!saved.has(node)) saved.set(node, /* @__PURE__ */ new Map());
      const values = saved.get(node);
      if (!values.has(name)) values.set(name, [node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]);
      if (node.style.getPropertyValue(name) !== value || node.style.getPropertyPriority(name) !== "important") node.style.setProperty(name, value, "important");
    }
    function restore() {
      for (const [node, values] of saved) for (const [name, [value, priority]] of values) {
        if (value) node.style.setProperty(name, value, priority);
        else node.style.removeProperty(name);
      }
      saved.clear();
    }
    function sync() {
      if (!open || !document2.body) return;
      restore();
      if (win.innerWidth - width < 320) return;
      const body = document2.body, style = win.getComputedStyle(body), margins = (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
      const fixed = [...body.querySelectorAll("*")].filter((node) => node !== host && !host.contains(node) && !node.closest('dialog,[aria-modal="true"],[role="dialog"]')).filter((node) => {
        const style2 = win.getComputedStyle(node), rect = node.getBoundingClientRect();
        return style2.position === "fixed" && rect.width > win.innerWidth * 0.5 && Math.abs(rect.right - win.innerWidth) < 24;
      });
      set(body, "box-sizing", "border-box");
      set(body, "width", `calc(100% - ${width + margins}px)`);
      set(body, "max-width", `calc(100% - ${width}px)`);
      for (const node of fixed) {
        set(node, "right", `${width}px`);
        set(node, "max-width", `calc(100% - ${width}px)`);
        if (node.getBoundingClientRect().width > win.innerWidth - width) set(node, "width", `calc(100% - ${width}px)`);
      }
    }
    const schedule = () => {
      if (open && !scheduled) scheduled = win.requestAnimationFrame(() => {
        scheduled = 0;
        sync();
      });
    };
    return { setOpen(value) {
      open = value;
      observer?.disconnect();
      observer = null;
      win.removeEventListener("resize", schedule);
      if (scheduled) win.cancelAnimationFrame(scheduled);
      scheduled = 0;
      if (!open) {
        restore();
        return;
      }
      sync();
      observer = new win.MutationObserver(schedule);
      observer.observe(document2.body, { childList: true, subtree: true });
      win.addEventListener("resize", schedule);
    }, close() {
      this.setOpen(false);
    } };
  }

  // extension/studio/theme.css
  var theme_default = `:root {\r
  color-scheme: light;\r
  --color-ink: #182339; --color-muted: #5c687e; --color-line: #e2e7ef;\r
  --color-surface: #fff; --color-canvas: #f5f6fa; --color-accent: #4f46e5;\r
  --color-accent-soft: #eeedff; --radius-control: .5rem; --radius-panel: .875rem;\r
  --color-button-fill: #eef2f8; --color-button-border: #8290a6;\r
  --color-button-hover: #e3e7fb; --color-button-pressed: #d4daf5;\r
  --color-accent-solid: #4f46e5; --color-accent-hover: #4338ca; --color-accent-pressed: #3730a3; --color-on-accent: #fff;\r
  --color-accordion-open: #f1f3fa; --color-accordion-body: #f8f9fd;\r
  --color-danger-ink: #b42318; --color-danger-fill: #fff1f0; --color-danger-border: #e7a5a0; --color-danger-hover: #ffe4e0; --color-danger-pressed: #ffd2ca;\r
  --color-disabled-fill: #e5e9f0; --color-disabled-ink: #526078; --color-disabled-border: #a1adbd;\r
  --shadow-panel: 0 2px 6px #18233904;\r
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\r
  color: var(--color-ink); background: var(--color-canvas); line-height: 1.55;\r
}\r
\r
:root {\r
 --color-field: var(--color-surface); --color-field-line: var(--color-line);\r
 --web-ink: var(--color-ink); --web-muted: var(--color-muted); --web-line: var(--color-line);\r
 --web-accent: var(--color-accent-solid); --web-soft: var(--color-accent-soft); --web-canvas: var(--color-canvas);\r
 --background: var(--color-canvas); --foreground: var(--color-ink);\r
 --card: var(--color-surface); --card-foreground: var(--color-ink); --popover: var(--color-surface); --popover-foreground: var(--color-ink);\r
 --primary: var(--color-accent-solid); --primary-foreground: var(--color-on-accent);\r
 --secondary: var(--color-button-fill); --secondary-foreground: var(--color-ink);\r
 --muted: var(--color-canvas); --muted-foreground: var(--color-muted); --accent: var(--color-accent-soft); --accent-foreground: var(--color-accent);\r
 --border: var(--color-line); --input: var(--color-field-line); --ring: var(--color-accent);\r
 --destructive: var(--color-danger-ink); --destructive-foreground: var(--color-on-accent);\r
 --sidebar: var(--color-surface); --sidebar-foreground: var(--color-ink); --sidebar-border: var(--color-line);\r
}\r
:root[data-theme="dark"] { --web-accent: var(--color-accent); }\r
body { background: var(--color-canvas); color: var(--color-ink); }\r
.web-theme-control { position: relative; flex: none; }\r
.web-theme-toggle { display: grid; place-items: center; width: 32px; height: 32px; padding: 6px; border: 1px solid var(--color-button-border); border-radius: 7px; color: var(--color-ink); background: var(--color-button-fill); cursor: pointer; }\r
.web-theme-toggle svg { width: 18px; height: 18px; }\r
.web-theme-toggle:hover { color: var(--color-accent); background: var(--color-button-hover); }\r
.web-theme-toggle:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }\r
.web-theme-error { position: absolute; right: 0; top: 38px; z-index: 70; width: 240px; padding: 10px; border: 1px solid var(--color-danger-border); border-radius: 7px; background: var(--color-danger-fill); color: var(--color-danger-ink); font-size: 12px; }\r
.autofill-options { --primary: var(--color-accent-solid); --primary-foreground: var(--color-on-accent); --accent-foreground: var(--color-accent); }\r
.web-button-primary,.prompt-settings .button-primary { color: var(--color-on-accent); background: var(--color-accent-solid); border-color: var(--color-accent-solid); }\r
.web-button-primary:hover:enabled { color: var(--color-on-accent); background: var(--color-accent-hover); border-color: var(--color-accent-hover); }\r
.prompt-message { background: var(--color-accent-soft); color: var(--color-ink); border-color: var(--color-line); }\r
.prompt-message.prompt-message-error { background: var(--color-danger-fill); color: var(--color-danger-ink); border-color: var(--color-danger-border); }\r
[data-theme="dark"] .prompt-message.prompt-message-success { background: #153b30; color: #9ddac1; border-color: #32654e; }\r
[data-theme="dark"] .prompt-settings .button-danger { color: var(--color-danger-ink); background: var(--color-danger-fill); border-color: var(--color-danger-border); }\r
/* Shared web feedback and controls retain readable text in either theme. */\r
.web-message { color: var(--color-ink); background: var(--color-accent-soft); border-color: var(--color-line); }\r
.web-message.web-error { color: var(--color-danger-ink); background: var(--color-danger-fill); border-color: var(--color-danger-border); }\r
.web-button-primary,.prompt-settings .button-primary { color: var(--color-on-accent); background: var(--color-accent-solid); border-color: var(--color-accent-solid); }\r
.web-button-primary:hover:enabled,.prompt-settings .button-primary:hover:enabled { color: var(--color-on-accent); background: var(--color-accent-hover); border-color: var(--color-accent-hover); }\r
.autofill-options :is(input,textarea,select)::placeholder { color: var(--color-muted); opacity: 1; }\r
:root { --chart-1: var(--color-accent-solid); }\r
/* Chrome's native dashboard uses the original dimensions and CSS unchanged. */\r
\r
:root[data-theme="dark"] {\r
  color-scheme: dark;\r
  --color-ink: #e5eaf3; --color-muted: #a5b2c6; --color-line: #334155;\r
  --color-surface: #151f31; --color-canvas: #0c1220; --color-accent: #b3abff;\r
  --color-accent-soft: #292442; --color-field: #101929; --color-field-line: #45546c;\r
  --color-accordion-open: #243149; --color-accordion-body: #101a2b;\r
  --color-danger-ink: #ffb4ab; --color-danger-fill: #3c222a; --color-danger-border: #9f5861; --color-danger-hover: #512c35; --color-danger-pressed: #633340;\r
  --color-button-fill: #24344c; --color-button-border: #7788a3;\r
  --color-button-hover: #303a58; --color-button-pressed: #3b4465;\r
  --color-accent-solid: #6558e8; --color-accent-hover: #7162ed; --color-accent-pressed: #5344ca;\r
  --color-disabled-fill: #253047; --color-disabled-ink: #a5b2c6; --color-disabled-border: #53627c;\r
  --shadow-panel: 0 2px 6px #0002;\r
}\r
`;

  // extension/dashboard.css
  var dashboard_default = '/* Original reference styles; local light palette follows. */\n\r\n    #at-reference-dock{--rd-bg:#121213;--rd-panel:#202022;--rd-line:#323035;--rd-text:#efedf2;--rd-muted:#a19ba6;--rd-purple:#a18af0;--rd-green:#57cfa5;--rd-orange:#f29a55;--rd-cyan:#69c5df;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1.45;padding:14px 10px;color:var(--rd-text)}\r\n    #at-reference-dock *{box-sizing:border-box}\r\n    #at-reference-dock [hidden]{display:none!important}\r\n    #at-reference-dock button,#at-reference-dock select{font:inherit}\r\n    #at-reference-dock button{color:inherit;font-weight:500}\r\n    #at-reference-dock button:focus-visible,#at-reference-dock select:focus-visible{outline:2px solid var(--rd-purple);outline-offset:3px}\r\n    #at-reference-dock .rd-dock{width:100%;max-width:350px;margin:0 auto;background:var(--rd-bg);border:1px solid #2c292f;border-radius:12px;overflow:clip;color-scheme:dark}\r\n    #at-reference-dock .rd-header{height:53px;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:11px 13px;border-bottom:1px solid #262428}\r\n    #at-reference-dock .rd-brand{display:flex;align-items:center;gap:7px;min-width:0}\r\n    #at-reference-dock .rd-logo{height:24px;width:24px;border-radius:7px;background:#7752d8;display:grid;place-items:center;color:#f6f1ff;flex-shrink:0}\r\n    #at-reference-dock .rd-logo svg{width:15px;height:15px}\r\n    #at-reference-dock .rd-brand-name{font-size:13px;letter-spacing:-.3px;font-weight:500;white-space:nowrap}\r\n    #at-reference-dock .rd-person{display:flex;align-items:center;gap:5px;min-width:0}\r\n    #at-reference-dock .rd-avatar{height:24px;width:24px;border-radius:50%;display:grid;place-items:center;background:#794edb;color:#f5eeff;font-size:11px;flex-shrink:0}\r\n    #at-reference-dock .rd-select{font-size:11px;border:0;color:#c8c2ce;background:var(--rd-bg);padding:3px 1px;min-width:0;width:74px}\r\n    #at-reference-dock .rd-main{padding:13px 13px 0}\r\n    #at-reference-dock .rd-welcome{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}\r\n    #at-reference-dock .rd-welcome p{margin:0;color:var(--rd-muted);font-size:12px}\r\n    #at-reference-dock .rd-welcome strong{font-size:14px;color:var(--rd-text);font-weight:500;margin-left:3px}\r\n    #at-reference-dock .rd-refresh{height:28px;width:28px;display:grid;place-items:center;background:#1c1b1e;border:1px solid #302d33;border-radius:8px;flex-shrink:0}\r\n    #at-reference-dock .rd-refresh svg{width:15px;height:15px;color:var(--rd-muted)}\r\n    #at-reference-dock .rd-section-title{margin:0 0 8px;font-size:12px;color:var(--rd-muted);font-weight:500}\r\n    #at-reference-dock .rd-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:18px}\r\n    #at-reference-dock .rd-stat{border:1px solid #34303f;border-radius:12px;min-height:109px;padding:12px 6px 10px;display:flex;flex-direction:column;align-items:center;text-align:center}\r\n    #at-reference-dock .rd-stat svg{width:16px;height:16px;margin-bottom:7px}\r\n    #at-reference-dock .rd-stat strong{font-size:20px;line-height:1.15;font-weight:500;font-variant-numeric:tabular-nums;margin-bottom:7px}\r\n    #at-reference-dock .rd-stat-label{font-size:11px;line-height:1.35;color:#aca6b3;max-width:86px}\r\n    #at-reference-dock .rd-stat-resume{background:#211c31;border-color:#342b48;color:var(--rd-purple)}\r\n    #at-reference-dock .rd-stat-applications{background:#152d24;border-color:#284539;color:var(--rd-green)}\r\n    #at-reference-dock .rd-stat-meetings{background:#332217;border-color:#493326;color:var(--rd-orange)}\r\n    #at-reference-dock .rd-actions{display:grid;gap:8px;margin-bottom:18px}\r\n    #at-reference-dock .rd-action{display:flex;align-items:center;gap:10px;width:100%;border:1px solid #3b2d53;border-radius:11px;min-height:42px;padding:10px 12px;text-align:left;background:#241d32}\r\n    #at-reference-dock .rd-action>svg:first-child{height:20px;width:20px;flex-shrink:0}\r\n    #at-reference-dock .rd-action-label{flex:1;font-size:13px;color:#ece8f1}\r\n    #at-reference-dock .rd-action>svg:last-child{height:14px;width:14px;color:#9e92ac;flex-shrink:0}\r\n    #at-reference-dock .rd-action-profile{background:#241e34;border-color:#3b2c55}\r\n    #at-reference-dock .rd-action-profile>svg:first-child{color:var(--rd-purple)}\r\n    #at-reference-dock .rd-action-browse{background:#301c32;border-color:#4c2751}\r\n    #at-reference-dock .rd-action-browse>svg:first-child{color:#d79cdb}\r\n    #at-reference-dock .rd-action-apply{background:#192e27;border-color:#254a3d}\r\n    #at-reference-dock .rd-action-apply>svg:first-child{color:var(--rd-green)}\r\n    #at-reference-dock .rd-action-applications{background:#192d34;border-color:#28434d}\r\n    #at-reference-dock .rd-action-applications>svg:first-child{color:var(--rd-cyan)}\r\n    #at-reference-dock .rd-action-meeting{background:#332319;border-color:#4c3526}\r\n    #at-reference-dock .rd-action-meeting>svg:first-child{color:var(--rd-orange)}\r\n    #at-reference-dock .rd-action:hover,#at-reference-dock .rd-action[aria-pressed=true]{filter:brightness(1.15)}\r\n    #at-reference-dock .rd-recent{border:1px solid #343136;border-radius:12px;background:var(--rd-panel);overflow:clip;margin-bottom:13px}\r\n    #at-reference-dock .rd-activity{width:100%;display:grid;grid-template-columns:16px minmax(0,1fr) 90px;align-items:center;gap:8px;padding:12px 11px;border:0;background:transparent;text-align:left;position:relative;min-height:53px}\r\n    #at-reference-dock .rd-activity:not(:last-child):after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:1px;background:#343136}\r\n    #at-reference-dock .rd-activity:hover,#at-reference-dock .rd-activity[aria-pressed=true]{background:#2a2630}\r\n    #at-reference-dock .rd-activity>svg{height:15px;width:15px}\r\n    #at-reference-dock .rd-activity.application>svg{color:var(--rd-green)}\r\n    #at-reference-dock .rd-activity.meeting>svg{color:var(--rd-orange)}\r\n    #at-reference-dock .rd-activity.profile>svg{color:var(--rd-purple)}\r\n    #at-reference-dock .rd-activity-copy{display:grid;gap:1px;min-width:0}\r\n    #at-reference-dock .rd-activity-title{font-size:12px;font-weight:500;color:#f0edf2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n    #at-reference-dock .rd-activity-company{font-size:11px;color:var(--rd-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}\r\n    #at-reference-dock .rd-time{font-size:11px;color:var(--rd-muted);white-space:nowrap;font-weight:400;text-align:right}\r\n    #at-reference-dock .rd-feedback{margin:0 13px 13px;padding:9px 10px;background:#26202f;border:1px solid #423350;border-radius:8px;font-size:11px;color:#d3c5e8}\r\n    @media(max-width:370px){#at-reference-dock{padding:10px 3px}#at-reference-dock .rd-header{padding-left:11px;padding-right:10px}#at-reference-dock .rd-brand{gap:6px}#at-reference-dock .rd-brand-name{font-size:12px}#at-reference-dock .rd-select{width:68px;font-size:11px}#at-reference-dock .rd-main{padding-left:11px;padding-right:11px}#at-reference-dock .rd-stat{padding-left:5px;padding-right:5px;min-height:113px}#at-reference-dock .rd-stat-label{font-size:11px}#at-reference-dock .rd-activity{grid-template-columns:15px minmax(0,1fr) 83px;gap:7px;padding-left:10px;padding-right:10px}#at-reference-dock .rd-time{font-size:11px}}\r\n    @media(pointer:coarse){#at-reference-dock .rd-action,#at-reference-dock .rd-activity,#at-reference-dock .rd-refresh,#at-reference-dock .rd-select{min-height:44px}#at-reference-dock .rd-refresh{width:36px}}\r\n  \n\r\n    html[data-theme="light"] #at-reference-dock{--rd-bg:#f7f7fa;--rd-panel:#ffffff;--rd-line:#e2dfe7;--rd-text:#28232e;--rd-muted:#766d7f;--rd-purple:#7958c8;--rd-green:#226f56;--rd-orange:#92501c;--rd-cyan:#286d84;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1.45;padding:14px 10px;color:var(--rd-text)}\r\n    html[data-theme="light"] #at-reference-dock *{box-sizing:border-box}\r\n    html[data-theme="light"] #at-reference-dock [hidden]{display:none!important}\r\n    html[data-theme="light"] #at-reference-dock button,html[data-theme="light"] #at-reference-dock select{font:inherit}\r\n    html[data-theme="light"] #at-reference-dock button{color:inherit;font-weight:500}\r\n    html[data-theme="light"] #at-reference-dock button:focus-visible,html[data-theme="light"] #at-reference-dock select:focus-visible{outline:2px solid var(--rd-purple);outline-offset:3px}\r\n    html[data-theme="light"] #at-reference-dock .rd-dock{width:100%;max-width:350px;margin:0 auto;background:var(--rd-bg);border:1px solid #e1dce7;border-radius:12px;overflow:clip;color-scheme:light}\r\n    html[data-theme="light"] #at-reference-dock .rd-header{height:53px;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:11px 13px;border-bottom:1px solid #ebe7ef}\r\n    html[data-theme="light"] #at-reference-dock .rd-brand{display:flex;align-items:center;gap:7px;min-width:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-logo{height:24px;width:24px;border-radius:7px;background:#7752d8;display:grid;place-items:center;color:#f6f1ff;flex-shrink:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-logo svg{width:15px;height:15px}\r\n    html[data-theme="light"] #at-reference-dock .rd-brand-name{font-size:13px;letter-spacing:-.3px;font-weight:500;white-space:nowrap}\r\n    html[data-theme="light"] #at-reference-dock .rd-person{display:flex;align-items:center;gap:5px;min-width:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-avatar{height:24px;width:24px;border-radius:50%;display:grid;place-items:center;background:#794edb;color:#f5eeff;font-size:11px;flex-shrink:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-select{font-size:11px;border:0;color:#5c5268;background:var(--rd-bg);padding:3px 1px;min-width:0;width:74px}\r\n    html[data-theme="light"] #at-reference-dock .rd-main{padding:13px 13px 0}\r\n    html[data-theme="light"] #at-reference-dock .rd-welcome{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}\r\n    html[data-theme="light"] #at-reference-dock .rd-welcome p{margin:0;color:var(--rd-muted);font-size:12px}\r\n    html[data-theme="light"] #at-reference-dock .rd-welcome strong{font-size:14px;color:var(--rd-text);font-weight:500;margin-left:3px}\r\n    html[data-theme="light"] #at-reference-dock .rd-refresh{height:28px;width:28px;display:grid;place-items:center;background:#f0edf4;border:1px solid #e0d9e8;border-radius:8px;flex-shrink:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-refresh svg{width:15px;height:15px;color:var(--rd-muted)}\r\n    html[data-theme="light"] #at-reference-dock .rd-section-title{margin:0 0 8px;font-size:12px;color:var(--rd-muted);font-weight:500}\r\n    html[data-theme="light"] #at-reference-dock .rd-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:18px}\r\n    html[data-theme="light"] #at-reference-dock .rd-stat{border:1px solid #ded5e9;border-radius:12px;min-height:109px;padding:12px 6px 10px;display:flex;flex-direction:column;align-items:center;text-align:center}\r\n    html[data-theme="light"] #at-reference-dock .rd-stat svg{width:16px;height:16px;margin-bottom:7px}\r\n    html[data-theme="light"] #at-reference-dock .rd-stat strong{font-size:20px;line-height:1.15;font-weight:500;font-variant-numeric:tabular-nums;margin-bottom:7px}\r\n    html[data-theme="light"] #at-reference-dock .rd-stat-label{font-size:11px;line-height:1.35;color:#74667e;max-width:86px}\r\n    html[data-theme="light"] #at-reference-dock .rd-stat-resume{background:#f1ecfb;border-color:#dcd0f2;color:var(--rd-purple)}\r\n    html[data-theme="light"] #at-reference-dock .rd-stat-applications{background:#eaf7f0;border-color:#cee9dc;color:var(--rd-green)}\r\n    html[data-theme="light"] #at-reference-dock .rd-stat-meetings{background:#fff2e7;border-color:#efd8c5;color:var(--rd-orange)}\r\n    html[data-theme="light"] #at-reference-dock .rd-actions{display:grid;gap:8px;margin-bottom:18px}\r\n    html[data-theme="light"] #at-reference-dock .rd-action{display:flex;align-items:center;gap:10px;width:100%;border:1px solid #dfd2ef;border-radius:11px;min-height:42px;padding:10px 12px;text-align:left;background:#f2ecfb}\r\n    html[data-theme="light"] #at-reference-dock .rd-action>svg:first-child{height:20px;width:20px;flex-shrink:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-label{flex:1;font-size:13px;color:#342b40}\r\n    html[data-theme="light"] #at-reference-dock .rd-action>svg:last-child{height:14px;width:14px;color:#85728f;flex-shrink:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-profile{background:#f1ecfb;border-color:#ddcef0}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-profile>svg:first-child{color:var(--rd-purple)}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-browse{background:#f9edf9;border-color:#ebd1ee}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-browse>svg:first-child{color:#aa5faf}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-apply{background:#eaf6ef;border-color:#cce7d8}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-apply>svg:first-child{color:var(--rd-green)}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-applications{background:#eaf4f8;border-color:#cde2eb}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-applications>svg:first-child{color:var(--rd-cyan)}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-meeting{background:#fff1e6;border-color:#efd6c0}\r\n    html[data-theme="light"] #at-reference-dock .rd-action-meeting>svg:first-child{color:var(--rd-orange)}\r\n    html[data-theme="light"] #at-reference-dock .rd-action:hover,html[data-theme="light"] #at-reference-dock .rd-action[aria-pressed=true]{filter:brightness(1.15)}\r\n    html[data-theme="light"] #at-reference-dock .rd-recent{border:1px solid #e4dfe9;border-radius:12px;background:var(--rd-panel);overflow:clip;margin-bottom:13px}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity{width:100%;display:grid;grid-template-columns:16px minmax(0,1fr) 90px;align-items:center;gap:8px;padding:12px 11px;border:0;background:transparent;text-align:left;position:relative;min-height:53px}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity:not(:last-child):after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:1px;background:#e4dfe9}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity:hover,html[data-theme="light"] #at-reference-dock .rd-activity[aria-pressed=true]{background:#f3eef8}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity>svg{height:15px;width:15px}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity.application>svg{color:var(--rd-green)}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity.meeting>svg{color:var(--rd-orange)}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity.profile>svg{color:var(--rd-purple)}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity-copy{display:grid;gap:1px;min-width:0}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity-title{font-size:12px;font-weight:500;color:#332a3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n    html[data-theme="light"] #at-reference-dock .rd-activity-company{font-size:11px;color:var(--rd-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}\r\n    html[data-theme="light"] #at-reference-dock .rd-time{font-size:11px;color:var(--rd-muted);white-space:nowrap;font-weight:400;text-align:right}\r\n    html[data-theme="light"] #at-reference-dock .rd-feedback{margin:0 13px 13px;padding:9px 10px;background:#f2ecfa;border:1px solid #dcd0ed;border-radius:8px;font-size:11px;color:#70528e}\r\n    @media(max-width:370px){html[data-theme="light"] #at-reference-dock{padding:10px 3px}html[data-theme="light"] #at-reference-dock .rd-header{padding-left:11px;padding-right:10px}html[data-theme="light"] #at-reference-dock .rd-brand{gap:6px}html[data-theme="light"] #at-reference-dock .rd-brand-name{font-size:12px}html[data-theme="light"] #at-reference-dock .rd-select{width:68px;font-size:11px}html[data-theme="light"] #at-reference-dock .rd-main{padding-left:11px;padding-right:11px}html[data-theme="light"] #at-reference-dock .rd-stat{padding-left:5px;padding-right:5px;min-height:113px}html[data-theme="light"] #at-reference-dock .rd-stat-label{font-size:11px}html[data-theme="light"] #at-reference-dock .rd-activity{grid-template-columns:15px minmax(0,1fr) 83px;gap:7px;padding-left:10px;padding-right:10px}html[data-theme="light"] #at-reference-dock .rd-time{font-size:11px}}\r\n    @media(pointer:coarse){html[data-theme="light"] #at-reference-dock .rd-action,html[data-theme="light"] #at-reference-dock .rd-activity,html[data-theme="light"] #at-reference-dock .rd-refresh,html[data-theme="light"] #at-reference-dock .rd-select{min-height:44px}html[data-theme="light"] #at-reference-dock .rd-refresh{width:36px}}\r\n  \n#at-reference-dock { --rd-soft:#1c1b1e; --rd-accent-soft:#211c31; --rd-good-soft:#152d24; --rd-warn-soft:#332217; }\nhtml[data-theme="light"] #at-reference-dock { --rd-soft:#f0edf4; --rd-accent-soft:#f1ecfb; --rd-good-soft:#eaf7f0; --rd-warn-soft:#fff2e7; }\n\n:root { --reference-dashboard-bg: #f7f7fa; }\n:root[data-theme="dark"] { --reference-dashboard-bg: #121213; }\nbody.reference-dashboard { margin: 0; background: var(--reference-dashboard-bg); }\n#at-reference-dock .rd-empty { margin: 0; padding: 18px 11px; font-size: 12px; color: var(--rd-muted); text-align: center; }\nhtml[data-theme] #at-reference-dock .rd-header { height:auto; min-height:53px; flex-wrap:wrap; }\nhtml[data-theme] #at-reference-dock .rd-person { max-width:100%; }\nhtml[data-theme] #at-reference-dock .rd-select { width:auto; max-width:250px; }\n#at-reference-dock button.rd-brand { padding:0; border:0; background:transparent; color:inherit; text-align:left; font:inherit; border-radius:7px; }\n#at-reference-dock button.rd-brand:focus-visible { outline:2px solid var(--rd-purple); outline-offset:4px; }\n#at-reference-dock button { cursor: pointer; }\n#at-reference-dock button:disabled { cursor: wait; opacity: .6; }\n';

  // extension/job-records.css
  var job_records_default = `/* Authored Applications / Job Queues dock layout. */
\r
    #job-records-design{--jr-bg:#f2f6f7;--jr-card:#ffffff;--jr-raised:#eaf1f3;--jr-hover:#f6fafb;--jr-text:#19343e;--jr-muted:#607580;--jr-line:#d3e0e4;--jr-accent:#08767e;--jr-accent-bg:#e0f2f1;--jr-blue:#3566aa;--jr-blue-bg:#e9f0fd;--jr-purple:#7752a6;--jr-purple-bg:#f0e8fb;--jr-green:#14795b;--jr-green-bg:#e1f3e9;--jr-red:#aa4348;--jr-red-bg:#fceced;--jr-amber:#916119;--jr-amber-bg:#fff2db;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1.45;color:var(--jr-text);padding:16px 10px}\r
    #job-records-design *{box-sizing:border-box}\r
    #job-records-design [hidden]{display:none!important}\r
    #job-records-design button,#job-records-design input,#job-records-design select,#job-records-design textarea{font:inherit}\r
    #job-records-design button{font-weight:500;color:inherit}\r
    #job-records-design button:focus-visible,#job-records-design input:focus-visible,#job-records-design select:focus-visible,#job-records-design textarea:focus-visible{outline:2px solid var(--jr-accent);outline-offset:3px}\r
    #job-records-design button:disabled{opacity:.45;cursor:not-allowed}\r
    #job-records-design .jr-window{width:100%;max-width:430px;margin:0 auto;background:var(--jr-bg);border:1px solid var(--jr-line);border-radius:16px;overflow:clip}\r
    #job-records-design .jr-header{padding:17px 17px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px}\r
    #job-records-design .jr-header h2{font-size:17px;line-height:1.3;letter-spacing:-.4px;font-weight:500;margin:0}\r
    #job-records-design .jr-identity{display:grid;justify-items:end;gap:3px;color:var(--jr-muted);font-size:11px}\r
    #job-records-design .jr-demo{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--jr-muted)}\r
    #job-records-design .jr-tabs{display:flex;gap:3px;margin:0 14px 15px;padding:4px;background:var(--jr-raised);border-radius:10px}\r
    #job-records-design .jr-tab{display:flex;align-items:center;justify-content:center;gap:8px;flex:1;border:0;border-radius:7px;background:transparent;padding:9px 7px;font-size:12px;color:var(--jr-muted)}\r
    #job-records-design .jr-tab[aria-selected=true]{background:var(--jr-card);color:var(--jr-text);box-shadow:0 1px 3px #29425312}\r
    #job-records-design .jr-tab-count{font-size:11px;font-variant-numeric:tabular-nums;color:var(--jr-muted)}\r
    #job-records-design .jr-body{padding:0 13px 14px}\r
    #job-records-design .jr-list{display:grid;gap:11px}\r
    #job-records-design .jr-record{background:var(--jr-card);border:1px solid var(--jr-line);border-radius:13px;padding:14px 14px 10px;min-width:0;transition:border-color .15s,background .15s}\r
    #job-records-design .jr-record:hover,#job-records-design .jr-record:focus-within{border-color:var(--jr-muted);background:var(--jr-hover)}\r
    #job-records-design .jr-record-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(108px,auto);align-items:start;gap:13px;min-width:0}\r
    #job-records-design .jr-company{min-width:0}\r
    #job-records-design .jr-company h3{font-size:15px;line-height:1.35;font-weight:500;margin:1px 0 5px;letter-spacing:-.15px;overflow-wrap:anywhere}\r
    #job-records-design .jr-company p{font-size:12px;color:var(--jr-muted);line-height:1.5;margin:0;overflow-wrap:anywhere}\r
    #job-records-design .jr-stamp{display:grid;justify-items:end;gap:6px;text-align:right;max-width:140px}\r
    #job-records-design .jr-updated{font-size:11px;line-height:1.45;color:var(--jr-muted);font-variant-numeric:tabular-nums;max-width:140px}\r
    #job-records-design .jr-status{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;padding:4px 7px;border-radius:6px;white-space:nowrap;background:var(--jr-raised);color:var(--jr-muted)}\r
    #job-records-design .jr-status svg{width:12px;height:12px}\r
    #job-records-design .jr-status.applied{background:var(--jr-blue-bg);color:var(--jr-blue)}\r
    #job-records-design .jr-status.screening{background:var(--jr-accent-bg);color:var(--jr-accent)}\r
    #job-records-design .jr-status.interview{background:var(--jr-purple-bg);color:var(--jr-purple)}\r
    #job-records-design .jr-status.offer,#job-records-design .jr-status.ready{background:var(--jr-green-bg);color:var(--jr-green)}\r
    #job-records-design .jr-status.failed,#job-records-design .jr-status.rejected{background:var(--jr-red-bg);color:var(--jr-red)}\r
    #job-records-design .jr-status.generating{background:var(--jr-amber-bg);color:var(--jr-amber)}\r
    #job-records-design .jr-record-actions{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;min-height:33px}\r
    #job-records-design .jr-view{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:5px;padding:5px 0;background:transparent;font-size:12px;color:var(--jr-muted)}\r
    #job-records-design .jr-view svg{width:13px;height:13px}\r
    #job-records-design .jr-view:hover{color:var(--jr-accent)}\r
    #job-records-design .jr-action-rail{display:flex;align-items:center;gap:3px;opacity:0;pointer-events:none;transform:translateY(2px);transition:opacity .12s,transform .12s}\r
    #job-records-design .jr-record:hover .jr-action-rail,#job-records-design .jr-record:focus-within .jr-action-rail{opacity:1;pointer-events:auto;transform:none}\r
    #job-records-design .jr-icon{height:29px;width:29px;border:1px solid transparent;border-radius:7px;display:grid;place-items:center;padding:0;background:transparent;color:var(--jr-muted)}\r
    #job-records-design .jr-icon svg{width:16px;height:16px;stroke-width:1.8}\r
    #job-records-design .jr-icon:hover{border-color:var(--jr-line);background:var(--jr-raised);color:var(--jr-accent)}\r
    #job-records-design .jr-icon.danger:hover{background:var(--jr-red-bg);color:var(--jr-red);border-color:transparent}\r
    #job-records-design .jr-error{display:flex;align-items:start;gap:6px;font-size:11px;color:var(--jr-red);margin:10px 0 0;line-height:1.5}\r
    #job-records-design .jr-error svg{width:13px;height:13px;flex-shrink:0;margin-top:1px}\r
    #job-records-design .jr-empty{padding:28px 16px;text-align:center;display:grid;justify-items:center;gap:10px;font-size:12px;color:var(--jr-muted)}\r
    #job-records-design .jr-empty svg{width:24px;height:24px}\r
    #job-records-design .jr-detail-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}\r
    #job-records-design .jr-back{display:inline-flex;align-items:center;gap:5px;background:transparent;border:0;border-radius:5px;padding:4px 0;color:var(--jr-muted);font-size:12px}\r
    #job-records-design .jr-back svg{width:14px;height:14px}\r
    #job-records-design .jr-detail-card{border:1px solid var(--jr-line);background:var(--jr-card);border-radius:13px;padding:15px}\r
    #job-records-design .jr-detail-heading{margin-bottom:16px}\r
    #job-records-design .jr-detail-company{font-size:19px;font-weight:500;line-height:1.3;letter-spacing:-.4px;margin:0 0 5px;overflow-wrap:anywhere}\r
    #job-records-design .jr-detail-role{font-size:13px;margin:0 0 13px;color:var(--jr-muted)}\r
    #job-records-design .jr-detail-status{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}\r
    #job-records-design .jr-detail-subnav{display:flex;gap:4px;border-bottom:1px solid var(--jr-line);margin:16px -15px 15px;padding:0 15px}\r
    #job-records-design .jr-detail-tab{border:0;border-bottom:2px solid transparent;background:transparent;padding:9px 8px;color:var(--jr-muted);font-size:12px}\r
    #job-records-design .jr-detail-tab[aria-selected=true]{color:var(--jr-accent);border-bottom-color:var(--jr-accent)}\r
    #job-records-design .jr-fields{display:grid;gap:0}\r
    #job-records-design .jr-field{display:grid;grid-template-columns:105px minmax(0,1fr);gap:10px;padding:10px 0;border-bottom:1px solid var(--jr-line);font-size:12px}\r
    #job-records-design .jr-field:last-child{border-bottom:0}\r
    #job-records-design .jr-field>span:first-child{color:var(--jr-muted)}\r
    #job-records-design .jr-field>span:last-child{overflow-wrap:anywhere}\r
    #job-records-design .jr-note{font-size:12px;color:var(--jr-muted);margin:12px 0 0;padding:11px;border-radius:8px;background:var(--jr-raised);white-space:pre-wrap;overflow-wrap:anywhere}\r
    #job-records-design .jr-detail-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}\r
    #job-records-design .jr-button{border:1px solid var(--jr-line);background:var(--jr-raised);border-radius:8px;padding:8px 11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12px;min-height:35px}\r
    #job-records-design .jr-button svg{width:14px;height:14px}\r
    #job-records-design .jr-button.primary{background:var(--jr-accent);color:#ffffff;border-color:transparent}\r
    #job-records-design .jr-button.danger{color:var(--jr-red);background:var(--jr-red-bg);border-color:transparent}\r
    #job-records-design .jr-section-label{font-size:11px;letter-spacing:.7px;text-transform:uppercase;color:var(--jr-muted);font-weight:500;margin:19px 0 7px}\r
    #job-records-design .jr-timeline{display:grid;gap:0}\r
    #job-records-design .jr-timeline-item{display:grid;grid-template-columns:11px minmax(0,1fr);gap:8px;padding:9px 0}\r
    #job-records-design .jr-history-dot{width:5px;height:5px;margin-top:6px;border-radius:50%;background:var(--jr-accent)}\r
    #job-records-design .jr-timeline-item p{font-size:12px;margin:0;color:var(--jr-text)}\r
    #job-records-design .jr-timeline-item time{display:block;font-size:11px;color:var(--jr-muted);margin-top:3px}\r
    #job-records-design .jr-edit-form{display:grid;gap:13px}\r
    #job-records-design .jr-label{display:block;font-size:12px;color:var(--jr-muted);margin-bottom:6px}\r
    #job-records-design .jr-select,#job-records-design .jr-textarea{display:block;width:100%;min-width:0;border:1px solid var(--jr-line);border-radius:8px;background:var(--jr-bg);color:var(--jr-text);padding:9px 10px}\r
    #job-records-design .jr-textarea{resize:vertical;font-size:12px;line-height:1.6}\r
    #job-records-design .jr-locked-status{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--jr-muted)}\r
    #job-records-design .jr-locked-status svg{width:14px;height:14px}\r
    #job-records-design .jr-preview-kind{font-size:12px;color:var(--jr-muted);display:flex;align-items:center;gap:6px;margin-bottom:10px}\r
    #job-records-design .jr-preview-kind svg{width:14px;height:14px}\r
    #job-records-design .jr-preview-document{background:#fff;color:#243b45;padding:24px 21px;border-radius:4px;font-family:Georgia,"Times New Roman",serif;min-height:245px;overflow-wrap:anywhere}\r
    #job-records-design .jr-preview-document h3{font-size:19px;font-weight:500;text-align:center;margin:0 0 5px;line-height:1.3}\r
    #job-records-design .jr-preview-document .jr-doc-role{text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5b707b;margin:0 0 19px}\r
    #job-records-design .jr-preview-document h4{font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:500;letter-spacing:.8px;text-transform:uppercase;margin:18px 0 8px;border-bottom:1px solid #d6e0e4;padding-bottom:5px}\r
    #job-records-design .jr-preview-document p{font-size:12px;line-height:1.7;margin:0}\r
    #job-records-design .jr-job-preview{background:var(--jr-bg);border:1px solid var(--jr-line);border-radius:9px;padding:15px;font-size:12px;line-height:1.7;color:var(--jr-muted);white-space:pre-wrap}\r
    #job-records-design .jr-chat-panel{display:grid;gap:12px}\r
    #job-records-design .jr-chat-context{padding:12px;background:var(--jr-raised);border-radius:8px;font-size:12px;color:var(--jr-muted);white-space:pre-wrap;line-height:1.65}\r
    #job-records-design .jr-alert{background:var(--jr-red-bg);border-radius:8px;padding:11px;color:var(--jr-red);font-size:12px;line-height:1.6}\r
    #job-records-design .jr-feedback{margin-top:11px;padding:10px 12px;border-radius:9px;background:var(--jr-raised);border:1px solid var(--jr-line);color:var(--jr-muted);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:10px}\r
    #job-records-design .jr-feedback>span{overflow-wrap:anywhere}\r
    #job-records-design .jr-undo{border:0;background:transparent;color:var(--jr-accent);padding:3px 0;font-size:12px;flex-shrink:0}\r
    @media(max-width:380px){#job-records-design{padding:12px 4px}#job-records-design .jr-header{padding:14px 13px}#job-records-design .jr-body{padding:0 10px 12px}#job-records-design .jr-tabs{margin-left:11px;margin-right:11px}#job-records-design .jr-record{padding:13px 11px 9px}#job-records-design .jr-record-head{gap:8px;grid-template-columns:minmax(0,1fr) minmax(105px,auto)}#job-records-design .jr-stamp,#job-records-design .jr-updated{max-width:119px}#job-records-design .jr-company h3{font-size:14px}#job-records-design .jr-company p{font-size:12px}#job-records-design .jr-field{grid-template-columns:87px minmax(0,1fr)}}\r
    @media(hover:none),(pointer:coarse){#job-records-design .jr-action-rail{opacity:1;pointer-events:auto;transform:none}#job-records-design .jr-icon{width:44px;height:44px}#job-records-design .jr-view,#job-records-design .jr-button,#job-records-design .jr-back,#job-records-design .jr-tab,#job-records-design .jr-detail-tab,#job-records-design .jr-undo{min-height:44px}#job-records-design .jr-record-actions{flex-wrap:wrap;gap:4px}#job-records-design .jr-action-rail{margin-left:auto}#job-records-design .jr-textarea,#job-records-design .jr-select{font-size:16px}}\r
    @media(prefers-reduced-motion:reduce){#job-records-design .jr-record,#job-records-design .jr-action-rail{transition:none;transform:none}}\r
  

[data-theme="dark"] #job-records-design { --jr-bg:#151d21;--jr-card:#192227;--jr-raised:#223037;--jr-hover:#1c292f;--jr-text:#eff4f7;--jr-muted:#9aafba;--jr-line:#304149;--jr-accent:#82d7d5;--jr-accent-bg:#203a3e;--jr-blue:#a9c9fb;--jr-blue-bg:#27384b;--jr-purple:#d1b5f2;--jr-purple-bg:#3b2f4a;--jr-green:#91dfbc;--jr-green-bg:#223c32;--jr-red:#f4a3a7;--jr-red-bg:#462d32;--jr-amber:#e7c58b;--jr-amber-bg:#3b3325;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1.45;color:var(--jr-text);padding:16px 10px }
/* Adapt the imported dock layout to the existing dock palette and shared theme. */
#at-reference-dock #job-records-design { --jr-bg:var(--rd-bg); --jr-card:var(--rd-panel); --jr-raised:var(--color-button-fill); --jr-hover:var(--color-button-hover); --jr-text:var(--rd-text); --jr-muted:var(--rd-muted); --jr-line:var(--rd-line); --jr-accent:var(--rd-purple); --jr-accent-bg:var(--color-accent-soft); padding:0; }
#at-reference-dock .rd-dock:has(#job-records-design:not([hidden])) { max-width:430px; }
#job-records-design .jr-window { max-width:none; margin:0; border:0; border-radius:0; }
#job-records-design .jr-body { margin:0; padding:0; border:0; }
#job-records-design .jr-tabs { margin:0; border:0; }
#job-records-design :is(.jr-record,.jr-detail-card) { margin:0; border:0; }
#job-records-design .jr-header h2 { font-size:14px; }
#job-records-design .jr-detail-title { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
#job-records-design .jr-detail-title .jr-detail-company { flex:1; min-width:0; }
#job-records-design .jr-detail-title #jr-detail-status { flex-shrink:0; }
#job-records-design .jr-detail-heading { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 12px; align-items:start; }
#job-records-design .jr-detail-heading>.jr-detail-role { grid-column:1; margin:0; }
#job-records-design .jr-detail-meta { grid-column:2; grid-row:1 / 3; display:flex; flex-direction:column; align-items:flex-end; gap:4px; max-width:160px; text-align:right; overflow-wrap:anywhere; font-size:11px; color:var(--jr-muted); }
#job-records-design .jr-edit-form :disabled { opacity:1; color:var(--jr-muted); cursor:default; }
#job-records-design .jr-detail-navigation { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin:0; border:0; }
#job-records-design .jr-detail-navigation .jr-detail-subnav { flex:1 1 auto; margin:0; padding:0; border:0; }
#job-records-design .jr-detail-navigation.jr-editing { position:sticky; top:0; z-index:5; background:var(--jr-card); padding-top:8px; box-shadow:0 5px 8px -7px #0006; }
#job-records-design #jr-edit-slot { margin-left:auto; padding-bottom:4px; }
#job-records-design #jr-edit-slot .jr-button { width:122px; min-height:36px; padding:7px 10px; font-size:11px; }
#job-records-design .jr-document-fields { display:grid; gap:12px; }
#job-records-design .jr-cover-letter-control { display:flex; align-items:center; gap:7px; font-size:12px; }
#job-records-design .jr-required { margin-left:4px; color:var(--color-danger-ink); }
#job-records-design #jr-detail-actions { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,135px),1fr)); align-items:stretch; gap:8px; }
#job-records-design #jr-detail-actions .jr-button,#job-records-design .jr-edit-form .jr-button { min-width:0; min-height:40px; padding:8px 10px; line-height:1.4; white-space:normal; overflow-wrap:anywhere; }
#job-records-design #jr-detail-actions .jr-button svg { flex-shrink:0; }
#job-records-design .jr-edit-form .jr-detail-actions { display:flex; flex-wrap:wrap; gap:8px; }
#job-records-design .jr-edit-form .jr-detail-actions>.jr-button { flex:1 1 120px; }
#job-records-design .jr-detail-card { container-type:inline-size; }
@container (max-width:270px) {
  #job-records-design .jr-detail-heading { grid-template-columns:minmax(0,1fr); }
  #job-records-design .jr-detail-meta { grid-column:1; grid-row:auto; max-width:none; align-items:flex-start; text-align:left; }
}
#job-records-design .jr-detail-meta .jr-updated { max-width:none; }
#job-records-design .jr-detail-meta .jr-detail-role { margin:0; min-width:0; overflow-wrap:anywhere; }
#job-records-design .jr-description-copy { margin:10px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; line-height:1.7; }
#job-records-design .jr-source-link { display:inline-flex; align-items:center; gap:5px; margin:0 0 5px; color:var(--jr-accent); font-size:12px; overflow-wrap:anywhere; }
#job-records-design .jr-source-link svg { width:13px; height:13px; flex-shrink:0; }
#job-records-design .jr-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:0 13px 13px; }
#job-records-design .jr-toolbar>.jr-icon { margin-left:auto; }
#job-records-design .jr-add-form { display:grid; gap:12px; padding:var(--dock-gutter,13px); margin:0; background:var(--jr-card); border:0; border-radius:12px; }
#job-records-design .jr-add-form input { display:block; width:100%; min-width:0; padding:8px 10px; border:1px solid var(--jr-line); border-radius:8px; background:var(--jr-bg); color:var(--jr-text); }
#job-records-design .jr-select option { color:var(--jr-text); background:var(--jr-bg); }
#job-records-design .jr-feedback[data-error=true] { color:var(--color-danger-ink); background:var(--color-danger-fill); border-color:var(--color-danger-border); }
#job-records-design .jr-unsaved { color:var(--jr-accent); font-size:11px; margin:6px 0; }
#job-records-design .jr-candidate-note { padding:0 14px 12px; margin:0; color:var(--jr-muted); font-size:11px; }
#job-records-design .jr-preview-document { max-width:100%; }
#job-records-design .jr-preview-document :is(p,li) { white-space:pre-wrap; }
#job-records-design .jr-preview-document ul { padding-left:17px; font-size:12px; }
#job-records-design .jr-saved-resume { margin-top:10px; }
#job-records-design [aria-busy=true] { cursor:wait; }
#job-records-design .jr-action-rail { flex-wrap:wrap; }
#job-records-design .jr-sample { font-size:10px; color:var(--jr-muted); }
#job-records-design .jr-queue-list { gap:8px; }
#job-records-design .jr-queue-record { padding:10px var(--dock-gutter,13px); border-radius:10px; }
#job-records-design .jr-queue-record .jr-record-head { grid-template-columns:minmax(0,1fr) auto; gap:8px; }
#job-records-design .jr-queue-record .jr-company h3 { font-size:15px; line-height:1.3; margin:0 0 4px; }
#job-records-design .jr-queue-record .jr-company p { font-size:13px; line-height:1.35; }
#job-records-design .jr-queue-record .jr-company .jr-card-salary { margin-top:7px; font-size:12px; color:var(--jr-muted); }
#job-records-design .jr-card-main { cursor:pointer; border-radius:6px; }
#job-records-design .jr-card-main:focus-visible { outline:2px solid var(--jr-accent); outline-offset:4px; }
#job-records-design .jr-card-main:hover .jr-company h3 { color:var(--jr-accent); }
#job-records-design .jr-queue-record .jr-stamp { gap:4px; max-width:132px; }
#job-records-design .jr-queue-status { display:flex; align-items:center; justify-content:flex-end; gap:5px; flex-wrap:wrap; }
#job-records-design .jr-queue-record .jr-status { padding:3px 6px; }
#job-records-design .jr-queue-record .jr-updated { font-size:10px; line-height:1.3; }
#job-records-design .jr-queue-record .jr-record-actions { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:stretch; gap:6px; margin-top:12px; }
#job-records-design .jr-queue-record .jr-record-actions .jr-button { display:flex; flex-direction:column; justify-content:center; min-width:0; min-height:42px; padding:4px 2px; font-size:10px; gap:3px; }
#job-records-design .jr-queue-record .jr-record-actions .jr-icon { width:29px; height:29px; }
#job-records-design .jr-queue-record .jr-record-actions .jr-button { white-space:nowrap; }
#job-records-design .jr-queue-record .jr-record-actions svg { flex-shrink:0; width:13px; height:13px; }
#job-records-design .jr-button.primary { background:var(--color-accent-solid); color:var(--color-on-accent); }
#job-records-design :is(input,textarea)::placeholder { color:var(--jr-muted); opacity:1; }

/* Resume Studio CV and letter controls. */










































































#job-records-design .jr-cv-modal .visually-hidden{position: absolute; width: 1px; height: 1px; padding: 0px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;}





















































#job-records-design .jr-cv-modal .letter-switch:focus-visible{outline-offset: 2px; outline-color: var(--color-accent); outline-style: var(--color-accent); outline-width: var(--color-accent);}
#job-records-design .jr-cv-modal .letter-switch:disabled{opacity: 1; color: var(--color-disabled-ink); background: var(--color-disabled-fill); border-color: var(--color-disabled-border); box-shadow: none;}











#job-records-design .jr-cv-modal .workspace-card{min-width: 0; border: 1px solid; background: #fff; border-radius: var(--radius-panel); padding: 1rem; box-shadow: var(--shadow-panel); border-width: var(--color-line); border-style: var(--color-line); border-color: var(--color-line);}
#job-records-design .jr-cv-modal .workspace-card h3{font-size: 0.9rem; font-weight: 650; line-height: 1.4; margin: 0px; letter-spacing: -0.02em;}
#job-records-design .jr-cv-modal .section-heading{display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .6rem; margin-bottom: 0.75rem;}

#job-records-design .jr-cv-modal .workspace-card label{display: block; font-size: 0.75rem; color: #48536a; margin-bottom: 0.35rem;}
#job-records-design .jr-cv-modal .workspace-card textarea{display: block; width: 100%; min-width: 0; max-width: 100%; padding: 0.65rem; margin: 0px 0px 0.75rem; border: 1px solid #d9dfeb; border-radius: var(--radius-control); color: var(--color-ink); background: #fafbfe; font-size: 0.8rem; line-height: 1.55; resize: vertical; white-space: pre-wrap; overflow-wrap: anywhere;}
#job-records-design .jr-cv-modal .workspace-card textarea::placeholder{color: #69748b;}
#job-records-design .jr-cv-modal .json-editor{font-family: "Cascadia Code", SFMono-Regular, Consolas, monospace;}



#job-records-design .jr-cv-modal .letter-switch{display: inline-flex; align-items: center; gap: .5rem; border: 1px solid; border-radius: var(--radius-control); background: var(--color-button-fill); font-size: 0.75rem; color: var(--color-ink); padding: 0.2rem 0.3rem; border-width: var(--color-button-border); border-style: var(--color-button-border); border-color: var(--color-button-border);}
#job-records-design .jr-cv-modal .letter-switch:hover:enabled{background: var(--color-button-hover); border-color: var(--color-accent);}
#job-records-design .jr-cv-modal .letter-switch:active:enabled{background: var(--color-button-pressed);}
#job-records-design .jr-cv-modal .letter-switch span{position: relative; width: 1.9rem; height: 1.05rem; background: #ccd3df; border-radius: 1rem;}
#job-records-design .jr-cv-modal .letter-switch span:after{content: ""; position: absolute; left: 0.15rem; top: 0.15rem; width: 0.75rem; height: 0.75rem; background: #fff; border-radius: 50%;}

















































#job-records-design .jr-cv-modal .letter-switch[aria-checked=true] span{background: var(--color-accent);}
#job-records-design .jr-cv-modal .letter-switch[aria-checked=true] span:after{transform: translate(.85rem);}
@media (min-width: 761px){}
@media (max-width: 380px){

}
@media (max-width: 380px){




#job-records-design .jr-cv-modal .workspace-card{padding: 0.8rem;}


}
@media (min-width: 761px){


#job-records-design .jr-cv-modal .workspace-card{padding: 1.25rem;}}

































#job-records-design .jr-cv-modal .editor-card{display: flex; flex-direction: column; min-height: 0; padding: 0.55rem 0.65rem; border-radius: 0.55rem;}
#job-records-design .jr-cv-modal .editor-card .section-heading{flex-wrap: nowrap; gap: .45rem; margin: 0px 0px 0.45rem; min-height: 1.7rem; flex-grow: 0; flex-shrink: 0; flex-basis: auto;}
#job-records-design .jr-cv-modal .cv-card>.section-heading{padding-bottom: 0.25rem; border-bottom-width: var(--color-line); border-bottom-style: var(--color-line); border-bottom-color: var(--color-line);}
#job-records-design .jr-cv-modal .editor-card h3{font-size: 0.78rem;}
#job-records-design .jr-cv-modal .editor-card .button{font-size: 0.68rem; min-height: 1.65rem; padding: 0.3rem 0.5rem;}
#job-records-design .jr-cv-modal .editor-card>textarea{min-height: 0; height: 0px; resize: none; overflow: auto; margin: 0px; padding: 0.6rem; font-size: 0.75rem; flex-grow: 1; flex-shrink: 1; flex-basis: 0%;}
#job-records-design .jr-cv-modal .editor-card .field-hint{max-height: 3.5rem; overflow: auto; margin: 0.15rem 0px 0px; font-size: 0.68rem; flex-grow: 0; flex-shrink: 0; flex-basis: auto;}
#job-records-design .jr-cv-modal .editor-card .field-hint p{margin: 0px;}
#job-records-design .jr-cv-modal .editor-card .cv-validation{max-height: 2.4rem; overflow: auto; margin: 0.15rem 0px 0px; font-size: 0.65rem; line-height: 1.3; flex-grow: 0; flex-shrink: 0; flex-basis: auto;}
#job-records-design .jr-cv-modal .editor-card .cv-validation:is(.valid,.empty){max-height: 1rem;}
#job-records-design .jr-cv-modal .editor-card>.candidate-error{max-height: 3rem; overflow: auto; padding: 0.2rem; margin: 0.15rem 0px 0px;}
#job-records-design .jr-cv-modal .letter-off .letter-card .section-heading{margin: 0px;}



















@media (min-width: 761px){}
@media (max-width: 300px){
#job-records-design .jr-cv-modal .editor-card h3{font-size: 0.72rem;}}


























#job-records-design .jr-cv-modal .workspace-card textarea[aria-invalid=true]{border-color: #dc2626; background: snow; box-shadow: inset 0 0 0 1px #dc262620;}



#job-records-design .jr-cv-modal .export-folder{position: relative; min-width: 0;}
#job-records-design .jr-cv-modal .export-folder input{display: block; width: 100%; min-width: 0; height: 2rem; border: 1px solid #cbd5e1; border-radius: 0.4rem; padding: 0.3rem 2.25rem 0.3rem 0.55rem; background: #fff; color: #334155; font-size: 0.75rem; font-style: inherit; font-variant: inherit; font-weight: inherit; font-stretch: inherit; line-height: inherit; font-family: inherit;}
#job-records-design .jr-cv-modal .export-folder input:focus-visible{outline-offset: 1px; outline-color: #3b82f6; outline-style: solid; outline-width: 2px;}
#job-records-design .jr-cv-modal .export-folder input[aria-invalid=true]{border-color: #dc2626;}
#job-records-design .jr-cv-modal .folder-picker{position: absolute; right: 0.15rem; top: 0.15rem; display: grid; place-items: center; width: 1.7rem; height: 1.7rem; padding: 0.25rem; border: 1px solid; border-radius: 0.3rem; background: var(--color-button-fill); color: var(--color-ink); cursor: pointer; border-width: var(--color-button-border); border-style: var(--color-button-border); border-color: var(--color-button-border);}
#job-records-design .jr-cv-modal .folder-picker svg{width: 1.1rem; height: 1.1rem;}
#job-records-design .jr-cv-modal .folder-picker:disabled{cursor: default;}
#job-records-design .jr-cv-modal .cv-heading-labels{display: flex; align-items: baseline; gap: .5rem; min-width: 0; flex-grow: 1; flex-shrink: 1; flex-basis: 0%;}
#job-records-design .jr-cv-modal .cv-heading-labels h3{flex-grow: 0; flex-shrink: 0; flex-basis: auto;}



#job-records-design .jr-cv-modal .cv-company{min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-muted); font-size: 0.72rem; font-weight: 500;}




































@media (max-width: 299px){
}
/* CV and letter control rules above are imported from Resume Studio's CSS. */\r
body.reference-dashboard:has(#jr-cv-dialog[open]) { overflow:hidden; }\r
#job-records-design .jr-cv-modal { --radius-control:6px; --radius-panel:9px; --shadow-panel:none; position:fixed; inset:12px; width:min(430px,calc(100% - 24px)); max-width:none; max-height:calc(100dvh - 24px); height:fit-content; margin:auto; padding:0; display:flex; flex-direction:column; border:1px solid var(--color-line); border-radius:12px; color:var(--color-ink); background:var(--color-canvas); box-shadow:0 20px 70px #0006; font-family:inherit; font-size:13px; }\r
#job-records-design .jr-cv-modal:not([open]) { display:none; }\r
#job-records-design .jr-cv-modal::backdrop { background:#0008; }\r
#job-records-design .jr-cv-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:13px; border-bottom:1px solid var(--color-line); }\r
#job-records-design .jr-cv-heading h2 { margin:0; font-size:16px; line-height:1.3; }\r
#job-records-design .jr-cv-heading p { margin:4px 0 0; color:var(--color-muted); font-size:11px; overflow-wrap:anywhere; }\r
#job-records-design .jr-cv-body { min-height:0; overflow-y:auto; padding:12px; display:grid; gap:10px; }\r
#job-records-design .jr-cv-modal .editor-card { margin:0; box-shadow:none; color:var(--color-ink); background:var(--color-surface); border-color:var(--color-line); }\r
#job-records-design .jr-cv-modal .editor-card h3 { color:var(--color-ink); }\r
#job-records-design .jr-cv-modal .editor-card>textarea { flex:none; height:clamp(165px,29dvh,280px); min-height:120px; color:var(--color-ink); background:var(--color-field); border-color:var(--color-field-line); caret-color:var(--color-ink); }\r
#job-records-design .jr-cv-modal .letter-card>textarea { height:150px; }\r
#job-records-design .jr-cv-modal textarea::placeholder { color:var(--color-muted); opacity:1; }\r
#job-records-design .jr-cv-modal .editor-card textarea[aria-invalid=true] { color:var(--color-ink); background:var(--color-field); border-color:var(--color-danger-border); box-shadow:inset 0 0 0 1px var(--color-danger-border); }\r
#job-records-design .jr-cv-modal .cv-company { color:var(--color-muted); }\r
#job-records-design .jr-cv-letter-actions { display:flex; align-items:center; gap:5px; }\r
#job-records-design .jr-cv-json-actions { display:flex; align-items:center; gap:5px; flex-shrink:0; }\r
#job-records-design .jr-cv-modal .cv-card .section-heading { flex-wrap:wrap; }\r
#job-records-design .jr-cv-json-actions { margin-left:auto; flex-wrap:wrap; justify-content:flex-end; max-width:100%; }\r
#job-records-design .jr-cv-modal .jr-copy-prompt { min-height:29px; padding:4px 7px; font-size:10px; }\r
#job-records-design .jr-prompt-comment { margin:0; font-size:11px; line-height:1.5; color:var(--color-muted); }\r
#job-records-design .jr-cv-modal [data-cv-action^="import-"] { display:inline-flex; width:auto; gap:5px; padding:4px 6px; font-size:10px; white-space:nowrap; }\r
#job-records-design .jr-cv-modal .letter-switch { flex-shrink:0; color:var(--color-ink); background:var(--color-button-fill); border-color:var(--color-button-border); }\r
#job-records-design .jr-cv-modal .letter-switch span { background:var(--color-muted); }\r
#job-records-design .jr-cv-modal .letter-switch[aria-checked=true] span { background:var(--color-accent-solid); }\r
#job-records-design .jr-cv-modal .letter-switch span:after { background:var(--color-on-accent); }\r
#job-records-design .jr-cv-modal .letter-switch b { font-weight:400; }\r
#job-records-design .jr-cv-status { display:flex; align-items:flex-start; gap:7px; padding:9px; font-size:11px; line-height:1.45; border:1px solid var(--color-line); border-radius:7px; background:var(--color-surface); overflow-wrap:anywhere; }\r
#job-records-design .jr-cv-status-light { flex-shrink:0; width:6px; height:6px; margin-top:4px; border-radius:50%; background:var(--color-muted); }\r
#job-records-design .jr-cv-status[data-state=valid] .jr-cv-status-light { background:var(--color-success-ink,var(--rd-green)); }\r
#job-records-design .jr-cv-status[data-state=checking] .jr-cv-status-light { background:var(--color-accent); }\r
#job-records-design .jr-cv-status[data-state=error] { color:var(--color-danger-ink); background:var(--color-danger-fill); border-color:var(--color-danger-border); }\r
#job-records-design .jr-cv-status[data-state=error] .jr-cv-status-light { background:var(--color-danger-ink); }\r
#job-records-design .jr-cv-folder label { display:block; margin-bottom:5px; color:var(--color-muted); font-size:11px; }\r
#job-records-design .jr-cv-modal .export-folder input { color:var(--color-ink); background:var(--color-field); border-color:var(--color-field-line); }\r
#job-records-design .jr-cv-modal .folder-picker { position:absolute; inset:1px 1px 1px auto; width:32px; height:auto; border:0; background:transparent; }\r
#job-records-design .jr-cv-export { padding:9px; border:1px solid var(--color-line); border-radius:7px; background:var(--color-surface); font-size:11px; overflow-wrap:anywhere; }\r
#job-records-design .jr-cv-export p { margin:0 0 5px; }\r
#job-records-design .jr-cv-footer { display:flex; justify-content:flex-end; gap:7px; padding:11px 12px; border-top:1px solid var(--color-line); }\r
#job-records-design .jr-cv-footer .jr-button { min-width:0; }\r
#job-records-design .jr-cv-footer [data-cv-action=cancel] { margin-right:auto; }\r
#job-records-design .jr-cv-modal :is(button,textarea):focus-visible { outline:2px solid var(--color-accent); outline-offset:2px; }\r
#job-records-design .jr-queue-tools { display:flex; align-items:center; flex-wrap:wrap; gap:5px 10px; margin-top:5px; }\r
#job-records-design .jr-queue-tools .jr-view { font-size:11px; padding:2px 0; }\r
#job-records-design .jr-queue-tools .jr-icon { width:25px; height:25px; margin-left:auto; }\r
#job-records-design .jr-queue-tools .jr-icon svg { width:13px; height:13px; }\r
`;

  // extension/apply-dock.css
  var apply_dock_default = '\r\n    #at-reference-dock #apply-ready-queue-design{--aj-bg:var(--rd-bg);--aj-card:var(--rd-panel);--aj-soft:var(--rd-soft);--aj-line:var(--rd-line);--aj-text:var(--rd-text);--aj-muted:var(--rd-muted);--aj-brand:var(--rd-purple);--aj-brand-text:var(--color-on-accent);--aj-brand-soft:var(--rd-accent-soft);--aj-purple:var(--rd-purple);--aj-purple-soft:var(--rd-accent-soft);--aj-good:var(--rd-green);--aj-good-soft:var(--rd-good-soft);--aj-warn:var(--rd-orange);--aj-warn-soft:var(--rd-warn-soft);--aj-red:var(--color-danger-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1.5;color:var(--aj-text);padding:16px 10px}\r\n    #at-reference-dock #apply-ready-queue-design *{box-sizing:border-box}\r\n    #at-reference-dock #apply-ready-queue-design [hidden]{display:none!important}\r\n    #at-reference-dock #apply-ready-queue-design button,#at-reference-dock #apply-ready-queue-design input,#at-reference-dock #apply-ready-queue-design select,#at-reference-dock #apply-ready-queue-design textarea{font:inherit}\r\n    #at-reference-dock #apply-ready-queue-design button{color:inherit;font-weight:500}\r\n    #at-reference-dock #apply-ready-queue-design button:disabled{opacity:.4;cursor:not-allowed}\r\n    #at-reference-dock #apply-ready-queue-design button:focus-visible,#at-reference-dock #apply-ready-queue-design input:focus-visible,#at-reference-dock #apply-ready-queue-design textarea:focus-visible,#at-reference-dock #apply-ready-queue-design select:focus-visible{outline:2px solid var(--aj-brand);outline-offset:3px}\r\n    #at-reference-dock #apply-ready-queue-design h2,#at-reference-dock #apply-ready-queue-design h3,#at-reference-dock #apply-ready-queue-design p{margin:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-window{max-width:430px;width:100%;margin:0 auto;background:var(--aj-bg);border:1px solid var(--aj-line);border-radius:16px;overflow:clip}\r\n    #at-reference-dock #apply-ready-queue-design .aj-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 17px 13px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-header h2{font-size:18px;font-weight:500;letter-spacing:-.5px;line-height:1.3}\r\n    #at-reference-dock #apply-ready-queue-design .aj-small{font-size:11px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:4px 7px;background:var(--aj-soft);color:var(--aj-muted);border-radius:6px;white-space:nowrap}\r\n    #at-reference-dock #apply-ready-queue-design .aj-badge.good{background:var(--aj-good-soft);color:var(--aj-good)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-badge.ai{background:var(--aj-purple-soft);color:var(--aj-purple)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-badge.warn{background:var(--aj-warn-soft);color:var(--aj-warn)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-badge svg{width:12px;height:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-steps{display:flex;gap:4px;padding:4px;margin:0 14px 16px;background:var(--aj-soft);border-radius:9px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-step{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:6px;background:transparent;color:var(--aj-muted);padding:8px 5px;font-size:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-step>span{display:grid;place-items:center;height:17px;width:17px;font-size:11px;border-radius:50%;background:var(--aj-bg);color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-step[aria-current=step]{background:var(--aj-card);color:var(--aj-text)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-step[aria-current=step]>span{background:var(--aj-brand);color:var(--aj-brand-text)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-body{padding:0 14px 15px;display:grid;gap:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-stack{display:grid;gap:12px;min-width:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-card{border:1px solid var(--aj-line);background:var(--aj-card);border-radius:12px;padding:14px;min-width:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\r\n    #at-reference-dock #apply-ready-queue-design .aj-between{justify-content:space-between}\r\n    #at-reference-dock #apply-ready-queue-design .aj-section-title{font-size:12px;font-weight:500;display:flex;align-items:center;gap:7px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-section-title>svg{width:15px;height:15px;color:var(--aj-brand)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-fields{display:grid;gap:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-label{display:block;font-size:12px;color:var(--aj-muted);margin-bottom:5px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-input,#at-reference-dock #apply-ready-queue-design .aj-select,#at-reference-dock #apply-ready-queue-design .aj-textarea{display:block;min-width:0;width:100%;padding:9px 10px;border:1px solid var(--aj-line);border-radius:8px;background:var(--aj-bg);color:var(--aj-text)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-textarea{resize:vertical;font-size:12px;line-height:1.65}\r\n    #at-reference-dock #apply-ready-queue-design .aj-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--aj-line);border-radius:8px;background:var(--aj-soft);padding:8px 11px;min-height:35px;font-size:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-button>svg{width:15px;height:15px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-primary{background:var(--aj-brand);color:var(--aj-brand-text);border-color:transparent}\r\n    #at-reference-dock #apply-ready-queue-design .aj-quiet{background:transparent;border-color:transparent;padding:4px 0;min-height:25px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-wide{width:100%}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle-label{display:flex;justify-content:space-between;align-items:center;gap:13px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle-copy{display:grid;gap:3px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle-copy strong{font-size:13px;font-weight:500}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle-copy>span{font-size:11px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle{appearance:none;width:34px;height:20px;min-width:34px;border:0;border-radius:20px;background:var(--aj-line);position:relative;margin:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle:before{content:"";position:absolute;width:14px;height:14px;left:3px;top:3px;border-radius:50%;background:var(--aj-card);transition:transform .15s}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle:checked{background:var(--aj-brand)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-toggle:checked:before{transform:translateX(14px);background:var(--aj-brand-text)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-rule{height:1px;background:var(--aj-line);margin:13px 0}\r\n    #at-reference-dock #apply-ready-queue-design details>summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design details>summary::-webkit-details-marker{display:none}\r\n    #at-reference-dock #apply-ready-queue-design details>summary svg{height:14px;width:14px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-job-description{margin-top:10px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-document{display:flex;align-items:center;gap:9px;min-width:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-document-icon{height:39px;width:32px;display:grid;place-items:center;border-radius:7px;flex-shrink:0;background:var(--aj-purple-soft);color:var(--aj-purple)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-document-icon svg{height:17px;width:17px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-document-copy{display:grid;gap:3px;min-width:0;flex:1}\r\n    #at-reference-dock #apply-ready-queue-design .aj-filename{font-size:12px;font-weight:500;overflow-wrap:anywhere}\r\n    #at-reference-dock #apply-ready-queue-design .aj-upload{border-top:1px solid var(--aj-line);padding-top:13px;margin-top:13px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-upload-box{display:grid;justify-items:center;gap:6px;border:1px dashed var(--aj-line);border-radius:9px;padding:16px 12px;background:var(--aj-bg);text-align:center}\r\n    #at-reference-dock #apply-ready-queue-design .aj-upload-box>svg{width:23px;height:23px;color:var(--aj-purple)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-upload-box>strong{font-weight:500;font-size:12px;overflow-wrap:anywhere}\r\n    #at-reference-dock #apply-ready-queue-design .aj-file{font-size:11px;max-width:100%;margin-top:7px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-import-review{display:grid;gap:8px;background:var(--aj-bg);border-radius:8px;padding:12px;margin-top:10px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-import-line{display:flex;gap:7px;align-items:center;font-size:12px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-import-line svg{width:13px;height:13px;color:var(--aj-good);flex-shrink:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-option-list{display:grid;gap:11px;margin-top:14px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-check input{accent-color:var(--aj-brand);margin:0;width:15px;height:15px;flex-shrink:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-context{background:var(--aj-card);border:1px solid var(--aj-line);border-radius:11px;padding:12px 13px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-context h3{font-size:15px;font-weight:500;line-height:1.35;overflow-wrap:anywhere;margin-bottom:4px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-progress{height:5px;border-radius:5px;background:var(--aj-line);overflow:hidden;margin:12px 0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-progress>span{display:block;height:100%;background:var(--aj-brand);transition:width .2s}\r\n    #at-reference-dock #apply-ready-queue-design .aj-status-rows{display:grid;gap:12px;margin-top:13px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-status-row{display:flex;align-items:center;justify-content:space-between;gap:9px;font-size:12px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-status-row>span:first-child{display:flex;align-items:center;gap:7px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-status-row svg{height:14px;width:14px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-run-title{font-size:15px;font-weight:500;line-height:1.35}\r\n    #at-reference-dock #apply-ready-queue-design .aj-run-description{font-size:12px;color:var(--aj-muted);margin-top:5px!important}\r\n    #at-reference-dock #apply-ready-queue-design .aj-state-good{color:var(--aj-good)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-question-navigation{display:flex;gap:6px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-question-nav{width:29px;height:29px;display:grid;place-items:center;padding:0;background:var(--aj-soft);border:1px solid var(--aj-line);border-radius:7px;font-size:11px;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-question-nav[aria-pressed=true]{background:var(--aj-brand-soft);color:var(--aj-brand)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-question-nav.done{color:var(--aj-good)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-question-title{font-size:14px;font-weight:500;line-height:1.5;margin:12px 0!important}\r\n    #at-reference-dock #apply-ready-queue-design .aj-question-hint{font-size:11px;color:var(--aj-muted);margin-top:8px!important}\r\n    #at-reference-dock #apply-ready-queue-design .aj-question-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-review-grid{display:grid;gap:0;margin-top:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-review-row{display:grid;grid-template-columns:91px minmax(0,1fr);gap:9px;padding:9px 0;border-bottom:1px solid var(--aj-line);font-size:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-review-row:last-child{border-bottom:0}\r\n    #at-reference-dock #apply-ready-queue-design .aj-review-row>span:first-child{color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-review-row>span:last-child{overflow-wrap:anywhere}\r\n    #at-reference-dock #apply-ready-queue-design .aj-success{padding:15px;background:var(--aj-good-soft);border-radius:10px;color:var(--aj-good);display:grid;gap:5px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-success h3{font-size:15px;font-weight:500}\r\n    #at-reference-dock #apply-ready-queue-design .aj-success p{font-size:12px}\r\n    #at-reference-dock #apply-ready-queue-design .aj-preview{padding:12px;background:var(--aj-bg);border:1px solid var(--aj-line);border-radius:9px;margin-top:12px;font-size:12px;line-height:1.7;color:var(--aj-muted)}\r\n    #at-reference-dock #apply-ready-queue-design .aj-feedback{border-radius:8px;background:var(--aj-soft);border:1px solid var(--aj-line);padding:10px 12px;font-size:12px;color:var(--aj-muted);overflow-wrap:anywhere}\r\n    #at-reference-dock #apply-ready-queue-design .aj-feedback.error{color:var(--aj-red)}\r\n    @media(max-width:370px){#at-reference-dock #apply-ready-queue-design{padding:12px 4px}#at-reference-dock #apply-ready-queue-design .aj-header{padding:14px 13px 12px}#at-reference-dock #apply-ready-queue-design .aj-body{padding-left:11px;padding-right:11px}#at-reference-dock #apply-ready-queue-design .aj-card{padding:12px}#at-reference-dock #apply-ready-queue-design .aj-steps{margin-left:11px;margin-right:11px}#at-reference-dock #apply-ready-queue-design .aj-button{font-size:12px;padding:8px 10px}}\r\n    @media(pointer:coarse){#at-reference-dock #apply-ready-queue-design .aj-button,#at-reference-dock #apply-ready-queue-design .aj-step,#at-reference-dock #apply-ready-queue-design .aj-question-nav{min-height:44px}#at-reference-dock #apply-ready-queue-design .aj-question-nav{width:44px}#at-reference-dock #apply-ready-queue-design .aj-input,#at-reference-dock #apply-ready-queue-design .aj-select,#at-reference-dock #apply-ready-queue-design .aj-textarea{font-size:16px}#at-reference-dock #apply-ready-queue-design .aj-toggle-label,#at-reference-dock #apply-ready-queue-design .aj-check{min-height:44px}}\r\n    @media(prefers-reduced-motion:reduce){#at-reference-dock #apply-ready-queue-design *{transition:none!important}}\r\n  \n#at-reference-dock #apply-ready-queue-design .aj-prepared-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-head h3{font-size:17px;font-weight:500;line-height:1.35;letter-spacing:-.3px;overflow-wrap:anywhere}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-head p{font-size:12px;color:var(--aj-muted);margin-top:5px;overflow-wrap:anywhere}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-state{display:grid;gap:6px;justify-items:end;text-align:right}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-document{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid var(--aj-line);margin-top:13px;padding-top:9px}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-file{display:flex;align-items:center;gap:6px;min-width:0}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-file>span{overflow-wrap:anywhere}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-file svg{width:13px;height:13px;flex-shrink:0}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-picker{display:grid;gap:7px;padding-top:12px;margin-top:12px;border-top:1px solid var(--aj-line)}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-option{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;border:1px solid var(--aj-line);border-radius:8px;padding:10px;background:var(--aj-bg)}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-option[aria-pressed=true]{border-color:var(--aj-brand);background:var(--aj-brand-soft)}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-option>span{display:grid;gap:3px;min-width:0}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-option strong{font-size:12px;font-weight:500;overflow-wrap:anywhere}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-option small{font-size:11px;color:var(--aj-muted);overflow-wrap:anywhere}\r\n#at-reference-dock #apply-ready-queue-design .aj-prepared-option svg{width:14px;height:14px;color:var(--aj-brand);flex-shrink:0}\r\n@media(max-width:370px){#at-reference-dock #apply-ready-queue-design .aj-prepared-head{gap:9px}#at-reference-dock #apply-ready-queue-design .aj-prepared-head h3{font-size:15px}#at-reference-dock #apply-ready-queue-design .aj-prepared-state .aj-badge{font-size:11px;padding:4px 6px}}\r\n@media(pointer:coarse){#at-reference-dock #apply-ready-queue-design .aj-prepared-option{min-height:52px}}\r\n\n\n/* Only dock framing and live-data additions sit outside the reference styles. */\n#at-reference-dock:has(#apply-ready-queue-design:not([hidden])) { padding:0; }\n#at-reference-dock .rd-dock:has(#apply-ready-queue-design:not([hidden])) { max-width:none; border:0; border-radius:0; overflow:visible; background:transparent; color-scheme:inherit; }\nbody.reference-dashboard:has(#apply-ready-queue-design:not([hidden])) { min-height:100dvh; background:var(--reference-dashboard-bg); }\n#at-reference-dock #apply-ready-queue-design { margin:0; padding:0; border:0; color-scheme:inherit; -webkit-font-smoothing:antialiased; background-image:radial-gradient(circle,color-mix(in srgb,var(--aj-text) 14%,transparent) .8px,transparent .8px); background-position:center; background-size:16px 16px; }\n#at-reference-dock #apply-ready-queue-design .aj-window { max-width:none; margin:0; border:0; border-radius:0; }\n#at-reference-dock #apply-ready-queue-design .aj-body { margin:0; padding:0; border:0; }\n#at-reference-dock #apply-ready-queue-design :is(.aj-card,.aj-context,.aj-steps) { margin:0; border:0; }\n#at-reference-dock #apply-ready-queue-design .aj-primary,#at-reference-dock #apply-ready-queue-design .aj-step[aria-current=step]>span,#at-reference-dock #apply-ready-queue-design .aj-toggle:checked { background:var(--color-accent-solid); color:var(--color-on-accent); }\n#at-reference-dock #apply-ready-queue-design .aj-navigation { display:flex; align-items:center; gap:12px; max-width:none; margin:0; padding:0 var(--dock-gutter,13px) 10px; border:0; }\n#at-reference-dock #apply-ready-queue-design .aj-navigation h2 { margin:0; font-size:18px; font-weight:500; letter-spacing:-.5px; line-height:1.3; }\n#at-reference-dock #apply-ready-queue-design .aj-navigation #aj-header-state { margin-left:auto; }\n#at-reference-dock #apply-ready-queue-design .aj-profile-name { display:block; padding:9px 10px; border:1px solid var(--aj-line); border-radius:8px; color:var(--aj-text); background:var(--aj-bg); overflow-wrap:anywhere; }\n#at-reference-dock #apply-ready-queue-design .aj-job-pager { display:inline-flex; align-items:center; gap:2px; margin-left:auto; }\n#at-reference-dock #apply-ready-queue-design .aj-job-pager button { display:grid; place-items:center; width:23px; height:28px; padding:0; border:1px solid var(--aj-line); border-radius:5px; background:var(--aj-bg); color:var(--aj-text); }\n#at-reference-dock #apply-ready-queue-design .aj-job-pager svg { width:14px; height:14px; }\n#at-reference-dock #apply-ready-queue-design #aj-job-position { min-width:34px; text-align:center; font-size:11px; color:var(--aj-muted); font-variant-numeric:tabular-nums; }\n#at-reference-dock #apply-ready-queue-design .aj-card-actions { display:flex; gap:8px; margin-top:12px; }\n#at-reference-dock #apply-ready-queue-design .aj-card-actions .aj-button { flex:1; min-width:0; }\n#at-reference-dock #apply-ready-queue-design .aj-import-sources { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }\n#at-reference-dock #apply-ready-queue-design .aj-source-button { display:flex; flex-direction:column; gap:8px; min-height:80px; padding:12px 8px; line-height:1.35; }\n#at-reference-dock #apply-ready-queue-design .aj-source-button svg { width:22px; height:22px; color:var(--aj-brand); }\n#at-reference-dock #apply-ready-queue-design #aj-upload-name { display:block; margin-top:8px; font-weight:400; }\n#at-reference-dock #apply-ready-queue-design select option { color:var(--aj-text); background:var(--aj-bg); }\n#at-reference-dock #apply-ready-queue-design :is(button,summary):not(:disabled) { cursor:pointer; }\n#at-reference-dock #apply-ready-queue-design .aj-pdf { display:block; width:100%; height:430px; border:1px solid var(--aj-line); border-radius:8px; background:var(--aj-card); }\n#at-reference-dock #apply-ready-queue-design .aj-small { overflow-wrap:anywhere; }\n#at-reference-dock #apply-ready-queue-design .aj-question-navigation { flex-wrap:wrap; }\n#at-reference-dock #apply-ready-queue-design .aj-import-facts { padding:9px 0; border-block:1px solid var(--aj-line); }\n#at-reference-dock #apply-ready-queue-design .aj-import-facts>summary { color:var(--aj-text); }\n#at-reference-dock #apply-ready-queue-design .aj-import-details { max-height:260px; overflow-y:auto; overflow-wrap:anywhere; font-size:12px; }\n#at-reference-dock #apply-ready-queue-design .aj-import-details h4 { margin:8px 0 4px; }\n#at-reference-dock #apply-ready-queue-design .aj-import-details p { margin:4px 0; white-space:pre-wrap; }\n#at-reference-dock #apply-ready-queue-design .aj-target-tab { display:grid; gap:5px; padding-top:10px; border-top:1px solid var(--aj-line); }\n';

  // src/inline-dock-content.js
  var SLOT = "__applicationTrackerInlineDock";
  var DISPOSE = "application-tracker:dispose-dock";
  async function start() {
    if (window.top !== window.self) return;
    if (globalThis[SLOT]) {
      const current = globalThis[SLOT], config = globalThis.__applicationTrackerInlineConfig;
      if (current.windowId !== void 0 && current.windowId !== config?.windowId) current.close();
      else {
        current.show(!config?.collapsed);
        return;
      }
    }
    let ready, closed = false;
    const cleanup = [];
    const instance = {
      windowId: globalThis.__applicationTrackerInlineConfig?.windowId,
      show: (open) => {
        void ready.then((api) => {
          if (!closed) api.show(open);
        }).catch(() => {
        });
      },
      close() {
        if (closed) return;
        closed = true;
        for (const dispose of cleanup.splice(0).reverse()) {
          try {
            dispose();
          } catch {
          }
        }
        if (globalThis[SLOT] === instance) delete globalThis[SLOT];
      }
    };
    globalThis[SLOT] = instance;
    ready = (async () => {
      const client = await createInlineDockClient();
      if (closed) {
        client.close();
        return;
      }
      cleanup.push(() => client.close());
      for (const previous of document.querySelectorAll("application-tracker-dock")) {
        if (previous.dataset.extensionId && previous.dataset.extensionId !== chrome.runtime.id) continue;
        previous.dispatchEvent(new Event(DISPOSE));
        if (previous.isConnected) {
          previous.style.setProperty("display", "none", "important");
          previous.removeAttribute("id");
        }
      }
      const host = document.createElement("application-tracker-dock");
      host.id = "application-tracker-inline-dock";
      host.dataset.extensionId = chrome.runtime.id;
      host.addEventListener(DISPOSE, instance.close, { once: true });
      cleanup.push(() => host.remove());
      host.style.cssText = "all:initial!important;display:block!important;position:relative!important;z-index:2147483647!important;width:0!important;height:0!important;";
      const shadow = host.attachShadow({ mode: "closed" }), styles = document.createElement("style");
      const scopedCSS = [theme_default, dashboard_default, job_records_default, apply_dock_default].join("\n").replace(/:root\[data-theme="([^"]+)"\]/g, ':host([data-theme="$1"])').replaceAll(":root", ":host").replaceAll("html[data-theme", "[data-inline-theme").replaceAll("body.reference-dashboard", ".inline-body").replace(/\bbody\s*\{/g, ".inline-body {");
      styles.textContent = scopedCSS + `
      :host{all:initial;font-family:Inter,system-ui,sans-serif;color-scheme:light;}
      .inline-panel{position:fixed;top:0;right:0;bottom:0;width:min(384px,100vw);padding:0;margin:0;border:0;border-radius:0;overflow:auto;overscroll-behavior:contain;background:var(--reference-dashboard-bg);box-shadow:-1px 0 0 #0001,-6px 0 24px #0001;}
      .inline-panel[hidden],.inline-launcher[hidden]{display:none!important;}
      [data-inline-theme] #at-reference-dock{--dock-gutter:13px;padding:0;min-height:100%;}
      [data-inline-theme] #at-reference-dock .rd-dock{width:100%;max-width:none;min-height:100dvh;margin:0;border:0;border-radius:0;}
      [data-inline-theme] #at-reference-dock .rd-header{flex-wrap:nowrap;gap:8px;}
      [data-inline-theme] #at-reference-dock .rd-person{margin-left:auto;}
      [data-inline-theme] #at-reference-dock .rd-logo svg{width:21px;height:21px;}
      [data-inline-theme] #at-reference-dock :is(.rd-header,.rd-main){padding-left:var(--dock-gutter);padding-right:var(--dock-gutter);}
      #at-reference-dock #job-records-design :is(.jr-header,.jr-toolbar,.jr-candidate-note){padding-left:var(--dock-gutter);padding-right:var(--dock-gutter);}
      #at-reference-dock #job-records-design :is(.jr-tabs,.jr-add-form){margin:0;}
      #at-reference-dock #apply-ready-queue-design{padding-left:0;padding-right:0;}
      #at-reference-dock #apply-ready-queue-design .aj-navigation{max-width:none;margin:0;}
      #at-reference-dock #apply-ready-queue-design .aj-window{max-width:none;border:0;border-radius:0;}
      #at-reference-dock #apply-ready-queue-design .aj-body{padding:0;}
      #at-reference-dock #apply-ready-queue-design .aj-steps{margin:0;}
      #at-reference-dock :is(.inline-collapse,.inline-settings){display:grid;place-items:center;box-sizing:border-box;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;flex-shrink:0;}
      #at-reference-dock .inline-collapse svg{width:26px;height:26px;}
      #at-reference-dock .inline-settings svg{width:19px;height:19px;}
      #at-reference-dock :is(.inline-collapse,.inline-settings):hover{background:var(--rd-soft);}
      .inline-launcher{position:fixed;right:0;top:120px;display:flex;align-items:center;gap:4px;height:56px;padding:8px 6px 8px 12px;border:1px solid #dcd0ed;border-right:0;border-radius:32px 0 0 32px;background:#fff;color:#7958c8;box-shadow:0 3px 20px #0002;transform:translateX(12px);transition:transform .3s;cursor:pointer;touch-action:none;user-select:none;}
      .inline-launcher:hover,.inline-launcher:focus-visible{transform:translateX(0);}
      .inline-launcher img{width:32px;height:32px;transform:scale(1.25);pointer-events:none;}.inline-grip{font-size:20px;line-height:1;padding:4px;cursor:ns-resize;}
      .inline-launcher:focus-visible{outline:2px solid #7958c8;outline-offset:2px;}
      @media(prefers-reduced-motion:reduce){.inline-launcher{transition:none;}}
    `;
      const panel = document.createElement("aside");
      panel.className = "inline-panel inline-body";
      panel.setAttribute("aria-label", "Application Tracker dock");
      const content = document.createElement("div");
      panel.append(content);
      const launcher = document.createElement("button");
      launcher.type = "button";
      launcher.className = "inline-launcher";
      launcher.title = "Open Application Tracker";
      launcher.setAttribute("aria-label", "Open Application Tracker dock");
      const image = document.createElement("img");
      image.src = chrome.runtime.getURL("icons/icon-128.png");
      image.alt = "";
      const grip = document.createElement("span");
      grip.className = "inline-grip";
      grip.textContent = "\u22EE";
      grip.setAttribute("aria-hidden", "true");
      launcher.append(image, grip);
      shadow.append(styles, panel, launcher);
      document.documentElement.append(host);
      const layout = reserveDockSpace(document, host);
      cleanup.push(() => layout.close());
      function show(open) {
        panel.hidden = !open;
        launcher.hidden = open;
        layout.setOpen(open);
        void client.call("collapse", { collapsed: !open }).catch(console.warn);
        if (open) collapse.focus();
        else launcher.focus();
      }
      const dock = mountDockDashboard(content, { browser: client.browser, privateStorage: client.privateStorage, showProfileSelector: false, onResumeInput: (record, options) => client.call("open-cv", { id: record.id, ...options }) });
      cleanup.push(() => dock.close());
      const settings = document.createElement("button");
      settings.type = "button";
      settings.className = "inline-settings";
      settings.dataset.action = "Settings";
      settings.title = "Open Settings";
      settings.setAttribute("aria-label", "Open Settings");
      settings.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 3h5l.6 2.2 1.6.9 2.2-.6 2.5 4.3-1.6 1.6v1.8l1.6 1.6-2.5 4.3-2.2-.6-1.6.9-.6 2.2h-5l-.6-2.2-1.6-.9-2.2.6-2.5-4.3 1.6-1.6v-1.8L2.6 9.8l2.5-4.3 2.2.6 1.6-.9Z"/><circle cx="12" cy="12" r="3"/></svg>';
      dock.root.querySelector(".rd-header").append(settings);
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "inline-collapse";
      collapse.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
      collapse.title = "Collapse dock";
      collapse.setAttribute("aria-label", "Collapse dock");
      collapse.addEventListener("click", () => show(false));
      dock.root.querySelector(".rd-header").append(collapse);
      let drag = null, moved = false;
      launcher.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target !== grip) return;
        drag = { y: event.clientY, top: launcher.getBoundingClientRect().top };
        moved = false;
        launcher.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      launcher.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const delta = event.clientY - drag.y;
        if (Math.abs(delta) > 3) moved = true;
        launcher.style.top = `${Math.max(0, Math.min(window.innerHeight - 56, drag.top + delta))}px`;
      });
      launcher.addEventListener("pointerup", () => {
        drag = null;
      });
      launcher.addEventListener("pointercancel", () => {
        drag = null;
      });
      launcher.addEventListener("click", () => {
        if (moved) {
          moved = false;
          return;
        }
        show(true);
      });
      const setTheme = (value) => {
        const next = value === "dark" ? "dark" : "light";
        host.dataset.theme = next;
        panel.dataset.inlineTheme = next;
      };
      const themeChanged = (changes, area) => {
        if (area === "local" && changes["ui-theme:v1"]) setTheme(changes["ui-theme:v1"].newValue);
      };
      chrome.storage.onChanged.addListener(themeChanged);
      cleanup.push(() => chrome.storage.onChanged.removeListener(themeChanged));
      try {
        setTheme((await chrome.storage.local.get("ui-theme:v1"))["ui-theme:v1"]);
      } catch {
        setTheme("light");
      }
      if (closed) return;
      const restore = new MutationObserver(() => {
        if (!host.isConnected) document.documentElement.append(host);
      });
      restore.observe(document.documentElement, { childList: true });
      cleanup.push(() => restore.disconnect());
      Object.assign(instance, { show, windowId: client.context.windowId });
      show(!globalThis.__applicationTrackerInlineConfig?.collapsed);
      window.addEventListener("pagehide", instance.close, { once: true });
      cleanup.push(() => window.removeEventListener("pagehide", instance.close));
      return instance;
    })();
    try {
      await ready;
    } catch (error) {
      instance.close();
      throw error;
    }
  }
  void start().catch((error) => console.error("Application Tracker dock:", error));
})();
