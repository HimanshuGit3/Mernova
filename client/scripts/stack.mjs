/**
 * Starts an isolated, seeded FixIt Campus stack for UI tests and screenshots:
 *   API on :5055 (database fixit_ui, uploads in server/.cache/ui-uploads) + Vite on :5174.
 * Never touches the development database, uploads or ports.
 *
 *   node scripts/stack.mjs          start, seed, and keep running (Playwright webServer)
 *   import { startStack } from './stack.mjs'   programmatic use (screenshots)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '..');
const serverDir = path.resolve(clientDir, '..', 'server');

export const API_PORT = Number(process.env.UI_API_PORT ?? 5055);
export const WEB_PORT = Number(process.env.UI_WEB_PORT ?? 5174);
export const API_URL = `http://localhost:${API_PORT}/api`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'FixIt@2026';

const serverEnv = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  MONGODB_URI: process.env.UI_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/fixit_ui',
  CLIENT_ORIGIN: WEB_URL,
  UPLOAD_DIR: '.cache/ui-uploads',
  SEED_PASSWORD,
  JWT_SECRET: process.env.JWT_SECRET ?? 'ui-test-secret-0123456789abcdefghijklmnopqrstuvwxyz',
  AI_TRIAGE_ENABLED: process.env.AI_TRIAGE_ENABLED ?? 'false',
  RATE_LIMIT_AUTH_MAX: '1000',
};

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    p.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`)),
    );
  });
}

async function waitFor(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function startStack({ seed = true, quiet = false, ai = false } = {}) {
  // AI off by default for deterministic tests; screenshots turn it on to show the AI chip.
  if (ai) serverEnv.AI_TRIAGE_ENABLED = 'true';
  if (seed)
    await run(process.execPath, ['scripts/seed.js', '--reset'], {
      cwd: serverDir,
      env: serverEnv,
      stdio: quiet ? 'ignore' : 'inherit',
    });
  const stdio = quiet ? 'ignore' : 'inherit';
  const api = spawn(process.execPath, ['server.js'], { cwd: serverDir, env: serverEnv, stdio });
  const viteBin = path.resolve(clientDir, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  const web = spawn(process.execPath, [viteBin, '--port', String(WEB_PORT), '--strictPort'], {
    cwd: clientDir,
    env: { ...process.env, VITE_API_URL: API_URL, VITE_SOCKET_URL: `http://localhost:${API_PORT}` },
    stdio,
  });
  const stop = () => {
    api.kill();
    web.kill();
  };
  process.on('exit', stop);
  await Promise.all([waitFor(`${API_URL}/health`), waitFor(WEB_URL)]);
  return { stop };
}

// Run directly: start and keep running until killed (used by Playwright's webServer).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startStack()
    .then(() => console.log(`UI stack ready: web ${WEB_URL}, API ${API_URL}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
}
