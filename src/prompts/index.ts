import { setReact } from './react-host';
import { PromptSettings } from './settings';
import {OtherSettings} from './other-settings';
export function createPromptSettings(React: any) { setReact(React); return PromptSettings; }
export function createOtherSettings(React:any){setReact(React);return OtherSettings;}
export { buildPrompt } from './prompt-builder';
export { templateIssue } from './prompt-composer';
