import type { Metadata } from 'next';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Styling, composition & accessibility' };

export default function StylingAndComposition() {
  return (
    <>
      <h1>Styling, composition &amp; accessibility</h1>
      <p className="docs-lede">
        <code>&lt;InterviewWidget&gt;</code> is the fastest path to a working interview, but nothing
        in <code>@interview-sdk/react</code> requires using it as one monolithic block — or its
        stylesheet at all.
      </p>

      <h2>The stylesheet is entirely optional</h2>
      <p>
        Every component renders plain semantic HTML with stable <code>isdk-*</code> class names and
        nothing else:
      </p>
      <CodeBlock lang="ts" filename="anywhere client-side">
        {`import '@interview-sdk/react/styles.css';`}
      </CodeBlock>
      <ul>
        <li>
          <strong>Skip the import</strong> for a fully headless build — style the{' '}
          <code>isdk-*</code> class names yourself, or ignore them and target the underlying
          tags/roles (<code>section</code>, <code>button[type=&quot;submit&quot;]</code>,{' '}
          <code>[role=&quot;alert&quot;]</code>, etc.).
        </li>
        <li>
          <strong>Import it</strong> for a complete, presentable interface with zero extra work — a
          warm paper background, a serif display face for headings, monospace for labels and scores,
          hairline-rule cards, and pass/flag/neutral score chips (the same 75/40 cutoffs the report
          itself uses for strengths/weaknesses, so a score reads the same color everywhere).
        </li>
        <li>
          <strong>Reskin it</strong> by overriding its CSS custom properties on <code>:root</code>{' '}
          in your own stylesheet loaded after it — <code>--isdk-accent</code>,{' '}
          <code>--isdk-paper</code>, <code>--isdk-radius</code>, <code>--isdk-font-display</code>,
          and more (see <code>styles.css</code> for the full list) — or override the{' '}
          <code>isdk-*</code> classes directly for full control. It also respects{' '}
          <code>prefers-color-scheme: dark</code> out of the box.
        </li>
      </ul>
      <p>
        Nothing here depends on the stylesheet being present — every component works identically
        with or without it.
      </p>

      <h2>Compose your own UI from the same pieces</h2>
      <p>
        <code>InterviewWidget</code> is built from <code>useInterview</code> plus a handful of
        components, and every one of them is exported individually — reach for these directly if you
        need a layout <code>InterviewWidget</code> doesn&apos;t offer:
      </p>
      <div className="docs-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Export</th>
              <th>What it is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>useInterview</code>
              </td>
              <td>
                The hook <code>InterviewWidget</code> itself is built on — session status, current
                question/prompt, transcript, <code>start</code>/<code>pause</code>/
                <code>resume</code>/<code>submitAnswer</code>/<code>retryLastAnswer</code>, the
                final report, and <code>getSnapshot</code>/<code>events</code> for session
                persistence and analytics (see{' '}
                <a href="/session-persistence-and-events">Session persistence &amp; events</a>).
              </td>
            </tr>
            <tr>
              <td>
                <code>QuestionCard</code>
              </td>
              <td>Renders the current prompt, hint, and answer input (text and/or voice).</td>
            </tr>
            <tr>
              <td>
                <code>MicButton</code>
              </td>
              <td>
                Voice recording control — always paired with a visible text fallback, never renders
                its own error UI.
              </td>
            </tr>
            <tr>
              <td>
                <code>TranscriptViewer</code>
              </td>
              <td>
                The full session transcript as a semantic{' '}
                <code>&lt;ol role=&quot;log&quot;&gt;</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>ScoreSummary</code>
              </td>
              <td>
                A real <code>&lt;table&gt;</code> breakdown of per-dimension rubric scores.
              </td>
            </tr>
            <tr>
              <td>
                <code>ReportCard</code>
              </td>
              <td>The end-of-session report, including export (below).</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        This is the same pattern as any headless-UI library: <code>useInterview</code> owns the
        state and side effects, the components are optional presentation you can swap out one at a
        time.
      </p>

      <h2>Accessibility is not a stretch goal</h2>
      <p>Every component ships with:</p>
      <ul>
        <li>
          <code>aria-live=&quot;polite&quot;</code> regions on the current question and hint, so
          screen readers announce updates without the user re-navigating.
        </li>
        <li>
          A semantic <code>&lt;ol role=&quot;log&quot;&gt;</code> transcript and a real{' '}
          <code>&lt;table&gt;</code> (with <code>scope</code> on header cells) for score breakdowns
          — no div soup.
        </li>
        <li>
          A text-input fallback for every voice interaction — <code>MicButton</code> never renders
          its own error UI, since the always-present textarea already is the fallback.
        </li>
        <li>
          Full keyboard operability: every control is a real <code>&lt;button&gt;</code> or form
          field.
        </li>
      </ul>

      <h2>Report export</h2>
      <p>
        <code>ReportCard</code> can export the final report as:
      </p>
      <ul>
        <li>
          <strong>JSON</strong> — always available, no dependencies.
        </li>
        <li>
          <strong>CSV</strong> — always available (a hand-rolled transcript-to-CSV, no
          dependencies).
        </li>
        <li>
          <strong>Image (PNG)</strong> — a snapshot of the rendered report card, only if you
          install the optional peer dependency yourself:
        </li>
      </ul>
      <CodeBlock lang="bash" filename="terminal">
        {`npm install html-to-image`}
      </CodeBlock>
      <Callout type="note">
        If <code>html-to-image</code> isn&apos;t installed, clicking &quot;Export Image&quot; falls
        back to a JSON download and calls <code>onExportError(error, &apos;image&apos;)</code> so
        you can surface a message. <code>@interview-sdk/react</code> never imports{' '}
        <code>html-to-image</code> statically — it&apos;s loaded via a dynamic import invisible to
        bundlers, so it&apos;s never bundled or required unless a developer actually installs and
        uses it.
      </Callout>
    </>
  );
}
