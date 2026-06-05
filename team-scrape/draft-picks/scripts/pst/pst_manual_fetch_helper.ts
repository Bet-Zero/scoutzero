#!/usr/bin/env tsx
/**
 * pst_manual_fetch_helper.ts
 * 
 * Helper script for manual PST page fetching when Cloudflare blocks automation.
 * 
 * STOP CONDITION: PST uses aggressive Cloudflare protection that blocks Playwright.
 * 
 * Manual Fetch Instructions:
 * 1. Open each URL in a regular browser
 * 2. Save the page as HTML (Cmd+S / Ctrl+S)
 * 3. Save to data/pst/pages/<slug>.html
 * 4. Run this script to generate the manifest from saved files
 * 
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_manual_fetch_helper.ts --generate-manifest
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_manual_fetch_helper.ts --check
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_manual_fetch_helper.ts --urls
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PST_TEAMS, buildPstUrl, PstTeamConfig } from './pst_team_slugs.js';
import type { FetchManifest, ManifestEntry } from './pst_fetch_pages.js';

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

const MIN_FILE_SIZE = 5000; // Minimum bytes for valid HTML

// ============================================================================
// UTILITIES
// ============================================================================

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(`--${flag}`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return 0;
  }
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function serialize(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

// ============================================================================
// COMMANDS
// ============================================================================

async function printUrls(): Promise<void> {
  console.log('\n📋 PST Team Page URLs');
  console.log('=====================');
  console.log('\nSave each page to data/pst/pages/<slug>.html\n');
  
  for (const team of PST_TEAMS) {
    const url = buildPstUrl(team.slug);
    console.log(`${team.code.padEnd(4)} ${team.slug.padEnd(14)} ${url}`);
    console.log(`     Save as: data/pst/pages/${team.slug}.html`);
  }
  
  console.log(`\nTotal: ${PST_TEAMS.length} pages to fetch`);
}

async function checkPages(): Promise<void> {
  console.log('\n🔍 Checking saved PST pages...');
  console.log('==============================\n');
  
  let found = 0;
  let missing = 0;
  let tooSmall = 0;
  
  for (const team of PST_TEAMS) {
    const filePath = path.join(DEFAULT_PAGES_DIR, `${team.slug}.html`);
    const exists = await fileExists(filePath);
    const size = exists ? await getFileSize(filePath) : 0;
    
    if (!exists) {
      console.log(`❌ ${team.code.padEnd(4)} ${team.slug.padEnd(14)} - NOT FOUND`);
      missing++;
    } else if (size < MIN_FILE_SIZE) {
      console.log(`⚠️  ${team.code.padEnd(4)} ${team.slug.padEnd(14)} - TOO SMALL (${size} bytes)`);
      tooSmall++;
    } else {
      console.log(`✓  ${team.code.padEnd(4)} ${team.slug.padEnd(14)} - ${size.toLocaleString()} bytes`);
      found++;
    }
  }
  
  console.log('\n📊 Summary');
  console.log(`   Found: ${found}/30`);
  console.log(`   Missing: ${missing}`);
  console.log(`   Too small: ${tooSmall}`);
  
  if (found === 30) {
    console.log('\n✅ All pages present! Run --generate-manifest to create manifest.');
  } else {
    console.log('\n⚠️  Some pages missing. Download manually and re-run check.');
  }
}

async function generateManifest(): Promise<void> {
  console.log('\n📝 Generating manifest from saved pages...');
  
  const entries: ManifestEntry[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const team of PST_TEAMS) {
    const filePath = path.join(DEFAULT_PAGES_DIR, `${team.slug}.html`);
    const url = buildPstUrl(team.slug);
    
    const exists = await fileExists(filePath);
    const size = exists ? await getFileSize(filePath) : 0;
    
    if (exists && size >= MIN_FILE_SIZE) {
      const content = await readFile(filePath, 'utf8');
      const contentHash = sha256(content);
      
      // Validate content looks like PST page (has round/draft content)
      const lowerContent = content.toLowerCase();
      const hasPickContent = 
        lowerContent.includes('round') || 
        lowerContent.includes('draft') ||
        lowerContent.includes('pick');
      
      if (hasPickContent) {
        entries.push({
          slug: team.slug,
          teamCode: team.code,
          url,
          status: 'success',
          httpStatus: 200,
          capturedAt: new Date().toISOString(),
          snapshotPath: filePath,
          contentHash,
          contentLength: size,
        });
        successCount++;
        console.log(`  ✓ ${team.code}: ${size.toLocaleString()} bytes`);
      } else {
        entries.push({
          slug: team.slug,
          teamCode: team.code,
          url,
          status: 'failure',
          capturedAt: new Date().toISOString(),
          snapshotPath: filePath,
          contentHash,
          contentLength: size,
          error: 'Content does not appear to be valid PST page (may be Cloudflare block)',
        });
        failureCount++;
        console.log(`  ⚠ ${team.code}: Invalid content (Cloudflare?)`);
      }
    } else {
      entries.push({
        slug: team.slug,
        teamCode: team.code,
        url,
        status: 'failure',
        capturedAt: new Date().toISOString(),
        snapshotPath: filePath,
        contentHash: '',
        contentLength: 0,
        error: exists ? `File too small (${size} bytes)` : 'File not found',
      });
      failureCount++;
      console.log(`  ✗ ${team.code}: ${exists ? 'Too small' : 'Missing'}`);
    }
  }
  
  const manifest: FetchManifest = {
    generatedAt: new Date().toISOString(),
    totalTeams: PST_TEAMS.length,
    successCount,
    failureCount,
    entries,
  };
  
  await mkdir(path.dirname(DEFAULT_MANIFEST_PATH), { recursive: true });
  await writeFile(DEFAULT_MANIFEST_PATH, serialize(manifest), 'utf8');
  
  console.log('\n📊 Manifest Summary');
  console.log(`   Success: ${successCount}/30`);
  console.log(`   Failure: ${failureCount}`);
  console.log(`\n   Written to: ${DEFAULT_MANIFEST_PATH}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  if (hasFlag('urls')) {
    await printUrls();
  } else if (hasFlag('check')) {
    await checkPages();
  } else if (hasFlag('generate-manifest')) {
    await generateManifest();
  } else {
    console.log(`
PST Manual Fetch Helper

STOP CONDITION: PST uses Cloudflare protection that blocks Playwright.
You must fetch pages manually using a regular browser.

Commands:
  --urls              Print all URLs to fetch manually
  --check             Check which pages have been saved
  --generate-manifest Generate manifest from saved HTML files

Manual Fetch Instructions:
  1. Run: npx tsx team-scrape/draft-picks/scripts/pst/pst_manual_fetch_helper.ts --urls
  2. Open each URL in your browser (Chrome/Firefox/Safari)
  3. Wait for page to fully load (Cloudflare will auto-pass for real browsers)
  4. Save page as HTML: File > Save As > "Webpage, HTML Only" 
  5. Save to: data/pst/pages/<Slug>.html (e.g., Mavericks.html)
  6. Check progress: npx tsx ... --check
  7. Generate manifest: npx tsx ... --generate-manifest
`);
  }
}

// Run if executed directly
if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
