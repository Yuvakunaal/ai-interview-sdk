import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliConfigError } from '../errors.js';
import {
  getMimeType,
  openBrowser,
  resolveDashboardAssetsDir,
  resolveRequestedFile,
  runDashboard,
  startDashboardServer,
} from './dashboard.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = vi.fn();
    return child;
  }),
}));

function stubPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-dashboard-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html><title>Dashboard</title>');
  await writeFile(join(dir, 'app.js'), 'console.log("hi");');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('getMimeType', () => {
  it('maps known extensions to their content type', () => {
    expect(getMimeType('index.html')).toBe('text/html; charset=utf-8');
    expect(getMimeType('app.js')).toBe('text/javascript; charset=utf-8');
    expect(getMimeType('styles.css')).toBe('text/css; charset=utf-8');
    expect(getMimeType('data.json')).toBe('application/json; charset=utf-8');
    expect(getMimeType('icon.svg')).toBe('image/svg+xml');
  });

  it('falls back to a generic binary type for unknown extensions', () => {
    expect(getMimeType('mystery.xyz')).toBe('application/octet-stream');
  });
});

describe('resolveRequestedFile', () => {
  it('serves index.html for the root path', () => {
    expect(resolveRequestedFile(dir, '/')).toBe(join(dir, 'index.html'));
  });

  it('resolves a real file by path', () => {
    expect(resolveRequestedFile(dir, '/app.js')).toBe(join(dir, 'app.js'));
  });

  it('returns null for a file that does not exist (no SPA fallback)', () => {
    expect(resolveRequestedFile(dir, '/nonexistent')).toBeNull();
  });

  it('returns null for a path-traversal attempt', () => {
    expect(resolveRequestedFile(dir, '/../../etc/passwd')).toBeNull();
  });

  it('strips query strings before resolving', () => {
    expect(resolveRequestedFile(dir, '/app.js?v=123')).toBe(join(dir, 'app.js'));
  });
});

describe('startDashboardServer', () => {
  let handles: Server[] = [];

  afterEach(async () => {
    await Promise.all(handles.map((server) => new Promise((resolve) => server.close(resolve))));
    handles = [];
  });

  it('serves index.html with the correct content type', async () => {
    const { server, port } = await startDashboardServer({ assetsDir: dir, port: 0 });
    handles.push(server);

    const response = await fetch(`http://localhost:${port}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toContain('Dashboard');
  });

  it('returns 404 for a missing file', async () => {
    const { server, port } = await startDashboardServer({ assetsDir: dir, port: 0 });
    handles.push(server);

    const response = await fetch(`http://localhost:${port}/nonexistent`);
    expect(response.status).toBe(404);
  });

  it('binds to localhost only, not all network interfaces', async () => {
    // No host argument on .listen() binds 0.0.0.0/:: by default — reachable
    // from other machines on the same network — even though the printed
    // URL ("http://localhost:<port>/") implies this is local-only.
    const { server, port } = await startDashboardServer({ assetsDir: dir, port: 0 });
    handles.push(server);

    const address = server.address();
    expect(typeof address === 'object' && address ? address.address : undefined).toBe(
      '127.0.0.1',
    );

    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(200);
  });

  it('retries on the next port when the requested one is already in use', async () => {
    const blocker = createServer(() => {});
    // Must bind the same host (127.0.0.1) startDashboardServer now binds —
    // otherwise this doesn't actually collide and the retry path never
    // triggers.
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const address = blocker.address();
    const busyPort = typeof address === 'object' && address ? address.port : 0;
    handles.push(blocker);

    const { server, port } = await startDashboardServer({ assetsDir: dir, port: busyPort });
    handles.push(server);

    expect(port).not.toBe(busyPort);
    // 127.0.0.1, not "localhost" — Node's fetch/undici has a known quirk
    // where reusing "localhost" right after a failed listen() attempt on
    // the same port can corrupt its connection state; unrelated to the
    // server itself, which is confirmed reachable via its actual bound
    // address (127.0.0.1, see the binding test above).
    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(200);
  });
});

describe('runDashboard', () => {
  it('throws a clear config error when the assets directory does not exist', async () => {
    await expect(
      runDashboard({ assetsDir: join(dir, 'does-not-exist'), openBrowser: vi.fn() }),
    ).rejects.toThrow(CliConfigError);
  });

  it('starts the server and calls the injected openBrowser with the real URL, without touching the OS', async () => {
    const openBrowser = vi.fn();
    await runDashboard({ assetsDir: dir, port: 0, openBrowser });

    expect(openBrowser).toHaveBeenCalledTimes(1);
    const [url] = openBrowser.mock.calls[0]!;
    expect(url).toMatch(/^http:\/\/localhost:\d+\/$/);

    const response = await fetch(url);
    expect(response.status).toBe(200);
  });
});

describe('resolveDashboardAssetsDir', () => {
  it("resolves via this package's own package.json, ending in dist/dashboard", () => {
    const resolved = resolveDashboardAssetsDir();
    expect(resolved.endsWith(join('dist', 'dashboard'))).toBe(true);
    expect(resolved).toContain(join('packages', 'cli'));
  });
});

describe('openBrowser', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    stubPlatform(originalPlatform);
    vi.mocked(spawn).mockClear();
  });

  it('uses "open" on darwin', () => {
    stubPlatform('darwin');
    openBrowser('http://localhost:4949/');
    expect(spawn).toHaveBeenCalledWith(
      'open',
      ['http://localhost:4949/'],
      expect.objectContaining({ detached: true }),
    );
  });

  it('uses "xdg-open" on linux', () => {
    stubPlatform('linux');
    openBrowser('http://localhost:4949/');
    expect(spawn).toHaveBeenCalledWith(
      'xdg-open',
      ['http://localhost:4949/'],
      expect.objectContaining({ detached: true }),
    );
  });

  it('uses the cmd /c start "" <url> empty-title idiom on win32 (a bare quoted URL is a known cmd.exe bug)', () => {
    stubPlatform('win32');
    openBrowser('http://localhost:4949/');
    expect(spawn).toHaveBeenCalledWith(
      'cmd',
      ['/c', 'start', '', 'http://localhost:4949/'],
      expect.objectContaining({ detached: true }),
    );
  });

  it('never throws even if the child process reports an error (e.g. xdg-open missing)', () => {
    stubPlatform('linux');
    expect(() => openBrowser('http://localhost:4949/')).not.toThrow();
    const child = vi.mocked(spawn).mock.results[0]!.value as EventEmitter;
    expect(() => child.emit('error', new Error('command not found'))).not.toThrow();
  });
});
