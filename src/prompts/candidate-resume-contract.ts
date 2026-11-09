export const RESUME_MAX_BYTES = 1024 * 1024;
export function resumeDataIssue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return "Expected resume file data.";
  const entry = value as Record<string, unknown>, data = entry.resumeBase64;
  if (typeof entry.fileName !== "string" || !entry.fileName.trim() || entry.fileName.length > 255) return "A resume filename is required (up to 255 characters).";
  if (typeof data !== "string" || !data || data.length % 4 || data.length > Math.ceil(RESUME_MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return "The resume file encoding is invalid. Upload the PDF again.";
  const bytes = data.length / 4 * 3 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
  if (!bytes || bytes > RESUME_MAX_BYTES) return "Choose a PDF resume no larger than 1 MB.";
  if (!data.startsWith("JVBERi0")) return "Upload a valid PDF resume.";
  if (entry.fileSize !== undefined && (typeof entry.fileSize !== "number" || !Number.isFinite(entry.fileSize) || Math.abs(entry.fileSize - bytes / 1024) > 0.000001)) return "The resume file size does not match its data.";
  if (entry.dateUploaded !== undefined && typeof entry.dateUploaded !== "string") return "Invalid resume upload date.";
  if (entry.sha256 !== undefined && (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256))) return "Invalid resume file checksum.";
  if (entry.pageCount !== undefined && (!Number.isSafeInteger(entry.pageCount) || Number(entry.pageCount) < 1)) return "The resume must contain a PDF page.";
  return null;
}
