import type { TranscriptEntry } from '../hooks/build-report.js';

// A field starting with =, +, -, or @ is interpreted as a formula by
// Excel/Sheets when the CSV is opened — a candidate's own answer text is
// untrusted input, so this is real CSV/formula-injection risk (OWASP),
// not just delimiter-escaping. Prefixing with a leading apostrophe forces
// spreadsheet apps to treat it as literal text.
const FORMULA_TRIGGER = /^[=+\-@]/;

function escapeCsvField(value: string): string {
  const safeValue = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function transcriptToCsv(transcript: TranscriptEntry[]): string {
  const header = ['question', 'prompt', 'isFollowUp', 'answer', 'score'];
  const rows = transcript.map((entry) => [
    entry.question.id,
    entry.prompt,
    String(entry.isFollowUp),
    entry.answer.text,
    String(entry.evaluation.totalScore),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\n');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Same download idiom as {@link downloadBlob}, for a data: URL that's already encoded — no object URL to revoke. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
