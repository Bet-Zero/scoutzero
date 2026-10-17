/** Existing Players → Lists workflow, confined to local demo services. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { DATA_DIR, coverage, loadSnapshot } from './cloudData.js';

const dir = path.resolve(DATA_DIR);
const report = coverage(await loadSnapshot());
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
  await page.goto('http://127.0.0.1:5173/lists');
  console.log('[cloud-check] Lists loaded');
  await page.getByRole('button', { name: '+ New List', exact: true }).waitFor();
  await page.waitForFunction(async () => {
    // Vite serves this existing application module; never a production SDK.
    const modulePath = '/src/firebaseConfig.ts';
    const { auth, db } = await import(/* @vite-ignore */ modulePath);
    return auth.currentUser && db.app.options.projectId === 'demo-architect-review';
  }, undefined, { timeout: 20000 });
  console.log('[cloud-check] Isolated authentication ready');
  const emulatorUserId = await page.evaluate(async () => {
    const modulePath = '/src/firebaseConfig.ts';
    const { auth } = await import(/* @vite-ignore */ modulePath);
    return auth.currentUser.uid as string;
  });
  if (resume) assert.equal(emulatorUserId, prior.emulatorUserId, 'The saved emulator identity must be restored');
  // Use the existing navigation so the authenticated Firebase session remains
  // initialized. A cold /players load currently has a pre-existing auth race.
  await page.getByRole('link', { name: 'Players', exact: true }).click();
  await page.waitForFunction(() => /[1-9][0-9]* players/.test(document.body.innerText), undefined, { timeout: 20000 });
  const total = Number((await page.locator('body').innerText()).match(/([0-9]+) players/)?.[1]);
  assert(total > 100, 'Expected the real player dataset, not a tiny review fixture');
  console.log('[cloud-check] Player dataset rendered');
  let record: { name: string; listUrl: string; sourceSha256: string };
  if (resume) {
    record = prior;
    assert.equal(record.sourceSha256, report.sha256, 'Resume proof must use the same source');
  } else {
    const name = 'Cloud Development ' + new Date().toISOString().replace(/[:.]/g, '-');
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
  const page = context.pages().find((p) => p.url().startsWith('http://127.0.0.1:5173'));
  if (page) {
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    await writeFile(path.join(dir, 'failure.txt'), await page.locator('body').innerText(), { mode: 0o600 }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
