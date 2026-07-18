import type { Question, RubricDimensionInput } from '@interview-sdk/core';
import { InterviewWidget } from '@interview-sdk/react';
import '@interview-sdk/react/styles.css';
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { buildIntegrationCode, type RuntimeMode } from './build-integration-code.js';
import { ConceptsInput } from './ConceptsInput.js';
import { createMockAdapter } from './mock-adapter.js';
import { mockSynthesize, mockTranscribe } from './mock-voice.js';

type Difficulty = 'Junior' | 'Mid' | 'Senior';
type ViewTab = 'preview' | 'code';

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

const rolePresets = ['Frontend Engineer', 'Backend Engineer', 'ML Engineer', 'Other'];
const brandSwatches = ['#b8862a', '#2f7a52', '#8a4a35', '#3d5a80'];

export function App() {
  const adapter = useMemo(() => createMockAdapter(), []);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('hybrid');
  const [difficulty, setDifficulty] = useState<Difficulty>('Senior');
  const [role, setRole] = useState(rolePresets[0]);
  const [customRole, setCustomRole] = useState('');
  const [brandColor, setBrandColor] = useState(brandSwatches[0]);
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [includeFollowUps, setIncludeFollowUps] = useState(true);
  const [sessionMinutes, setSessionMinutes] = useState(18);
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const voiceEnabled = runtimeMode === 'voice' || runtimeMode === 'hybrid';
  const timeoutMs = sessionMinutes * 60 * 1000;
  const effectiveRole = role === 'Other' ? customRole.trim() || 'Custom role' : role;
  const roleTitle = `${difficulty} ${effectiveRole}`;
  const integrationCode = useMemo(
    () =>
      buildIntegrationCode({
        questions,
        rubric,
        runtimeMode,
        includeFollowUps,
        sessionMinutes,
        roleTitle,
      }),
    [includeFollowUps, questions, runtimeMode, sessionMinutes, roleTitle],
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
      <aside className="studio-sidebar" aria-label="Interview configuration">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Local dashboard</p>
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

          {role === 'Other' && (
            <label className="field">
              <span>Custom role</span>
              <input
                type="text"
                value={customRole}
                onChange={(event) => setCustomRole(event.target.value)}
                placeholder="e.g. Site Reliability Engineer"
              />
            </label>
          )}

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
      </aside>

      <section className="studio-main" aria-label="Configured interview preview">
        <header className="topbar">
          <div>
            <p className="eyebrow">Live build</p>
            <h2>{effectiveRole}</h2>
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
                    <ConceptsInput
                      concepts={question.concepts}
                      onChange={(concepts) => updateQuestion(question.id, { concepts })}
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>

          <section className="preview-stage" aria-label="Candidate interview UI and integration code">
            <div className="section-title">
              <div>
                <p className="eyebrow">{activeTab === 'preview' ? 'Interview UI' : 'Ship it'}</p>
                <h3>
                  {activeTab === 'preview'
                    ? 'Exactly what the candidate sees'
                    : 'Copy this into your app'}
                </h3>
              </div>
              <div className="view-toggle" role="tablist" aria-label="Preview or code view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'preview'}
                  className={activeTab === 'preview' ? 'is-selected' : ''}
                  onClick={() => setActiveTab('preview')}
                >
                  Preview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'code'}
                  className={activeTab === 'code' ? 'is-selected' : ''}
                  onClick={() => setActiveTab('code')}
                >
                  Code
                </button>
              </div>
            </div>

            {activeTab === 'preview' ? (
              <>
                <p className="stage-note">
                  Local preview — a mock adapter stands in for a real AI provider, no API keys
                  used.
                </p>
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
                    roleTitle={roleTitle}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="stage-note">
                  Server Mode recommended — plug your own AI provider adapter in behind
                  <code> /api/interview/answer</code>, keys never touch the browser.
                </p>
                <div className="code-frame">
                  <div className="code-frame__head">
                    <p className="eyebrow">TSX</p>
                    <button
                      className={
                        copyStatus === 'copied' ? 'copy-btn is-copied' : 'copy-btn'
                      }
                      type="button"
                      onClick={() => void copyIntegrationCode()}
                    >
                      {copyStatus === 'copied' ? (
                        <span className="stamp">
                          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                              d="M3 8.5L6.2 11.5L13 4.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Copied
                        </span>
                      ) : copyStatus === 'failed' ? (
                        'Copy failed'
                      ) : (
                        'Copy code'
                      )}
                    </button>
                  </div>
                  <pre aria-label="Generated React integration code">{integrationCode}</pre>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
