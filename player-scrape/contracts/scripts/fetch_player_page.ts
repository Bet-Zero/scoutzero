import fs from 'node:fs/promises';
import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, isRegressionFixture } from './config';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * getPlayerHtml
 * - If playerId is in the regression set and snapshot exists, return it.
 * - Else fetch live HTML from sourceUrl.
 * - NEVER write per-player HTML to disk in production flows.
 */
export async function getPlayerHtml(
  playerId: string,
  sourceUrl: string
): Promise<string> {
  if (isRegressionFixture(playerId)) {
    const snapshotPath = path.join(paths.snapshotsDir, `${playerId}.html`);
    try {
      return await fs.readFile(snapshotPath, 'utf8');
    } catch {
      // fall through to live fetch if snapshot missing
    }
  }
  const res = await fetch(sourceUrl, { cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${res.status}`);
  return await res.text();
}

/**
 * CLI entrypoint - fetch player page (prefer fixture) and save to working/page.html
 * Usage:
 *   PLAYER_ID="austin_reaves" PLAYER_URL="https://salaryswish.com/players/austin-reaves" npx tsx player-scrape/contracts/scripts/fetch_player_page.ts
 * Notes:
 *   - Prefers PLAYER_ID from env to select regression fixtures.
 *   - Falls back to deriving id from PLAYER_URL if PLAYER_ID is missing.
 *   - Uses domcontentloaded (more reliable than networkidle) with longer timeout.
 */
async function main() {
  const playerUrl = process.env.PLAYER_URL || '';
  const playerIdFromEnv = process.env.PLAYER_ID || '';

  if (!playerUrl) {
    console.error(
      'Usage: PLAYER_URL=<url> [PLAYER_ID=<id>] npx tsx .../fetch_player_page.ts'
    );
    console.error(
      'Example: PLAYER_ID="lebron_james" PLAYER_URL="https://salaryswish.com/players/lebron-james" npx tsx .../fetch_player_page.ts'
    );
    process.exit(1);
  }

  // Prefer explicit PLAYER_ID; otherwise derive from URL slug
  const derivedId =
    playerUrl.match(/\/players\/(.+)$/)?.[1]?.replace(/-/g, '_') || '';
  const playerId = playerIdFromEnv || derivedId;

  if (!playerId) {
    console.error(
      'Could not determine playerId (set PLAYER_ID or use a /players/<slug> URL).'
    );
    process.exit(1);
  }

  console.log(`🔎 Player: ${playerId}`);
  console.log(`🔍 Source: ${playerUrl}`);

  const workingDir = process.env.WORKING_DIR_OVERRIDE
    ? path.resolve(process.env.WORKING_DIR_OVERRIDE)
    : path.join(__dirname, '../_artifacts/working');
  await fs.mkdir(workingDir, { recursive: true });
  const outFile = process.env.TEMP_FILE || 'page.html';
  const outPath = path.join(workingDir, outFile);

  // 1) Fixture-first: if configured and snapshot exists, use it
  if (isRegressionFixture(playerId)) {
    const snapshotPath = path.join(paths.snapshotsDir, `${playerId}.html`);
    try {
      const html = await fs.readFile(snapshotPath, 'utf8');
      await fs.writeFile(outPath, html, 'utf8');
      console.log(`📁 Using regression snapshot → ${snapshotPath}`);
      console.log(
        `💾 Wrote: ${outPath}  (${(html.length / 1024).toFixed(1)} KB)`
      );
      return;
    } catch (error: any) {
      console.warn(
        `⚠️  Snapshot not found for ${playerId}, falling back to live fetch (${error?.message || error})`
      );
    }
  }

  // 2) Live fetch via Playwright (more forgiving settings)
  const { chromium } = await import('playwright');

  const navTimeoutMs = 90000; // 90s hard cap; adjust if needed
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  console.log(
    `🌐 Fetching live page (domcontentloaded, ${navTimeoutMs / 1000}s timeout)…`
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent,
  });
  const page = await context.newPage();

  try {
    // More reliable than "networkidle" on modern sites with long-lived requests
    page.setDefaultNavigationTimeout(navTimeoutMs);

    await page.goto(playerUrl, {
      waitUntil: 'domcontentloaded',
      timeout: navTimeoutMs,
    });

    // Small grace period for client-side rendering to finish up
    await page.waitForTimeout(1500);

    // Optional: wait for a signature element if you know one exists (uncomment if helpful)
    // await page.waitForSelector('table', { timeout: 5000 }).catch(() => {});

    const html = await page.content();

    if (!html || html.length < 500) {
      throw new Error(
        'Fetched HTML looks too small; page may not have loaded correctly.'
      );
    }

    await fs.writeFile(outPath, html, 'utf8');
    console.log(`✅ Saved HTML to: ${outPath}`);
    console.log(`   Size: ${(html.length / 1024).toFixed(1)} KB`);
  } catch (error: any) {
    console.error('❌ Error fetching page:', error?.message || error);
    process.exit(1);
  } finally {
    try {
      await page.close();
    } catch {}
    try {
      await context.close();
    } catch {}
    try {
      await browser.close();
    } catch {}
  }
}

// Only run main if this file is executed directly
if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
