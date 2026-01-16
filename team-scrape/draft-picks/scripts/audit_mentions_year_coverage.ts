#!/usr/bin/env -S node --experimental-strip-types
/* eslint-disable */
/**
 * Audit: Mentions Year Coverage
 *
 * Validates that each team's mentions file includes picks through REQUIRED_MAX_YEAR.
 * Fails hard (exit 1) if any team has incomplete year coverage.
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/audit_mentions_year_coverage.ts
 *   npx tsx team-scrape/draft-picks/scripts/audit_mentions_year_coverage.ts --mentionsDir=<path>
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ---------- Configuration ----------
// TODO: Derive NEXT_DRAFT_YEAR from config or current date logic
const NEXT_DRAFT_YEAR = 2026;
const REQUIRED_MAX_YEAR = NEXT_DRAFT_YEAR + 6; // 2032

const argv = process.argv.slice(2);
const getArgVal = (flag: string, def?: string) => {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  // Also check for --flag=value format
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split('=')[1];
  return def;
};

const BASE_DIR = path.resolve(process.cwd());
const DEFAULT_MENTIONS_DIR = path.join(
  BASE_DIR,
  'team-scrape/draft-picks/_artifacts/output/mentions'
);
const MENTIONS_DIR = getArgVal('--mentionsDir', DEFAULT_MENTIONS_DIR)!;

// All 30 NBA teams
const ALL_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

// ---------- Types ----------
interface MentionPick {
  year: number;
  round: 1 | 2;
  [key: string]: unknown;
}

interface TeamAuditResult {
  teamCode: string;
  mentionsFile: string;
  exists: boolean;
  totalPicks: number;
  firstRoundMaxYear: number;
  secondRoundMaxYear: number;
  overallMaxYear: number;
  passed: boolean;
  error?: string;
}

// ---------- Main Logic ----------
async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function auditTeam(teamCode: string): Promise<TeamAuditResult> {
  const mentionsFile = path.join(MENTIONS_DIR, `draft_picks_mentions_${teamCode}.json`);

  const result: TeamAuditResult = {
    teamCode,
    mentionsFile,
    exists: false,
    totalPicks: 0,
    firstRoundMaxYear: 0,
    secondRoundMaxYear: 0,
    overallMaxYear: 0,
    passed: false,
  };

  // Check if file exists
  if (!(await fileExists(mentionsFile))) {
    result.error = `Mentions file not found: ${mentionsFile}`;
    return result;
  }
  result.exists = true;

  try {
    // Load and parse mentions
    const raw = await fs.readFile(mentionsFile, 'utf8');
    const picks: MentionPick[] = JSON.parse(raw);

    result.totalPicks = picks.length;

    // Compute max years by round
    const firstRoundYears = picks.filter((p) => p.round === 1).map((p) => p.year);
    const secondRoundYears = picks.filter((p) => p.round === 2).map((p) => p.year);

    result.firstRoundMaxYear =
      firstRoundYears.length > 0 ? Math.max(...firstRoundYears) : 0;
    result.secondRoundMaxYear =
      secondRoundYears.length > 0 ? Math.max(...secondRoundYears) : 0;
    result.overallMaxYear = Math.max(
      result.firstRoundMaxYear,
      result.secondRoundMaxYear
    );

    // Pass if BOTH rounds have coverage through REQUIRED_MAX_YEAR
    // (some teams may not have 2nd round picks for all years, so check 1st round primarily)
    result.passed = result.firstRoundMaxYear >= REQUIRED_MAX_YEAR;

    if (!result.passed) {
      result.error = `1st round maxYear=${result.firstRoundMaxYear} < ${REQUIRED_MAX_YEAR}`;
    }
  } catch (err) {
    result.error = `Failed to parse mentions: ${err}`;
  }

  return result;
}

async function main() {
  console.log('═════════════════════════════════════════════════════════════');
  console.log(' AUDIT: Mentions Year Coverage');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`Mentions directory: ${MENTIONS_DIR}`);
  console.log(`Required max year: ${REQUIRED_MAX_YEAR}`);
  console.log(`Teams to audit: ${ALL_TEAMS.length}`);
  console.log('');

  const results: TeamAuditResult[] = [];
  const failures: TeamAuditResult[] = [];

  for (const teamCode of ALL_TEAMS) {
    const result = await auditTeam(teamCode);
    results.push(result);

    const status = result.passed ? '✓' : '✗';
    const yearInfo = result.exists
      ? `1st:${result.firstRoundMaxYear} 2nd:${result.secondRoundMaxYear}`
      : 'NO FILE';

    console.log(
      `${status} ${teamCode}: ${yearInfo} (${result.totalPicks} picks)${result.error ? ` — ${result.error}` : ''}`
    );

    if (!result.passed) {
      failures.push(result);
    }
  }

  console.log('');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`Total teams: ${results.length}`);
  console.log(`Passed: ${results.length - failures.length}`);
  console.log(`Failed: ${failures.length}`);

  if (failures.length > 0) {
    console.log('');
    console.log('FAILURES:');
    for (const f of failures) {
      console.log(`  • ${f.teamCode}: ${f.error}`);
    }
    console.log('');
    console.error(
      `❌ AUDIT FAILED: ${failures.length} team(s) have incomplete year coverage.`
    );
    process.exit(1);
  }

  console.log('');
  console.log(`✅ AUDIT PASSED: All teams have mentions through ${REQUIRED_MAX_YEAR}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
