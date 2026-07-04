import type { TranscriptEntry } from '../hooks/build-report.js';

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
