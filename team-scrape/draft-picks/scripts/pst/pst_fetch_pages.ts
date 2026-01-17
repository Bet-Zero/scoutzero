#!/usr/bin/env tsx
/**
 * pst_fetch_pages.ts
 *
 * Browser-grade Playwright fetcher for ProSportsTransactions (PST) Future Draft Trades pages.
 * Fetches all 30 team pages, saves HTML snapshots, and writes a manifest.
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_fetch_pages.ts
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_fetch_pages.ts --headed
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_fetch_pages.ts --team=DAL
 *
 * Outputs:
 *   data/pst/pages/<slug>.html       - HTML snapshots
 *   data/pst/pst_fetch_manifest.json - Fetch manifest with status
 */

import { chromium, type Browser, type Page } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PST_TEAMS,
  buildPstUrl,
  type PstTeamConfig,
} from './pst_team_slugs.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const DEFAULT_PAGES_DIR = path.join(PROJECT_ROOT, 'data', 'pst', 'pages');
const DEFAULT_MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  'data',
  'pst',
  'pst_fetch_manifest.json'
);

// Fetch delays to be respectful to the server
const DELAY_BETWEEN_PAGES_MS = 2000;
const PAGE_LOAD_TIMEOUT_MS = 60000;

// ============================================================================
// TYPES
// ============================================================================

export type FetchStatus = 'success' | 'failure';

export type ManifestEntry = {
  slug: string;
  teamCode: string;
  url: string;
  status: FetchStatus;
  httpStatus?: number;
  capturedAt: string;
  snapshotPath: string;
  contentHash: string;
  contentLength: number;
  error?: string;
};

export type FetchManifest = {
  generatedAt: string;
  totalTeams: number;
  successCount: number;
  failureCount: number;
  entries: ManifestEntry[];
};

// ============================================================================
// CLI ARGS
// ============================================================================

