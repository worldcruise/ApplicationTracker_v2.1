(() => {
  // extension/studio/dock-apply-form.js
  function createApplyForm(document2, { uploadResume } = {}) {
    const win = document2.defaultView, ids = /* @__PURE__ */ new WeakMap(), nodes = /* @__PURE__ */ new Map();
    let serial = 0, currentRun = null, paused = false;
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const clean = (value) => normalize(value).slice(0, 2e3);
    const labelText = (node) => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll("input,select,textarea,button").forEach((child) => child.remove());
      return copy.textContent;
    };
    const label = (node) => clean(node.getAttribute("aria-label") || (node.getAttribute("aria-labelledby") || "").split(" ").map((id) => document2.getElementById(id)?.textContent || "").join(" ") || [...node.labels || []].map(labelText).join(" ") || node.getAttribute("placeholder") || node.name || node.id);
    const fieldLabel = (node) => node.type === "radio" ? clean(node.closest("fieldset")?.querySelector("legend")?.textContent) || label(node) : label(node);
    const visible = (node) => !node.disabled && !node.closest('[hidden],[aria-hidden="true"],fieldset[disabled]') && win.getComputedStyle(node).display !== "none" && win.getComputedStyle(node).visibility !== "hidden";
    function key(node) {
      if (!ids.has(node)) ids.set(node, `field-${++serial}`);
      const id = ids.get(node);
      nodes.set(id, node);
      return id;
    }
    function controls() {
      return [...document2.querySelectorAll("input,textarea,select")].filter((node) => !["hidden", "password", "submit", "button", "reset", "image"].includes(node.type) && !node.readOnly && visible(node));
    }
    function facts(profile) {
      const name = profile.nameData || {}, contact = profile.contactData || {}, address = profile.addressData || {}, site = profile.websiteData || {};
      return {
        "given-name": name.firstName,
        "family-name": name.lastName,
        "additional-name": name.middleName,
        name: [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" "),
        email: contact.email,
        tel: contact.phoneNumber,
        "address-line1": address.line1,
        "address-line2": address.line2,
        "address-level2": address.city,
        "address-level1": address.state,
        "postal-code": address.postalCode,
        "country-name": address.country,
        url: site.personal,
        linkedin: site.linkedin,
        github: site.github,
        skills: (profile.skillsData || []).join(", ")
      };
    }
    function mapped(node, profile) {
      const data = facts(profile), auto = (node.autocomplete || "").split(" ").at(-1);
      if (auto && data[auto]) return data[auto];
      const value = normalize(label(node) + " " + node.name + " " + node.id).toLowerCase().replace(/[_-]+/g, " ");
      const rules = [[/\bfirst\s*name\b|\bgiven\s*name\b/, "given-name"], [/\blast\s*name\b|\bfamily\s*name\b|\bsurname\b/, "family-name"], [/\bmiddle\s*name\b/, "additional-name"], [/\bfull\s*name\b|^name name name$/, "name"], [/\be.?mail\b/, "email"], [/\bphone\b|\bmobile\b|\btelephone\b/, "tel"], [/\blinkedin\b/, "linkedin"], [/\bgithub\b/, "github"], [/\bpostal\b|\bzip\b/, "postal-code"], [/\bcity\b/, "address-level2"], [/\bstate\b|\bprovince\b/, "address-level1"], [/\bcountry\b/, "country-name"], [/\baddress\s*(line\s*)?1\b|\bstreet address\b/, "address-line1"], [/\baddress\s*(line\s*)?2\b/, "address-line2"], [/\bpersonal\s*(website|url)\b|\bportfolio\b/, "url"], [/^skills\b/, "skills"]];
      return data[rules.find(([pattern]) => pattern.test(value))?.[1]] || "";
    }
    function hasValue(node) {
      return node.type === "file" ? !!node.files?.length : ["checkbox", "radio"].includes(node.type) ? node.checked : !!normalize(node.value);
    }
    function valid(node) {
      return node.validity ? node.validity.valid : true;
    }
    function entries() {
      const seen = /* @__PURE__ */ new Set();
      return controls().filter((node) => {
        if (node.type !== "radio") return true;
        const group = node.name || key(node);
        if (seen.has(group)) return false;
        seen.add(group);
        return true;
      }).map((node) => {
        const radios = node.type === "radio" ? controls().filter((other) => other.type === "radio" && other.name === node.name && other.form === node.form) : null;
        const selected = radios?.find((other) => other.checked);
        return {
          id: key(node),
          label: fieldLabel(node),
          kind: /\bwhy\b|\bdescribe\b|\btell us\b|\bcover letter\b|\bmotivat/i.test(fieldLabel(node)) ? "ai" : "fact",
          type: node.type,
          required: node.required || node.getAttribute("aria-required") === "true" || !!radios?.some((other) => other.required),
          filled: radios ? !!selected : hasValue(node) && valid(node),
          answer: radios ? selected?.value || "" : node.type === "file" ? node.files?.[0]?.name || "" : node.type === "checkbox" ? node.checked ? "Yes" : "" : String(node.value || "").slice(0, 1e4),
          options: radios ? radios.map((other) => ({ value: other.value, label: label(other) })) : node.tagName === "SELECT" ? [...node.options].map((option) => ({ value: option.value, label: option.textContent })) : []
        };
      });
    }
    function check(runId) {
      if (!currentRun || currentRun !== runId) throw Error("This form belongs to another autofill run.");
      if (paused) throw Error("Resume the paused run first.");
    }
    function set(node, value) {
      if (node.type === "radio") {
        const radio = controls().find((other) => other.type === "radio" && other.name === node.name && other.form === node.form && (other.value === value || label(other).toLowerCase() === value.toLowerCase()));
        if (!radio) throw Error("Choose one of the available answers.");
        radio.click();
        return;
      }
      if (node.type === "checkbox") {
        if (!/^(yes|no|true|false)$/i.test(value)) throw Error("Enter Yes or No for this checkbox.");
        const next = /^(yes|true)$/i.test(value);
        if (node.checked !== next) node.click();
        return;
      }
      if (node.tagName === "SELECT") {
        const option = [...node.options].find((option2) => !option2.disabled && option2.value && (option2.value.toLowerCase() === value.toLowerCase() || normalize(option2.textContent).toLowerCase() === value.toLowerCase()));
        if (!option) throw Error("Choose a value from the employer dropdown.");
        value = option.value;
      }
      const prototype = node.tagName === "SELECT" ? win.HTMLSelectElement.prototype : node.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
      node.dispatchEvent(new win.Event("input", { bubbles: true }));
      node.dispatchEvent(new win.Event("change", { bubbles: true }));
    }
    async function request(message) {
      const { action, runId } = message;
      if (action === "bind") {
        currentRun = runId;
        paused = false;
        return scan();
      }
      if (action === "pause" || action === "cancel") {
        if (currentRun === runId) {
          paused = true;
          if (action === "cancel") currentRun = null;
        }
        return { stopped: true };
      }
      if (action === "resume") {
        if (currentRun !== runId) throw Error("The application page was reloaded. Rescan to reconnect.");
        paused = false;
        return scan();
      }
      check(runId);
      if (action === "scan") return scan();
      if (action === "fill") {
        const profile = message.profile || {}, saved = message.answers || {};
        for (const node of controls()) {
          check(runId);
          if (hasValue(node) || ["checkbox", "radio"].includes(node.type)) continue;
          if (node.type === "file") {
            if (/resume|\bcv\b/i.test(label(node)) && message.resume) {
              if (uploadResume) uploadResume(node, message.resume);
              else {
                const bytes = Uint8Array.from(win.atob(message.resume.resumeBase64), (char) => char.charCodeAt(0)), transfer = new win.DataTransfer();
                transfer.items.add(new win.File([bytes], message.resume.fileName, { type: "application/pdf" }));
                node.files = transfer.files;
                node.dispatchEvent(new win.Event("change", { bubbles: true }));
              }
            }
          } else {
            const value = mapped(node, profile) || saved[`${node.type}:${normalize(label(node)).toLowerCase()}`];
            if (value) try {
              set(node, String(value));
            } catch {
            }
          }
          await new Promise((resolve) => win.setTimeout(resolve, 0));
        }
        check(runId);
        return scan();
      }
      if (action === "answer") {
        const node = nodes.get(message.fieldId);
        if (!node?.isConnected || fieldLabel(node) !== message.label) throw Error("The question changed. Rescan the page before filling it.");
        if (node.type === "file") throw Error("Upload this document on the employer page.");
        set(node, String(message.answer || ""));
        return scan();
      }
      if (action === "next" || action === "submit") {
        if (entries().some((field) => field.required && !field.filled)) throw Error("Complete the required fields on the employer page first.");
        const pattern = action === "next" ? /^(next|continue|save and continue|next page|review application)$/i : /^(submit|submit application|send application|apply now|finish application)$/i;
        const buttons = [...document2.querySelectorAll('button,input[type="submit"]')].filter((node) => visible(node) && pattern.test(normalize(node.textContent || node.value)));
        if (buttons.length !== 1) throw Error(`Use the employer page's ${action === "next" ? "Next" : "Submit"} button, then rescan here.`);
        const form = buttons[0].form;
        if (form && !form.reportValidity()) throw Error("The employer form still has validation errors.");
        buttons[0].click();
        return { clicked: true };
      }
      throw Error("Unsupported form action.");
    }
    function scan() {
      const buttons = [...document2.querySelectorAll('button,input[type="submit"]')].filter(visible).map((node) => normalize(node.textContent || node.value));
      return { url: document2.location.href, title: document2.title, fields: entries(), nextAvailable: buttons.some((text) => /^(next|continue|save and continue|next page|review application)$/i.test(text)), submitAvailable: buttons.some((text) => /^(submit|submit application|send application|apply now|finish application)$/i.test(text)), success: /application (has been |was )?(successfully )?submitted|thank you for applying|we (have |have successfully )?received your application/i.test(document2.body?.innerText || document2.body?.textContent || "") };
    }
    return { request, scan };
  }

  // src/dock-apply-content.js
  if (!globalThis.__applicationTrackerApplyBridge) {
    globalThis.__applicationTrackerApplyBridge = true;
    const form = createApplyForm(document);
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
      if (sender.id !== chrome.runtime.id || sender.tab || sender.url && sender.url !== chrome.runtime.getURL("service-worker.js") || message?.target !== "dock-apply-form:v1") return false;
      Promise.resolve().then(() => form.request(message)).then((result) => reply({ ok: true, result }), (error) => reply({ ok: false, error: error.message }));
      return true;
    });
  }
})();
