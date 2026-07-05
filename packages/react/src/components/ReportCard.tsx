import type { Rubric } from '@interview-sdk/core';
import { useCallback, useId } from 'react';
import type { InterviewReport } from '../hooks/build-report.js';
import { ScoreSummary } from './ScoreSummary.js';
import { TranscriptViewer } from './TranscriptViewer.js';
import { downloadBlob, transcriptToCsv } from './report-export.js';
import { loadJsPdf } from './optional-pdf-export.js';

export interface ReportCardProps {
  report: InterviewReport;
  rubric: Rubric;
  /** Called when PDF or CSV generation fails and the report falls back to a JSON download. */
  onExportError?: (error: Error, format: 'pdf' | 'csv') => void;
}

export function ReportCard({ report, rubric, onExportError }: ReportCardProps) {
  const headingId = useId();

  const exportJson = useCallback(() => {
    downloadBlob(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      `interview-report-${report.sessionId}.json`,
    );
  }, [report]);

  const exportCsv = useCallback(() => {
    try {
      const csv = transcriptToCsv(report.transcript);
      downloadBlob(
        new Blob([csv], { type: 'text/csv' }),
        `interview-report-${report.sessionId}.csv`,
      );
    } catch (error) {
      onExportError?.(error instanceof Error ? error : new Error(String(error)), 'csv');
      exportJson();
    }
  }, [report, onExportError, exportJson]);

  const exportPdf = useCallback(async () => {
    try {
      const jsPDFModule = await loadJsPdf();
      const doc = new jsPDFModule.default();
      doc.text(`Interview Report`, 10, 10);
      doc.text(`Overall score: ${report.totalScore}/100`, 10, 20);
      doc.save(`interview-report-${report.sessionId}.pdf`);
    } catch (error) {
      onExportError?.(error instanceof Error ? error : new Error(String(error)), 'pdf');
      exportJson();
    }
  }, [report, onExportError, exportJson]);

  return (
    <article className="isdk-report-card" aria-labelledby={headingId}>
      <div className="isdk-report-card__head">
        <h2 className="isdk-report-card__title" id={headingId}>
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

      <TranscriptViewer transcript={report.transcript} />

      <div className="isdk-report-card__actions">
        <button className="isdk-btn isdk-btn--secondary" type="button" onClick={exportJson}>
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