function parseArg(label: string, def?: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${label}`) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(`--${label}=`)) {
      const [, val] = arg.split('=');
      return val ?? 'true';
    }
  }
  return def;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(`--${flag}`);
}

// ============================================================================
// UTILITIES
// ============================================================================

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serialize(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

// ============================================================================
// FETCH LOGIC
// ============================================================================

/**
 * Wait for Cloudflare challenge to complete
 * Cloudflare shows a challenge page that eventually redirects to content
 */
async function waitForCloudflarePass(page: Page, teamCode: string): Promise<boolean> {
  const maxWaitMs = 15000;
  const checkIntervalMs = 500;
  let waitedMs = 0;

  while (waitedMs < maxWaitMs) {
    const html = await page.content();
    const lowerHtml = html.toLowerCase();

    // Check if we're past the Cloudflare challenge
    if (
      !lowerHtml.includes('cloudflare') &&
      !lowerHtml.includes('ray id') &&
      !lowerHtml.includes('checking your browser') &&
      !lowerHtml.includes('just a moment')
    ) {
      return true;
    }

    // Also check if actual content is present (tables with draft data)
    if (lowerHtml.includes('round picks') || lowerHtml.includes('draft')) {
      return true;
    }

    await delay(checkIntervalMs);
    waitedMs += checkIntervalMs;
  }

  console.warn(`    ⚠ ${teamCode}: Cloudflare challenge did not resolve in ${maxWaitMs}ms`);
  return false;
}

async function fetchTeamPage(
  page: Page,
  team: PstTeamConfig
): Promise<ManifestEntry> {
  const url = buildPstUrl(team.slug);
  const snapshotPath = path.join(DEFAULT_PAGES_DIR, `${team.slug}.html`);
  const capturedAt = new Date().toISOString();

  try {
    console.log(`  Fetching: ${team.code} (${team.slug}) ...`);

    // Navigate to the page - use domcontentloaded to avoid hanging on slow resources
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    const httpStatus = response?.status();

    // Wait for Cloudflare challenge to pass if present
    const cloudflareCleared = await waitForCloudflarePass(page, team.code);

    // Extra wait for dynamic content
    await delay(2000);

    // Wait for the table to be present (PST uses tables for pick data)
    const tableFound = await page.waitForSelector('table', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!tableFound) {
      console.warn(`    ⚠ No table found for ${team.code}, saving anyway`);
    }

    // Get full HTML content
    const html = await page.content();

    // Validate content
    if (!html || html.length < 100) {
      throw new Error(`Page content too short (${html?.length ?? 0} bytes)`);
    }

    // Check for Cloudflare/error indicators in content
    const lowerHtml = html.toLowerCase();
    if (
      lowerHtml.includes('403 forbidden') ||
      lowerHtml.includes('access denied')
    ) {
      throw new Error('Page returned 403 Forbidden content');
    }

    // Check if we still have Cloudflare challenge page
    if (
      lowerHtml.includes('checking your browser') ||
      (lowerHtml.includes('cloudflare') && lowerHtml.includes('ray id') && !lowerHtml.includes('round'))
    ) {
      throw new Error('Cloudflare challenge not passed - try headed mode (--headed)');
    }

    // Save HTML snapshot
    await writeFile(snapshotPath, html, 'utf8');

    const contentHash = sha256(html);

    // Check if content looks valid (has draft pick related content)
    const hasPickContent = lowerHtml.includes('round') || lowerHtml.includes('draft') || lowerHtml.includes('pick');
    const statusEmoji = hasPickContent ? '✓' : '⚠';

    console.log(
      `    ${statusEmoji} ${team.code}: ${html.length.toLocaleString()} bytes, status=${httpStatus}${hasPickContent ? '' : ' (may be blocked)'}`
    );

    return {
      slug: team.slug,
      teamCode: team.code,
      url,
      status: hasPickContent ? 'success' : 'failure',
      httpStatus,
      capturedAt,
      snapshotPath,
      contentHash,
      contentLength: html.length,
      error: hasPickContent ? undefined : 'Content may be blocked by Cloudflare',
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`    ✗ ${team.code}: ${errorMessage}`);

    return {
      slug: team.slug,
      teamCode: team.code,
      url,
      status: 'failure',
      capturedAt,
      snapshotPath,
      contentHash: '',
      contentLength: 0,
      error: errorMessage,
    };
  }
}


// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const headed = hasFlag('headed');
  const teamFilter = parseArg('team')?.toUpperCase();
  const pagesDir = parseArg('pagesDir', DEFAULT_PAGES_DIR);
  const manifestPath = parseArg('manifestPath', DEFAULT_MANIFEST_PATH);

  console.log('\n🏀 PST Page Fetcher');
  console.log('===================');
  console.log(`  Headed mode: ${headed}`);
  console.log(`  Pages dir: ${pagesDir}`);
  console.log(`  Manifest: ${manifestPath}`);

  // Filter teams if specified
  const teamsToFetch = teamFilter
    ? PST_TEAMS.filter((t) => t.code === teamFilter)
    : PST_TEAMS;

  if (teamsToFetch.length === 0) {
    console.error(`\n❌ No teams found matching filter: ${teamFilter}`);
    process.exit(1);
  }

  console.log(`  Teams to fetch: ${teamsToFetch.length}`);
  console.log('');

  // Ensure output directory exists
  await ensureDir(pagesDir!);

  // Launch browser
  console.log('Launching browser...');
  const browser: Browser = await chromium.launch({
    headless: !headed,
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const entries: ManifestEntry[] = [];
  let successCount = 0;
  let failureCount = 0;

  try {
    for (const team of teamsToFetch) {
      const entry = await fetchTeamPage(page, team);
      entries.push(entry);

      if (entry.status === 'success') {
        successCount++;
      } else {
        failureCount++;
      }

      // Delay between requests to be respectful
      if (team !== teamsToFetch[teamsToFetch.length - 1]) {
        await delay(DELAY_BETWEEN_PAGES_MS);
      }
    }
  } finally {
    await browser.close();
  }

  // Write manifest
  const manifest: FetchManifest = {
    generatedAt: new Date().toISOString(),
    totalTeams: teamsToFetch.length,
    successCount,
    failureCount,
    entries,
  };

  await ensureDir(path.dirname(manifestPath!));
  await writeFile(manifestPath!, serialize(manifest), 'utf8');

  // Summary
  console.log('\n📊 Fetch Summary');
  console.log('================');
  console.log(`  Total: ${teamsToFetch.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failure: ${failureCount}`);

  if (failureCount > 0) {
    console.log('\n❌ Failed teams:');
    for (const entry of entries.filter((e) => e.status === 'failure')) {
      console.log(`    ${entry.teamCode}: ${entry.error}`);
    }

    console.error('\n💥 Fetch failed! Some pages could not be retrieved.');
    process.exit(1);
  }

  console.log('\n✅ All pages fetched successfully!');
  console.log(`   Manifest: ${manifestPath}`);
  console.log(`   Pages: ${pagesDir}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
