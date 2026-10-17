/** Existing Architect roster/cap/world path. Run cloud:check first to restore its local identity. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { DATA_DIR, coverage, loadSnapshot } from './cloudData.js';
import { runtimeDirectory } from './cloudRuntime.js';

const sourceDir = process.argv.includes('--scope=core') ? path.join(DATA_DIR, 'core') : DATA_DIR;
const report = coverage(await loadSnapshot(sourceDir));
const dir = runtimeDirectory(sourceDir, report.sha256);
const identity = JSON.parse(await readFile(path.join(dir, 'proof.json'), 'utf8'));
assert.equal(identity.sourceSha256, report.sha256);
const resume = process.argv.includes('--resume');
const proofFile = path.join(dir, 'architect-proof.json');
const previous = resume ? JSON.parse(await readFile(proofFile, 'utf8')) : null;
if (previous) assert.equal(previous.sourceSha256, report.sha256);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, storageState: path.join(dir, 'browser-state.json') });
const blocked: string[] = [];
const errors: string[] = [];
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' && ['5173', '8082', '9099', '5001'].includes(url.port)) return route.continue();
  blocked.push(url.origin); return route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.type() === 'confirm' ? dialog.accept() : dialog.dismiss());
try {
  await page.goto('http://127.0.0.1:5173/lists', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByRole('button', { name: '+ New List', exact: true }).waitFor();
  const uid = await page.evaluate(async () => {
    const modulePath = '/src/firebaseConfig.ts';
    const { auth, db, FIREBASE_TARGET_MODE, FIREBASE_EMULATOR_ENDPOINTS: endpoints } = await import(/* @vite-ignore */ modulePath);
    await auth.authStateReady();
    if (db.app.options.projectId !== 'demo-architect-review' || FIREBASE_TARGET_MODE !== 'EMULATOR' ||
        auth.emulatorConfig?.host !== '127.0.0.1' || auth.emulatorConfig.port !== 9099 ||
        endpoints.firestore?.host !== '127.0.0.1' || endpoints.firestore.port !== 8082 ||
        endpoints.functions?.host !== '127.0.0.1' || endpoints.functions.port !== 5001) throw new Error('Architect proof requires the fixed local demo services');
    return auth.currentUser?.uid;
  });
  assert.equal(uid, identity.emulatorUserId);
  await page.goto('http://127.0.0.1:5173/gm/MIA', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByTestId('cockpit-world-menu-trigger').waitFor();
  const worldName = previous?.worldName || 'Cloud Review ' + new Date().toISOString().slice(11, 19);
  if (!resume) {
    await page.getByTestId('cockpit-world-menu-trigger').click();
    await page.getByTitle('Create new world', { exact: true }).click();
    await page.getByLabel('World Name', { exact: true }).fill(worldName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByLabel('World Name', { exact: true }).waitFor({ state: 'detached' });
  }
  await page.getByTestId('cockpit-world-menu-trigger').filter({ hasText: worldName }).waitFor();
  await page.getByTestId('cockpit-world-menu-trigger').click();
  const worldId = await page.locator('#world-selector').inputValue();
  assert(worldId);
  if (previous) assert.equal(worldId, previous.worldId);
  const metadata = await page.evaluate(async (id: string) => {
    const modulePath = '/src/features/architect/utils/worldManager.ts';
    const { getWorldMetadata } = await import(/* @vite-ignore */ modulePath);
    const value = await getWorldMetadata(id);
    return { name: value.worldName, owner: value.createdBy, contractSourceRelease: value.contractSourceRelease };
  }, worldId);
  assert.equal(metadata.name, worldName); assert.equal(metadata.owner, uid);
  assert(metadata.contractSourceRelease, 'Use the existing governed initializer, not an invented world root');
  await page.getByTestId('cockpit-world-menu-trigger').click();
  await page.getByText('Bam Adebayo', { exact: true }).first().waitFor();
  await page.screenshot({ path: path.join(dir, 'architect-cap.png') });
  const capText = await page.locator('body').innerText();
  const rosterLink = page.getByRole('link', { name: /Roster/ }).first();
  await rosterLink.click();
  await page.getByText('Bam Adebayo', { exact: true }).first().waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('cockpit-world-menu-trigger').filter({ hasText: worldName }).waitFor();
  await page.getByText('Bam Adebayo', { exact: true }).first().waitFor();
  await page.screenshot({ path: path.join(dir, 'architect-roster.png') });
  assert.deepEqual(errors, []);
  await context.storageState({ path: path.join(dir, 'browser-state.json'), indexedDB: true });
  await writeFile(proofFile, JSON.stringify({ sourceSha256: report.sha256, sourceReadTime: report.readTime,
    worldName, worldId, emulatorUserId: uid, checkedAt: new Date().toISOString(), resumed: resume,
    checkedCandidateSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    cleanWorktree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() === '',
    worldSavedAndReloaded: true, rosterRendered: true, capRendered: true,
    capNeedsInput: /Needs input|SALARY BOOKS NEED INPUT/i.test(capText),
    contractSourceRelease: metadata.contractSourceRelease, pageErrors: errors, blockedOrigins: [...new Set(blocked)] }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ passed: true, worldSavedAndReloaded: true, rosterRendered: true, capRendered: true,
    capNeedsInput: /Needs input|SALARY BOOKS NEED INPUT/i.test(capText), resumed: resume }));
} catch (error) {
  await page.screenshot({ path: path.join(dir, 'architect-failure.png'), timeout: 10000 }).catch(() => {});
  await writeFile(path.join(dir, 'architect-failure.txt'), await page.locator('body').innerText(), { mode: 0o600 }).catch(() => {});
  throw error;
} finally { await browser.close(); }
