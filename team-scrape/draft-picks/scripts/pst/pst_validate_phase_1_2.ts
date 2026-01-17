#!/usr/bin/env tsx
/**
 * pst_validate_phase_1_2.ts
 *
 * Validation and reporting for PST Phase 1-2 (Fetch + Raw Row Extraction).
 * Confirms all outputs are valid and generates a summary report.
 *
 * Checks:
 * - All 30 HTML snapshots exist and are non-empty
 * - pst_raw_rows.json exists and has > 0 rows
 * - Each row has required fields
 * - Generates summary report with counts and coverage
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_validate_phase_1_2.ts
 *
 * Outputs:
 *   data/pst/pst_phase_1_2_report.json
 */

import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PST_TEAMS, PST_SLUG_TO_CODE } from './pst_team_slugs.js';
import type { PstRawRow, AllRawRows, TeamRawRows } from './pst_extract_raw_rows.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const DEFAULT_PAGES_DIR = path.join(PROJECT_ROOT, 'data', 'pst', 'pages');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'data', 'pst');
const DEFAULT_RAW_BY_TEAM_DIR = path.join(DEFAULT_OUTPUT_DIR, 'raw_by_team');
const DEFAULT_MANIFEST_PATH = path.join(DEFAULT_OUTPUT_DIR, 'pst_fetch_manifest.json');
const DEFAULT_RAW_ROWS_PATH = path.join(DEFAULT_OUTPUT_DIR, 'pst_raw_rows.json');
const DEFAULT_REPORT_PATH = path.join(DEFAULT_OUTPUT_DIR, 'pst_phase_1_2_report.json');

// Minimum snapshot size to be considered valid
const MIN_SNAPSHOT_SIZE = 1000;

// ============================================================================
// TYPES
// ============================================================================

type SnapshotValidation = {
  slug: string;
  teamCode: string;
  exists: boolean;
  size: number;
  valid: boolean;
  error?: string;
};

type RowValidation = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingFields: Record<string, number>;
  invalidRowDetails: Array<{ rowRef: string; errors: string[] }>;
};

type TeamRowSummary = {
  teamCode: string;
  rowCount: number;
  yearsFound: number[];
};

