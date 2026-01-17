#!/usr/bin/env tsx
/**
 * pst_extract_raw_rows.ts
 *
 * Raw row extraction from PST (ProSportsTransactions) HTML snapshots.
 * Produces raw row objects with zero interpretation for later parsing.
 *
 * PST Table Structure:
 * - Each team page has tables organized by year and round
 * - Tables have rows with: original team logo/name, description text, current owner
 * - Year headers appear in the table structure
 * - Round is indicated at the table level (1st Round, 2nd Round)
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_extract_raw_rows.ts
 *
 * Outputs:
 *   data/pst/pst_raw_rows.json         - All teams combined
 *   data/pst/raw_by_team/<slug>.json   - Per-team files
 */

import * as cheerio from 'cheerio';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PST_TEAMS,
  PST_SLUG_TO_CODE,
  normalizePstLabel,
  buildPstUrl,
} from './pst_team_slugs.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const DEFAULT_PAGES_DIR = path.join(PROJECT_ROOT, 'data', 'pst', 'pages');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'data', 'pst');
const DEFAULT_RAW_BY_TEAM_DIR = path.join(DEFAULT_OUTPUT_DIR, 'raw_by_team');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Raw row extracted from PST page
 * Zero interpretation - just the facts from the table
 */
export type PstRawRow = {
  year: number;
  round: 1 | 2;
  originalTeam: string; // Canonical team code (e.g., "DAL")
  displayOwner: string; // Canonical team code of current holder
  rawText: string; // Exact text from description cell, can be empty for own picks
  rowKind: 'own' | 'transaction' | 'condition_not_met';
  source: 'PST';
  sourceUrl: string;
  sourceTeamPage: string; // PST slug (e.g., "Mavericks")
  snapshotPath: string;
  rowRef: string; // Row identifier (e.g., "r1" or content hash)
};

/**
 * Per-team extraction result
 */
export type TeamRawRows = {
  teamCode: string;
  slug: string;
  extractedAt: string;
  rows: PstRawRow[];
  rowCount: number;
  yearsFound: number[];
};

/**
 * Combined output
 */
export type AllRawRows = {
  extractedAt: string;
  totalTeams: number;
  totalRows: number;
  rows: PstRawRow[];
};

// ============================================================================
// UTILITIES
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

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

