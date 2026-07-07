import type { Question, RubricDimensionInput } from '@interview-sdk/core';
import { InterviewWidget } from '@interview-sdk/react';
import '@interview-sdk/react/styles.css';
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { createMockAdapter } from './mock-adapter.js';
import { mockSynthesize, mockTranscribe } from './mock-voice.js';

type RuntimeMode = 'voice' | 'hybrid' | 'text';
type Difficulty = 'Junior' | 'Mid' | 'Senior';

const starterQuestions: Question[] = [
  {
    id: 'q1',
    prompt: 'How does a hash map resolve collisions in a production system?',
    concepts: ['hashing', 'collision resolution'],
  },
  {
    id: 'q2',
    prompt: 'What happens to a React component when state changes?',
    concepts: ['re-render', 'virtual dom'],
  },
  {
    id: 'q3',
    prompt: 'Describe one trade-off you would make when designing a reliable API.',
    concepts: ['trade-offs', 'reliability'],
  },
];

const rubric: RubricDimensionInput[] = [
  { id: 'technical', label: 'Technical accuracy', weight: 3 },
  { id: 'communication', label: 'Communication clarity', weight: 1 },
  { id: 'systems', label: 'Systems thinking', weight: 2 },
];

const modes: Array<{ id: RuntimeMode; label: string; caption: string }> = [
  { id: 'voice', label: 'Voice first', caption: 'AI speaks. Candidate records.' },
  { id: 'hybrid', label: 'Hybrid', caption: 'Audio, recording, and typed fallback.' },
  { id: 'text', label: 'Typed', caption: 'Question display and written answers.' },
];

const rolePresets = ['Frontend Engineer', 'Backend Engineer', 'ML Engineer'];
const brandSwatches = ['#b8862a', '#2f7a52', '#8a4a35', '#3d5a80'];

function conceptsToText(concepts: Question['concepts']): string {
  return concepts?.join(', ') ?? '';
}

function textToConcepts(text: string): string[] {
  return text
    .split(',')
    .map((concept) => concept.trim())
    .filter(Boolean);
}

function buildIntegrationCode({
  questions,
  runtimeMode,
  includeFollowUps,
  sessionMinutes,
}: {
  questions: Question[];
  runtimeMode: RuntimeMode;
  includeFollowUps: boolean;
  sessionMinutes: number;
}): string {
  const hasVoice = runtimeMode !== 'text';

  return `import { InterviewWidget } from '@interview-sdk/react';
import '@interview-sdk/react/styles.css';

const questions = ${JSON.stringify(questions, null, 2)};

const rubric = ${JSON.stringify(rubric, null, 2)};

export function CandidateInterview() {
  return (
    <InterviewWidget
      mode="server"
      apiBaseUrl="/api/interview/answer"
      questions={questions}
      rubric={rubric}
      maxFollowUpDepth={${includeFollowUps ? 1 : 0}}
      sessionTimeoutMs={${sessionMinutes * 60 * 1000}}${
        hasVoice
          ? `
      synthesize={voiceProvider.synthesize.bind(voiceProvider)}
      transcribe={async (audio) => (await voiceProvider.transcribe(await audio.arrayBuffer())).text}`
          : ''
      }
    />
  );
}`;
}

