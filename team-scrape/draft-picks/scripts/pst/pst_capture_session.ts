#!/usr/bin/env tsx
/**
 * pst_capture_session.ts
 *
 * Interactive session capture script for PST Cloudflare bypass.
 * Opens a persistent browser context where the user can manually complete
 * the Cloudflare challenge, then saves the session for reuse.
 *
 * Usage:
 *   npm run pst:session:capture
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_capture_session.ts
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_capture_session.ts --channel=chrome
 *
 * After running:
 *   - Session profile saved to: data/pst/session/profile/
 *   - Storage state exported to: data/pst/session/storageState.json
 *   - Metadata saved to: data/pst/session/session_meta.json
 */

import { chromium, type BrowserContext } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  PROFILE_DIR,
  STORAGE_STATE_PATH,
  SESSION_DIR,
  getDefaultUserAgent,
  saveSessionMeta,
  waitForEnter,
  delay,
  hasPstContent,
  detectCloudflareChallenge,
} from './pst_session_helpers.js';

import { buildPstUrl } from './pst_team_slugs.js';

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

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const channel = parseArg('channel'); // e.g., 'chrome', 'msedge'
  const testUrl = buildPstUrl('Mavericks'); // Use Mavericks as test page

  console.log('\n🔐 PST Session Capture');
  console.log('======================');
  console.log('');
  console.log('This script will open a browser window where you can manually');
  console.log('complete the Cloudflare challenge. Once done, the session will');
  console.log('be saved for automated fetching.');
  console.log('');

  // Ensure session directory exists
  await mkdir(SESSION_DIR, { recursive: true });
  await mkdir(PROFILE_DIR, { recursive: true });

  console.log(`📁 Session directory: ${SESSION_DIR}`);
  console.log(`🌐 Test URL: ${testUrl}`);
  if (channel) {
    console.log(`🔧 Browser channel: ${channel}`);
  }
  console.log('');

  // Launch persistent context
  console.log('🚀 Launching browser with persistent context...');

  const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = {
    headless: false,
    userAgent: getDefaultUserAgent(),
    viewport: { width: 1280, height: 800 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  };

  if (channel) {
    launchOptions.channel = channel;
  }

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, launchOptions);
  } catch (err) {
    console.error('❌ Failed to launch browser:', err instanceof Error ? err.message : err);
    console.error('');
    console.error('Suggestions:');
    console.error('  - Make sure Playwright is installed: npx playwright install');
    console.error('  - Try a different channel: --channel=chrome');
    process.exit(1);
  }

  const page = await context.newPage();

  try {
    // Navigate to PST page
    console.log('');
    console.log('📖 Navigating to PST page...');
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Initial content check
    await delay(2000);
    let html = await page.content();
    const initialCheck = detectCloudflareChallenge(html);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (initialCheck.isChallenge) {
      console.log('⚠️  CLOUDFLARE CHALLENGE DETECTED');
      console.log(`   Markers: ${initialCheck.markers.join(', ')}`);
      console.log('');
      console.log('   👉 Please complete the Cloudflare challenge in the browser window.');
      console.log('   👉 You should see "Verify you are human" or similar.');
      console.log('   👉 Once you can see the PST table with draft picks, return here.');
    } else if (hasPstContent(html)) {
      console.log('✅ NO CLOUDFLARE CHALLENGE - Page loaded successfully!');
      console.log('   The page appears to have valid PST content.');
      console.log('   You can proceed to save the session.');
    } else {
      console.log('⚠️  UNKNOWN PAGE STATE');
      console.log('   The page may still be loading or has unexpected content.');
      console.log('   Please wait for the PST table to appear.');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Wait for user confirmation
    await waitForEnter('Press ENTER when you can see the PST draft table... ');

    // Verify access after user interaction
    console.log('');
    console.log('🔍 Verifying page content...');
    html = await page.content();

    const finalCheck = detectCloudflareChallenge(html);
    if (finalCheck.isChallenge) {
      console.error('');
      console.error('❌ Cloudflare challenge still detected!');
      console.error(`   Markers: ${finalCheck.markers.join(', ')}`);
      console.error('');
      console.error('   The challenge was not successfully completed.');
      console.error('   Please try again and make sure to solve the captcha.');
      await context.close();
      process.exit(1);
    }

    if (!hasPstContent(html)) {
      console.warn('');
      console.warn('⚠️  Warning: Page content may not be valid PST data.');
      console.warn('   Proceeding with session save anyway...');
    } else {
      console.log('   ✓ Page appears to have valid PST content');
    }

    // Export storage state
    console.log('');
    console.log('💾 Saving session state...');
    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`   ✓ Storage state saved to: ${STORAGE_STATE_PATH}`);

    // Save session metadata
    const userAgent = getDefaultUserAgent();
    await saveSessionMeta({
      capturedAt: new Date().toISOString(),
      testedUrl: testUrl,
      userAgent,
      browserChannel: channel,
      profileDir: PROFILE_DIR,
      storageStatePath: STORAGE_STATE_PATH,
      notes: 'Session captured via pst_capture_session.ts',
    });
    console.log(`   ✓ Session metadata saved to: ${path.join(SESSION_DIR, 'session_meta.json')}`);

    // Final summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ SESSION CAPTURED SUCCESSFULLY!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test session: npm run pst:session:test');
    console.log('  2. Fetch pages:  npm run pst:fetch:session');
    console.log('  3. Full pipeline: npm run pst:phase-1-2');
    console.log('');
    console.log('Session files:');
    console.log(`  - Profile: ${PROFILE_DIR}`);
    console.log(`  - Storage: ${STORAGE_STATE_PATH}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

  } finally {
    await context.close();
    console.log('');
    console.log('Browser closed.');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
