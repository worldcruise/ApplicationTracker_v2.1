import { CandidateError, type StoredCandidate } from "./candidate-contract";

export type CandidateResult = { candidate: StoredCandidate | null; [key: string]: unknown };
export type CandidateReply<T> = { version: 1; requestId: string } & (
  { ok: true; result: T } | { ok: false; error: { code: string; message: string; fieldPath?: string; currentRevision?: number; retryable?: boolean } }
);
export function extensionAvailable() { return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id); }
export async function candidateRequest<T = CandidateResult>(operation: string = "WORKSPACE_BOOTSTRAP", payload: unknown = {}): Promise<T> {
  if (!extensionAvailable()) throw new CandidateError("UNAVAILABLE", "Candidate storage is available in the installed extension.");
  const requestId = crypto.randomUUID();
  let response: CandidateReply<T>;
  try { response = await chrome.runtime.sendMessage({ version: 1, requestId, operation, payload }); }
  catch { throw new CandidateError("CONNECTION_FAILED", "The coordinator could not be reached. Your input is retained. Try again."); }
  if (!response || response.version !== 1 || response.requestId !== requestId) throw new CandidateError("INVALID_REPLY", "The coordinator returned an invalid response. Your input is retained.");
  if (!response.ok) throw new CandidateError(response.error.code, response.error.message, response.error.fieldPath, response.error.currentRevision);
  return response.result;
}