export function App() {
  const adapter = useMemo(() => createMockAdapter(), []);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('hybrid');
  const [difficulty, setDifficulty] = useState<Difficulty>('Senior');
  const [role, setRole] = useState(rolePresets[0]);
  const [brandColor, setBrandColor] = useState(brandSwatches[0]);
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [includeFollowUps, setIncludeFollowUps] = useState(true);
  const [sessionMinutes, setSessionMinutes] = useState(18);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const voiceEnabled = runtimeMode === 'voice' || runtimeMode === 'hybrid';
  const timeoutMs = sessionMinutes * 60 * 1000;
  const integrationCode = useMemo(
    () => buildIntegrationCode({ questions, runtimeMode, includeFollowUps, sessionMinutes }),
    [includeFollowUps, questions, runtimeMode, sessionMinutes],
  );
  const activeConcepts = questions.flatMap((question) => question.concepts ?? []);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    );
  };

  const addQuestion = () => {
    setQuestions((current) => [
      ...current,
      {
        id: `q${current.length + 1}`,
        prompt: 'Ask a role-specific follow-up question here.',
        concepts: ['role depth'],
      },
    ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((current) =>
      current.length > 1 ? current.filter((question) => question.id !== id) : current,
    );
  };

  const copyIntegrationCode = async () => {
    try {
      await navigator.clipboard.writeText(integrationCode);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <main className="studio-shell" style={{ '--brand-accent': brandColor } as React.CSSProperties}>
      <aside className="studio-sidebar" aria-label="Interview builder">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Interview Studio</p>
            <h1>
              AI Interview <span className="brand-suffix">SDK</span>
            </h1>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">
            <p className="eyebrow">Runtime</p>
            <span>{difficulty}</span>
          </div>

          <div className="mode-grid" role="radiogroup" aria-label="Interview runtime mode">
            {modes.map((mode) => (
              <button
                className={runtimeMode === mode.id ? 'mode-card is-active' : 'mode-card'}
                type="button"
                key={mode.id}
                onClick={() => setRuntimeMode(mode.id)}
                aria-pressed={runtimeMode === mode.id}
              >
                <strong>{mode.label}</strong>
                <span>{mode.caption}</span>
              </button>
            ))}
          </div>

          <label className="field">
            <span>Role preset</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {rolePresets.map((preset) => (
                <option key={preset}>{preset}</option>
              ))}
            </select>
          </label>

          <div className="segmented" aria-label="Difficulty">
            {(['Junior', 'Mid', 'Senior'] as const).map((level) => (
              <button
                type="button"
                key={level}
                className={difficulty === level ? 'is-selected' : ''}
                onClick={() => setDifficulty(level)}
              >
                {level}
              </button>
            ))}
          </div>

          <label className="range-field">
            <span>
              Timebox <strong>{sessionMinutes} min</strong>
            </span>
            <input
              type="range"
              min="5"
              max="45"
              step="1"
              value={sessionMinutes}
              onChange={(event) => setSessionMinutes(Number(event.target.value))}
            />
          </label>

          <label className="toggle-row">
            <span>Follow-ups enabled</span>
            <input
              type="checkbox"
              checked={includeFollowUps}
              onChange={(event) => setIncludeFollowUps(event.target.checked)}
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-head">
            <p className="eyebrow">Brand</p>
            <span>Theme</span>
          </div>
          <div className="swatch-row" aria-label="Brand color">
            {brandSwatches.map((swatch) => (
              <button
                className={brandColor === swatch ? 'swatch is-active' : 'swatch'}
                type="button"
                key={swatch}
                style={{ '--swatch': swatch } as React.CSSProperties}
                onClick={() => setBrandColor(swatch)}
                aria-label={`Use brand color ${swatch}`}
              />
            ))}
          </div>
        </section>

        <section className="panel metrics-panel" aria-label="Interview metrics">
          <div>
            <strong>{questions.length}</strong>
            <span>Questions</span>
          </div>
          <div>
            <strong>{activeConcepts.length}</strong>
            <span>Concepts</span>
          </div>
          <div>
            <strong>{includeFollowUps ? 'On' : 'Off'}</strong>
            <span>Follow-ups</span>
          </div>
        </section>

        <section className="panel export-panel">
          <div className="panel-head">
            <p className="eyebrow">Ship</p>
            <span>React</span>
          </div>
          <pre aria-label="Generated React integration code">{integrationCode}</pre>
          <button className="copy-btn" type="button" onClick={copyIntegrationCode}>
            {copyStatus === 'copied'
              ? 'Copied'
              : copyStatus === 'failed'
                ? 'Copy failed'
                : 'Copy component'}
          </button>
        </section>
      </aside>

      <section className="studio-main" aria-label="Configured interview preview">
        <header className="topbar">
          <div>
            <p className="eyebrow">Live build</p>
            <h2>{role}</h2>
          </div>
          <div className="status-strip" aria-label="Interview settings summary">
            <span>{runtimeMode}</span>
            <span>{questions.length} questions</span>
            <span>{sessionMinutes}m</span>
          </div>
        </header>

        <div className="workspace-grid">
          <section className="question-builder" aria-label="Question builder">
              <div className="section-title">
              <div>
                <p className="eyebrow">Question set</p>
                <h3>Customize the interview</h3>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={addQuestion}
                aria-label="Add question"
              >
                +
              </button>
            </div>

            <div className="question-list">
              {questions.map((question, index) => (
                <article
                  className="question-editor"
                  key={question.id}
                  style={{ '--d': index } as React.CSSProperties}
                >
                  <div className="question-editor__top">
                    <span>[Q{index + 1}]</span>
                    <button
                      type="button"
                      onClick={() => removeQuestion(question.id)}
                      disabled={questions.length === 1}
                      aria-label={`Remove question ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                  <label>
                    <span>Prompt</span>
                    <textarea
                      value={question.prompt}
                      onChange={(event) =>
                        updateQuestion(question.id, { prompt: event.target.value })
                      }
                      rows={3}
                    />
                  </label>
                  <label>
                    <span>Concepts</span>
                    <input
                      value={conceptsToText(question.concepts)}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          concepts: textToConcepts(event.target.value),
                        })
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>

          <section className="preview-stage" aria-label="Candidate interview UI">
            <div className="section-title">
              <div>
                <p className="eyebrow">Interview UI</p>
                <h3>Exactly what the candidate sees</h3>
              </div>
            </div>
            <div className="candidate-frame">
              <InterviewWidget
                key={`${runtimeMode}-${questions.map((question) => question.prompt).join('|')}`}
                questions={questions}
                rubric={rubric}
                mode="client"
                adapter={adapter}
                maxFollowUpDepth={includeFollowUps ? 1 : 0}
                sessionTimeoutMs={timeoutMs}
                synthesize={voiceEnabled ? mockSynthesize : undefined}
                transcribe={voiceEnabled ? mockTranscribe : undefined}
                onSessionEnd={(report) => console.log('Interview finished:', report)}
                roleTitle={`${difficulty} ${role}`}
              />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
