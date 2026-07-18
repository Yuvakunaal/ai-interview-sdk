import type { Question } from '@interview-sdk/core';
import { defineRubric } from '@interview-sdk/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewReport, TranscriptEntry } from '../hooks/build-report.js';
import { ReportCard, isExportable } from './ReportCard.js';

const rubric = defineRubric([
  { id: 'technical', label: 'Technical', weight: 3 },
  { id: 'communication', label: 'Communication', weight: 1 },
]);

const question: Question = { id: 'q1', prompt: 'Explain hash maps.' };

const transcript: TranscriptEntry[] = [
  {
    question,
    prompt: question.prompt,
    isFollowUp: false,
    answer: { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 },
    evaluation: {
      questionId: 'q1',
      dimensionScores: { technical: 90, communication: 20 },
      totalScore: 70,
      conceptCoverage: [{ concept: 'collisions', covered: false }],
      contradictions: [],
      flags: [],
    },
  },
];

function report(overrides: Partial<InterviewReport> = {}): InterviewReport {
  return {
    sessionId: 'session-1',
    totalScore: 70,
    dimensionAverages: { technical: 90, communication: 20 },
    strengths: ['Technical'],
    weaknesses: ['Communication'],
    missedConcepts: ['collisions'],
    transcript,
    ...overrides,
  };
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:fake-url');
  revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe('ReportCard', () => {
  it('renders the score summary, strengths, weaknesses, and missed concepts', () => {
    render(<ReportCard report={report()} rubric={rubric} />);

    expect(screen.getByText('70/100')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Strengths' })).toBeInTheDocument();
    expect(screen.getByText('Technical', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('Communication', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('collisions')).toBeInTheDocument();
  });

  it('moves focus to the report heading on mount, so arriving here is announced to assistive tech', () => {
    render(<ReportCard report={report()} rubric={rubric} />);
    expect(screen.getByRole('heading', { name: 'Interview Report' })).toHaveFocus();
  });

  it('shows "None identified." when there are no strengths or weaknesses', () => {
    render(<ReportCard report={report({ strengths: [], weaknesses: [] })} rubric={rubric} />);
    expect(screen.getAllByText('None identified.')).toHaveLength(2);
  });

  it('omits the recommended-review section when there are no missed concepts', () => {
    render(<ReportCard report={report({ missedConcepts: [] })} rubric={rubric} />);
    expect(
      screen.queryByRole('heading', { name: 'Recommended review topics' }),
    ).not.toBeInTheDocument();
  });

  it('renders the transcript', () => {
    render(<ReportCard report={report()} rubric={rubric} />);
    expect(screen.getByText('It uses buckets.')).toBeInTheDocument();
  });

  it('exports JSON via a downloaded blob when the JSON button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReportCard report={report()} rubric={rubric} />);

    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('exports CSV via a downloaded blob when the CSV button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReportCard report={report()} rubric={rubric} />);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('text/csv');
  });

  // jsdom lacks the canvas/SVGImageElement APIs html-to-image needs, so this
  // exercises the real fallback path via a genuine capture failure — not a
  // simulated "package not installed" state, which was verified separately
  // against a real, external npm consumer (installed vs. not installed,
  // both in a real browser).
  it('falls back to a JSON download and reports the error when image export fails', async () => {
    const user = userEvent.setup();
    const onExportError = vi.fn();
    render(<ReportCard report={report()} rubric={rubric} onExportError={onExportError} />);

    await user.click(screen.getByRole('button', { name: 'Export Image' }));

    await waitFor(() => expect(onExportError).toHaveBeenCalledWith(expect.any(Error), 'image'));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/json');
  });

  it('shows a visible notice when image export falls back to JSON, so the mismatch is never silent', async () => {
    const user = userEvent.setup();
    render(<ReportCard report={report()} rubric={rubric} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export Image' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        "Image export isn't available here — downloaded a JSON file instead.",
      ),
    );
  });

  it('clears the fallback notice once a plain JSON export is clicked directly', async () => {
    const user = userEvent.setup();
    render(<ReportCard report={report()} rubric={rubric} />);

    await user.click(screen.getByRole('button', { name: 'Export Image' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a session integrity section when integritySignals is present', () => {
    render(
      <ReportCard
        report={report({
          integritySignals: {
            tabSwitchCount: 2,
            tabSwitchTimestamps: [1, 2],
            pasteEvents: [{ length: 400, timestamp: 3 }],
          },
        })}
        rubric={rubric}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Session integrity' })).toBeInTheDocument();
    expect(screen.getByText(/Tab switches: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Pastes into an answer: 1/)).toBeInTheDocument();
  });

  it('omits the session integrity section entirely when integritySignals was never tracked', () => {
    render(<ReportCard report={report()} rubric={rubric} />);
    expect(screen.queryByRole('heading', { name: 'Session integrity' })).not.toBeInTheDocument();
  });

  describe('isExportable (the image-export filter)', () => {
    it('excludes the actions and export-notice elements from the captured image', () => {
      const actions = document.createElement('div');
      actions.className = 'isdk-report-card__actions';
      const notice = document.createElement('p');
      notice.className = 'isdk-report-card__export-notice';
      expect(isExportable(actions)).toBe(false);
      expect(isExportable(notice)).toBe(false);
    });

    it('includes ordinary content elements', () => {
      const heading = document.createElement('h2');
      expect(isExportable(heading)).toBe(true);
    });

    it('passes through non-Element nodes (e.g. Text) instead of crashing on missing classList — html-to-image really does call its filter on every child node, not just elements, despite its typed signature', () => {
      const text = document.createTextNode('Overall score: 70/100');
      expect(() => isExportable(text as unknown as HTMLElement)).not.toThrow();
      expect(isExportable(text as unknown as HTMLElement)).toBe(true);
    });
  });
});
