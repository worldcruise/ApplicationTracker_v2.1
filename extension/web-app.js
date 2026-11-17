// src/web-app.jsx
import { React, createRoot } from "./vendor/react.js";
import { createWebHeader } from "./studio/web-header.js";
import { createWebDashboard } from "./studio/web-dashboard.js";
import { createWebApplications } from "./studio/web-applications.js";
import { createApplicationsPage, createMeetingBoard } from "./studio/applications-page.js";
import { createMeetingsBoardPage } from "./studio/meetings-board-page.js";
import { createProfileResumePage } from "./studio/profile-resume-page.js";
import { createPromptSettings, createOtherSettings, createCandidatePromptSettings, createAISettings, createKeywordSettings, createKeyboardSettings, createSettingsNavigation } from "./studio/prompt-settings.js";
import { createAutofillSettings } from "./studio/autofill-settings.js";
import { StudioPreviewLink, ResumeStudioPage } from "./studio/preview-components.js";

// extension/ai-apply/src/keyword-matcher.js
(() => {
  if (globalThis.AiAgentKeywords?.version === 2) return;
  const storageKey = "keywordHighlights";
  const palette = Object.freeze([
    { id: "yellow", label: "Yellow", color: "#fff2a8" },
    { id: "green", label: "Green", color: "#b7e4ca" },
    { id: "red", label: "Red", color: "#ff5252" },
    { id: "blue", label: "Blue", color: "#bde0fe" },
    { id: "purple", label: "Purple", color: "#ddd0f5" },
    { id: "orange", label: "Orange", color: "#ffd4a8" },
    { id: "custom", label: "Custom", color: "#e2e8f0" }
  ].map(Object.freeze));
  const defaults = Object.freeze({
    yellow: Object.freeze(["travel", "staff", "architect", "relocation"]),
    green: Object.freeze(["remote"]),
    red: Object.freeze(["onsite", "on-site", "certification", "license", "volunteer", "intern", "hybrid"])
  });
  const validColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  function words(values, caseSensitive) {
    const seen = /* @__PURE__ */ new Set();
    return (Array.isArray(values) ? values : []).flatMap((value) => {
      if (typeof value !== "string") return [];
      const word = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
      const key = caseSensitive ? word : word.toLowerCase();
      if (!word || seen.has(key)) return [];
      seen.add(key);
      return [word];
    }).slice(0, 200);
  }
  function normalize(value) {
    const fresh = value == null || typeof value === "object" && !Object.keys(value).length;
    value ||= {};
    const caseSensitive = value?.caseSensitive === true;
    const stored = Array.isArray(value?.groups) ? value.groups : null;
    const groups = palette.map((entry) => {
      const records = stored?.filter((group) => group?.id === entry.id) || [];
      const color = entry.id === "custom" && validColor(records[0]?.color) ? records[0].color.toLowerCase() : entry.color;
      return { id: entry.id, color, keywords: words(fresh ? defaults[entry.id] : records.flatMap((group) => Array.isArray(group.keywords) ? group.keywords : []), caseSensitive) };
    });
    if (!stored && !fresh) {
      const color = validColor(value?.color) ? value.color.toLowerCase() : palette[0].color;
      const id = ["#ffcfe0", "#ffb3b3"].includes(color) ? "red" : palette.find((entry) => entry.id !== "custom" && entry.color === color)?.id || "custom";
      const group = groups.find((entry) => entry.id === id);
      group.keywords = words(value?.keywords, caseSensitive);
      if (id === "custom") group.color = color;
    }
    return {
      version: 2,
      enabled: fresh || value?.enabled === true,
      groups,
      caseSensitive,
      wholeWords: value?.wholeWords === true
    };
  }
  function parseInput(text, caseSensitive = false) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 200) throw new Error("Use up to 200 keywords, one per line.");
    if (lines.some((line) => line.length > 80)) throw new Error("Keep each keyword or phrase under 81 characters.");
    return words(lines, caseSensitive);
  }
  function createMatcher(value) {
    const settings = normalize(value);
    const entries = settings.groups.flatMap((group) => group.keywords.map((word) => ({ word, groupId: group.id }))).sort((a, b) => b.word.length - a.word.length);
    if (!settings.enabled || !entries.length) return () => [];
    const alternatives = entries.map(({ word }) => "(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")").join("|");
    const edge = "[\\p{L}\\p{N}_]";
    const pattern = settings.wholeWords ? `(?<!${edge})(?:${alternatives})(?!${edge})` : alternatives;
    const expression = new RegExp(pattern, settings.caseSensitive ? "gu" : "giu");
    return (text) => {
      if (typeof text !== "string") return [];
      const matches = [];
      for (const match of text.matchAll(expression)) {
        const owner = entries[match.findIndex((value2, index) => index > 0 && value2 !== void 0) - 1];
        matches.push({ start: match.index, end: match.index + match[0].length, groupId: owner.groupId });
        if (matches.length === 5e3) break;
      }
      return matches;
    };
  }
  const findMatches = (text, value) => createMatcher(value)(text);
  globalThis.AiAgentKeywords = Object.freeze({ version: 2, storageKey, palette, normalize, parseInput, createMatcher, findMatches });
})();

