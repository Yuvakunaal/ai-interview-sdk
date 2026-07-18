import type { Rubric } from '@interview-sdk/core';
import type { InterviewReport } from '../hooks/build-report.js';
import type { JsPdfInstance } from './optional-pdf-export.js';

const MARGIN = 10;
const LINE_HEIGHT = 7;
const USABLE_WIDTH_FALLBACK = 190;

function answerText(entry: InterviewReport['transcript'][number]): string {
  if (entry.answer.isSkipped) return '(Skipped)';
  if (entry.answer.isSilence) return '(No response)';
  return entry.answer.text;
}

/**
 * Writes the full report — scores, strengths/weaknesses, missed concepts,
 * and the complete transcript — into a jsPDF document, paginating as
 * needed. Previously this only wrote two lines (title + total score); a
 * real developer expects the same content the on-screen report and CSV
 * export already show, not a near-empty file.
 */
export function generatePdfReport(doc: JsPdfInstance, report: InterviewReport, rubric: Rubric): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = (doc.internal.pageSize.getWidth() ?? USABLE_WIDTH_FALLBACK) - MARGIN * 2;
  let y = MARGIN;

  const ensureSpace = (): void => {
    if (y + LINE_HEIGHT > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const writeLine = (text: string, size = 11): void => {
    doc.setFontSize(size);
    ensureSpace();
    doc.text(text, MARGIN, y);
    y += LINE_HEIGHT;
  };

  const writeWrapped = (text: string, size = 11): void => {
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, usableWidth)) {
      ensureSpace();
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
  };

  const blankLine = (): void => {
    y += LINE_HEIGHT / 2;
  };

  writeLine('Interview Report', 18);
  writeLine(`Session: ${report.sessionId}`, 9);
  blankLine();
  writeLine(`Overall score: ${report.totalScore}/100`, 13);

  blankLine();
  writeLine('Dimension scores', 13);
  for (const dimension of rubric.dimensions) {
    const score = report.dimensionAverages[dimension.id];
    if (typeof score === 'number') {
      writeLine(`  ${dimension.label}: ${Math.round(score)}/100`);
    }
  }

  blankLine();
  writeLine('Strengths', 13);
  if (report.strengths.length > 0) {
    for (const strength of report.strengths) writeLine(`  - ${strength}`);
  } else {
    writeLine('  None identified.');
  }

  blankLine();
  writeLine('Areas for improvement', 13);
  if (report.weaknesses.length > 0) {
    for (const weakness of report.weaknesses) writeLine(`  - ${weakness}`);
  } else {
    writeLine('  None identified.');
  }

  if (report.missedConcepts.length > 0) {
    blankLine();
    writeLine('Recommended review topics', 13);
    for (const concept of report.missedConcepts) writeLine(`  - ${concept}`);
  }

  blankLine();
  writeLine('Transcript', 13);
  report.transcript.forEach((entry, index) => {
    blankLine();
    writeWrapped(`${index + 1}. ${entry.prompt}`, 11);
    writeWrapped(`Answer: ${answerText(entry)}`, 10);
    writeLine(`Score: ${entry.evaluation.totalScore}/100`, 10);
  });
}