type ValidationReport = {
  generatedAt: string;
  phase: 'Phase 1-2';

  // Snapshot validation
  snapshots: {
    expected: number;
    found: number;
    valid: number;
    missing: string[];
    empty: string[];
    errors: SnapshotValidation[];
  };

  // Row validation
  rows: RowValidation;

  // Summary stats
  summary: {
    totalTeams: number;
    totalRows: number;
    rowsPerTeam: TeamRowSummary[];
    yearsCoverage: number[];
    minRowsPerTeam: number;
    maxRowsPerTeam: number;
    avgRowsPerTeam: number;
  };

  // Overall status
  passed: boolean;
  missingTeams: number;
  invalidRows: number;
  warnings: string[];
  errors: string[];
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

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

/**
 * Validates HTML snapshots
 */
async function validateSnapshots(pagesDir: string): Promise<SnapshotValidation[]> {
  const results: SnapshotValidation[] = [];

  for (const team of PST_TEAMS) {
    const filePath = path.join(pagesDir, `${team.slug}.html`);

    try {
      const exists = await fileExists(filePath);
      const size = exists ? await getFileSize(filePath) : 0;
      const valid = exists && size >= MIN_SNAPSHOT_SIZE;

      let error: string | undefined;
      if (!exists) {
        error = 'File not found';
      } else if (size < MIN_SNAPSHOT_SIZE) {
        error = `File too small (${size} bytes)`;
      }

      results.push({
        slug: team.slug,
        teamCode: team.code,
        exists,
        size,
        valid,
        error,
      });
    } catch (err) {
      results.push({
        slug: team.slug,
        teamCode: team.code,
        exists: false,
        size: 0,
        valid: false,
        error: String(err),
      });
    }
  }

  return results;
}

/**
 * Validates a single raw row
 */
function validateRow(row: PstRawRow): string[] {
  const errors: string[] = [];

  // Required fields
  if (typeof row.year !== 'number' || row.year < 2020 || row.year > 2040) {
    errors.push(`Invalid year: ${row.year}`);
  }

  if (row.round !== 1 && row.round !== 2) {
    errors.push(`Invalid round: ${row.round}`);
  }

  if (!row.originalTeam || row.originalTeam.length !== 3) {
    errors.push(`Invalid originalTeam: ${row.originalTeam}`);
  }

  if (!row.displayOwner || row.displayOwner.length !== 3) {
    errors.push(`Invalid displayOwner: ${row.displayOwner}`);
  }

  if (row.rowKind === 'transaction' || row.rowKind === 'condition_not_met') {
    if (!row.rawText || row.rawText.length < 5) {
      errors.push(`Invalid or empty rawText for ${row.rowKind} row`);
    }
  }

  if (row.rowKind === 'own') {
    if (row.rawText !== '') {
         errors.push('rawText should be empty for own picks');
    }
  }

  if (!['own', 'transaction', 'condition_not_met'].includes(row.rowKind)) {
      errors.push(`Invalid rowKind: ${row.rowKind}`);
  }

  if (row.source !== 'PST') {
    errors.push(`Invalid source: ${row.source}`);
  }

  if (!row.sourceUrl) {
    errors.push('Missing sourceUrl');
  }

  if (!row.sourceTeamPage) {
    errors.push('Missing sourceTeamPage');
  }

  if (!row.rowRef) {
    errors.push('Missing rowRef');
  }

  return errors;
}

/**
 * Validates all raw rows
 */
function validateRawRows(rows: PstRawRow[]): RowValidation {
  const missingFields: Record<string, number> = {};
  const invalidRowDetails: Array<{ rowRef: string; errors: string[] }> = [];
  let validRows = 0;
  let invalidRows = 0;

  for (const row of rows) {
    const errors = validateRow(row);

    if (errors.length === 0) {
      validRows++;
    } else {
      invalidRows++;

      for (const error of errors) {
        const field = error.split(':')[0];
        missingFields[field] = (missingFields[field] || 0) + 1;
      }

      // Only keep first 20 invalid row details
      if (invalidRowDetails.length < 20) {
        invalidRowDetails.push({
          rowRef: row.rowRef || 'unknown',
          errors,
        });
      }
    }
  }

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    missingFields,
    invalidRowDetails,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const pagesDir = parseArg('pagesDir', DEFAULT_PAGES_DIR);
  const outputDir = parseArg('outputDir', DEFAULT_OUTPUT_DIR);
  const rawRowsPath = parseArg('rawRowsPath', DEFAULT_RAW_ROWS_PATH);
  const reportPath = parseArg('reportPath', DEFAULT_REPORT_PATH);
  const rawByTeamDir = parseArg('rawByTeamDir', DEFAULT_RAW_BY_TEAM_DIR);

  console.log('\n✅ PST Phase 1-2 Validator');
  console.log('==========================');
  console.log(`  Pages dir: ${pagesDir}`);
  console.log(`  Raw rows: ${rawRowsPath}`);
  console.log('');

  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Validate snapshots
  console.log('Validating HTML snapshots...');
  const snapshotResults = await validateSnapshots(pagesDir!);

  const validSnapshots = snapshotResults.filter((s) => s.valid);
  const missingSnapshots = snapshotResults.filter((s) => !s.exists);
  const emptySnapshots = snapshotResults.filter((s) => s.exists && !s.valid);

  console.log(`  Found: ${validSnapshots.length}/30 valid snapshots`);

  if (missingSnapshots.length > 0) {
    const msg = `Missing snapshots: ${missingSnapshots.map((s) => s.teamCode).join(', ')}`;
    errors.push(msg);
    console.log(`  ❌ ${msg}`);
  }

  if (emptySnapshots.length > 0) {
    const msg = `Empty/invalid snapshots: ${emptySnapshots.map((s) => s.teamCode).join(', ')}`;
    warnings.push(msg);
    console.log(`  ⚠ ${msg}`);
  }

  // 2. Validate raw rows file
  console.log('\nValidating raw rows...');

  let rawRowsData: AllRawRows | null = null;
  let rowValidation: RowValidation = {
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    missingFields: {},
    invalidRowDetails: [],
  };

  try {
    const rawRowsContent = await readFile(rawRowsPath!, 'utf8');
    rawRowsData = JSON.parse(rawRowsContent) as AllRawRows;

    if (rawRowsData.rows && rawRowsData.rows.length > 0) {
      rowValidation = validateRawRows(rawRowsData.rows);
      console.log(`  Total rows: ${rowValidation.totalRows}`);
      console.log(`  Valid rows: ${rowValidation.validRows}`);
      console.log(`  Invalid rows: ${rowValidation.invalidRows}`);
    } else {
      errors.push('pst_raw_rows.json has 0 rows');
      console.log('  ❌ No rows found in pst_raw_rows.json');
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      errors.push('pst_raw_rows.json not found');
      console.log('  ❌ pst_raw_rows.json not found');
    } else {
      errors.push(`Error reading pst_raw_rows.json: ${err}`);
      console.log(`  ❌ Error: ${err}`);
    }
  }

  // 3. Build per-team summary
  console.log('\nBuilding per-team summary...');

  const teamRowSummaries: TeamRowSummary[] = [];
  const allYears = new Set<number>();

  for (const team of PST_TEAMS) {
    const teamFilePath = path.join(rawByTeamDir!, `${team.slug}.json`);

    try {
      const content = await readFile(teamFilePath, 'utf8');
      const teamData = JSON.parse(content) as TeamRawRows;

      teamRowSummaries.push({
        teamCode: team.code,
        rowCount: teamData.rowCount || 0,
        yearsFound: teamData.yearsFound || [],
      });

      for (const year of teamData.yearsFound || []) {
        allYears.add(year);
      }
    } catch {
      teamRowSummaries.push({
        teamCode: team.code,
        rowCount: 0,
        yearsFound: [],
      });
    }
  }

  const rowCounts = teamRowSummaries.map((t) => t.rowCount);
  const totalRows = rowCounts.reduce((a, b) => a + b, 0);
  const minRows = Math.min(...rowCounts);
  const maxRows = Math.max(...rowCounts);
  const avgRows = totalRows / teamRowSummaries.length;

  console.log(`  Teams with data: ${teamRowSummaries.filter((t) => t.rowCount > 0).length}/30`);
  console.log(`  Total rows: ${totalRows}`);
  console.log(`  Row range: ${minRows} - ${maxRows}`);
  console.log(`  Years coverage: ${[...allYears].sort().join(', ') || 'none'}`);

  // 4. Build report
  const report: ValidationReport = {
    generatedAt: new Date().toISOString(),
    phase: 'Phase 1-2',

    snapshots: {
      expected: 30,
      found: snapshotResults.filter((s) => s.exists).length,
      valid: validSnapshots.length,
      missing: missingSnapshots.map((s) => s.teamCode),
      empty: emptySnapshots.map((s) => s.teamCode),
      errors: snapshotResults.filter((s) => !s.valid),
    },

    rows: rowValidation,

    summary: {
      totalTeams: teamRowSummaries.length,
      totalRows,
      rowsPerTeam: teamRowSummaries.sort((a, b) => b.rowCount - a.rowCount),
      yearsCoverage: [...allYears].sort(),
      minRowsPerTeam: minRows,
      maxRowsPerTeam: maxRows,
      avgRowsPerTeam: parseFloat(avgRows.toFixed(1)),
    },

    passed: errors.length === 0,
    missingTeams: missingSnapshots.length,
    invalidRows: rowValidation.invalidRows,
    warnings,
    errors,
  };

  // 5. Write report
  await ensureDir(outputDir!);
  await writeFile(reportPath!, serialize(report), 'utf8');

  // 6. Final summary
  console.log('\n📊 Validation Summary');
  console.log('=====================');
  console.log(`  Snapshots: ${validSnapshots.length}/30 valid`);
  console.log(`  Rows: ${rowValidation.validRows}/${rowValidation.totalRows} valid`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`\n  Report: ${reportPath}`);

  if (report.passed) {
    console.log('\n✅ PHASE 1-2 VALIDATION PASSED!');
  } else {
    console.log('\n❌ PHASE 1-2 VALIDATION FAILED!');
    console.log('\nErrors:');
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