function serialize(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

// ============================================================================
// EXTRACTION LOGIC
// ============================================================================

/**
 * Extracts raw rows from PST HTML content using strict strict DOM anchoring.
 *
 * Logic:
 * 1. Iterate through .container children in order.
 * 2. Anchor Year: <p class="headline">YYYY</p>
 * 3. Anchor Round: Inside the table, <tr class="RoundLabel">
 * 4. Data Rows: <tr class="datatable center">
 *    - Must have transaction content (p.bodyCopySm or .conditionnotmet)
 *    - Must NOT be a header (DraftTableLabel)
 *    - Must NOT be an empty "own pick" row
 */
function extractRawRowsFromHtml(
  html: string,
  slug: string,
  snapshotPath: string
): PstRawRow[] {
  const $ = cheerio.load(html);
  const rows: PstRawRow[] = [];
  const sourceUrl = buildPstUrl(slug);
  const teamCode = PST_SLUG_TO_CODE[slug];

  if (!teamCode) {
    console.warn(`  ⚠ Unknown slug: ${slug}`);
    return [];
  }

  let currentYear: number | null = null;
  let rowIndex = 0;

  // Select the main container that holds the headlines and tables
  // In PST templates, this is typically div.container
  const $container = $('.container').first();
  if ($container.length === 0) {
    console.warn(`  ⚠ No .container found for ${slug}`);
    return [];
  }

  // Iterate over direct children of the container to find headlines and tables
  $container.children().each((_, el) => {
    const $el = $(el);

    // 1. Check for Year Headline: <p class="headline">2026</p>
    if ($el.is('p.headline')) {
      const text = normalizeWhitespace($el.text());
      if (/^\d{4}$/.test(text)) {
        currentYear = parseInt(text, 10);
      }
      return; // Continue to next element
    }

    // 2. Process Tables: <table class="datatable">
    // Only process if we have a valid anchored year
    if ($el.is('table.datatable') && currentYear) {
      let currentRound: 1 | 2 = 1; // Default to 1, but we look for labels

      const $rows = $el.find('tr');
      $rows.each((_, tr) => {
        const $tr = $(tr);

        // a. Check for Round Anchor: <td class="RoundLabel">Round 2</td>
        // Note: The RoundLabel is on the td, not the tr, usually.
        // Structure: <tr><td class="RoundLabel">...</td></tr>
        const roundLabelText = $tr.find('.RoundLabel').text();
        if (
          /2nd\s*Round/i.test(roundLabelText) || 
          /Second\s*Round/i.test(roundLabelText) ||
          /Round\s*2/i.test(roundLabelText)
        ) {
          currentRound = 2;
          return; // Skip identifier row
        } else if (
          /1st\s*Round/i.test(roundLabelText) || 
          /First\s*Round/i.test(roundLabelText) ||
          /Round\s*1/i.test(roundLabelText)
        ) {
          currentRound = 1;
          return; // Skip identifier row
        }

        // b. Skip Header Rows
        if ($tr.hasClass('DraftTableLabel')) return;

        // c. Validate Data Row
        // Must be .datatable.center (or .datatable and .center)
        // And must have transaction details
        const isDataRow = $tr.hasClass('datatable') && $tr.hasClass('center'); // The class string is usually "datatable center"
        
        // Sometimes it might just be <tr> with center alignment, so we check content primarily
        // But the prompt says "Include tr.datatable.center rows"
        if (!isDataRow && !$tr.find('td').length) return; 

        // Content Classification:
        // Must have at least one p.bodyCopySm OR a .conditionnotmet cell
        const hasTransaction = $tr.find('p.bodyCopySm').length > 0;
        const hasConditionMsg = $tr.find('.conditionnotmet').length > 0;
        
        let rowKind: 'own' | 'transaction' | 'condition_not_met';
        if (hasConditionMsg) {
          rowKind = 'condition_not_met';
        } else if (hasTransaction) {
          rowKind = 'transaction';
        } else {
          rowKind = 'own';
        }

        // d. Extract Fields
        const $cells = $tr.find('td');
        if ($cells.length === 0) return;

        // Original Team: First cell's .textrightoflogo
        const firstCell = $cells.first();
        let originalTeam = normalizePstLabel(firstCell.find('.textrightoflogo').text());

        if (!originalTeam) {
            // Fallback: check img alt in first cell
            const imgAlt = firstCell.find('img').attr('alt');
            if (imgAlt) {
              originalTeam = normalizePstLabel(imgAlt.replace(/\s*logo\s*/i, '').trim());
            }
        }
        
        // Task B: Strengthen Pick Row Detection
        // If first cell doesn't identify a team, skip this row
        if (!originalTeam) return;

        // Display Owner: Scan remaining cells RIGHT-TO-LEFT
        // The last cell with a team label is the current owner
        let displayOwner: string | undefined;
        // Check cells starting from the end, skipping strictly transaction cells if mixed?
        // Actually, the prompt says "scan remaining <td> cells right-to-left, choose the first cell containing .textrightoflogo team label."
        // We skip the *first* cell (index 0) which is original team.
        for (let i = $cells.length - 1; i > 0; i--) {
            const $cell = $cells.eq(i);
            const teamLabel = normalizePstLabel($cell.find('.textrightoflogo').text());
            if (teamLabel) {
                displayOwner = teamLabel;
                break; 
            }
            // Fallback to img if text missing? (Prompt didn't specify, but safe)
            if (!displayOwner) {
                 const imgAlt = $cell.find('img').attr('alt');
                 if (imgAlt) {
                     const code = normalizePstLabel(imgAlt.replace(/\s*logo\s*/i, '').trim());
                     if (code) {
                         displayOwner = code;
                         break;
                     }
                 }
            }
        }

        // Fallbacks
        if (!originalTeam) originalTeam = teamCode; // Should rarely happen in valid rows due to check above
        if (!displayOwner) displayOwner = originalTeam; // Default if no transfer column found

        // Raw Text: Join p.bodyCopySm texts with " | "
        // Exclude "Team" label text (which is in .textrightoflogo usually)
        // p.bodyCopySm is usually inside the transaction cell
        const rawTextParts: string[] = [];
        $tr.find('p.bodyCopySm').each((_, p) => {
             const text = normalizeWhitespace($(p).text());
             if (text) rawTextParts.push(text);
        });
        
        // Task C: Set rawText based on rowKind
        let rawText = '';
        if (rowKind === 'own') {
            rawText = '';
        } else {
            rawText = rawTextParts.join(' | ');
        }

        // Exclude specific invalid texts
        if (rawText === 'Transactions') return;
        
        // For non-own rows, ensure we have content (unless it's just condition not met with no text?)
        // Actually condition_not_met usually has text. If transaction row has no text, is it valid?
        // Prompt says: "rawText may be empty string for rowKind=own"
        // It implies for others it should be populated.
        // But let's stick to: only skip if it's "Transactions" or junk.

        rowIndex++;

        rows.push({
          year: currentYear!,
          round: currentRound,
          originalTeam,
          displayOwner,
          rawText,
          rowKind,
          source: 'PST',
          sourceUrl,
          sourceTeamPage: slug,
          snapshotPath,
          rowRef: `r${rowIndex}`,
        });
      });
    }
  });

  return rows;
}

/**
 * Process a single team's HTML file
 */
async function processTeamFile(
  slug: string,
  pagesDir: string
): Promise<TeamRawRows | null> {
  const filePath = path.join(pagesDir, `${slug}.html`);
  const teamCode = PST_SLUG_TO_CODE[slug];

  if (!teamCode) {
    console.warn(`  ⚠ Unknown slug: ${slug}`);
    return null;
  }

  try {
    const html = await readFile(filePath, 'utf8');

    if (!html || html.length < 100) {
      console.warn(`  ⚠ ${slug}: File too small or empty`);
      return null;
    }

  // Try primary extraction
    const rows = extractRawRowsFromHtml(html, slug, filePath);

    // Deduplicate rows based on year + round + rawText
    const seen = new Set<string>();
    const uniqueRows = rows.filter((row) => {
      // Create a unique key for the row to prevent exact duplicates
      // We include rowRef to distinguish truly separate rows if needed, 
      // but here we want to dedupe identical content.
      const key = `${row.year}-${row.round}-${row.originalTeam}-${row.rawText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const yearsFound = [...new Set(uniqueRows.map((r) => r.year))].sort();

    console.log(`  ✓ ${teamCode}: ${uniqueRows.length} rows, years: ${yearsFound.join(', ') || 'none'}`);

    return {
      teamCode,
      slug,
      extractedAt: new Date().toISOString(),
      rows: uniqueRows,
      rowCount: uniqueRows.length,
      yearsFound,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`  ⚠ ${slug}: File not found`);
    } else {
      console.error(`  ✗ ${slug}: ${err}`);
    }
    return null;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const pagesDir = parseArg('pagesDir', DEFAULT_PAGES_DIR);
  const outputDir = parseArg('outputDir', DEFAULT_OUTPUT_DIR);
  const rawByTeamDir = parseArg('rawByTeamDir', DEFAULT_RAW_BY_TEAM_DIR);

  console.log('\n🔍 PST Raw Row Extractor');
  console.log('========================');
  console.log(`  Pages dir: ${pagesDir}`);
  console.log(`  Output dir: ${outputDir}`);
  console.log('');

  await ensureDir(outputDir!);
  await ensureDir(rawByTeamDir!);

  const allRows: PstRawRow[] = [];
  const teamResults: TeamRawRows[] = [];
  let processedCount = 0;
  let emptyCount = 0;

  for (const team of PST_TEAMS) {
    const result = await processTeamFile(team.slug, pagesDir!);

    if (result) {
      teamResults.push(result);
      allRows.push(...result.rows);
      processedCount++;

      if (result.rowCount === 0) {
        emptyCount++;
      }

      // Write per-team file
      await writeFile(
        path.join(rawByTeamDir!, `${team.slug}.json`),
        serialize(result),
        'utf8'
      );
    }
  }

  // Write combined output
  const allOutput: AllRawRows = {
    extractedAt: new Date().toISOString(),
    totalTeams: processedCount,
    totalRows: allRows.length,
    rows: allRows,
  };

  await writeFile(
    path.join(outputDir!, 'pst_raw_rows.json'),
    serialize(allOutput),
    'utf8'
  );

  // Summary
  console.log('\n📊 Extraction Summary');
  console.log('=====================');
  console.log(`  Teams processed: ${processedCount}/30`);
  console.log(`  Teams with 0 rows: ${emptyCount}`);
  console.log(`  Total rows extracted: ${allRows.length}`);

  // Year coverage
  const allYears = [...new Set(allRows.map((r) => r.year))].sort();
  console.log(`  Years found: ${allYears.join(', ') || 'none'}`);

  // Top teams by row count
  const sortedTeams = [...teamResults].sort((a, b) => b.rowCount - a.rowCount);
  console.log('\n  Top 5 teams by row count:');
  for (const t of sortedTeams.slice(0, 5)) {
    console.log(`    ${t.teamCode}: ${t.rowCount} rows`);
  }

  console.log('\n  Bottom 5 teams by row count:');
  for (const t of sortedTeams.slice(-5).reverse()) {
    console.log(`    ${t.teamCode}: ${t.rowCount} rows`);
  }

  console.log('\n✅ Extraction complete!');
  console.log(`   Combined: ${path.join(outputDir!, 'pst_raw_rows.json')}`);
  console.log(`   Per-team: ${rawByTeamDir}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
