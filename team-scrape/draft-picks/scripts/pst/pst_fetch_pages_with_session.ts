#!/usr/bin/env tsx
/**
 * pst_fetch_pages_with_session.ts
 *
 * Fetches all 30 PST team pages using a previously captured session.
 * Reuses the persistent browser profile to bypass Cloudflare.
 *
 * Usage:
 *   npm run pst:fetch:session
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_fetch_pages_with_session.ts
 *
 * Test mode (quick validation with 2 pages):
 *   npm run pst:session:test
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_fetch_pages_with_session.ts --test
 *
 * Single team:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_fetch_pages_with_session.ts --team=DAL
 *
 * Prerequisites:
 *   Run session capture first: npm run pst:session:capture
 *
 * Outputs:
 *   data/pst/pages/<slug>.html       - HTML snapshots
 *   data/pst/pst_fetch_manifest.json - Fetch manifest with status
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  PROFILE_DIR,
  PAGES_DIR,
  MANIFEST_PATH,
  getDefaultUserAgent,
  hasValidSession,
  loadSessionMeta,
  delay,
  serialize,
  detectCloudflareChallenge,
  hasPstContent,
  assertPstAccess,
  type CloudflareDetectionResult,
} from './pst_session_helpers.js';

import {
  PST_TEAMS,
  buildPstUrl,
  type PstTeamConfig,
} from './pst_team_slugs.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DELAY_BETWEEN_PAGES_MS = 2000;
const PAGE_LOAD_TIMEOUT_MS = 60000;

// Test mode teams (quick validation)
const TEST_TEAMS = ['DAL', 'LAL']; // Mavericks and Lakers

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
  blockedByCloudflare: boolean;
  detectedChallenge: boolean;
  challengeMarkers?: string[];
  error?: string;
};

export type FetchManifest = {
  generatedAt: string;
  sessionCapturedAt: string;
  mode: 'full' | 'test' | 'single';
  totalTeams: number;
  successCount: number;
  failureCount: number;
  challengeCount: number;
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

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// ============================================================================
// FETCH LOGIC
// ============================================================================

async function fetchTeamPage(
  page: Page,
  team: PstTeamConfig
): Promise<ManifestEntry> {
  const url = buildPstUrl(team.slug);
  const snapshotPath = path.join(PAGES_DIR, `${team.slug}.html`);
  const capturedAt = new Date().toISOString();

  try {
    console.log(`  Fetching: ${team.code} (${team.slug}) ...`);

    // Navigate to the page
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    const httpStatus = response?.status();

    // Wait for content to stabilize
    await delay(2000);

    // Get HTML content
    const html = await page.content();

    // Validate content
    if (!html || html.length < 100) {
      throw new Error(`Page content too short (${html?.length ?? 0} bytes)`);
    }

    // Check for Cloudflare challenge
    const cfResult: CloudflareDetectionResult = detectCloudflareChallenge(html);
    const hasContent = hasPstContent(html);

    // Determine status
    const isBlocked = cfResult.isChallenge || !hasContent;
    const status: FetchStatus = isBlocked ? 'failure' : 'success';

    // Save HTML snapshot (even if blocked, for debugging)
    await writeFile(snapshotPath, html, 'utf8');

    const contentHash = sha256(html);

    // Log result
    if (cfResult.isChallenge) {
      console.log(
        `    ✗ ${team.code}: CLOUDFLARE BLOCKED (${cfResult.markers.join(', ')})`
      );
    } else if (!hasContent) {
      console.log(
        `    ⚠ ${team.code}: ${html.length.toLocaleString()} bytes (missing PST content)`
      );
    } else {
      console.log(
        `    ✓ ${team.code}: ${html.length.toLocaleString()} bytes, status=${httpStatus}`
      );
    }

    return {
      slug: team.slug,
      teamCode: team.code,
      url,
      status,
      httpStatus,
      capturedAt,
      snapshotPath,
      contentHash,
      contentLength: html.length,
      blockedByCloudflare: cfResult.isChallenge,
      detectedChallenge: cfResult.isChallenge,
      challengeMarkers: cfResult.isChallenge ? cfResult.markers : undefined,
      error: isBlocked
        ? cfResult.isChallenge
          ? `Cloudflare challenge: ${cfResult.markers.join(', ')}`
          : 'Missing PST content'
        : undefined,
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
      blockedByCloudflare: false,
      detectedChallenge: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const isTestMode = hasFlag('test');
  const teamFilter = parseArg('team')?.toUpperCase();

  console.log('\n🏀 PST Page Fetcher (Session Mode)');
  console.log('===================================');

  // Check for valid session
  if (!(await hasValidSession())) {
    console.error('');
    console.error('❌ No valid session found!');
    console.error('');
    console.error('Please capture a session first:');
    console.error('  npm run pst:session:capture');
    console.error('');
    process.exit(1);
  }

  const sessionMeta = await loadSessionMeta();
  console.log(`  Session captured: ${sessionMeta?.capturedAt ?? 'unknown'}`);
  console.log(`  Profile dir: ${PROFILE_DIR}`);

  // Determine mode and teams
  let mode: 'full' | 'test' | 'single';
  let teamsToFetch: PstTeamConfig[];

  if (teamFilter) {
    mode = 'single';
    teamsToFetch = PST_TEAMS.filter((t) => t.code === teamFilter);
    if (teamsToFetch.length === 0) {
      console.error(`\n❌ No team found matching: ${teamFilter}`);
      process.exit(1);
    }
  } else if (isTestMode) {
    mode = 'test';
    teamsToFetch = PST_TEAMS.filter((t) => TEST_TEAMS.includes(t.code));
    console.log(`\n🧪 TEST MODE - Fetching ${teamsToFetch.length} teams: ${TEST_TEAMS.join(', ')}`);
  } else {
    mode = 'full';
    teamsToFetch = PST_TEAMS;
  }

  console.log(`  Mode: ${mode}`);
  console.log(`  Teams to fetch: ${teamsToFetch.length}`);
  console.log('');

  // Ensure output directory exists
  await mkdir(PAGES_DIR, { recursive: true });

  // Launch browser with persistent context
  console.log('Launching browser with saved session...');

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true, // Run headless for automated fetching
      userAgent: getDefaultUserAgent(),
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
    });
  } catch (err) {
    console.error('❌ Failed to launch browser:', err instanceof Error ? err.message : err);
    console.error('');
    console.error('Session may be corrupted. Try recapturing:');
    console.error('  npm run pst:session:capture');
    process.exit(1);
  }

  const page = await context.newPage();

  const entries: ManifestEntry[] = [];
  let successCount = 0;
  let failureCount = 0;
  let challengeCount = 0;

  try {
    // Quick session validation with first team
    console.log('');
    console.log('Validating session with first page...');
    const firstTeam = teamsToFetch[0];
    const firstEntry = await fetchTeamPage(page, firstTeam);
    entries.push(firstEntry);

    if (firstEntry.detectedChallenge) {
      console.error('');
      console.error('❌ SESSION INVALID - Cloudflare challenge on first page!');
      console.error('');
      console.error('Your session appears to have expired or is invalid.');
      console.error('Please recapture: npm run pst:session:capture');
      await context.close();
      process.exit(1);
    }

    if (firstEntry.status === 'success') {
      successCount++;
      console.log('   ✓ Session validated - continuing with fetch');
    } else {
      failureCount++;
      console.warn('   ⚠ First page had issues but no Cloudflare challenge');
    }

    // Fetch remaining teams
    const remainingTeams = teamsToFetch.slice(1);
    for (const team of remainingTeams) {
      await delay(DELAY_BETWEEN_PAGES_MS);

      const entry = await fetchTeamPage(page, team);
      entries.push(entry);

      if (entry.status === 'success') {
        successCount++;
      } else {
        failureCount++;
        if (entry.detectedChallenge) {
          challengeCount++;
        }
      }
    }
  } finally {
    await context.close();
  }

  // Write manifest
  const manifest: FetchManifest = {
    generatedAt: new Date().toISOString(),
    sessionCapturedAt: sessionMeta?.capturedAt ?? 'unknown',
    mode,
    totalTeams: teamsToFetch.length,
    successCount,
    failureCount,
    challengeCount,
    entries,
  };

  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, serialize(manifest), 'utf8');

  // Summary
  console.log('\n📊 Fetch Summary');
  console.log('================');
  console.log(`  Mode: ${mode}`);
  console.log(`  Total: ${teamsToFetch.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failure: ${failureCount}`);
  console.log(`  Cloudflare blocks: ${challengeCount}`);

  if (challengeCount > 0) {
    console.log('\n❌ CLOUDFLARE BLOCKED PAGES:');
    for (const entry of entries.filter((e) => e.detectedChallenge)) {
      console.log(`    ${entry.teamCode}: ${entry.challengeMarkers?.join(', ')}`);
    }

    console.error('\n💥 Session has expired or is invalid!');
    console.error('   Recapture: npm run pst:session:capture');
    process.exit(1);
  }

  if (failureCount > 0 && challengeCount === 0) {
    console.log('\n⚠️  FAILED PAGES (not Cloudflare):');
    for (const entry of entries.filter((e) => e.status === 'failure' && !e.detectedChallenge)) {
      console.log(`    ${entry.teamCode}: ${entry.error}`);
    }

    console.warn('\n⚠ Some pages failed but not due to Cloudflare.');
    console.warn('  Check manifest for details.');
    // Don't exit with error - these might be retryable
  }

  if (successCount === teamsToFetch.length) {
    console.log('\n✅ All pages fetched successfully!');
    console.log(`   Manifest: ${MANIFEST_PATH}`);
    console.log(`   Pages: ${PAGES_DIR}`);

    if (isTestMode) {
      console.log('\n🎉 TEST PASSED! Session is valid.');
      console.log('   Proceed with full fetch: npm run pst:fetch:session');
    } else if (mode === 'full') {
      console.log('\n🎉 PHASE 1.1 COMPLETE! All 30 pages fetched.');
      console.log('   Next: npm run pst:phase-1-2');
    }
  }

  // Exit with appropriate code
  process.exit(failureCount > 0 ? 1 : 0);
}

// Run if executed directly
if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
