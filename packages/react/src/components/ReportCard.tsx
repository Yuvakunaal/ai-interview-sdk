import type { Rubric } from '@interview-sdk/core';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { InterviewReport } from '../hooks/build-report.js';
import { ScoreSummary } from './ScoreSummary.js';
import { TranscriptViewer } from './TranscriptViewer.js';
import { downloadBlob, transcriptToCsv } from './report-export.js';
import { loadJsPdf } from './optional-pdf-export.js';
import { generatePdfReport } from './pdf-report.js';

export interface ReportCardProps {
  report: InterviewReport;
  rubric: Rubric;
  /** Called when PDF or CSV generation fails and the report falls back to a JSON download. */
  onExportError?: (error: Error, format: 'pdf' | 'csv') => void;
}

const FALLBACK_MESSAGE: Record<'pdf' | 'csv', string> = {
  pdf: "PDF export isn't available here — downloaded a JSON file instead.",
  csv: "CSV export failed — downloaded a JSON file instead.",
};

export function ReportCard({ report, rubric, onExportError }: ReportCardProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // This component mounts fresh exactly once, the moment the interview
  // completes — moving focus here (rather than leaving it on whatever
  // button was last clicked, or dropped to <body>) is what actually tells a
  // screen-reader or keyboard user the report has arrived.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  // Surfaces the same fallback the catch blocks below already handle
  // silently at the data layer — so a candidate who clicks "Export PDF"
  // and gets a JSON file actually finds out why, instead of a mislabeled
  // download with no explanation.
  const [fallback, setFallback] = useState<'pdf' | 'csv' | null>(null);

  const exportJson = useCallback(() => {
    downloadBlob(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      `interview-report-${report.sessionId}.json`,
    );
  }, [report]);

  const exportCsv = useCallback(() => {
    setFallback(null);
    try {
      const csv = transcriptToCsv(report.transcript);
      downloadBlob(
        new Blob([csv], { type: 'text/csv' }),
        `interview-report-${report.sessionId}.csv`,
      );
    } catch (error) {
      onExportError?.(error instanceof Error ? error : new Error(String(error)), 'csv');
      setFallback('csv');
      exportJson();
    }
  }, [report, onExportError, exportJson]);

  const exportPdf = useCallback(async () => {
    setFallback(null);
    try {
      const jsPDFModule = await loadJsPdf();
      const doc = new jsPDFModule.default();
      generatePdfReport(doc, report, rubric);
      doc.save(`interview-report-${report.sessionId}.pdf`);
    } catch (error) {
      onExportError?.(error instanceof Error ? error : new Error(String(error)), 'pdf');
      setFallback('pdf');
      exportJson();
    }
  }, [report, rubric, onExportError, exportJson]);

  return (
    <article className="isdk-report-card" aria-labelledby={headingId}>
      <div className="isdk-report-card__head">
        <h2 className="isdk-report-card__title" id={headingId} ref={headingRef} tabIndex={-1}>
          Interview Report
        </h2>
        <span className="isdk-stamp">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8.5L6.2 11.5L13 4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Complete
        </span>
      </div>

      <ScoreSummary
        totalScore={report.totalScore}
        rubric={rubric}
        dimensionAverages={report.dimensionAverages}
      />

      <section className="isdk-report-card__section">
        <h3 className="isdk-report-card__section-title">Strengths</h3>
        {report.strengths.length > 0 ? (
          <ul>
            {report.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        ) : (
          <p>None identified.</p>
        )}
      </section>

      <section className="isdk-report-card__section">
        <h3 className="isdk-report-card__section-title">Areas for improvement</h3>
        {report.weaknesses.length > 0 ? (
          <ul>
            {report.weaknesses.map((weakness) => (
              <li key={weakness}>{weakness}</li>
            ))}
          </ul>
        ) : (
          <p>None identified.</p>
        )}
      </section>

      {report.missedConcepts.length > 0 && (
        <section className="isdk-report-card__section">
          <h3 className="isdk-report-card__section-title">Recommended review topics</h3>
          <ul>
            {report.missedConcepts.map((concept) => (
              <li key={concept}>{concept}</li>
            ))}
          </ul>
        </section>
      )}

      {report.integritySignals && (
        <section className="isdk-report-card__section">
          <h3 className="isdk-report-card__section-title">Session integrity</h3>
          <p className="isdk-report-card__integrity-note">
            Tab switches: {report.integritySignals.tabSwitchCount} · Pastes into an answer:{' '}
            {report.integritySignals.pasteEvents.length}. Informational only — weigh these in
            context, not as an automated verdict.
          </p>
        </section>
      )}

      <TranscriptViewer transcript={report.transcript} />

      {fallback && (
        <p className="isdk-report-card__export-notice" role="status">
          {FALLBACK_MESSAGE[fallback]}
        </p>
      )}

      <div className="isdk-report-card__actions">
        <button
          className="isdk-btn isdk-btn--secondary"
          type="button"
          onClick={() => {
            setFallback(null);
            exportJson();
          }}
        >
          Export JSON
        </button>
        <button className="isdk-btn isdk-btn--secondary" type="button" onClick={exportCsv}>
          Export CSV
        </button>
        <button
          className="isdk-btn isdk-btn--secondary"
          type="button"
          onClick={() => void exportPdf()}
        >
          Export PDF
        </button>
      </div>
    </article>
  );
}
