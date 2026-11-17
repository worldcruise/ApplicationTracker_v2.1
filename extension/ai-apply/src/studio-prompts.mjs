export const PROMPT_SETTINGS_KEY = 'ai-apply-prompts:v1';
export const defaultPrompts = {
  base: { name: 'Base resume', text: 'Use only facts from the candidate profile. Prepare a general resume without tailoring to a job. Preserve employment facts and return only the required resume JSON.' },
  focused: { name: 'Job focused', text: 'Use only facts from the candidate profile. Prioritize experience relevant to the job. Preserve employment facts and return only the required resume JSON.' },
  concise: { name: 'Concise', text: 'Use short, direct sentences supported by the candidate profile. Remove repetition. Return only the required resume JSON.' },
  technical: { name: 'Technical', text: 'Prioritize supported technical skills and engineering experience relevant to this job. Never invent tools or metrics. Return only the required resume JSON.' }
};

export const prompts = structuredClone(defaultPrompts);
export function normalizePromptSettings(value) {
  return { selectedId: Object.hasOwn(defaultPrompts, value?.selectedId) ? value.selectedId : 'focused',
    templates: Object.fromEntries(Object.entries(defaultPrompts).map(([id, fallback]) => [id, {
      name: fallback.name,
      text: typeof value?.templates?.[id]?.text === 'string' && value.templates[id].text.trim() && value.templates[id].text.length <= 32000
        ? value.templates[id].text.trim() : fallback.text
    }])) };
}

// The dock consumes the same preferences edited in Settings > Prompts.
export function connectPromptSettings({browser = chrome, onChange = () => {}} = {}) {
  let disposed = false, revision = 0;
  function apply(value) {
    if (disposed) return;
    const next = normalizePromptSettings(value);
    Object.assign(prompts, next.templates); onChange(next);
  }
  const changed = (changes, area) => {
    if (area === 'local' && changes[PROMPT_SETTINGS_KEY]) { revision++; apply(changes[PROMPT_SETTINGS_KEY].newValue); }
  };
  browser.storage.onChanged.addListener(changed);
  const initial = revision;
  const ready = browser.storage.local.get(PROMPT_SETTINGS_KEY).then(saved => { if(initial === revision) apply(saved[PROMPT_SETTINGS_KEY]); });
  return {ready, dispose() {disposed = true; browser.storage.onChanged.removeListener(changed);}};
}

