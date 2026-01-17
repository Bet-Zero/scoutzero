#!/usr/bin/env tsx
/**
 * pst_fetch_pages_over_cdp.ts
 *
 * Fetches PST (ProSportsTransactions) team pages by connecting to an existing
 * Chrome instance via CDP (Cloudflare Bypassing Phase 1.1c).
 *
 * This method is required because Cloudflare fingerprints Playwright-launched
 * browsers even when valid storageState/profile is used. By using the user's
 * actual Chrome instance, we inherit the full trust of the browser session.
 *
 * Usage:
 *   chrome-debug  (launch chrome with --remote-debugging-port=9222)
 *   npm run pst:fetch:cdp:test  (Fetch DAL + LAL only)
 *   npm run pst:fetch:cdp       (Fetch all 30 teams)
 */

import { chromium } from 'playwright';
import { 
  detectCloudflareChallenge,
  hasPstContent,
  PAGES_DIR,
  MANIFEST_PATH,
  delay
} from './pst_session_helpers.js';
import { PST_TEAMS, buildPstUrl } from './pst_team_slugs.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

// Manifest Definitions
type FetchStatus = 'success' | 'challenge_blocked' | 'error' | 'empty';

interface PageManifestEntry {
  teamCode: string;
  url: string;
  status: FetchStatus;
  timestamp: string;
  contentHash?: string;
  contentLength?: number;
  markers?: string[];
  error?: string;
  fetchMethod: 'cdp';
}

interface FetchManifest {
  meta: {
    generatedAt: string;
    totalTeams: number;
    successCount: number;
    failureCount: number;
    mode: 'test' | 'full';
  };
  pages: Record<string, PageManifestEntry>;
}

// Calculate MD5 hash of content
function calculateHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  const isTestMode = args.includes('--test');

  console.log('\n🏀 PST PAGE FETCHER (CDP MODE) 🏀\n');
  console.log(`Mode: ${isTestMode ? 'TEST (DAL + LAL)' : 'FULL (30 Teams)'}`);
  console.log(`Connecting to Chrome at ${CDP_URL}...`);

  // 1. Prepare Target List
  const targets = isTestMode 
    ? PST_TEAMS.filter(t => ['DAL', 'LAL'].includes(t.code))
    : PST_TEAMS;

  // 2. Connect to Browser
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (err: any) {
    console.error(`\n❌ Could not connect to Chrome at ${CDP_URL}`);
    console.error('Make sure Chrome is running with: --remote-debugging-port=9222');
    process.exit(1);
    return; // satisfy ts
  }

  const context = browser.contexts()[0];
  if (!context) {
    console.error('❌ No browser context found.');
    await browser.close();
    process.exit(1);
    return;
  }

  // 3. Setup Page (reuse one tab)
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('prosportstransactions.com'));
  
  if (!page) {
    console.log('Opening new tab for fetching...');
    page = await context.newPage();
  } else {
    console.log(`Reusing existing PST tab: ${page.url()}`);
    await page.bringToFront();
  }

  // 4. Ensure Output Directory
  await mkdir(PAGES_DIR, { recursive: true });

  // 5. Initialize Manifest
  const manifestData: Record<string, PageManifestEntry> = {};
  let successCount = 0;
  let failureCount = 0;

  console.log(`\nStarting fetch for ${targets.length} teams...\n`);

  for (const team of targets) {
    const url = buildPstUrl(team.slug);
    console.log(`[${team.code}] Fetching ${url} ...`);

    const entry: PageManifestEntry = {
      teamCode: team.code,
      url,
      status: 'error',
      timestamp: new Date().toISOString(),
      fetchMethod: 'cdp'
    };

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for table OR Cloudflare marker
      // We accept either the main table OR a challenge element appearing
      try {
        await page.waitForSelector('table, #cf-challenge, title:has-text("Just a moment")', { timeout: 5000 });
      } catch (e) {
        // Timeout is okay, we will analyze content anyway
      }

      // Small stabilization delay
      await delay(1000);

      const content = await page.content();
      const cfResult = detectCloudflareChallenge(content);

      if (cfResult.isChallenge) {
        console.warn(`  ⚠️  Cloudflare Challenge Detected! (${cfResult.markers.join(', ')})`);
        // In CDP mode, we might be able to wait for the user to solve it, 
        // but for now, we just mark it. If the user is watching, they might see it.
        // Let's wait a bit longer just in case it auto-solves
        if (cfResult.confidence === 'high') {
             console.log('  Waiting 5s for potential auto-solve...');
             await delay(5000);
             // Re-read
             const newContent = await page.content();
             const newCfResult = detectCloudflareChallenge(newContent);
             if (newCfResult.isChallenge) {
                 entry.status = 'challenge_blocked';
                 entry.markers = newCfResult.markers;
                 failureCount++;
             } else {
                 // It solved!
                 if (hasPstContent(newContent)) {
                    processSuccess(entry, newContent, team.slug);
                    successCount++;
                 } else {
                    entry.status = 'empty';
                    failureCount++;
                 }
             }
        } else {
            entry.status = 'challenge_blocked';
            entry.markers = cfResult.markers;
            failureCount++;
        }
      } else if (hasPstContent(content)) {
        await processSuccess(entry, content, team.slug);
        successCount++;
      } else {
        console.warn('  ⚠️  Page loaded but lacks PST content (Empty?)');
        entry.status = 'empty';
        failureCount++;
      }

    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      entry.status = 'error';
      entry.error = err.message;
      failureCount++;
    }

    manifestData[team.code] = entry;
    
    // Add a small delay between requests to be polite, even though we are human-speed
    // Random 1-2s
    const waitTime = 1000 + Math.random() * 1000;
    await delay(waitTime);
  }

  // 6. Write Manifest
  const manifest: FetchManifest = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalTeams: targets.length,
      successCount,
      failureCount,
      mode: isTestMode ? 'test' : 'full'
    },
    pages: manifestData
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  
  console.log('\n----------------------------------------');
  console.log(`Fetch Complete.`);
  console.log(`Success: ${successCount} / ${targets.length}`);
  console.log(`Failed:  ${failureCount}`);
  console.log(`Manifest written to: ${MANIFEST_PATH}`);
  console.log('----------------------------------------\n');

  console.log('Disconnecting CDP...');
  await browser.close();
}

async function processSuccess(entry: PageManifestEntry, content: string, slug: string) {
    const filename = `${slug}.html`;
    const filepath = path.join(PAGES_DIR, filename);
    await writeFile(filepath, content);
    
    entry.status = 'success';
    entry.contentHash = calculateHash(content);
    entry.contentLength = content.length;
    console.log(`  ✅ Saved ${filename} (${(content.length / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