// extension/ai-apply/src/workspace-shortcut-keys.js
(() => {
  if (globalThis.AiAgentWorkspaceKeys) return;
  const bindings = Object.freeze([
    { key: "ArrowUp", shortcut: "Ctrl+Up", action: "view.studio", label: "Open application tracker", target: "results-tab" },
    { key: "ArrowDown", shortcut: "Ctrl+Down", action: "view.chat", label: "Open Chat", target: "chat-dock-toggle" },
    { key: "ArrowLeft", shortcut: "Ctrl+Left", action: "tab.previous", label: "Previous browser tab", target: "previous-job" },
    { key: "ArrowRight", shortcut: "Ctrl+Right", action: "tab.next", label: "Next browser tab", target: "next-job" },
    { key: "Enter", shortcut: "Ctrl+Enter", action: "queue.add", label: "Save job to queue", target: "add-request" }
  ].map(Object.freeze));
  const isAction = (action2) => bindings.some((binding) => binding.action === action2);
  function action(event) {
    if (event.isTrusted !== true || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing || event.keyCode === 229 || event.repeat) return null;
    return bindings.find((binding) => binding.key === event.key)?.action || null;
  }
  globalThis.AiAgentWorkspaceKeys = Object.freeze({ bindings, isAction, action });
})();

// src/web-app.jsx
var Header = createWebHeader(React);
var Dashboard = createWebDashboard(React);
var Profile = createProfileResumePage(React);
var Prompts = createPromptSettings(React);
var Other = createOtherSettings(React);
var Candidate = createCandidatePromptSettings(React);
var AI = createAISettings(React);
var Keywords = createKeywordSettings(React);
var Keyboard = createKeyboardSettings(React);
var Autofill = createAutofillSettings(React);
function Link({ to, children, ...props }) {
  return /* @__PURE__ */ React.createElement("a", { ...props, href: "#" + to }, children);
}
var SettingsNavigation = createSettingsNavigation(React, Link);
var MeetingBoard = createMeetingBoard(React);
var Meetings = createMeetingsBoardPage(React, { Board: MeetingBoard });
var Applications = createWebApplications(React, { Applications: createApplicationsPage(React), Board: () => /* @__PURE__ */ React.createElement(Meetings, { boardOnly: true }) });
var aliases = { "/settings": "/settings/profile", "/profile": "/settings/profile", "/profile/new": "/settings/profile", "/settings/profile/new": "/settings/profile", "/settings/prompts": "/settings/ai/prompt", "/settings/ai": "/settings/ai/resume-generation", "/settings/autofill": "/settings/ai/autofill" };
function App() {
  const [hash, setHash] = React.useState(location.hash || "#/dashboard");
  React.useEffect(() => {
    const change = () => setHash(location.hash || "#/dashboard");
    window.addEventListener("hashchange", change);
    window.addEventListener("popstate", change);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("popstate", change);
    };
  }, []);
  const path = hash.replace(/^#/, "").split("?")[0] || "/", route = aliases[path] || path;
  React.useEffect(() => {
    if (aliases[path]) location.replace("#" + route);
  }, [path, route]);
  const settings = {
    "/settings/profile": Profile,
    "/settings/ai/resume-generation": AI,
    "/settings/ai/autofill": Autofill,
    "/settings/ai/candidate": Candidate,
    "/settings/ai/prompt": Prompts,
    "/settings/keywords": Keywords,
    "/settings/keyboard": Keyboard,
    "/settings/other": Other
  };
  const Page = settings[route];
  const content = Page ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "settings-page-heading" }, /* @__PURE__ */ React.createElement("h1", null, "Settings")), /* @__PURE__ */ React.createElement("div", { className: "web-settings-layout" }, /* @__PURE__ */ React.createElement("aside", { className: "web-settings-sidebar" }, /* @__PURE__ */ React.createElement(SettingsNavigation, { pathname: route })), /* @__PURE__ */ React.createElement("div", { className: "web-settings-content" }, /* @__PURE__ */ React.createElement(Page, null)))) : route === "/dashboard" ? /* @__PURE__ */ React.createElement(Dashboard, null) : route === "/meetings" ? /* @__PURE__ */ React.createElement(Meetings, null) : route === "/" ? /* @__PURE__ */ React.createElement(Applications, null) : route === "/resume-studio" ? /* @__PURE__ */ React.createElement(ResumeStudioPage, null) : /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("h1", null, "Page not found"), /* @__PURE__ */ React.createElement(Link, { to: "/dashboard" }, "Back to dashboard"));
  return /* @__PURE__ */ React.createElement("div", { className: "web-app-shell" }, /* @__PURE__ */ React.createElement("div", { className: "web-app-scroll" }, /* @__PURE__ */ React.createElement(Header, { active: route, Link, StudioLink: StudioPreviewLink }), /* @__PURE__ */ React.createElement("main", { className: "web-app-main" }, content)));
}
createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
