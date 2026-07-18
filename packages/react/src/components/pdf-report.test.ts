import type { EvaluationResult, Question, Rubric } from '@interview-sdk/core';
import { defineRubric } from '@interview-sdk/core';
import { describe, expect, it } from 'vitest';
import type { InterviewReport, TranscriptEntry } from '../hooks/build-report.js';
import type { JsPdfInstance } from './optional-pdf-export.js';
import { generatePdfReport } from './pdf-report.js';

const rubric: Rubric = defineRubric([
  { id: 'technical', label: 'Technical', weight: 3 },
  { id: 'communication', label: 'Communication', weight: 1 },
]);

const question: Question = { id: 'q1', prompt: 'Explain hash maps.' };

function evaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    questionId: 'q1',
    dimensionScores: { technical: 90, communication: 20 },
    totalScore: 70,
    conceptCoverage: [],
    contradictions: [],
    flags: [],
    ...overrides,
  };
}

function entry(overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    question,
    prompt: question.prompt,
    isFollowUp: false,
    answer: { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 },
    evaluation: evaluation(),
    ...overrides,
  };
}

function report(overrides: Partial<InterviewReport> = {}): InterviewReport {
  return {
    sessionId: 'session-1',
    totalScore: 70,
    dimensionAverages: { technical: 90, communication: 20 },
    strengths: ['Technical'],
    weaknesses: ['Communication'],
    missedConcepts: ['collisions'],
    transcript: [entry()],
    ...overrides,
  };
}

/**
 * A fake jsPDF that records every call rather than rendering anything, so
 * assertions can check the actual generated content and pagination
 * behavior, not just that .save() eventually got called.
 */
function fakeJsPdf(pageHeight = 297, pageWidth = 210): {
  doc: JsPdfInstance;
  textCalls: string[];
  pageCount: number;
} {
  const textCalls: string[] = [];
  let pageCount = 1;
  const doc: JsPdfInstance = {
    text: (text: string) => {
      textCalls.push(text);
      return doc;
    },
    setFontSize: () => doc,
    addPage: () => {
      pageCount += 1;
      return doc;
    },
    splitTextToSize: (text: string, maxWidth: number) => {
      // Simple, deterministic wrap: one "line" per ~40 chars, matching
      // real jsPDF's contract (returns an array of lines that fit maxWidth).
      const charsPerLine = Math.max(10, Math.floor(maxWidth / 2));
      const lines: string[] = [];
      for (let i = 0; i < text.length; i += charsPerLine) {
        lines.push(text.slice(i, i + charsPerLine));
      }
      return lines.length > 0 ? lines : [text];
    },
    save: () => doc,
    internal: {
      pageSize: {
        getHeight: () => pageHeight,
        getWidth: () => pageWidth,
      },
    },
  };
  return {
    doc,
    textCalls,
    get pageCount() {
      return pageCount;
    },
  };
}

describe('generatePdfReport', () => {
  it('includes the session id and overall score', () => {
    const { doc, textCalls } = fakeJsPdf();
    generatePdfReport(doc, report(), rubric);
    expect(textCalls).toContain('Session: session-1');
    expect(textCalls).toContain('Overall score: 70/100');
  });

  it('includes every rubric dimension score, using rubric labels', () => {
    const { doc, textCalls } = fakeJsPdf();
    generatePdfReport(doc, report(), rubric);
    expect(textCalls).toContain('  Technical: 90/100');
    expect(textCalls).toContain('  Communication: 20/100');
  });

  it('includes strengths, weaknesses, and missed concepts', () => {
    const { doc, textCalls } = fakeJsPdf();
    generatePdfReport(doc, report(), rubric);
    expect(textCalls).toContain('  - Technical');
    expect(textCalls).toContain('  - Communication');
    expect(textCalls).toContain('  - collisions');
  });

  it('says "None identified." when there are no strengths or weaknesses', () => {
    const { doc, textCalls } = fakeJsPdf();
    generatePdfReport(doc, report({ strengths: [], weaknesses: [] }), rubric);
    expect(textCalls.filter((t) => t === '  None identified.')).toHaveLength(2);
  });

  it('includes the transcript: prompt, answer, and score for every entry', () => {
    const { doc, textCalls } = fakeJsPdf();
    generatePdfReport(
      doc,
      report({
        transcript: [
          entry({ evaluation: evaluation({ totalScore: 55 }) }),
          entry({
            question: { id: 'q2', prompt: 'Explain binary search.' },
            prompt: 'Explain binary search.',
            answer: { questionId: 'q2', text: 'Divide and conquer.', submittedAt: 2 },
          }),
        ],
      }),
      rubric,
    );
    expect(textCalls.some((t) => t.includes('1. Explain hash maps.'))).toBe(true);
    expect(textCalls.some((t) => t.includes('Score: 55/100'))).toBe(true);
    expect(textCalls.some((t) => t.includes('2. Explain binary search.'))).toBe(true);
  });

  it('renders skipped and silent answers by their placeholder label, not raw empty text', () => {
    const { doc, textCalls } = fakeJsPdf();
    generatePdfReport(
      doc,
      report({
        transcript: [
          entry({ answer: { questionId: 'q1', text: '', submittedAt: 1, isSkipped: true } }),
        ],
      }),
      rubric,
    );
    expect(textCalls.some((t) => t.includes('(Skipped)'))).toBe(true);
  });

  it('omits the missed-concepts section entirely when there are none', () => {
    const { doc, textCalls } = fakeJsPdf();
    generatePdfReport(doc, report({ missedConcepts: [] }), rubric);
    expect(textCalls).not.toContain('Recommended review topics');
  });

  it('wraps a long answer across multiple lines instead of overflowing the page width', () => {
    const { doc, textCalls } = fakeJsPdf();
    const longAnswer = 'x'.repeat(300);
    generatePdfReport(
      doc,
      report({ transcript: [entry({ answer: { questionId: 'q1', text: longAnswer, submittedAt: 1 } })] }),
      rubric,
    );
    const wrappedLines = textCalls.filter((t) => t.startsWith('x'));
    expect(wrappedLines.length).toBeGreaterThan(1);
  });

  it('adds a new page once content exceeds the page height, instead of writing off the bottom', () => {
    // Destructuring pageCount here would snapshot it at 1 before
    // generatePdfReport ever runs — the getter must be read afterward.
    const fake = fakeJsPdf(40); // tiny page height forces pagination quickly
    generatePdfReport(fake.doc, report(), rubric);
    expect(fake.pageCount).toBeGreaterThan(1);
  });
});
