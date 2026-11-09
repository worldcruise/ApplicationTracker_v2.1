import { setReact } from './react-host';
import { PromptSettings } from './settings';
export function createPromptSettings(React: any) { setReact(React); return PromptSettings; }
export { buildPrompt } from './prompt-builder';
export { templateIssue } from './prompt-composer';
