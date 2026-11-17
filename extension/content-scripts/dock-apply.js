(() => {
  // extension/studio/apply-form-dom.js
  var composedParent = (node) => node?.parentElement || node?.getRootNode?.().host || null;
  function queryFormTree(root, selector) {
    const found = [];
    for (const node of root.querySelectorAll("*")) {
      if (node.matches(selector)) found.push(node);
      if (node.shadowRoot) found.push(...queryFormTree(node.shadowRoot, selector));
    }
    return found;
  }
  function formElementById(node, id) {
    return id && (node.getRootNode()?.getElementById?.(id) || node.ownerDocument.getElementById(id));
  }
  function closestFormAncestor(node, selector) {
    for (let item = node; item; item = composedParent(item)) if (item.matches(selector)) return item;
    return null;
  }
  var text = (value) => String(value || "").replace(/\s+/g, " ").trim();
  var labelText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll("input,select,textarea,button").forEach((child) => child.remove());
    return text(copy.textContent);
  };
  var labelled = (node) => text(node.getAttribute("aria-label")) || text((node.getAttribute("aria-labelledby") || "").split(/\s+/).map((id) => formElementById(node, id)?.textContent || "").join(" "));
  function formFieldCaption(node) {
    const own = labelled(node) || text([...node.labels || []].map(labelText).join(" "));
    if (own) return own;
    const wrapping = closestFormAncestor(node, "label");
    if (wrapping && labelText(wrapping)) return labelText(wrapping);
    for (let host = node.getRootNode()?.host; host; host = host.getRootNode()?.host) {
      if (queryFormTree(host.shadowRoot, 'input:not([type="hidden"]),textarea,select,button[role="combobox"],button[aria-haspopup="listbox"]').length !== 1) break;
      const associated = host.id ? [...host.getRootNode().querySelectorAll("label[for]")].find((label) => label.htmlFor === host.id) : null;
      const caption = labelled(host) || text(host.getAttribute("label")) || associated && labelText(associated);
      if (caption) return caption;
    }
    return "";
  }

  // extension/studio/apply-form-widgets.js
  var text2 = (value) => String(value || "").replace(/\s+/g, " ").trim();
  var documentKind = (value) => {
    const normalized = text2(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /cover[\s_-]*letter/.test(normalized) ? "Cover Letter" : /resume|\bcv\b|curriculum\s+vitae/.test(normalized) ? "Resume/CV" : "";
  };
  var labelled2 = (node) => (node?.getAttribute("aria-labelledby") || "").split(/\s+/).map((id) => formElementById(node, id)?.textContent || "").join(" ");
  function uploadFieldContainer(node) {
    const group = node.closest('.file-upload,.file-upload-container,.dropzone,[role="group"],.field,[id^="s3_upload_for_"],[data-automation-id^="formField-"],fieldset');
    if (group) return group;
    for (let parent = node.parentElement; parent && !/^(FORM|BODY|HTML)$/.test(parent.tagName); parent = parent.parentElement) {
      if (documentKind([parent.id, parent.getAttribute("aria-label"), labelled2(parent), parent.querySelector(":scope > label,:scope > h3,:scope > legend")?.textContent].join(" "))) return parent;
    }
    const label = [...node.labels || []].find((item) => item.isConnected);
    return label?.parentElement && !/^(FORM|BODY|HTML)$/.test(label.parentElement.tagName) ? label.parentElement : node.parentElement;
  }
  function uploadFieldLabel(node) {
    const direct = [node.getAttribute("aria-label"), labelled2(node), ...node.labels || [], node.id, node.name].filter(Boolean).map((item) => typeof item === "string" ? item : item.textContent).join(" ");
    const own = documentKind(direct);
    if (own) return own;
    const group = uploadFieldContainer(node), caption = group?.getAttribute("aria-label") || labelled2(group) || group?.querySelector(".upload-label,legend,h3,label")?.textContent || "";
    return documentKind([group?.id, group?.getAttribute("data-automation-id"), caption].join(" ")) || text2(caption);
  }
  function nativeSelectProxy(node) {
    if (node.tagName !== "SELECT") return null;
    const explicit = formElementById(node, `s2id_${node.id}`);
    if (explicit) return explicit;
    return [node.previousElementSibling, node.nextElementSibling].find((item) => item?.classList.contains("select2-container")) || null;
  }
  function createComboboxController(document2, { visible, writeValue }) {
    const win = document2.defaultView;
    const isCombo = (node) => node.getAttribute("role") === "combobox" || node.tagName === "INPUT" && (["list", "both"].includes(node.getAttribute("aria-autocomplete")) || node.getAttribute("aria-haspopup") === "listbox" || node.classList.contains("pac-target-input")) || node.tagName === "BUTTON" && node.getAttribute("aria-haspopup") === "listbox";
    const widgetSelector = '.select-shell,.select__container,.Select,.select2-container,[data-automation-id^="formField-"],[role="combobox"]';
    const root = (node) => closestFormAncestor(composedParent(node), widgetSelector) || (node.parentElement && !/^(FORM|BODY|HTML)$/.test(node.parentElement.tagName) ? node.parentElement : node);
    const placeholder = (value2) => !text2(value2) || /^(?:select(?:\s+(?:one|an?\s+option|an?\s+answer))?|choose(?:\s+(?:one|an?\s+option))?|search|type to search)[.\s…]*$/i.test(text2(value2));
    const proofs = /* @__PURE__ */ new WeakMap();
    const fieldText = (node) => formFieldCaption(node) || formFieldCaption(closestFormAncestor(composedParent(node), '[role="combobox"]') || node);
    const streetField = (node) => {
      const auto = (node.autocomplete || "").split(/\s+/).at(-1);
      if (auto && !["off", "on"].includes(auto)) return ["street-address", "address-line1"].includes(auto);
      const caption = text2([fieldText(node), node.name, node.id].join(" ")).replace(/([a-z])([A-Z])/g, "$1 $2");
      return !/\b(?:city|state|province|country|postal|zip|email|e-mail|line\s*2)\b/i.test(caption) && /\bstreet\b|\baddress\s*(?:line\s*)?1\b|^address(?: address)*$/i.test(caption);
    };
    function value(node) {
      const container = root(node);
      if (node.tagName === "INPUT" && streetField(node) && !container?.matches(widgetSelector)) return text2(node.getAttribute("aria-valuetext")) || (node.getAttribute("aria-expanded") !== "true" ? text2(node.value) : "");
      const selected = container?.querySelector('.select__single-value,[class*="-singleValue"],.Select-value-label,.select2-chosen');
      if (selected && visible(selected) && !placeholder(selected.textContent)) return text2(selected.textContent);
      const hidden = container?.querySelector('input[type="hidden"][name]');
      if (hidden?.value) return text2(hidden.value);
      if (node.getAttribute("aria-valuetext")) return text2(node.getAttribute("aria-valuetext"));
      const selectedOption = options(node, { includeHidden: true }).find((option) => option.getAttribute("aria-selected") === "true" || option.getAttribute("aria-checked") === "true" || option.querySelector("input:checked"));
      if (selectedOption) return text2(selectedOption.getAttribute("aria-label") || selectedOption.textContent);
      if (node.tagName === "BUTTON") return placeholder(node.textContent) ? "" : text2(node.textContent);
      const proof = proofs.get(node);
      if (proof && proof.inputValue && node.value === proof.inputValue && node.getAttribute("aria-expanded") !== "true") return streetField(node) ? text2(node.value) : proof.label;
      return streetField(node) && node.getAttribute("aria-expanded") !== "true" ? text2(node.value) : "";
    }
    function menus(node, scope = root(node)) {
      const owners = [node, ...scope && scope !== node ? [scope, ...queryFormTree(scope, "[aria-controls],[aria-owns]")] : []];
      const ids = [...new Set(owners.flatMap((owner) => [owner.getAttribute("aria-controls"), owner.getAttribute("aria-owns")].filter(Boolean).flatMap((value2) => value2.split(/\s+/))))];
      const containers = ids.map((id) => formElementById(node, id)).filter(Boolean);
      if (!ids.length && (node.getAttribute("aria-expanded") === "true" || document2.activeElement === node)) {
        const open = queryFormTree(document2, '[role="listbox"],.pac-container').filter(visible);
        if (open.length === 1) containers.push(open[0]);
      }
      return [...new Set(containers)];
    }
    function options(node, { includeHidden = false, scope = root(node) } = {}) {
      const containers = [scope, ...menus(node, scope)];
      return [...new Set(containers.filter(Boolean).flatMap((container) => queryFormTree(container, '[role="option"],.select__option,.Select-option,[data-automation-id="menuItem"],.pac-item')))].filter((option) => (includeHidden || visible(option)) && option.getAttribute("aria-disabled") !== "true" && !option.classList.contains("select__option--is-disabled"));
    }
    const countryKey = (value2) => text2(value2).toLowerCase().replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, "").replace(/\s*\(?\+\d[\d\s-]*\)?$/, "").replace(/^united states of america$/, "united states").replace(/^(us|usa)$/, "united states").replace(/^(uk|great britain)$/, "united kingdom").trim();
    const countryField = (node) => /\bcountry\b/i.test(fieldText(node) || node.id);
    const states = Object.fromEntries("AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming".split("|").map((row) => row.split(":")));
    const canonical = (value2) => text2(value2).toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    function choice(value2) {
      const key = canonical(value2);
      return /^yes\b|^true$/.test(key) ? "yes" : /^no\b|^false$/.test(key) ? "no" : /^(?:prefer not|i (?:do not|dont) wish|decline|undisclosed)/.test(key) ? "undisclosed" : { "bachelors degree": "bachelors", "bachelor": "bachelors", "masters degree": "masters", "master": "masters", "bs": "bachelor of science", "bsc": "bachelor of science", "ba": "bachelor of arts", "ms": "master of science", "msc": "master of science", "ph d": "phd", "doctorate": "phd" }[key] || key;
    }
    function matches(node, option, answer) {
      if (countryField(node)) return countryKey(option) === countryKey(answer);
      if (/\bstate\b|\bprovince\b/i.test(fieldText(node))) {
        const state = (value2) => canonical(states[text2(value2).toUpperCase()] || text2(value2).replace(/\s*\([A-Z]{2}\)$/, ""));
        return state(option) === state(answer);
      }
      if (/\bmonth\b/i.test(fieldText(node))) {
        const month = (value2) => {
          const key = canonical(value2), number = Number(key);
          return number >= 1 && number <= 12 ? number : ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].findIndex((item) => item === key || item.slice(0, 3) === key) + 1;
        };
        if (month(option) && month(option) === month(answer)) return true;
      }
      const optionKey = choice(option), answerKey = choice(answer);
      return optionKey === answerKey || optionKey === "bachelors" && answerKey.startsWith("bachelor of ") || optionKey === "masters" && answerKey.startsWith("master of ");
    }
    async function select(node, answer, { check = () => {
    } } = {}) {
      const identity2 = { id: node.id, name: node.name, caption: fieldText(node) }, typed = /* @__PURE__ */ new WeakSet();
      const reconnect = () => {
        if (node.isConnected) return;
        const candidates = queryFormTree(document2, 'input,[role="combobox"],button[aria-haspopup="listbox"]').filter((item) => isCombo(item) && (identity2.id ? item.id === identity2.id : identity2.name ? item.name === identity2.name : false) && fieldText(item) === identity2.caption);
        if (candidates.length !== 1) throw Error("The dropdown changed. Choose an option on the employer page.");
        node = candidates[0];
      };
      const before = node.value, country = countryField(node), street = streetField(node), editable = node.tagName === "INPUT" && !node.readOnly;
      const query = country && countryKey(answer) === "united states" ? "United States" : answer;
      check();
      node.focus();
      node.click();
      node.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true, composed: true }));
      if (editable) {
        typed.add(node);
        writeValue(node, query);
      }
      const checkQuery = () => {
        check();
        reconnect();
        if (editable && !typed.has(node)) {
          if (node.value && node.value !== query) throw Error("The dropdown changed while it was being filled. Review its answer on the employer page.");
          typed.add(node);
          writeValue(node, query);
        }
        if (!node.isConnected || editable && node.value !== query) throw Error("The dropdown changed while it was being filled. Review its answer on the employer page.");
      };
      let option;
      for (let attempt = 0; attempt < 25; attempt++) {
        checkQuery();
        option = options(node).find((item) => {
          const caption = item.getAttribute("aria-label") || item.textContent;
          if (!street) return item.getAttribute("data-value") === answer || item.getAttribute("value") === answer || matches(node, caption, answer);
          const address = item.querySelector(".pac-item-query")?.textContent || text2(caption).split(",")[0];
          return canonical(address) === canonical(answer) || canonical(caption) === canonical(answer);
        });
        if (option) break;
        await new Promise((resolve) => win.setTimeout(resolve, 60));
      }
      checkQuery();
      if (!option) {
        if (editable) writeValue(node, before);
        node.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
        throw Error("Choose a value from the employer dropdown.");
      }
      const selectedLabel = text2(option.getAttribute("aria-label") || option.textContent);
      option.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true }));
      option.click();
      await new Promise((resolve) => win.setTimeout(resolve, 0));
      check();
      reconnect();
      if (node.value && node.value !== query && node.getAttribute("aria-expanded") !== "true") proofs.set(node, { label: selectedLabel, inputValue: node.value });
      if (!value(node)) throw Error("The employer dropdown did not accept this answer. Choose its option on the application page.");
    }
    return { isCombo, value, options, select, matches, root, menus };
  }

  // extension/studio/apply-navigation.js
  var text3 = (value) => String(value || "").replace(/\s+/g, " ").trim();
  function submissionAttemptId(random = globalThis.crypto) {
    if (typeof random.randomUUID === "function") return random.randomUUID();
    return [...random.getRandomValues(new Uint8Array(16))].map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  function visibleApplicationControl(node) {
    if (!node || node.disabled || node.matches?.(":disabled") || node.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]')) return false;
    for (let item = node; item; item = item.parentElement) {
      const style = node.ownerDocument.defaultView.getComputedStyle(item);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }
  function applicationControl(node) {
    if (!visibleApplicationControl(node)) return null;
    const doc = node.ownerDocument, labels = [node.getAttribute("aria-label"), node.getAttribute("title"), node.getAttribute("data-label"), ...(node.getAttribute("aria-labelledby") || "").split(" ").map((id) => doc.getElementById(id)?.textContent), node.value, node.textContent].map(text3).filter(Boolean);
    const label = labels.find((value) => /\b(next|continue|proceed|review|submit|apply|send application|finish application)\b/i.test(value)) || labels[0] || "";
    const identity2 = [node.id, node.name, node.getAttribute("data-testid"), node.getAttribute("data-test"), node.getAttribute("data-automation-id")].filter(Boolean).join(" ");
    const normalized = label.replace(/[\u2190-\u21ff\u00bb\u203a><]/g, "").trim();
    let kind;
    if (/^(?:back|previous|cancel|save draft|save for later|withdraw|upload|add another)\b/i.test(normalized) || /\b(back|previous|cancel|withdraw)\b/i.test(identity2)) return null;
    if (/^(?:next(?: step| page)?|continue(?: to .+)?|proceed|save (?:and|&) continue|review(?: application)?)$/i.test(normalized) || /application-next-step|btnNext|(?:^|[-_])(?:next|continue)(?:[-_]|$)/i.test(identity2)) kind = "next";
    if (/^(?:submit(?: (?:application|profile))?|send application|finish (?:application|questionnaire)|complete this application step)$/i.test(normalized) || /application-submit|btnSubmit|submit_app|submitApplication/i.test(identity2)) kind = "submit";
    if (/pageFooterNextButton|bottom-navigation-next-button/.test(identity2)) kind = /submit/i.test(normalized) ? "submit" : "next";
    if (/^apply(?: now| directly| to (?:this |the )?(?:job|position|role)| for (?:this |the )?(?:job|position|role))?$/i.test(normalized)) kind = node.type === "submit" || node.closest("form") && !node.closest("a[href]") ? "submit" : "apply";
    if (/^(?:jobs|apply)\.workable\.com$/.test(doc.location.hostname) && /^apply(?: now| for (?:this |the )?(?:job|position|role)| to (?:this |the )?(?:job|position|role))?$/i.test(normalized)) {
      const form2 = node.form || node.closest("form");
      const candidateForm = form2?.querySelector('input[type="email"],input[type="file"],input[autocomplete="given-name"],input[name="firstname"],input[name="first_name"],textarea');
      kind = doc.location.hostname === "jobs.workable.com" || !candidateForm ? "apply" : "submit";
    }
    if (kind === "submit" && /icims\.com$/.test(doc.location.hostname) && /submit profile/i.test(normalized)) {
      const steps = [...doc.querySelectorAll(".iCIMS_Steps > ul > li")], current = steps.findIndex((step) => step.classList.contains("iCIMS_Steps_Current"));
      if (current >= 0 && current < steps.length - 1) kind = "next";
    }
    const ownerForm = node.form || node.closest("form");
    if (kind === "submit" && ownerForm && (/sign.?in|log.?in|create.?account|sign.?up|register/i.test([ownerForm.id, ownerForm.name, ownerForm.action].join(" ")) || ownerForm.querySelector('input[type="password"]') && !/submit application/i.test(normalized))) kind = "next";
    if (!kind) return null;
    const link = node.closest("a[href]"), form = node.form || node.closest("form");
    let targetUrl = link?.href || node.getAttribute("data-href") || node.getAttribute("data-url") || (form?.hasAttribute("action") ? form.action : null);
    try {
      targetUrl = targetUrl ? new URL(targetUrl, doc.location.href).href : null;
      if (targetUrl && !/^https?:/.test(targetUrl)) targetUrl = null;
    } catch {
      targetUrl = null;
    }
    return { kind, label: label.slice(0, 200), targetUrl };
  }
  function applicationControls(document2) {
    return [...document2.querySelectorAll('a,button,input[type="submit"],input[type="button"],[role="button"]')].map((node) => ({ node, ...applicationControl(node) })).filter((control) => control.kind);
  }
  function applicationFormSubmission(form, submitter) {
    const control = submitter && applicationControl(submitter);
    if (control) return control;
    const label = text3(submitter?.getAttribute("aria-label") || submitter?.value || submitter?.textContent), context = [label, form?.id, form?.name, form?.action].filter(Boolean).join(" ");
    const authentication = !!form?.querySelector('input[type="password"]') || /sign.?in|log.?in|create.?account|sign.?up|register|\/auth(?:\/|\?)/i.test(context);
    return { kind: authentication ? "next" : "submit", label: label || (authentication ? "Continue signing in" : "Submit application"), targetUrl: form?.hasAttribute("action") ? form.action : null };
  }
  function applicationReceipt(document2) {
    const nodes = [...document2.querySelectorAll('#application_confirmation,#form-submission-success-message,.application-confirmation,.postings-btn-wrapper,.iCIMS_SuccessMessage,[data-automation-id="candidateHomeTaskModal"],.thanks,[role="status"],[role="alert"],main h1,main h2,body > h1,body > h2')];
    const message = nodes.filter(visibleApplicationControl).map((node) => text3(node.innerText || node.textContent)).find((value) => /application (?:has been |was )?(?:successfully )?(?:submitted|received|sent)|your application has successfully been submitted|successfully submitted your application|thank you for (?:applying|your application)|we (?:have |have successfully )?received your application|application complete/i.test(value));
    return message ? { kind: "receipt", text: message.slice(0, 600) } : null;
  }
  function applicationErrors(document2) {
    return [...document2.querySelectorAll('[role="alert"],.field-error,.form-error,[data-automation-id="errorBanner"],.iCIMS_ErrorMessage')].filter(visibleApplicationControl).map((node) => text3(node.innerText || node.textContent)).filter((value) => /error|required|invalid|failed|could not|unable/i.test(value)).slice(0, 5).join(" ").slice(0, 800);
  }

  // extension/studio/autofill-profile.js
  var text4 = (value) => typeof value === "string" ? value.trim() : "";
  var words = (value) => String(value ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-[\].]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  var yesNo = (value) => value === true ? "Yes" : value === false ? "No" : value === "undisclosed" ? "Prefer not to disclose" : "";
  var identity = (node) => [node.name, node.id, node.getAttribute("data-automation-id")].filter(Boolean).join(" ");
  function history(node) {
    const own = identity(node), array = own.match(/(?:education|employment|experience|work|jobs?)(?:Data|History|Experience)?\[(\d+)\]/i);
    let context = words(own), index = array ? Number(array[1]) : null;
    for (let parent = composedParent(node); parent && !/^(FORM|BODY|HTML)$/.test(parent.tagName); parent = composedParent(parent)) {
      const description = [identity(parent), parent.getAttribute("data-section"), parent.querySelector(":scope > legend,:scope > h2,:scope > h3,:scope > h4")?.textContent].filter(Boolean).join(" ");
      context += " " + words(description);
      if (index === null) {
        const match = description.match(/(?:education|workExperience|work[- ]?experience|employment|experience)[-_ ](\d+)/i);
        if (match) index = Math.max(0, Number(match[1]) - 1);
      }
      if (/\beducation\b|\b(?:work|employment)(?:\s+history|\s+experience)?\b|\bexperience\b/.test(context)) break;
    }
    return { education: /\beducation\b/.test(context), work: /\b(?:work|employment|experience|job history)\b/.test(context), index: index ?? 0 };
  }
  function datePart(value, label) {
    const date = text4(value), us = date.match(/^(\d{1,2})\/(\d{4})$/), match = date.match(/^(\d{4})(?:[-/](\d{1,2}))?/) || (us ? [us[0], us[2], us[1]] : null);
    if (!match) return /\b(?:month|year)\b/.test(label) ? "" : date;
    if (/\byear\b/.test(label)) return match[1];
    if (/\bmonth\b/.test(label)) return match[2] ? String(Number(match[2])) : "";
    return us ? `${match[1]}-${match[2].padStart(2, "0")}` : date;
  }
  function phone(profile, node, label) {
    const contact = profile.contactData || {}, number = text4(contact.phoneNumber), code = text4(contact.phoneCountryCode), auto = words(node.autocomplete);
    if (/country code|dial(?:ing)? code|phone prefix/.test(label) || auto.endsWith("tel country code")) return code;
    if (/country/.test(label) && /phone|mobile|telephone/.test(label)) return contact.phoneCountry ? new Intl.DisplayNames(["en"], { type: "region" }).of(contact.phoneCountry) : "";
    const digits = number.replace(/\D/g, ""), national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (national.length === 10 && (code === "+1" || contact.phoneCountry === "US" || /^\+1\b/.test(number) || !code && !number.startsWith("+"))) return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
    if (auto.endsWith("tel national")) return code && number.startsWith(code) ? number.slice(code.length).trim() : number;
    if (!number) return "";
    return number.startsWith("+") || !code ? number : code + " " + number;
  }
  function profileFieldAnswer(node, profile, label) {
    const name = profile.nameData || {}, contact = profile.contactData || {}, address = profile.addressData || {}, site = profile.websiteData || {}, employment = profile.employmentData || {};
    const caption = words(label), field = words([label, identity(node)].join(" ")), auto = (node.autocomplete || "").split(" ").at(-1), scope = history(node);
    const education = (profile.educationData || [])[scope.index] || {}, job = (profile.jobData || [])[scope.index] || {};
    if (/consent|agree|certify|acknowledge|privacy|terms|signature/.test(caption)) return "";
    if (/\b(?:why|describe|explain)\b|tell us|tell me/.test(caption)) return "";
    if (/\blinked\s*in\b/.test(field)) return text4(site.linkedin) || (site.websites || []).find((value) => {
      try {
        return /(^|\.)linkedin\.com$/i.test(new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname);
      } catch {
        return false;
      }
    }) || "";
    if (/\bgit\s*hub\b/.test(field)) return text4(site.github);
    if (/sponsor|sponsorship/.test(caption)) return /authoriz|authoris|eligible|eligibility/.test(caption) ? "" : yesNo(employment.sponsorship);
    if (/(?:authorized|authorised|authorization|authorisation|eligible|eligibility).*(?:work|employment)|(?:work|employment).*(?:authorized|authorised|authorization|authorisation|eligibility)/.test(caption)) {
      const otherCountry = /\b(?:canada|united kingdom|uk|australia|germany|india)\b/.test(caption);
      return !otherCountry && (/\b(?:united states|u s|usa|us)\b/.test(caption) || /united states|^us$|^usa$/i.test(address.country || "")) ? yesNo(employment.eligibilityUS) : "";
    }
    if (/\bdisab(?:ility|ilities|led)\b/.test(caption)) return yesNo(employment.disability);
    if (/\bveteran\b/.test(caption)) return yesNo(employment.veteran);
    if (/hispanic|latino/.test(caption)) return yesNo(employment.hispanicOrLatino);
    if (/\bgender\b/.test(caption)) return text4(employment.gender);
    if (/\bethnicity\b|\brace\b/.test(caption)) return text4(employment.ethnicity);
    if (/\b(?:available|availability|earliest)\b.*\b(?:start|date)\b|\bstart date\b|\bwhen\b.*\bstart\b/.test(caption)) return text4(employment.availableStartDate);
    if (/\b(?:salary|compensation|pay)\b.*\b(?:expect|desir|require)|\b(?:expect|desir)\w*\b.*\b(?:salary|compensation|pay)\b/.test(caption)) return text4(employment.expectedSalary);
    if (/\b(?:work arrangement|preferred work|work preference)\b/.test(caption)) return text4(employment.workArrangement);
    if (/\bpreferred\s+(?:job\s+)?(?:role|title)\b/.test(caption)) return text4(employment.preferredRole);
    if (/\bpreferred location\b/.test(caption)) return text4(employment.preferredLocation);
    const isEducation = scope.education || /\b(?:school|university|college|degree|major|field of study|discipline|gpa|graduation)\b/.test(field);
    if (isEducation) {
      if (/\b(?:school|university|college|institution)\b/.test(caption) && !/degree|major/.test(caption) || /\bschool(?: name)?\b/.test(words(identity(node)))) return text4(education.school);
      if (/\b(?:major|field of study|discipline)\b/.test(field)) return text4(education.fieldOfStudy);
      if (/\bdegree\b|qualification|education level/.test(field)) return text4(education.degreeName) || text4(education.degree);
      if (/\bgpa\b/.test(field)) return text4(education.gpa);
      if (/currently (?:attending|studying|enrolled)/.test(caption)) return typeof education.currentlyAttending === "boolean" ? yesNo(education.currentlyAttending) : "";
      if (/\b(?:end|graduation|completion|to|last)\b/.test(caption)) return education.currentlyAttending ? "" : datePart(education.endDate, caption);
      if (/\b(?:start|from|first|enrollment)\b/.test(caption)) return datePart(education.startDate, caption);
      return "";
    }
    if (scope.work || /\b(?:current|most recent|previous)\b.*\b(?:employer|company|job|title)\b|^(?:(?:company|employer)(?: name)?|job title|position title)$/.test(caption)) {
      if (/\b(?:job|position) title\b|^title$/.test(caption)) return text4(job.jobTitle);
      if (/\bcompany\b|\bemployer\b/.test(caption) && !/contact|permission/.test(caption)) return text4(job.company);
      if (/\blocation\b/.test(caption)) return text4(job.location);
      if (/\b(?:description|responsibilities|achievements|duties)\b/.test(caption)) return text4(job.description);
      if (/currently (?:work|employed)/.test(caption)) return typeof job.currentlyWorkHere === "boolean" ? yesNo(job.currentlyWorkHere) : "";
      if (/\b(?:end|to|last)\b/.test(caption)) return job.currentlyWorkHere ? "" : datePart(job.endDate, caption);
      if (/\b(?:start|from|first)\b/.test(caption)) return datePart(job.startDate, caption);
      return "";
    }
    if (auto?.startsWith("tel") || /\b(?:phone|mobile|telephone|dialing)\b|country code/.test(field)) return phone(profile, node, field);
    const facts = {
      "given-name": name.firstName,
      "family-name": name.lastName,
      "additional-name": name.middleName,
      name: [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" "),
      email: contact.email,
      "street-address": [text4(address.line1), text4(address.line2)].filter(Boolean).join("\n"),
      "address-line1": address.line1,
      "address-line2": address.line2,
      "address-level2": address.city,
      "address-level1": address.state,
      "postal-code": address.postalCode,
      "country-name": address.country,
      country: address.country,
      url: site.personal,
      linkedin: site.linkedin,
      github: site.github,
      skills: (profile.skillsData || []).join(", ")
    };
    if (auto && facts[auto]) return text4(facts[auto]);
    if (/\bpreferred\b/.test(field) && /\bname\b/.test(field)) return text4(name.preferredFirstName);
    const rules = [[/\bfirst\s*name\b|\bgiven\s*name\b/, "given-name"], [/\blast\s*name\b|\bfamily\s*name\b|\bsurname\b/, "family-name"], [/\bmiddle\s*name\b/, "additional-name"], [/\bfull\s*name\b|^name(?: name)*$/, "name"], [/\be.?mail\b/, "email"], [/\blinkedin\b/, "linkedin"], [/\bgithub\b/, "github"], [/\bpostal\b|\bzip\b/, "postal-code"], [/\bcity\b/, "address-level2"], [/\bstate\b|\bprovince\b/, "address-level1"], [/\bcountry\b/, "country-name"], [/\baddress\s*(?:line\s*)?2\b/, "address-line2"], [/\baddress\s*(?:line\s*)?1\b|\bstreet\b|^address(?: address)*$/, "address-line1"], [/\bpersonal\s*(?:website|url)\b|\bportfolio\b|^website(?: website)*$/, "url"], [/^skills\b/, "skills"]];
    return text4(facts[rules.find(([pattern]) => pattern.test(field))?.[1]]);
  }

  // extension/studio/apply-choice-fields.js
  var text5 = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  var optionLabel = (node) => node.matches("input") ? formFieldCaption(node) || text5(node.value) : text5(node.getAttribute("aria-label") || node.label || node.textContent || node.value);
  var optionValue = (node) => node.getAttribute("data-value") ?? node.querySelector("input")?.value ?? node.getAttribute("value") ?? optionLabel(node);
  var disabled = (node) => node.disabled || node.getAttribute("aria-disabled") === "true" || !!node.closest("optgroup[disabled]");
  var chosen = (node) => node.selected || node.checked || node.getAttribute("aria-selected") === "true" || node.getAttribute("aria-checked") === "true" || !!node.querySelector("input:checked");
  var contains = (container, node) => {
    for (let item = node; item; item = composedParent(item)) if (item === container) return true;
    return false;
  };
  var comboScope = '[role="combobox"],.select-shell,.select__container,.Select,.select2-container,[data-automation-id^="formField-"]';
  function createChoiceFields(document2, { combos, visible }) {
    let groups = /* @__PURE__ */ new Map();
    function collect(raw) {
      groups = /* @__PURE__ */ new Map();
      const suppressed = /* @__PURE__ */ new Set(), owners = [];
      const suppress = (owner, scope) => {
        if (scope) {
          for (const node of raw) if (node !== owner && contains(scope, node)) suppressed.add(node);
        }
      };
      for (const node of raw.filter((node2) => node2.tagName === "SELECT")) {
        const proxy = nativeSelectProxy(node);
        if (proxy) {
          suppress(node, proxy);
          for (const menu of combos.menus(node, proxy)) suppress(node, menu);
        }
        if (node.multiple) groups.set(node, { kind: "native", multiple: true, scope: node, label: formFieldCaption(node) });
      }
      for (const item of raw.filter((node) => combos.isCombo(node) && !closestFormAncestor(composedParent(node), '[role="listbox"]'))) {
        if (suppressed.has(item) || owners.some((owner) => contains(owner.scope, item))) continue;
        const scope = closestFormAncestor(composedParent(item), comboScope) || item;
        const inside = raw.filter((node2) => contains(scope, node2) && !suppressed.has(node2));
        const node = inside.find((node2) => node2.tagName === "INPUT" && combos.isCombo(node2)) || inside.find((node2) => node2.tagName === "BUTTON" && combos.isCombo(node2)) || item;
        const menus = combos.menus(node, scope), multiple = [node, scope, ...menus].some((node2) => node2.getAttribute("aria-multiselectable") === "true") || scope.matches(".Select--multi,.select2-selection--multiple") || !!scope.querySelector('.select__multi-value,.Select--multi,.select2-selection--multiple,[class*="-multiValue"]');
        const label = formFieldCaption(node) || formFieldCaption(scope) || text5(scope.querySelector("label")?.textContent);
        const group = { kind: "combo", scope, node, label, multiple };
        groups.set(node, group);
        owners.push(group);
        suppress(node, scope);
        for (const menu of menus) suppress(node, menu);
        suppressed.delete(node);
      }
      for (const node of raw.filter((node2) => node2.matches('[role="listbox"],[role="radiogroup"]'))) {
        if (suppressed.has(node) || owners.some((owner) => combos.menus(owner.node, owner.scope).includes(node) || contains(owner.scope, node))) continue;
        groups.set(node, { kind: "list", scope: node, label: formFieldCaption(node), multiple: node.getAttribute("aria-multiselectable") === "true" });
        suppress(node, node);
      }
      for (const node of raw.filter((node2) => node2.type === "checkbox" && !suppressed.has(node2))) {
        const scope = closestFormAncestor(composedParent(node), 'fieldset,[role="group"][aria-label],[role="group"][aria-labelledby]');
        if (!scope || owners.some((owner) => contains(owner.scope, node))) continue;
        const label = formFieldCaption(scope) || text5(scope.querySelector(":scope > legend")?.textContent);
        if (!label || /consent|terms|privacy|acknowledge|certify/i.test(label)) continue;
        const members = raw.filter((other) => other.type === "checkbox" && !suppressed.has(other) && closestFormAncestor(composedParent(other), 'fieldset,[role="group"][aria-label],[role="group"][aria-labelledby]') === scope);
        if (members.length < 2) continue;
        groups.set(node, { kind: "checks", scope, members, label, multiple: true });
        for (const member of members) if (member !== node) suppressed.add(member);
      }
      return raw.filter((node) => !suppressed.has(node));
    }
    function nodes(node, { includeHidden = true } = {}) {
      const group = groups.get(node);
      if (!group) return [];
      if (group.kind === "native") return [...node.options];
      if (group.kind === "checks") return group.members;
      if (group.kind === "combo") return combos.options(node, { includeHidden, scope: group.scope });
      return queryFormTree(group.scope, '[role="option"],[role="radio"],input[type="checkbox"],input[type="radio"]').filter((item) => !item.matches("input") || !item.closest('[role="option"],[role="radio"]'));
    }
    function selected(node) {
      const group = groups.get(node), all = nodes(node), values = all.filter(chosen).map((item) => ({ value: item.tagName === "OPTION" || group.kind === "checks" ? item.value : optionValue(item), label: optionLabel(item) }));
      if (group.kind === "combo" && group.multiple && !values.length) {
        const labels = queryFormTree(group.scope, '.select__multi-value__label,.Select-value-label,.select2-selection__choice__display,[class*="-multiValue"] [class*="-label"]').map((node2) => text5(node2.textContent));
        const hidden = queryFormTree(group.scope, 'input[type="hidden"][name]').filter((node2) => node2.value);
        return labels.map((label, index) => ({ value: hidden[index]?.value || label, label }));
      }
      return values;
    }
    function info(node) {
      const group = groups.get(node);
      if (!group) return null;
      const options = nodes(node).map((item) => ({ value: item.tagName === "OPTION" || group.kind === "checks" ? item.value : optionValue(item), label: optionLabel(item), ...disabled(item) ? { disabled: true } : {} }));
      const selections = selected(node), answer = group.kind === "combo" && !group.multiple ? combos.value(node) : selections.map((item) => item.label).join(", ");
      return { label: group.label, type: group.multiple ? "select-multiple" : "select-one", multiple: group.multiple, options, answer, ...group.multiple ? { answerValues: selections.map((item) => item.value) } : {}, filled: !!answer, required: node.required || group.scope.getAttribute("aria-required") === "true" || !!group.members?.some((item) => item.required) };
    }
    function parse(answer) {
      if (Array.isArray(answer)) return answer.map(String);
      const value = String(answer ?? "").trim();
      if (!value) return [];
      if (value.startsWith("[")) {
        let values;
        try {
          values = JSON.parse(value);
        } catch {
          throw Error("Choose answers from the available options.");
        }
        if (!Array.isArray(values) || values.some((value2) => typeof value2 !== "string")) throw Error("Choose answers from the available options.");
        return [...new Set(values)];
      }
      return [value];
    }
    async function set(node, answer, { check = () => {
    } } = {}) {
      const group = groups.get(node);
      if (!group) return false;
      if (group.kind === "combo" && !group.multiple) {
        await combos.select(node, answer, { check });
        return true;
      }
      check();
      const wanted = parse(answer);
      if (!group.multiple && wanted.length > 1) throw Error("Choose one answer from the available options.");
      if (group.kind === "combo" && !nodes(node, { includeHidden: false }).length) {
        node.focus();
        node.click();
        for (let attempt = 0; attempt < 25 && !nodes(node, { includeHidden: false }).length; attempt++) {
          await new Promise((resolve) => document2.defaultView.setTimeout(resolve, 60));
          check();
        }
      }
      const available = nodes(node), matched = wanted.map((value) => available.find((item) => !disabled(item) && (optionValue(item) === value || item.value === value || combos.matches(node, optionLabel(item), value))));
      if (matched.some((item) => !item)) throw Error("Choose answers from the available dropdown options.");
      if (group.kind === "native") {
        for (const option of available) {
          check();
          option.selected = matched.includes(option);
        }
        node.dispatchEvent(new document2.defaultView.Event("input", { bubbles: true, composed: true }));
        node.dispatchEvent(new document2.defaultView.Event("change", { bubbles: true, composed: true }));
      } else {
        for (const previous of available) {
          const target = matched.includes(previous), value = optionValue(previous);
          if (disabled(previous)) continue;
          let option = nodes(node).find((item) => optionValue(item) === value);
          if (option && !!chosen(option) === target) continue;
          check();
          if (group.kind === "combo" && (!option || !visible(option))) {
            node.click();
            for (let attempt = 0; attempt < 25; attempt++) {
              await new Promise((resolve) => document2.defaultView.setTimeout(resolve, 60));
              check();
              option = nodes(node).find((item) => optionValue(item) === value && visible(item));
              if (option) break;
            }
          }
          if (!option || !visible(option)) throw Error("Choose an option");
          option.click();
          await new Promise((resolve) => document2.defaultView.setTimeout(resolve, 0));
          check();
        }
      }
      check();
      const actual = selected(node);
      if (wanted.length !== actual.length || matched.some((item) => !actual.some((value) => value.value === optionValue(item) || value.value === item.value))) throw Error("The employer did not accept all selected answers. Review this question on its page.");
      return true;
    }
    return { collect, info, set, has: (node) => groups.has(node), label: (node) => groups.get(node)?.label || "" };
  }

  // extension/studio/dock-apply-form.js
  function createApplyForm(document2, { uploadResume } = {}) {
    const win = document2.defaultView, ids = /* @__PURE__ */ new WeakMap(), nodes = /* @__PURE__ */ new Map(), uploadErrors = /* @__PURE__ */ new WeakMap(), uploadProofs = /* @__PURE__ */ new Map();
    let serial = 0, currentRun = null, paused = false, candidateProfile = {};
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const clean2 = (value) => normalize(value).slice(0, 2e3);
    const label = (node) => clean2((node.type === "file" ? uploadFieldLabel(node) : "") || formFieldCaption(node) || node.getAttribute("placeholder") || node.name || node.id);
    const fieldLabel = (node) => choices.label(node) || (node.type === "radio" ? clean2(closestFormAncestor(node, "fieldset")?.querySelector("legend")?.textContent) || label(node) : label(node));
    const visible = (node) => {
      for (let item = node; item; item = composedParent(item)) {
        if (item.disabled || item.matches('[hidden],[aria-hidden="true"],fieldset[disabled]')) return false;
        const style = win.getComputedStyle(item);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    };
    function writeValue(node, value) {
      const prototype = node.tagName === "SELECT" ? win.HTMLSelectElement.prototype : node.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
      node.dispatchEvent(new win.Event("input", { bubbles: true, composed: true }));
      node.dispatchEvent(new win.Event("change", { bubbles: true, composed: true }));
    }
    const combos = createComboboxController(document2, { visible, writeValue });
    const choices = createChoiceFields(document2, { combos, visible });
    const choiceErrors = /* @__PURE__ */ new Map();
    function key(node) {
      if (!ids.has(node)) {
        const previous = [...nodes].find(([, old]) => !old.isConnected && old.tagName === node.tagName && (node.id ? old.id === node.id : node.name && old.name === node.name) && (node.id || label(old) === label(node)));
        ids.set(node, previous?.[0] || `field-${++serial}`);
      }
      const id = ids.get(node);
      nodes.set(id, node);
      return id;
    }
    const sameRadioGroup = (node, other) => other.type === "radio" && other.name === node.name && other.form === node.form && other.getRootNode() === node.getRootNode();
    function controls() {
      const raw = queryFormTree(document2, 'input,textarea,select,[role="combobox"],[role="listbox"],[role="radiogroup"],button[aria-haspopup="listbox"]').filter((node) => (combos.isCombo(node) || !["hidden", "password", "submit", "button", "reset", "image"].includes(node.type)) && (!node.readOnly || combos.isCombo(node)) && (node.type === "file" ? visible(node) || !node.disabled && !node.closest("fieldset[disabled]") && !!uploadFieldLabel(node) && !!uploadFieldContainer(node) && visible(uploadFieldContainer(node)) : visible(node) || !node.disabled && nativeSelectProxy(node) && visible(nativeSelectProxy(node))));
      return choices.collect(raw);
    }
    function uploadedName(node) {
      const native = node.files?.[0]?.name;
      if (native) return native;
      const expected = uploadProofs.get(uploadFieldLabel(node));
      return expected && uploadFieldContainer(node)?.textContent.includes(expected) ? expected : "";
    }
    function hasValue(node) {
      return choices.has(node) ? choices.info(node).filled : node.type === "file" ? !!uploadedName(node) : ["checkbox", "radio"].includes(node.type) ? node.checked : combos.isCombo(node) ? !!combos.value(node) : !!normalize(node.value);
    }
    function valid(node) {
      return node.getAttribute("aria-invalid") !== "true" && (combos.isCombo(node) || !node.validity || node.validity.valid);
    }
    function entries() {
      const seen = /* @__PURE__ */ new Set(), fields = controls();
      return fields.filter((node) => {
        if (node.type !== "radio") return true;
        const group = `${key(node.form || node.getRootNode())}:${node.name || key(node)}`;
        if (seen.has(group)) return false;
        seen.add(group);
        return true;
      }).map((node) => {
        const radios = node.type === "radio" ? fields.filter((other) => sameRadioGroup(node, other)) : null;
        const selected = radios?.find((other) => other.checked), choice = choices.info(node);
        return {
          id: key(node),
          canAutofill: (node.type !== "checkbox" || !!choice) && node.type !== "file" && !!profileFieldAnswer(node, candidateProfile, fieldLabel(node)),
          kind: /\bwhy\b|\bdescribe\b|\btell us\b|\bcover letter\b|\bmotivat/i.test(fieldLabel(node)) ? "ai" : "fact",
          type: node.tagName === "BUTTON" ? "select-one" : node.type,
          filled: radios ? !!selected : hasValue(node) && valid(node),
          ...node.type === "file" && uploadErrors.has(node) ? { uploadError: uploadErrors.get(node) } : {},
          answer: radios ? selected?.value || "" : node.type === "file" ? uploadedName(node) : node.type === "checkbox" ? node.checked ? "Yes" : "" : combos.isCombo(node) ? combos.value(node) : String(node.value || "").slice(0, 1e4),
          options: radios ? radios.map((other) => ({ value: other.value, label: label(other) })) : node.tagName === "SELECT" ? [...node.options].map((option) => ({ value: option.value, label: option.textContent, ...option.disabled ? { disabled: true } : {} })) : combos.isCombo(node) ? combos.options(node).map((option) => ({ value: option.getAttribute("data-value") || option.textContent, label: option.textContent })) : [],
          ...choice,
          label: fieldLabel(node),
          ...choice ? { filled: choice.filled && valid(node) } : {},
          ...choiceErrors.has(key(node)) && !hasValue(node) ? { optionMessage: "Choose an option" } : {},
          required: !!(node.required || choice?.required || /\*/.test(fieldLabel(node)) || node.getAttribute("aria-required") === "true" || node.type === "file" && node.closest('[aria-required="true"]') !== null || radios?.some((other) => other.required))
        };
      });
    }
    function check(runId) {
      if (!currentRun || currentRun !== runId) throw Error("This form belongs to another autofill run.");
      if (paused) throw Error("Resume the paused run first.");
    }
    async function set(node, value, check2 = () => {
    }) {
      if (choices.has(node)) return choices.set(node, value, { check: check2 });
      if (combos.isCombo(node)) return combos.select(node, value, { check: check2 });
      if (node.type === "radio") {
        const radio = controls().find((other) => sameRadioGroup(node, other) && (other.value === value || combos.matches(node, label(other), value)));
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
        const option = [...node.options].find((option2) => !option2.disabled && option2.value && (option2.value.toLowerCase() === value.toLowerCase() || combos.matches(node, option2.textContent, value)));
        if (!option) throw Error("Choose a value from the employer dropdown.");
        value = option.value;
      }
      writeValue(node, value);
    }
    async function request(message) {
      const { action, runId } = message;
      if (message.profile && typeof message.profile === "object") candidateProfile = message.profile;
      if (action === "inspect") return scan();
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
        const profile = message.profile || {}, saved = message.answers || {}, pending = controls(), queued = new WeakSet(pending), attemptedDocuments = /* @__PURE__ */ new Set();
        const reconnect = () => {
          for (const node of controls()) if (!queued.has(node)) {
            queued.add(node);
            pending.push(node);
          }
        };
        for (let count = 0; count < 500 && count < pending.length; count++) {
          const node = pending[count];
          if (!node.isConnected) {
            reconnect();
            continue;
          }
          check(runId);
          if (!node.isConnected || hasValue(node) || node.type === "radio" && controls().some((other) => sameRadioGroup(node, other) && other.checked) || combos.isCombo(node) && normalize(node.value)) continue;
          const documentField = /cover.?letter/i.test(label(node)) || node.type === "file" && /resume|\bcv\b/i.test(label(node));
          if (Array.isArray(message.selectedIds) && !message.selectedIds.includes(key(node)) && !documentField) continue;
          if (node.type === "file") {
            const file = /cover.?letter/i.test(label(node)) ? message.coverLetter : /resume|\bcv\b/i.test(label(node)) ? message.resume : null;
            if (file?.resumeBase64 && !attemptedDocuments.has(label(node))) {
              attemptedDocuments.add(label(node));
              try {
                const mime = /\.docx$/i.test(file.fileName) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : /\.doc$/i.test(file.fileName) ? "application/msword" : /\.txt$/i.test(file.fileName) ? "text/plain" : /\.rtf$/i.test(file.fileName) ? "application/rtf" : "application/pdf";
                const accept = (node.accept || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
                if (accept.length && !accept.some((value) => value === "*/*" || value.startsWith(".") && file.fileName.toLowerCase().endsWith(value) || value === mime || value.endsWith("/*") && mime.startsWith(value.slice(0, -1)))) throw Error(`This field accepts ${node.accept}. ${file.fileName} cannot be attached.`);
                uploadErrors.delete(node);
                uploadProofs.set(label(node), file.fileName);
                if (uploadResume) await uploadResume(node, file);
                else {
                  const raw = file.resumeBase64.replace(/^data:[^,]*;base64,/i, ""), bytes = Uint8Array.from(win.atob(raw), (char) => char.charCodeAt(0)), transfer = new win.DataTransfer();
                  transfer.items.add(new win.File([bytes], file.fileName, { type: mime }));
                  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "files").set.call(node, transfer.files);
                  node.dispatchEvent(new win.Event("input", { bubbles: true, composed: true }));
                  node.dispatchEvent(new win.Event("change", { bubbles: true, composed: true }));
                }
              } catch (error) {
                uploadErrors.set(node, error.message || "The page did not accept this document.");
              }
            }
          } else {
            const type = choices.info(node)?.type || node.type;
            if (node.type === "checkbox" && !choices.has(node) && !message.edits?.[key(node)] && !saved[`${type}:${normalize(fieldLabel(node)).toLowerCase()}`]) continue;
            const value = message.edits?.[key(node)] || (/cover.?letter/i.test(label(node)) ? message.coverLetter?.text : "") || profileFieldAnswer(node, profile, fieldLabel(node)) || saved[`${type}:${normalize(fieldLabel(node)).toLowerCase()}`];
            if (value) try {
              choiceErrors.delete(key(node));
              await set(node, String(value), () => check(runId));
            } catch {
              if (choices.has(node) || combos.isCombo(node) || node.tagName === "SELECT") choiceErrors.set(key(node), true);
            }
          }
          await new Promise((resolve) => win.setTimeout(resolve, 0));
          reconnect();
        }
        check(runId);
        return scan();
      }
      if (action === "answer") {
        const node = nodes.get(message.fieldId);
        if (!node?.isConnected || fieldLabel(node) !== message.label) throw Error("The question changed. Rescan the page before filling it.");
        if (node.type === "file") throw Error("Upload this document on the employer page.");
        await set(node, String(message.answer || ""), () => check(runId));
        return scan();
      }
      throw Error("Unsupported form action.");
    }
    function scan() {
      const controls2 = applicationControls(document2), receipt = applicationReceipt(document2);
      return { url: document2.location.href, origin: win.origin, title: document2.title, fields: entries(), applyAvailable: controls2.some((control) => control.kind === "apply"), nextAvailable: controls2.some((control) => control.kind === "next"), submitAvailable: controls2.some((control) => control.kind === "submit"), success: !!receipt, receipt, errors: applicationErrors(document2) };
    }
    return { request, scan };
  }

  // extension/studio/workday-submission.js
  var WORKDAY_ARM = "application-tracker:workday-arm";
  var WORKDAY_RESULT = "application-tracker:workday-result";

  // extension/studio/apply-lifecycle.js
  function createApplyLifecycle(document2, { scan, emit, isTrusted = (event) => event.isTrusted } = {}) {
    const win = document2.defaultView;
    let binding = null, timer = null, poll = null, observer = null, last = "", url = "", disposed = false, attempt = null;
    const send = (event) => {
      if (binding) void Promise.resolve(emit({ ...binding, url: document2.location.href, ...event })).catch(() => {
      });
    };
    const changed = () => {
      if (!binding || disposed) return;
      const result = scan(), signature = JSON.stringify(result);
      if (signature !== last) {
        last = signature;
        send({ kind: "state", scan: result, receipt: applicationReceipt(document2), errors: applicationErrors(document2) });
      }
      url = document2.location.href;
    };
    const schedule = () => {
      if (timer !== null) return;
      timer = win.setTimeout(() => {
        timer = null;
        changed();
      }, 200);
    };
    const intent = (control) => {
      if (control.kind === "submit" && (!attempt || Date.now() - attempt.at > 1e3)) {
        attempt = { attemptId: submissionAttemptId(), pageUrl: document2.location.href, at: Date.now() };
        win.dispatchEvent(new win.CustomEvent(WORKDAY_ARM, { detail: JSON.stringify(attempt) }));
      }
      send({ ...control, kind: "intent", action: control.kind, attemptId: control.kind === "submit" ? attempt.attemptId : void 0, at: control.kind === "submit" ? attempt.at : void 0, receipt: applicationReceipt(document2) });
    };
    const click = (event) => {
      if (!binding || !isTrusted(event) || event.button !== 0) return;
      const node = event.composedPath().find((item) => item?.matches?.('a,button,input[type="submit"],input[type="button"],[role="button"]')), control = node && applicationControl(node);
      if (control) intent(control);
    };
    const submit = (event) => {
      if (!binding || !isTrusted(event)) return;
      intent(applicationFormSubmission(event.target, event.submitter));
    };
    const invalid = () => {
      attempt = null;
      send({ kind: "invalid", errors: "Complete the required fields on the employer page." });
    };
    const network = (event) => {
      try {
        const proof = JSON.parse(event.detail);
        if (binding && proof.attemptId === attempt?.attemptId) send({ kind: "network", proof });
      } catch {
      }
    };
    win.addEventListener(WORKDAY_RESULT, network);
    document2.addEventListener("click", click, true);
    document2.addEventListener("submit", submit, true);
    document2.addEventListener("invalid", invalid, true);
    document2.addEventListener("input", schedule, true);
    document2.addEventListener("change", schedule, true);
    function watch(value) {
      binding = value;
      last = JSON.stringify(scan());
      url = document2.location.href;
      if (!observer) {
        observer = new win.MutationObserver(schedule);
        observer.observe(document2.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-invalid", "hidden", "aria-hidden", "class", "disabled"] });
        poll = win.setInterval(() => {
          if (document2.location.href !== url) schedule();
        }, 500);
        win.addEventListener("popstate", schedule);
        win.addEventListener("hashchange", schedule);
      }
    }
    function stop(runId) {
      if (runId && binding?.runId !== runId) return;
      binding = null;
      observer?.disconnect();
      observer = null;
      if (timer !== null) win.clearTimeout(timer);
      if (poll !== null) win.clearInterval(poll);
      timer = poll = null;
      win.removeEventListener("popstate", schedule);
      win.removeEventListener("hashchange", schedule);
    }
    return { watch, stop, dispose() {
      disposed = true;
      stop();
      document2.removeEventListener("click", click, true);
      document2.removeEventListener("submit", submit, true);
      document2.removeEventListener("invalid", invalid, true);
      document2.removeEventListener("input", schedule, true);
      document2.removeEventListener("change", schedule, true);
      win.removeEventListener(WORKDAY_RESULT, network);
    } };
  }

  // extension/studio/speedy-submission-rules.js
  var SPEEDY_SUBMISSION_RULES = [
    { id: "workday", source: "wI / xI", host: /(^|\.)myworkday(?:jobs(?:-impl)?|site)?\.com$/, submit: 'button[data-automation-id="bottom-navigation-next-button"],button[data-automation-id="pageFooterNextButton"]', review: '[data-automation-id="reviewJobApplicationPage"],[data-automation-id="applyFlowReviewPage"]' },
    { id: "greenhouse", source: "oN / iN / JM / Uj", host: /(^|\.)greenhouse\.io$/, submit: '#submit_app,.application--submit button[type="submit"]', departure: 5e3 },
    { id: "lever", source: "IN / UN", host: /(^|\.)lever\.co$/, receipt: "div.thanks", submit: "#btn-submit" },
    { id: "successfactors", source: "fF / dF", host: /(^|\.)(successfactors|sapsf)\.(com|eu)$/, receipt: "#applyConfirmMsg", submit: 'span[role="button"][id*="submitBtn"],span[role="button"][id*="saveBtn"]' },
    { id: "icims", source: "SN / CN", host: /\.icims\.(com|eu)$/, receipt: ".iCIMS_SuccessMessage", receiptText: /application (?:has been|was) submitted|thank you/i },
    { id: "workable", source: "HF / qF", host: /^apply\.workable\.com$/, receipt: '[data-ui="successful-submit"]', submit: '[data-ui="apply-button"]' },
    { id: "rippling", source: "MP / OP / AP / Uj", host: /(^ats\.rippling\.com$|\.rippling-ats\.com$)/, submit: '#job-application-form button[type="submit"]', departure: 5e3, confirmation: "rippling" },
    { id: "breezy", source: "Kj / Qj / Uj", host: /\.breezy\.hr$/, submit: "button", submitText: /submit application/i, departure: 5e3 },
    { id: "jazzhr", source: "wN / kN / Uj", host: /\.(applytojob|theresumator)\.com$/, submit: "#resumator-submit-resume", departure: 5e3 },
    { id: "ashby", source: "Ej / Oj", host: /^jobs\.ashbyhq\.com$/, application: '[aria-labelledby="job-application-form"] .ashby-application-form-section-container', receipt: "h2", receiptText: /success/i, submit: "button.ashby-application-form-submit-button" },
    { id: "smartrecruiters", source: "QP / $P", host: /^jobs\.smartrecruiters\.com$/, receipt: "oc-success-page-content", submit: '[data-test="footer-submit"]', next: '[data-test="footer-next"]' },
    { id: "paylocity", source: "eP / tP", host: /^recruiting\.paylocity\.com$/, receipt: "#appSubmitResponseDiv", submit: 'button[data-automation-id="btnSubmit"]', next: 'button[data-automation-id="btnNext"]' },
    { id: "freshteam", source: "NM / RM", host: /\.freshteam\.com$/, receipt: "#applicant-success:not(.hide)" },
    { id: "dover", source: "_M / yM", host: /^app\.dover\.(io|com)$/, receipt: "div", receiptText: /thanks for applying!/i },
    { id: "pinpoint", source: "hP / yP", host: /\.pinpointhq\.com$/, receipt: "p", receiptText: /your application was received successfully\./i },
    { id: "comeet", source: "$j / nM", host: /^(www\.)?comeet\.co$/, receipt: "p", receiptText: /your application has been submitted/i },
    { id: "gusto", source: "sN / lN", host: /^jobs\.gusto\.com$/, receipt: "li:nth-child(3) span", receiptText: /thank you/i },
    { id: "polymer", source: "bP / SP", host: /^jobs\.polymer\.co$/, receipt: "h2", receiptText: /your application has been sent!/i },
    { id: "adp", source: "yj / Tj", host: /^workforcenow\.adp\.com$/, receipt: "#vdlContainerFluid .success-message-container", submit: "#submitApplication", next: "#ja_sv_cw_next_footer_btn" },
    { id: "jobvite", source: "AN / PN", host: /^jobs\.jobvite\.com$/, receipt: ".jv-page-applyconfirm", submit: 'button[aria-label="Send Application"]', next: 'button[aria-label="Next"]' },
    { id: "ultipro", source: "jF / MF", host: /\.ultipro\.(com|ca)$/, receipt: "#ApplicationSubmitted", submit: '[data-automation="btn-submit"]' },
    { id: "tesla", source: "pF / _F", host: /^(www\.)?tesla\.com$/, path: /^\/careers\/search\/job\/apply\/\d+\/?$/, receipt: 'div[class*="Confirmation_"]', submit: 'button[type="submit"]', next: 'button[name="next"]' },
    { id: "tiktok", source: "xF / kF", host: /^(careers\.tiktok\.com|lifeattiktok\.com)$/, submit: 'button[data-test="applyResumeBtn"]', confirmation: "tiktok" },
    { id: "eightfold", source: "MM / jM / TM", host: /\.eightfold\.ai$/, receipt: '[data-test-id="success-form"],h2#form-submission-success-message', submit: '[data-test-id="position-apply-button"],[data-test-id="submitApplicationButton"]' },
    { id: "seek", source: "NP / BP", host: /(^|\.)seek\.com\.au$/, receipt: "#applicationSent", submit: 'button[data-testid="review-submit-application"]', next: '[data-testid="continue-button"]' },
    { id: "bamboohr", source: "Lj / zj", host: /\.bamboohr\.com$/, receipt: "a", receiptText: /see all job openings/i, submit: "button", submitText: /submit application/i },
    { id: "dayforce", source: "hM / gM", host: /\.dayforcehcm\.com$/, receipt: 'div[test-id="success-dayforce-jobs"]', submit: 'button[test-id="application-submit"]' },
    { id: "indeed", source: "KI", host: /^(?:[a-z]{2}\.)?smartapply\.indeed\.com$/, confirmation: "indeed" },
    { id: "linkedin", source: "eL / nL / rL", host: /(^|\.)linkedin\.com$/, receipt: 'div[aria-labelledby="post-apply-modal"]', shadow: "#interop-outlet" },
    { id: "naukri", source: "iL / Uj", host: /^(www\.)?naukri\.com$/, submit: "#job_header #walkin-button,#job_header #apply-button,div.sendMsg", departure: 5e3 },
    { id: "phenom", source: "aP / mP / Uj", selector: "head[data-ph-id]", submit: "button.btn-submit", next: "button.btn-next", departure: 3e4 }
  ];
  function speedyRuleForUrl(value) {
    try {
      const url = new URL(value);
      return SPEEDY_SUBMISSION_RULES.find((rule) => rule.host?.test(url.hostname) && (!rule.path || rule.path.test(url.pathname))) || null;
    } catch {
      return null;
    }
  }
  function speedyRuleForDocument(document2) {
    return speedyRuleForUrl(document2.location.href) || SPEEDY_SUBMISSION_RULES.find((rule) => rule.selector && document2.querySelector(rule.selector)) || null;
  }

  // extension/studio/speedy-submission-adapters.js
  var clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  function speedyApplicationMetadata(document2, rule = speedyRuleForDocument(document2)) {
    if (!rule) return null;
    const page = new URL(document2.location.href), url = page.href, q = (selector) => document2.querySelector(selector), xpath = (selector) => document2.evaluate?.(selector, document2, null, 9, null)?.singleNodeValue, text6 = (selector) => clean(q(selector)?.textContent), href = (selector) => q(selector)?.href || "", origin = (value) => {
      try {
        return value ? new URL(value, url).origin : "";
      } catch {
        return "";
      }
    };
    let jobTitle = "", jobLink = "", companyLink = "", companyName = "", match;
    switch (rule.id) {
      case "workday":
        jobTitle = text6('h3,[data-automation-id="jobTitleHeading"],[data-automation-id="jobPostingHeader"]');
        companyLink = href('a[data-automation-id="logoLink"]') || url.match(/(https?:\/\/[^/]+\/(?:en-US\/)?[^/]+)/)?.[1] || "";
        jobLink = url.includes("/apply") ? url.slice(0, url.indexOf("/apply")) : url;
        break;
      case "greenhouse": {
        jobTitle = text6(".job__title h1,h1.app-title");
        companyName = document2.title.split(" at ")[1]?.trim() || "";
        jobTitle ||= document2.title.split(" at ")[0]?.replace("Job Application for ", "").trim() || "";
        companyLink = origin(href("a.logo"));
        if (page.pathname.includes("/embed/job_app")) {
          companyLink ||= page.origin + "/" + page.searchParams.get("for");
          jobLink = page.origin + "/" + page.searchParams.get("for") + "/jobs/" + page.searchParams.get("token");
          if (/^boards(?:\.eu)?\.greenhouse\.io$/.test(page.hostname) && page.searchParams.get("b")) {
            const external = page.searchParams.get("b");
            jobLink = external + "?gh_jid=" + page.searchParams.get("token");
            companyLink = origin(external);
            jobTitle = q('meta[property="og:title"]')?.content || jobTitle;
          }
        } else {
          jobLink = url.match(/(https:\/\/.+?\/jobs\/\d+)/)?.[1] || "";
          companyLink ||= url.match(/(https?:\/\/[^/]+\/[^/]+)/)?.[1] || "";
        }
        break;
      }
      case "lever":
        jobTitle = text6("h2,.posting-headline h2");
        companyName = document2.title.split(" - ")[0]?.trim() || "";
        companyLink = href(".main-footer-text p:first-child a") || url.match(/(https:\/\/jobs(?:\.[a-z]+)?\.lever\.co\/[^/]+)/)?.[1] || "";
        jobLink = url.replace(/\/(?:apply|thanks)(?:[/?#].*)?$/, "");
        break;
      case "ashby":
        jobTitle = text6("h1");
        companyLink = href("a.navLogoLink") || url.match(/^(https:\/\/jobs\.ashbyhq\.com\/[^/]+)/)?.[1] || "";
        companyName = q("a img")?.alt || document2.title.split(" @ ").pop()?.trim() || "";
        jobLink = url.match(/^(https:\/\/jobs\.ashbyhq\.com\/[^/]+\/[a-f0-9-]+)/)?.[1] || "";
        break;
      case "bamboohr":
        jobTitle = text6("h3");
        match = url.match(/^(https:\/\/[^/]+\.bamboohr\.com\/careers)(?:\/(\d+))?/);
        companyLink = match?.[1] || "";
        jobLink = match?.[2] ? `${companyLink}/${match[2]}` : "";
        break;
      case "breezy":
        jobTitle = text6("#heroBackgroundColor h1");
        jobLink = url.match(/^(https:\/\/[^/]+\.breezy\.hr\/p\/[a-z0-9]+-[^/]+)/)?.[1] || "";
        companyLink = page.origin;
        break;
      case "dayforce":
        jobTitle = text6('h1[test-id="job-detail-title"]');
        jobLink = url.split("/apply")[0];
        companyLink = url.split("/jobs/")[0];
        break;
      case "dover":
        jobTitle = clean(xpath("//a[img]/../following-sibling::div[1]/div | //img/../following-sibling::div[1]/div")?.textContent);
        companyLink = xpath("//a[img]")?.href || xpath("//a[@href='https://dover.com']/following::a[1]")?.href || "";
        if (companyLink.endsWith("/audit")) companyLink = companyLink.slice(0, -6);
        companyName = document2.title.split(" at ").pop()?.trim() || "";
        jobLink = url.match(/(https:\/\/app\.dover\.(?:io|com)\/apply\/[^/]+\/[a-f0-9-]+)/)?.[1] || "";
        break;
      case "eightfold":
        jobTitle = text6(".apply-position-title,.jobCartPositionName");
        jobLink = href('link[rel="canonical"]') || (page.searchParams.has("pid") ? `${page.origin}${page.pathname}?pid=${page.searchParams.get("pid")}` : url);
        companyLink = url.match(/^(https?:\/\/[^/]+\/careers)/)?.[1] || page.origin;
        companyName = (q('meta[name="description"]')?.content || "").replace(/^careers at /i, "");
        break;
      case "freshteam":
        jobTitle = text6("h1.brand-color");
        jobLink = url;
        companyLink = url.match(/(https:\/\/[^.]+\.freshteam\.com\/jobs)/)?.[1] || "";
        break;
      case "gusto":
        jobTitle = text6("li:nth-child(2) a");
        jobLink = href("li:nth-child(2) a") || url.match(/(https:\/\/jobs\.gusto\.com\/postings\/[^/]+-[a-f0-9-]+)/)?.[1] || url.replace(/\/applicants(?:\/new)?$/, "");
        companyLink = href("li:nth-child(1) a");
        break;
      case "icims":
        jobTitle = text6("h1.iCIMS_Header");
        jobLink = url.match(/(https:\/\/[^/]+\.icims\.(?:com|eu)\/jobs\/\d+(?:\/[^/]+)?\/job)/)?.[1] || "";
        companyLink = origin(href('link[rel="canonical"]'));
        if (!companyLink) {
          const root = url.match(/(https:\/\/[^/]+\.icims\.(?:com|eu)\/jobs)/)?.[1];
          companyLink = root ? root + "/dashboard" : "";
        }
        break;
      case "jazzhr": {
        jobTitle = text6(".job_title,.job-header h1");
        companyLink = q("#resumator-view-our-website-text")?.parentElement?.href || url.match(/(https:\/\/[^/]*\.(?:applytojob|theresumator)\.com\/apply)/)?.[1] || "";
        jobLink = url;
        try {
          const data = JSON.parse(q('script[type="application/ld+json"]')?.textContent || "{}");
          if (data["@type"] === "Organization") companyName = data.name || "";
        } catch {
        }
        companyName ||= document2.title.match(/-\s*([^-\n]+?)(?:\s*-\s*Career Page)?$/)?.[1]?.trim() || "";
        break;
      }
      case "jobvite":
        companyName = [...document2.querySelectorAll('script[type="text/javascript"]')].find((node) => node.textContent.includes("function getCompanyName()"))?.textContent.match(/return\s+['"](.+?)['"]/)?.[1] || document2.title.replace(/\s*Careers\s*$/i, "").trim();
        jobLink = url.match(/^(https:\/\/jobs\.jobvite\.com\/[^/]+\/job\/[^/]+)/)?.[1] || "";
        companyLink = url.match(/^(https:\/\/jobs\.jobvite\.com\/[^/]+)/)?.[1] || "";
        break;
      case "paylocity":
        jobTitle = text6(".job-apply-title > span");
        companyLink = [...document2.querySelectorAll("a")].find((node) => /view all jobs/i.test(node.textContent))?.href || "";
        match = url.match(/^https:\/\/recruiting\.paylocity\.com\/Recruiting\/Jobs\/([^/]+)\/([^/]+)/i);
        jobLink = match ? "https://recruiting.paylocity.com/Recruiting/Jobs/Details/" + match[2] : "";
        break;
      case "phenom":
        jobTitle = text6("#job-description-url");
        jobLink = href("#job-description-url");
        companyLink = origin(jobLink);
        break;
      case "pinpoint":
        jobTitle = text6("a > span");
        jobLink = url.match(/^(https:\/\/[^/]+\.pinpointhq\.com\/[^/]+\/postings\/[a-f0-9-]+)/)?.[1] || "";
        companyLink = page.origin;
        break;
      case "polymer":
        jobTitle = text6(".title");
        companyLink = href(".header__website") || url.match(/(https:\/\/jobs\.polymer\.co\/[^/]+)/)?.[1] || "";
        jobLink = url.match(/(https:\/\/jobs\.polymer\.co\/[^/]+\/\d+)/)?.[1] || "";
        break;
      case "rippling":
        jobTitle = text6(".job-title-container h2") || document2.title.replace("Apply - ", "");
        companyLink = href(".company-logo a") || url.match(/^(https:\/\/ats\.rippling\.com\/[^/]+\/jobs)/)?.[1] || page.origin;
        jobLink = url.match(/^(https:\/\/ats\.rippling\.com\/[^/]+\/jobs\/[^/]+)/)?.[1] || url.split("?")[0];
        break;
      case "seek":
        jobTitle = text6("h1");
        jobLink = url.match(/^(https:\/\/(?:www\.)?seek\.com\.au\/job\/\d+)/)?.[1] || "";
        break;
      case "smartrecruiters":
        jobTitle = text6('p[data-test="topbar-job-title"]');
        companyName = q('img[data-test="topbar-logo"]')?.alt?.replace(/\s*Logo\s*$/i, "").trim() || document2.title.split(" - ").pop()?.trim() || "";
        match = url.match(/^https:\/\/jobs\.smartrecruiters\.com\/oneclick-ui\/company\/([^/]+)\/(?:job|publication)\/([^/]+)/);
        jobLink = match ? `https://jobs.smartrecruiters.com/${match[1]}/${match[2]}` : "";
        companyLink = match ? `https://careers.smartrecruiters.com/${match[1]}` : "";
        break;
      case "successfactors":
        jobTitle = text6('[id*="pageTitle"] h1');
        companyLink = href('.customheaderimagecontainer a,img[class*="logo"]') || q('img[class*="logo"]')?.parentElement?.href || "";
        break;
      case "tesla":
        jobTitle = text6('p[class*="JobTitle_"]');
        jobLink = url.replace(/\/job\/apply\/(\d+).*$/, "/job/$1");
        companyLink = "https://www.tesla.com/";
        break;
      case "tiktok":
        jobTitle = text6('[class*="resumeEditForm-headerText"]');
        match = url.match(/^(https:\/\/(?:careers\.tiktok\.com|lifeattiktok\.com))\/resume\/(\d+)\/apply$/);
        jobLink = match ? `${match[1]}/position/${match[2]}/detail` : "";
        companyLink = page.origin + "/";
        break;
      case "ultipro":
        jobTitle = text6("h1").replace(/^You applied for /, "");
        companyLink = href("a.navbar-brand") || url.match(/^https:\/\/[^/]+\.ultipro\.(?:com|ca)\/[^/]+\/JobBoard\/[^/]+/)?.[0] || "";
        break;
      case "workable":
        jobTitle = text6('h1[data-ui="job-title"]');
        companyLink = href('[data-ui="company-url"]') || url.match(/(https:\/\/apply\.workable\.com\/[^/]+)/)?.[1] || "";
        companyName = q('[data-ui="header-logo"] img')?.alt || document2.title.split(" - ").pop()?.trim() || "";
        jobLink = url.match(/(https:\/\/apply\.workable\.com\/[^/]+\/j\/[^/]+\/)/)?.[1] || "";
        break;
      case "adp":
        companyLink = "https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=" + page.searchParams.get("cid");
        jobLink = companyLink + "&jobId=" + page.searchParams.get("jobId");
        break;
      case "indeed": {
        jobTitle = text6(".ia-JobHeader h1");
        companyName = text6(".ia-JobHeader span").split(" - ")[0];
        let id = page.searchParams.get("jk");
        for (const script of document2.querySelectorAll("script:not([src])")) id ||= script.textContent.match(/"jk"\s*:\s*"([^"]+)"/)?.[1];
        if (id) jobLink = `https://www.indeed.com/viewjob?jk=${id}`;
        companyLink = companyName && !/confidential/i.test(companyName) ? "https://www.indeed.com/cmp/" + companyName.replace(/\s+/g, "-") : "";
        break;
      }
      case "linkedin":
        jobTitle = text6("main .job-view-layout.jobs-details h1");
        companyName = text6(".job-details-jobs-unified-top-card__company-name a");
        companyLink = href(".job-details-jobs-unified-top-card__company-name a").replace(/\/life\/?$/, "");
        if (!jobTitle) {
          jobTitle = clean(xpath("//a[@data-view-name='job-apply-button']/ancestor::*[.//a[contains(@href, 'linkedin.com/company')]//figure][1]//a[contains(@href, 'linkedin.com/jobs') and not(@data-view-name='job-apply-button')]")?.textContent);
          const company = xpath("//a[@data-view-name='job-apply-button']/ancestor::*[.//a[contains(@href, 'linkedin.com/company')]//figure][1]//a[contains(@href, 'linkedin.com/company')]//figure/following-sibling::p/a");
          companyLink = company?.href?.replace(/\/life\/?$/, "") || companyLink;
          companyName = clean(company?.textContent) || companyName;
        }
        match = page.searchParams.get("currentJobId") || page.pathname.match(/\/jobs\/view\/([^/]+)/)?.[1];
        if (match) jobLink = "https://www.linkedin.com/jobs/view/" + match + "/";
        break;
      case "naukri":
        jobTitle = text6("#job_header h1");
        companyLink = q("#job_header a:has(img)")?.href || "";
        match = url.match(/job-listings-[a-z0-9-]+-(\d+)\b/);
        jobLink = match ? "https://www.naukri.com/job-listings-" + match[1] : "";
        break;
      case "comeet": {
        const data = [...document2.querySelectorAll("script")].find((node) => /POSITION_DATA/.test(node.textContent || ""))?.textContent || "", position = data.indexOf('"position_uid"'), stack = [];
        let quoted = false, escaped = false, object = "";
        for (let index = 0; position >= 0 && index < data.length && !object; index++) {
          const char = data[index];
          if (quoted) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') quoted = false;
          } else if (char === '"') quoted = true;
          else if (char === "{") stack.push(index);
          else if (char === "}") {
            const start = stack.pop();
            if (start !== void 0 && start <= position && index >= position) object = data.slice(start, index + 1);
          }
        }
        const field = (name) => {
          const value = object.match(new RegExp('"' + name + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
          try {
            return value ? JSON.parse('"' + value[1] + '"') : "";
          } catch {
            return "";
          }
        };
        jobTitle = field("name");
        companyName = field("company_name");
        jobLink = field("careers_page_url");
        companyLink = jobLink.split("/").slice(0, -2).join("/");
        break;
      }
    }
    return { jobTitle: clean(jobTitle).slice(0, 500), jobLink: jobLink || url, companyLink: companyLink || "", companyName: clean(companyName).slice(0, 300) };
  }
  function speedySubmissionSnapshot(document2) {
    const rule = speedyRuleForDocument(document2);
    if (!rule) return null;
    const visible = (node) => {
      if (!node || node.closest('[hidden],[aria-hidden="true"]')) return false;
      for (let item = node; item; item = item.parentElement) {
        const style = document2.defaultView.getComputedStyle(item);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    };
    let receipt = null;
    if (rule.receipt) {
      const roots = [document2];
      if (rule.shadow && document2.querySelector(rule.shadow)?.shadowRoot) roots.push(document2.querySelector(rule.shadow).shadowRoot);
      for (const root of roots) {
        const node = [...root.querySelectorAll(rule.receipt)].find((node2) => visible(node2) && (!rule.receiptText || rule.receiptText.test(node2.textContent)));
        if (node) {
          receipt = { kind: "speedy-receipt", provider: rule.id, rule: rule.source, text: clean(node.textContent).slice(0, 600) || "Application submitted" };
          break;
        }
      }
    }
    const page = new URL(document2.location.href);
    if (rule.confirmation === "rippling" && page.searchParams.get("step") === "confirmation" || rule.confirmation === "tiktok" && page.pathname === "/resume/applied" || rule.confirmation === "indeed" && page.pathname.includes("post-apply")) receipt = { kind: "speedy-route", provider: rule.id, rule: rule.source, text: "Application submitted", url: page.href };
    let stage = "Application form";
    const stages = [['[data-automation-id="quickApplyPage"],[data-automation-id="applyFlowAutoFillPage"]', "Resume"], ['[data-automation-id="contactInformationPage"],[data-automation-id="applyFlowMyInfoPage"],#step--personal,oc-oneclick-form', "Personal information"], ['[data-automation-id="myExperiencePage"],[data-automation-id="applyFlowMyExpPage"]', "Experience"], ['[data-automation-id="primaryQuestionnairePage"],[data-automation-id="applyFlowPrimaryQuestionsPage"],[data-automation-id="secondaryQuestionnairePage"],[data-automation-id="applyFlowSecondaryQuestionsPage"],sr-screening-questions-form,#step--job', "Application questions"], ['[data-automation-id="voluntaryDisclosuresPage"],[data-automation-id="applyFlowVoluntaryDisclosuresPage"],#step--legal', "Disclosures"], ['[data-automation-id="selfIdentificationPage"],[data-automation-id="applyFlowSelfIdentifyPage"],#step--eeo', "Self identification"], ['[data-automation-id="reviewJobApplicationPage"],[data-automation-id="applyFlowReviewPage"],#pcty-wr-preview-jobapplication', "Review application"]];
    for (const [selector, label] of stages) if ([...document2.querySelectorAll(selector)].some(visible)) stage = label;
    const active = document2.querySelector('ol button[aria-current="step"],.iCIMS_Steps_Current');
    if (active && visible(active)) stage = clean(active.textContent) || stage;
    return { provider: rule.id, source: rule.source, metadata: speedyApplicationMetadata(document2, rule), stage, receipt };
  }
  function speedySubmissionControl(node, rule = speedyRuleForDocument(node.ownerDocument)) {
    if (!rule || node.disabled || node.closest('[disabled],[aria-disabled="true"]')) return null;
    const submit = rule.submit && node.closest(rule.submit), next = rule.next && node.closest(rule.next);
    if (submit && rule.id === "workable") {
      const form = submit.form || submit.closest("form");
      if (!form?.querySelector('input[type="email"],input[type="file"],input[autocomplete="given-name"],input[name="firstname"],input[name="first_name"],textarea')) return { kind: "apply", node: submit };
    }
    if (submit && (!rule.submitText || rule.submitText.test(submit.textContent)) && (!rule.review || node.ownerDocument.querySelector(rule.review))) return { kind: "submit", node: submit };
    if (next) return { kind: "next", node: next };
    return null;
  }

  // extension/ai-apply/src/application-identity.mjs
  function applicationUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null;
    } catch {
      return null;
    }
  }
  function applicationPageKey(value) {
    const url = applicationUrl(value);
    if (!url) return "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|jr_id|trk|trackingId|refId|referral|source)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
  }
  function applicationIdentity(value) {
    const url = applicationUrl(value);
    if (!url) return null;
    const host = url.hostname.toLowerCase(), path = url.pathname.replace(/\/+$/, ""), query = (...keys) => keys.map((key) => url.searchParams.get(key)).find(Boolean), result = (provider, tenant, id) => id ? { provider, tenant, id, key: [provider, tenant, id].join(":") } : null;
    let match;
    if (/(^|\.)smartrecruiters\.com$/.test(host)) {
      match = path.match(/^\/oneclick-ui\/company\/([^/]+)\/(?:job|publication)\/([^/]+)/i);
      if (match) return result("smartrecruiters", match[1].toLowerCase(), match[2].replace(/^(\d+)-.*$/, "$1"));
      match = path.match(/^\/([^/]+)\/(\d+)(?:-[^/]*)?(?:\/.*)?$/);
      if (match) return result("smartrecruiters", match[1].toLowerCase(), match[2]);
    }
    if (/(^|\.)greenhouse\.io$/.test(host)) {
      match = path.match(/^\/([^/]+)\/jobs\/([^/]+)/);
      return /\/embed\//.test(path) ? result("greenhouse", query("for"), query("token")) : match ? result("greenhouse", match[1], match[2]) : null;
    }
    if (/(^|\.)lever\.co$/.test(host) && (match = path.match(/^\/([^/]+)\/([^/]+)(?:\/(?:apply|thanks))?$/))) return result("lever", host + "/" + match[1], match[2]);
    if (/(^|\.)myworkday(?:jobs(?:-impl)?|site)?\.com$/.test(host) && (match = path.match(/^(.*?\/job\/.+?)(?:\/apply(?:\/.*)?)?$/))) return result("workday", host, match[1]);
    if (/(^|\.)icims\.com$/.test(host) && (match = path.match(/^\/jobs\/(\d+)(?:\/|$)/))) return result("icims", host, match[1]);
    if (/(^|\.)adp\.com$/.test(host)) return result("adp", host + "/" + (query("cid", "client", "ncsp") || path.split("/")[1]), query("jobId", "jobid", "reqId", "_reqID", "r"));
    if (/\.oraclecloud\.com$/.test(host) && (match = path.match(/^\/hcmUI\/CandidateExperience\/([^/]+)(?:\/sites\/([^/]+))?\/(?:job|jobs\/preview)\/([^/]+)/))) return result("oracle", host + "/" + match[1] + "/" + (match[2] || "jobsearch"), match[3]);
    if (host === "apply.workable.com" && (match = path.match(/^\/([^/]+)\/j\/([^/]+)/))) return result("workable", host + "/" + match[1], match[2]);
    if (/(^|\.)ashbyhq\.com$/.test(host) && (match = path.match(/^\/([^/]+)\/([^/]+)/))) return result("ashby", host + "/" + match[1], match[2]);
    if (/(^|\.)linkedin\.com$/.test(host)) return result("linkedin", host, query("currentJobId") || path.match(/\/jobs\/view\/(\d+)/)?.[1]);
    if (query("jobId", "jobid", "job_id", "reqId", "requisitionId", "pid", "token")) return result("query", url.origin + "/" + path.replace(/\/(?:apply|application|step[^/]*)\b.*$/i, "") + "/" + (query("cid", "company", "tenant", "clientId", "for") || ""), query("jobId", "jobid", "job_id", "reqId", "requisitionId", "pid", "token"));
    match = path.match(/^(.*?\/(?:jobs?|positions?|postings?)\/[^/]+)(?:\/(?:apply|application|step[^/]*|confirmation|thanks|submitted)(?:\/.*)?)?$/i);
    if (match) return result("path", url.origin, match[1]);
    const fallback = new URL(applicationPageKey(url.href));
    fallback.pathname = path.replace(/\/(?:apply|application)\/?$/i, "") || "/";
    return result("page", url.origin, fallback.pathname + fallback.search + fallback.hash);
  }
  function sameApplicationUrl(left, right) {
    if (!applicationPageKey(left) || !applicationPageKey(right)) return false;
    const a = applicationIdentity(left), b = applicationIdentity(right);
    return a && b && a.key === b.key || applicationPageKey(left) === applicationPageKey(right);
  }

  // extension/studio/speedy-submission-tracker.js
  function createSpeedySubmissionTracker(document2, { emit, isTrusted = (event) => event.isTrusted, now = Date.now } = {}) {
    const rule = speedyRuleForDocument(document2);
    if (!rule) return { dispose() {
    } };
    const win = document2.defaultView;
    let alive = true, metadata = null, last = "", attempt = null, timer = null, refreshing = false, again = false, applicationSeen = !rule.application;
    const sent = /* @__PURE__ */ new Set();
    async function send(kind, extra = {}) {
      if (!alive) return;
      try {
        return await emit({ kind, provider: rule.id, url: document2.location.href, metadata, ...extra });
      } catch (error) {
        if (/context invalidated/i.test(error.message)) dispose();
      }
    }
    async function refresh() {
      if (!alive) return;
      if (refreshing) {
        again = true;
        return;
      }
      refreshing = true;
      try {
        const snapshot = speedySubmissionSnapshot(document2);
        if (!snapshot) return;
        applicationSeen ||= !!document2.querySelector(rule.application);
        const next = snapshot.metadata;
        if (metadata && !snapshot.receipt && !sameApplicationUrl(metadata.jobLink, next.jobLink)) metadata = null;
        metadata = Object.fromEntries(["jobTitle", "jobLink", "companyLink", "companyName"].map((key) => [key, metadata?.[key] || next[key] || ""]));
        const signature = JSON.stringify([document2.location.href, metadata, snapshot.stage]);
        if (signature !== last) {
          last = signature;
          await send("speedy-context", { stage: snapshot.stage });
        }
        if (applicationSeen && snapshot.receipt) {
          const key = JSON.stringify([metadata.jobLink, snapshot.receipt]);
          if (!sent.has(key)) {
            const result = await send("speedy-confirmed", { proof: snapshot.receipt });
            if (result?.ok !== false) sent.add(key);
          }
        }
      } finally {
        refreshing = false;
        if (again) {
          again = false;
          void refresh();
        }
      }
    }
    function schedule() {
      if (timer !== null) return;
      timer = win.setTimeout(() => {
        timer = null;
        void refresh();
      }, 200);
    }
    function intent(control) {
      if (!control) return;
      if (control.kind === "submit") {
        if (!attempt || now() - attempt.at > 1e3) attempt = { attemptId: submissionAttemptId(), at: now(), pageUrl: document2.location.href };
        if (rule.id === "workday") win.dispatchEvent(new win.CustomEvent(WORKDAY_ARM, { detail: JSON.stringify(attempt) }));
      }
      void send("speedy-intent", { action: control.kind, attemptId: attempt?.attemptId, at: attempt?.at });
    }
    function click(event) {
      if (!isTrusted(event) || event.button !== 0) return;
      const control = event.composedPath().filter((node) => node?.nodeType === 1).map((node) => speedySubmissionControl(node, rule) || applicationControl(node)).find(Boolean);
      if (control) intent(control);
    }
    function submit(event) {
      if (isTrusted(event)) intent(speedySubmissionControl(event.submitter || event.target, rule) || applicationFormSubmission(event.target, event.submitter));
    }
    function invalid() {
      attempt = null;
      void send("speedy-invalid", { message: "Complete the required fields on the employer page." });
    }
    function departure() {
      const limit = rule.id === "naukri" && document2.querySelector("div.sendMsg") ? 8e3 : rule.departure;
      if (limit && attempt && now() - attempt.at <= limit && !applicationErrors(document2)) void send("speedy-confirmed", { attemptId: attempt.attemptId, proof: { kind: "speedy-departure", provider: rule.id, rule: rule.source, at: attempt.at } });
    }
    function network(event) {
      try {
        const proof = JSON.parse(event.detail);
        if (rule.id === "workday" && attempt?.attemptId === proof.attemptId) void send("speedy-confirmed", { attemptId: attempt.attemptId, proof: { ...proof, kind: "speedy-workday", provider: rule.id, rule: rule.source } });
      } catch {
      }
    }
    const observer = new win.MutationObserver(schedule);
    observer.observe(document2.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "aria-hidden", "aria-current", "disabled"] });
    const poll = win.setInterval(() => void refresh(), 1e3);
    document2.addEventListener("click", click, true);
    document2.addEventListener("submit", submit, true);
    document2.addEventListener("invalid", invalid, true);
    win.addEventListener("beforeunload", departure);
    win.addEventListener(WORKDAY_RESULT, network);
    win.addEventListener("popstate", schedule);
    win.addEventListener("hashchange", schedule);
    void refresh();
    function dispose() {
      alive = false;
      observer.disconnect();
      win.clearInterval(poll);
      if (timer !== null) win.clearTimeout(timer);
      document2.removeEventListener("click", click, true);
      document2.removeEventListener("submit", submit, true);
      document2.removeEventListener("invalid", invalid, true);
      win.removeEventListener("beforeunload", departure);
      win.removeEventListener(WORKDAY_RESULT, network);
      win.removeEventListener("popstate", schedule);
      win.removeEventListener("hashchange", schedule);
    }
    return { dispose, refresh };
  }

  // src/dock-apply-content.js
  if (!globalThis.__applicationTrackerApplyBridge) {
    globalThis.__applicationTrackerApplyBridge = true;
    const form = createApplyForm(document);
    const emit = async (event) => {
      const reply = await chrome.runtime.sendMessage({ type: "ai-apply.lifecycle", event });
      if (event.runId && reply?.ok && reply.value?.watch === false) lifecycle.stop(event.runId);
      return reply;
    };
    let lifecycle = createApplyLifecycle(document, { scan: () => form.scan(), emit });
    let submissionTracker = createSpeedySubmissionTracker(document, { emit });
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
      if (sender.id !== chrome.runtime.id || sender.tab || sender.url && sender.url !== chrome.runtime.getURL("service-worker.js") || message?.target !== "dock-apply-form:v1") return false;
      Promise.resolve().then(async () => {
        const result = await form.request(message);
        if (message.action === "bind" && message.trackingToken) lifecycle.watch({ runId: message.runId, token: message.trackingToken });
        if (["cancel", "pause"].includes(message.action)) lifecycle.stop(message.runId);
        return result;
      }).then((result) => reply({ ok: true, result }), (error) => reply({ ok: false, error: error.message }));
      return true;
    });
    const announce = async () => {
      for (const wait of [0, 100, 250, 500, 1e3, 2e3]) {
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        try {
          const reply = await emit({ kind: "ready", url: location.href });
          if (reply?.ok || reply?.code !== "PAGE_LOADING") return;
        } catch {
          return;
        }
      }
    };
    void announce();
    window.addEventListener("pagehide", () => {
      lifecycle.dispose();
      submissionTracker.dispose();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        lifecycle = createApplyLifecycle(document, { scan: () => form.scan(), emit });
        submissionTracker = createSpeedySubmissionTracker(document, { emit });
        void announce();
      }
    });
  }
})();
