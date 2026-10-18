/**
 * FILE: scripts/dev/maintenanceConsumer.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Verify the two real player consumers after demo publication, with all network confined locally. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadSnapshot, digest } from './cloudData.js';
import { runtimeDirectory } from './cloudRuntime.js';

export async function verifyPublishedPlayer(dir: string, playerId: string, sourceSeason: string) {
  const snapshot = await loadSnapshot('.scoutzero-dev/core');
  const session = runtimeDirectory('.scoutzero-dev/core', digest(snapshot));
  const browser = await chromium.launch({ executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined, headless: true });
  try {
    const context = await browser.newContext({ storageState: path.join(session, 'browser-state.json'), viewport: { width: 1280, height: 720 } });
    await context.route('**/*', route => ['http://127.0.0.1:5173', 'http://127.0.0.1:8082', 'http://127.0.0.1:9099', 'http://127.0.0.1:5001'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5173/lists');
    await page.getByRole('link', { name: 'Players', exact: true }).click();
    const stored = await page.evaluate(async id => {
      const modulePath = '/scripts/dev/maintenanceConsumer.browser.ts';
      const { readPublishedPlayer } = await import(/* @vite-ignore */ modulePath);
      return readPublishedPlayer(id);
    }, playerId);
    assert(stored?.bio?.displayName, 'The app SDK must read the actual published player');
    await page.getByPlaceholder('Search players...').fill(stored.bio.displayName);
    await page.waitForFunction(() => /\b1 players\b/.test(document.body.innerText), undefined, { timeout: 20000 });
    await page.screenshot({ path: path.join(dir, 'published-player-table.png') });
    await page.goto('http://127.0.0.1:5173/profiles?pid=' + encodeURIComponent(playerId));
    try { await page.getByText(sourceSeason, { exact: true }).first().waitFor({ timeout: 20000 }); }
    catch (error) {
      await page.screenshot({ path: path.join(dir, 'published-profile-failure.png') });
      await writeFile(path.join(dir, 'published-profile-failure.txt'), await page.locator('body').innerText(), { mode: 0o600 });
      throw error;
    }
    await page.screenshot({ path: path.join(dir, 'published-player-profile.png') });
    return { tableRendered: true, profileRendered: true, actualProfileSeason: sourceSeason, currentSeasonStatsPresent: !!stored.currentSeasonStats };
  } finally { await browser.close(); }
}
