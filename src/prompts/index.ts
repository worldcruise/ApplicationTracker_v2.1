import { setReact } from './react-host';
import { PromptSettings } from './settings';
import {OtherSettings} from './other-settings';
import {AIApplySettings,KeywordSettings,ShortcutSettings} from './ai-apply-settings';
import {CandidatePromptSettings} from './candidate-prompt-settings';
import {settingsNavigation} from './settings-navigation';
export function createPromptSettings(React: any) { setReact(React); return PromptSettings; }
export function createOtherSettings(React:any){setReact(React);return OtherSettings;}
export function createCandidatePromptSettings(React:any){setReact(React);return CandidatePromptSettings;}
export function createAISettings(React:any){setReact(React);return AIApplySettings;}
export function createKeywordSettings(React:any){setReact(React);return KeywordSettings;}
export function createKeyboardSettings(React:any){setReact(React);return ShortcutSettings;}
export function createSettingsNavigation(React:any,Link:any){setReact(React);return settingsNavigation(Link);}
export { buildPrompt } from './prompt-builder';
export { templateIssue } from './prompt-composer';
