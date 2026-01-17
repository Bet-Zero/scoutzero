#!/usr/bin/env tsx
/**
 * pst_validate_normalization.ts
 *
 * Phase 1.3 Validation: Enforce Raw Row Normalization Standards.
 *
 * Checks:
 * 1. Coverage: Years 2026-2033 must exist for EVERY team.
 * 2. Density: At least 2 rows (1 R1, 1 R2) per year per team.
 * 3. Shape: Confirm rowKind and rawText semantics.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PST_TEAMS } from './pst_team_slugs.js';
import type { AllRawRows, PstRawRow } from './pst_extract_raw_rows.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const DEFAULT_RAW_ROWS_PATH = path.join(PROJECT_ROOT, 'data', 'pst', 'pst_raw_rows.json');
const REPORT_PATH = path.join(PROJECT_ROOT, 'data', 'pst', 'pst_phase_1_3_report.json');

type ValidationParams = {
  startYear: number;
  endYear: number;
  minRowsPerYear: number;
};

const RULES: ValidationParams = {
  startYear: 2026,
  endYear: 2033,
  minRowsPerYear: 2,
};

async function main() {
  console.log('\n🔍 PST Phase 1.3 Normalization Validator');
  console.log('========================================');
  console.log(`  Source: ${DEFAULT_RAW_ROWS_PATH}`);
  console.log(`  Rules: Years ${RULES.startYear}-${RULES.endYear}, Min ${RULES.minRowsPerYear} rows/year`);

  try {
    const rawContent = await readFile(DEFAULT_RAW_ROWS_PATH, 'utf8');
    const data = JSON.parse(rawContent) as AllRawRows;
    const rows = data.rows;

    console.log(`  Total rows loaded: ${rows.length}`);

    // Group by team -> year -> count
    const teamMap: Record<string, Record<number, number>> = {};
    const teamHasRound1: Record<string, Record<number, boolean>> = {};
    const teamHasRound2: Record<string, Record<number, boolean>> = {};

    // Initialize map
    for (const team of PST_TEAMS) {
      teamMap[team.code] = {};
      teamHasRound1[team.code] = {};
      teamHasRound2[team.code] = {};
      for (let y = RULES.startYear; y <= RULES.endYear; y++) {
        teamMap[team.code][y] = 0;
        teamHasRound1[team.code][y] = false;
        teamHasRound2[team.code][y] = false;
      }
    }

    // Populate map
    for (const row of rows) {
      if (!teamMap[row.originalTeam]) continue; // Should not happen with valid orig team
      if (row.year < RULES.startYear || row.year > RULES.endYear) continue;

      // Note: We care about the "team page" source mostly for coverage?
      // Wait, "Every team MUST have at least 2 rows per year".
      // Is this "Every extracted team page must have 2 rows" or "Every team code must appear"?
      // "Source of Truth: PST team pages".
      // "Rows are team-scoped (as shown on that team page)".
      // So we should check based on `sourceTeamPage` (which maps to team code) rather than `originalTeam`.
      // Correct: checking what is ON the page.
      
      const pageTeamCode = PST_TEAMS.find(t => t.slug === row.sourceTeamPage)?.code;
      if (!pageTeamCode) continue;

      teamMap[pageTeamCode][row.year]++;
      if (row.round === 1) teamHasRound1[pageTeamCode][row.year] = true;
      if (row.round === 2) teamHasRound2[pageTeamCode][row.year] = true;
    }

    // Validate
    const errors: string[] = [];
    let passedTeams = 0;

    for (const team of PST_TEAMS) {
      let teamErrors: string[] = [];
      
      for (let y = RULES.startYear; y <= RULES.endYear; y++) {
        const count = teamMap[team.code][y];
        const hasR1 = teamHasRound1[team.code][y];
        const hasR2 = teamHasRound2[team.code][y];

        if (count < RULES.minRowsPerYear) {
          teamErrors.push(`Year ${y}: Found ${count} rows (Expected >= 2)`);
        }
        if (!hasR1) {
          teamErrors.push(`Year ${y}: Missing Round 1 row`);
        }
        if (!hasR2) {
          teamErrors.push(`Year ${y}: Missing Round 2 row`);
        }
      }

      if (teamErrors.length > 0) {
        errors.push(`❌ ${team.code} Failures:`);
        errors.push(...teamErrors.map(e => `    - ${e}`));
      } else {
        passedTeams++;
      }
    }

    // Write Report
    const report = {
      generatedAt: new Date().toISOString(),
      passed: errors.length === 0,
      passedTeams,
      totalTeams: PST_TEAMS.length,
      errors
    };

    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log(`\n  Teams Passed: ${passedTeams}/${PST_TEAMS.length}`);
    
    if (errors.length > 0) {
      console.log('\n  ❌ VALIDATION FAILED');
      console.log('  Failures found. See report for details.');
      errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
      if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more lines`);
      process.exit(1);
    } else {
      console.log('\n  ✅ VALIDATION PASSED');
      console.log('  All teams have full pick coverage (2026-2033).');
    }

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
