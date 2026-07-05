import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CliConfigError, CliUsageError } from '../errors.js';
import { fileExists } from '../fs-utils.js';

export type ScaffoldFramework = 'nextjs' | 'node';

export interface ScaffoldServerRouteOptions {
  framework?: ScaffoldFramework;
  /** Project root to scaffold into; defaults to the current working directory. */
  dir?: string;
  force?: boolean;
}

export interface ScaffoldResult {
  filesWritten: string[];
}

const PLACEHOLDER_ADAPTER_SNIPPET = `{
    id: 'todo',
    // TODO: replace with a real provider, e.g. new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! })
    complete: async () => {
      throw new Error('Configure a real AI provider adapter before use — see the CLI README.');
    },
  }`;

function processorSetup(): string {
  return `const processor = new ServerAnswerProcessor({
  questions: [
    // TODO: replace with your real question bank
    { id: 'q1', prompt: 'Replace this with your first interview question.' },
  ],
  rubric: [{ id: 'technical', label: 'Technical depth', weight: 1 }],
  adapter: ${PLACEHOLDER_ADAPTER_SNIPPET},
  signingSecret: process.env.INTERVIEW_SIGNING_SECRET,
});`;
}

function nextjsRouteTemplate(): string {
  return `import { ServerAnswerProcessor, createInterviewAnswerHandler } from '@interview-sdk/server';

${processorSetup()}

export const POST = createInterviewAnswerHandler(processor);
`;
}

function nodeServerTemplate(): string {
  return `import { createServer } from 'node:http';
import { ServerAnswerProcessor, createInterviewAnswerHandler } from '@interview-sdk/server';

${processorSetup()}

const handler = createInterviewAnswerHandler(processor);

createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/interview/answer') {
    res.writeHead(404).end();
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request('http://localhost' + req.url, {
    method: req.method,
    headers: req.headers,
    body: Buffer.concat(chunks),
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(3000, () => console.log('Listening on http://localhost:3000'));
`;
}

const TEMPLATES: Record<ScaffoldFramework, { relativePath: string; content: () => string }> = {
  nextjs: { relativePath: 'app/api/interview/answer/route.ts', content: nextjsRouteTemplate },
  node: { relativePath: 'interview-server.mjs', content: nodeServerTemplate },
};

/**
 * `interview-sdk init --mode=server` (§6): scaffolds a minimal backend
 * route wired to @interview-sdk/server, so a new project starts with
 * production security (keys and scoring server-side) rather than bolting
 * it on later.
 */
export async function scaffoldServerRoute(
  options: ScaffoldServerRouteOptions = {},
): Promise<ScaffoldResult> {
  const framework = options.framework ?? 'nextjs';
  const template = TEMPLATES[framework];
  if (!template) {
    throw new CliUsageError(
      `Unknown framework "${framework}". Supported frameworks: ${Object.keys(TEMPLATES).join(', ')}.`,
    );
  }

  const dir = options.dir ?? process.cwd();
  const targetPath = join(dir, template.relativePath);

  if (!options.force && (await fileExists(targetPath))) {
    throw new CliConfigError(
      `"${template.relativePath}" already exists. Pass --force to overwrite it.`,
    );
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, template.content(), 'utf8');

  return { filesWritten: [targetPath] };
}
