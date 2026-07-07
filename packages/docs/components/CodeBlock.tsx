import { codeToHtml } from 'shiki';
import { CopyButton } from './CopyButton';

export interface CodeBlockProps {
  children: string;
  /** A bundled Shiki language id (e.g. "tsx", "ts", "bash", "json"). Defaults to "tsx" — most samples in this SDK's own docs are widget/route code. */
  lang?: string;
  /** Header label — a filename/path if this represents a real file, otherwise the language name is shown. */
  filename?: string;
}

/**
 * Real, build-time syntax highlighting (Shiki) — this is a static export, so
 * highlighting happens once at `next build`, never per-request. Renders both
 * a light and a dark theme into the same markup via CSS variables (see
 * globals.css), so there's no client-side re-highlight on theme change.
 */
export async function CodeBlock({ children, lang = 'tsx', filename }: CodeBlockProps) {
  const code = children.replace(/^\n+|\n+$/g, '');
  const html = await codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });

  return (
    <div className="isdk-code-block">
      <div className="isdk-code-block-header">
        <span className="isdk-code-filename">{filename ?? lang}</span>
        <CopyButton text={code} />
      </div>
      <div className="isdk-code" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
