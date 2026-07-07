import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { CliConfigError } from '../errors.js';

const DEFAULT_PORT = 4949;
const MAX_PORT_ATTEMPTS = 20;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Locates the dashboard's pre-built static assets relative to this
 * package's own package.json — not a relative hop from this compiled
 * file's own location, since tsup bundles src/commands/*.ts into a shared
 * chunk sitting directly in dist/, not a dist/commands/ mirror of the
 * source tree. Resolving via the package's own "./package.json" export
 * works identically in-repo and as a real published/npx'd install.
 */
export function resolveDashboardAssetsDir(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@interview-sdk/cli/package.json');
  return path.join(path.dirname(pkgPath), 'dist', 'dashboard');
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Resolves a request URL to a real file inside assetsDir, or null if it
 * doesn't exist or would escape assetsDir (path traversal). The dashboard
 * is a single view with no client-side router — no path other than "/"
 * ever needs to resolve to index.html, so there's no SPA-fallback case to
 * handle here.
 */
export function resolveRequestedFile(assetsDir: string, requestUrl: string): string | null {
  const { pathname } = new URL(requestUrl, 'http://localhost');
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const root = path.resolve(assetsDir);
  const resolved = path.resolve(root, relativePath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  if (!existsSync(resolved) || !statSync(resolved).isFile()) return null;
  return resolved;
}

export interface StartDashboardServerOptions {
  assetsDir: string;
  port?: number;
}

export interface DashboardServerHandle {
  server: Server;
  port: number;
}

/** Starts the static file server, retrying on the next port if the requested one is already in use. */
export function startDashboardServer({
  assetsDir,
  port = DEFAULT_PORT,
}: StartDashboardServerOptions): Promise<DashboardServerHandle> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const filePath = resolveRequestedFile(assetsDir, req.url ?? '/');
      if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found.');
        return;
      }
      res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
      createReadStream(filePath).pipe(res);
    });

    let attempt = 0;
    let currentPort = port;

    // Registered before .listen() — bind failures surface via 'error',
    // asynchronously, not a thrown exception from .listen() itself.
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
        attempt += 1;
        currentPort += 1;
        server.listen(currentPort);
        return;
      }
      reject(error);
    });

    server.once('listening', () => {
      // Reads the real bound port back from the OS rather than trusting
      // currentPort, since a requested port of 0 (used in tests to avoid
      // picking a fixed port) is only a request — the OS assigns the
      // actual ephemeral port at bind time.
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : currentPort;
      resolve({ server, port: boundPort });
    });

    server.listen(currentPort);
  });
}

/** Best-effort: opens the system browser, silently doing nothing if it fails (the printed URL is the reliable fallback). */
export function openBrowser(url: string): void {
  const [command, args]: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? // The empty-title argument is required: `start "<url>"` alone is a
          // real cmd.exe bug — a lone quoted argument is treated as the
          // window title, not the target, and nothing opens.
          ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      // e.g. xdg-open missing in a container — ignored, URL is already printed.
    });
    child.unref();
  } catch {
    // ignored — the printed URL is the reliable fallback.
  }
}

export interface RunDashboardOptions {
  port?: number;
  /** Overrides the resolved static-assets directory; injectable for testing. */
  assetsDir?: string;
  /** Overrides the browser-opening step; injectable for testing (defaults to the real openBrowser). */
  openBrowser?: (url: string) => void;
}

/**
 * `interview-sdk dashboard`: serves the local customize-and-copy-code UI
 * and best-effort opens it in the system browser. Runs until the process
 * is interrupted (Ctrl+C) — the open server socket keeps Node alive.
 */
export async function runDashboard(options: RunDashboardOptions = {}): Promise<void> {
  const assetsDir = options.assetsDir ?? resolveDashboardAssetsDir();
  if (!existsSync(assetsDir)) {
    throw new CliConfigError(
      `Dashboard assets not found at "${assetsDir}" — this @interview-sdk/cli install may be incomplete.`,
    );
  }

  const { port } = await startDashboardServer({
    assetsDir,
    ...(options.port ? { port: options.port } : {}),
  });

  const url = `http://localhost:${port}/`;
  console.log(`Dashboard running at ${url}`);
  console.log('Press Ctrl+C to stop.');
  (options.openBrowser ?? openBrowser)(url);
}
