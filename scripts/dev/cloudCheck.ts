/** Existing Players → Lists workflow, confined to local demo services. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { DATA_DIR, coverage, loadSnapshot } from './cloudData.js';
import { runtimeDirectory } from './cloudRuntime.js';

const sourceDir = process.argv.includes('--scope=core') ? path.join(DATA_DIR, 'core') : DATA_DIR;
const report = coverage(await loadSnapshot(sourceDir));
const dir = runtimeDirectory(sourceDir, report.sha256);
await mkdir(dir, { recursive: true, mode: 0o700 });
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const resume = process.argv.includes('--resume');
const recordPath = path.join(dir, 'proof.json');
const prior = resume ? JSON.parse(await readFile(recordPath, 'utf8')) : null;
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  ...(resume ? { storageState: path.join(dir, 'browser-state.json') } : {}),
});
const errors: string[] = [];
const blocked: string[] = [];
const failedRequests: { path: string; error: string | undefined }[] = [];
context.setDefaultTimeout(30000);
context.setDefaultNavigationTimeout(30000);
try {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && ['5173', '8082', '9099', '5001'].includes(url.port)) {
      await route.continue();
    } else {
      blocked.push(url.origin);
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    failedRequests.push({ path: url.origin + url.pathname, error: request.failure()?.errorText });
  });
  if (resume) {
    // Import invalidates old emulator ID tokens. Reauthenticate the existing
    // exported account; never recreate a missing one or use a production key.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST &&
        process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
      throw new Error('Unexpected Auth emulator target');
    }
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    const app = initializeApp({ projectId: 'demo-architect-review' }, 'cloud-development-resume');
    let token: string;
    try {
      const localAuth = getAuth(app);
      await localAuth.getUser(prior.emulatorUserId);
      token = await localAuth.createCustomToken(prior.emulatorUserId);
    } finally { await deleteApp(app); }
    // Load a real loopback document (a fulfilled document loses Chromium's
    // loopback address-space classification). Defer React until SDK recovery
    // so mounted hooks cannot create a replacement anonymous account first.
    const entry = 'http://127.0.0.1:5173/src/main.tsx';
    await page.route(entry, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('http://127.0.0.1:5173/');
    await page.evaluate(async ({ token, uid }) => {
      const modulePath = '/scripts/dev/cloudSession.browser.ts';
      const { resumeCloudSession } = await import(/* @vite-ignore */ modulePath);
      await resumeCloudSession(token, uid);
    }, { token, uid: prior.emulatorUserId });
    await page.unroute(entry);
  }
  await page.goto('http://127.0.0.1:5173/lists');
  console.log('[cloud-check] Lists loaded');
  await page.getByRole('button', { name: '+ New List', exact: true }).waitFor();
  const emulatorUserId = await page.evaluate(async () => {
    // Await the actual user inside one evaluation. An async waitForFunction
    // predicate can resolve a Promise containing null before sign-in finishes.
    const modulePath = '/src/firebaseConfig.ts';
    const { auth, db } = await import(/* @vite-ignore */ modulePath);
    if (db.app.options.projectId !== 'demo-architect-review') throw new Error('Not an isolated project');
    for (let attempt = 0; attempt < 80; attempt++) {
      if (auth.currentUser) return auth.currentUser.uid as string;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Isolated authentication did not become ready');
  });
  console.log('[cloud-check] Isolated authentication ready');
  if (resume) assert.equal(emulatorUserId, prior.emulatorUserId, 'The saved emulator identity must be restored');
  // Use the existing navigation so the authenticated Firebase session remains
  // initialized. A cold /players load currently has a pre-existing auth race.
  await page.getByRole('link', { name: 'Players', exact: true }).click();
  // The saved browser state includes the prior player search. Clear it and
  // await the settled result rather than mistaking a one-player filter for data
  // loss or clicking the old first row before the search debounce completes.
  await page.getByPlaceholder('Search players...').fill('');
  await page.waitForFunction(() => {
    const count = document.body.innerText.match(/([0-9]+) players/);
    return count && Number(count[1]) > 100;
  }, undefined, { timeout: 20000 });
  const total = Number((await page.locator('body').innerText()).match(/([0-9]+) players/)?.[1]);
  assert(total > 100, 'Expected the real player dataset, not a tiny review fixture');
  console.log('[cloud-check] Player dataset rendered');
  let record: { name: string; listUrl: string; sourceSha256: string };
  if (resume) {
    record = prior;
    assert.equal(record.sourceSha256, report.sha256, 'Resume proof must use the same source');
  } else {
    const name = 'Scouting Review ' + new Date().toISOString().slice(11, 19);
    await page.getByPlaceholder('Search players...').fill('LeBron James');
    await page.getByText(/^lebron$/i).first().waitFor();
    await page.getByText(/^james$/i).first().waitFor();
    await page.waitForFunction(() => /\b1 players\b/.test(document.body.innerText), undefined, { timeout: 10000 });
    await page.getByTitle('Add to List', { exact: true }).first().waitFor();
    await page.getByTitle('Add to List', { exact: true }).first().click();
    await page.getByPlaceholder('e.g. Free Agent Rankings').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    console.log('[cloud-check] Save submitted');
    await page.getByPlaceholder('e.g. Free Agent Rankings').waitFor({ state: 'detached' });
    await page.goto('http://127.0.0.1:5173/lists');
    await page.getByRole('heading', { name, exact: true }).click();
    await page.getByText(/^lebron$/i).first().waitFor();
    await page.getByText(/^james$/i).first().waitFor();
    await page.getByRole('button', { name: 'Save List', exact: true }).click();
    await page.getByRole('button', { name: 'Save List', exact: true }).waitFor();
    record = { name, listUrl: page.url(), sourceSha256: report.sha256 };
  }
  assert(record.listUrl.startsWith('http://127.0.0.1:5173/lists/'));
  await page.goto(record.listUrl);
  await page.getByRole('heading', { name: record.name, exact: true }).waitFor();
  await page.getByText(/^lebron$/i).first().waitFor();
  await page.getByText(/^james$/i).first().waitFor();
  await page.reload();
  await page.getByText(/^lebron$/i).first().waitFor();
  await page.getByText(/^james$/i).first().waitFor();
  await page.screenshot({ path: path.join(dir, resume ? 'resumed-list.png' : 'saved-list.png') });
  assert.deepEqual(errors, [], 'Unexpected browser errors');
  await context.storageState({ path: path.join(dir, 'browser-state.json'), indexedDB: true });
  await writeFile(recordPath, JSON.stringify({
    ...record, emulatorUserId, checkedAt: new Date().toISOString(), visiblePlayers: total,
    checkedCandidateSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    cleanWorktree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() === '',
    workflow: 'Players → add real player to List → save → reload',
    isolatedProject: 'demo-architect-review', resumed: resume,
    sourceCapturedAt: report.capturedAt, blockedExternalOrigins: [...new Set(blocked)],
    pageErrors: errors,
  }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ passed: true, visiblePlayers: total, savedAndReloaded: true, resumed: resume }));
} catch (error) {
  console.error(JSON.stringify({ failedRequests, blockedExternalOrigins: [...new Set(blocked)] }));
  const page = context.pages().find((p) => p.url().startsWith('http://127.0.0.1:5173'));
  if (page) {
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    await writeFile(path.join(dir, 'failure.txt'), await page.locator('body').innerText(), { mode: 0o600 }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
