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
    <article aria-labelledby={headingId}>
      <h2 id={headingId}>Interview Report</h2>

      <ScoreSummary
        totalScore={report.totalScore}
        rubric={rubric}
        dimensionAverages={report.dimensionAverages}
      />

      <section>
        <h3>Strengths</h3>
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

      <section>
        <h3>Areas for improvement</h3>
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
        <section>
          <h3>Recommended review topics</h3>
          <ul>
            {report.missedConcepts.map((concept) => (
              <li key={concept}>{concept}</li>
            ))}
          </ul>
        </section>
      )}

      <TranscriptViewer transcript={report.transcript} />

      <div>
        <button type="button" onClick={exportJson}>
          Export JSON
        </button>
        <button type="button" onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" onClick={() => void exportPdf()}>
          Export PDF
        </button>
      </div>
    </article>
  );
}
