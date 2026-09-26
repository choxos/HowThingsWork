// Runs every browser check in src/site against one dev server.
//
// Serial on purpose. Each check drives a headless Chromium that renders a
// WebGL scene, and three of those at once starve each other until the page
// never fires `load`; the failures that follow are the machine, not the site.
//
// The dev server rather than a preview build, because a few checks fetch a
// module's own source from `/src/site/...` to reach the three.js instance the
// page is using, and a built bundle no longer serves that path.
import {spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('..', import.meta.url));
const siteDir = new URL('../src/site/', import.meta.url);
const port = Number(process.env.CHECK_PORT || 5175);
const base = process.env.SITE_URL || `http://127.0.0.1:${port}/`;
const only = process.argv.slice(2);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function serverIsUp() {
  try {
    // A loaded machine can take many seconds to answer; waiting only 2 s called a working server dead.
    const response = await fetch(base, {signal: AbortSignal.timeout(30000)});
    return response.ok;
  } catch {
    return false;
  }
}

let server;
async function ensureServer() {
  if (await serverIsUp()) return true;
  if (process.env.SITE_URL) return false;
  server?.kill();
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await wait(500);
    if (await serverIsUp()) return true;
  }
  server.kill();
  server = undefined;
  return false;
}

const names = (await readdir(siteDir))
  .filter(name => name.startsWith('check-') && name.endsWith('.mjs'))
  // The `-model` checks are analytic and run without a browser, under test:models.
  .filter(name => !name.endsWith('-model.mjs'))
  .map(name => name.slice(0, -4))
  .filter(name => only.length === 0 || only.includes(name))
  .sort();

const unknown = only.filter(name => !names.includes(name));
if (unknown.length) throw new Error('Unknown browser checks: ' + unknown.join(', '));
if (!names.length) throw new Error('No browser checks selected');

if (!(await ensureServer())) {
  console.error(`The dev server never answered on ${base}`);
  process.exit(1);
}
console.log(server ? `Started the dev server on ${base}` : `Reusing the server already on ${base}`);

const run = name =>
  new Promise(resolve => {
    const child = spawn(process.execPath, [`src/site/${name}.mjs`], {
      cwd: root,
      env: {...process.env, SITE_URL: base},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.stderr.on('data', chunk => (output += chunk));
    // Five minutes a check unless CHECK_TIMEOUT_MS says otherwise: the longest
    // checks walk every preset at two widths and need more on a loaded machine.
    const timer = setTimeout(() => child.kill('SIGKILL'), Number(process.env.CHECK_TIMEOUT_MS || 300000));
    child.on('close', code => {
      clearTimeout(timer);
      resolve({code, output});
    });
  });

const failures = [];
for (const [index, name] of names.entries()) {
  // A server that has gone away turns every remaining check into a connection
  // refused, which reads as a wall of failures that say nothing about the site.
  if (!(await ensureServer())) {
    console.error(`The dev server stopped answering before ${name}`);
    server?.kill();
    process.exit(1);
  }
  const started = Date.now();
  let {code, output} = await run(name);
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const label = `${String(index + 1).padStart(2)}/${names.length}`;
  if (code === 0) {
    console.log(`${label} PASS ${name} (${seconds}s)`);
    continue;
  }
  console.log(`${label} FAIL ${name} (${seconds}s)`);
  console.log(output.split('\n').slice(-25).join('\n'));
  failures.push(name);
}

server?.kill();
if (failures.length) {
  console.error(`\n${failures.length} of ${names.length} browser checks failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`\nAll ${names.length} browser checks passed without retries.`);
