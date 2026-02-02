/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_audit_all_teams_entitlements_sanity.ts
 * PURPOSE: Whole-dataset guardrail that runs entitlement sanity audit across ALL 30 NBA teams.
 *          Produces consolidated JSON + TXT reports and exits with code 1 if ANY team has ERROR rows.
 * OWNERSHIP: PST Audit (Phase 12.3F)
 * HISTORY:
 *   - 2026-02-01: Created (Phase 12.3F)
 * LINKS: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
 */

import fs from 'fs';
import path from 'path';
import {
  classifyEntitlement,
  SanityResult,
  SanityClassification,
  EntitlementInput,
  LedgerPickInput,
  PickRuleProfileInput,
} from './_utils/entitlementSanityClassifier';

// =====================================================
// CONSTANTS
// =====================================================

const TEAM_CODES = [
  'ATL',
  'BKN',
  'BOS',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
];

// =====================================================
// INTERFACES
// =====================================================

interface LedgerPick {
  pickId: string;
  year: number;
  round: number;
  originalTeam: string;
  owner: string;
  ownershipSource: string;
  evidenceRowRefs: string[];
  encumbrances?: {
    protections?: any[];
    swaps?: any[];
    conveyance?: any[];
    didNotConvey?: any[];
    selectionSpecs?: any[];
  };
}

interface Entitlement {
  id: string;
  holderTeam: string;
  seasonYear: number;
  round: number;
  kind: 'pick_ownership' | 'conveyance_right' | 'swap_right';
  underlyingPickId?: string;
  poolUnderlyingPickIds?: string[];
  swapControllerPickId?: string;
  description: string;
  evidenceRowRefs: string[];
  underlyingStatus?: string;
  receivesRank?: number[];
  receivesComparator?: string;
}

interface PickRuleProfile {
  pickId: string;
  year: number;
  round: number;
  originalTeam: string;
  displayOwner: string;
  protections: any[];
  swaps: any[];
  conveyance: any[];
  didNotConvey: any[];
  selectionSpecs: any[];
  mentions?: {
    referencedPickIds?: string[];
  };
  needs_review?: boolean;
}

interface TeamAuditSummary {
  team: string;
  total: number;
  ok: number;
  warn: number;
  error: number;
  byClassification: Record<string, number>;
  errorEntitlementIds: string[];
}

interface AllTeamsAuditResult {
  meta: {
    auditDate: string;
    teamCount: number;
    inputFiles: {
      ledger: string;
      entitlements: string;
      pickRules: string | null;
    };
  };
  grandTotals: {
    total: number;
    ok: number;
    warn: number;
    error: number;
  };
  byClassification: Record<string, number>;
  teamSummaries: TeamAuditSummary[];
  teamsWithErrors: string[];
  passedGuardrail: boolean;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function loadJsonFile<T>(filePath: string, required: boolean): T | null {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    if (required) {
      throw new Error(`REQUIRED file missing: ${filePath}`);
    }
    console.warn(`Optional file missing: ${filePath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

// =====================================================
// MAIN AUDIT FUNCTION
// =====================================================

function main() {
  console.log('='.repeat(70));
  console.log('ALL TEAMS ENTITLEMENTS SANITY AUDIT');
  console.log('Phase 12.3F - Whole-Dataset Guardrail');
  console.log('='.repeat(70));
  console.log('');

  // -----------------------------------------------
  // STEP A: Load Shared Data
  // -----------------------------------------------
  console.log('Loading input files...');

  const LEDGER_PATH = 'data/pst/pst_pick_ledger_final_2026_2033.json';
  const ENTITLEMENTS_PATH = 'data/pst/pst_entitlement_assets_2026_2033.json';
  const PICK_RULES_PATH =
    'data/pst/pst_pick_rule_profiles_final_2026_2033.json';

  const ledgerData = loadJsonFile<{ picks: LedgerPick[] }>(LEDGER_PATH, true)!;
  const entitlementsData = loadJsonFile<{ assets: Entitlement[] }>(
    ENTITLEMENTS_PATH,
    true
  )!;
  const pickRulesData = loadJsonFile<{
    profiles: Record<string, PickRuleProfile>;
  }>(PICK_RULES_PATH, false);

  console.log(`  Ledger: ${ledgerData.picks.length} picks loaded`);
  console.log(
    `  Entitlements: ${entitlementsData.assets.length} assets loaded`
  );
  console.log(
    `  PickRules: ${pickRulesData ? Object.keys(pickRulesData.profiles).length : 0} profiles loaded (${pickRulesData ? 'OK' : 'MISSING'})`
  );

  // Build indices
  const ledgerByPickId = new Map<string, LedgerPick>();
  for (const pick of ledgerData.picks) {
    ledgerByPickId.set(pick.pickId, pick);
  }

  const pickRulesByPickId = new Map<string, PickRuleProfile>();
  if (pickRulesData) {
    for (const [pickId, profile] of Object.entries(pickRulesData.profiles)) {
      pickRulesByPickId.set(pickId, profile);
    }
  }

  // Group entitlements by team
  const entitlementsByTeam = new Map<string, Entitlement[]>();
  for (const team of TEAM_CODES) {
    entitlementsByTeam.set(team, []);
  }
  for (const ent of entitlementsData.assets) {
    const list = entitlementsByTeam.get(ent.holderTeam);
    if (list) {
      list.push(ent);
    }
  }

  console.log(`\nProcessing ${TEAM_CODES.length} teams...\n`);

  // -----------------------------------------------
  // STEP B: Audit Each Team
  // -----------------------------------------------
  const teamSummaries: TeamAuditSummary[] = [];
  const grandByClassification: Record<string, number> = {};
  let grandTotal = 0;
  let grandOk = 0;
  let grandWarn = 0;
  let grandError = 0;

  for (const team of TEAM_CODES) {
    const teamEntitlements = entitlementsByTeam.get(team) || [];
    const summary: TeamAuditSummary = {
      team,
      total: teamEntitlements.length,
      ok: 0,
      warn: 0,
      error: 0,
      byClassification: {},
      errorEntitlementIds: [],
    };

    for (const ent of teamEntitlements) {
      // Determine the primary underlying pickId for ledger/rules lookup
      const primaryPickId =
        ent.underlyingPickId ||
        ent.swapControllerPickId ||
        (ent.poolUnderlyingPickIds?.length
          ? ent.poolUnderlyingPickIds[0]
          : null);

      // Ledger join
      const ledgerPick = primaryPickId
        ? ledgerByPickId.get(primaryPickId)
        : null;

      // PickRules join
      const pickRuleProfile = primaryPickId
        ? pickRulesByPickId.get(primaryPickId)
        : null;

      // Prepare classifier inputs
      const entitlementInput: EntitlementInput = {
        id: ent.id,
        kind: ent.kind,
        holderTeam: ent.holderTeam,
        seasonYear: ent.seasonYear,
        round: ent.round,
        description: ent.description,
        underlyingPickId: ent.underlyingPickId,
        poolUnderlyingPickIds: ent.poolUnderlyingPickIds,
        swapControllerPickId: ent.swapControllerPickId,
        receivesComparator: ent.receivesComparator,
        receivesRank: ent.receivesRank,
      };

      const ledgerPickInput: LedgerPickInput | null = ledgerPick
        ? {
            pickId: ledgerPick.pickId,
            owner: ledgerPick.owner,
            originalTeam: ledgerPick.originalTeam,
            ownershipSource: ledgerPick.ownershipSource,
          }
        : null;

      const pickRuleProfileInput: PickRuleProfileInput | null = pickRuleProfile
        ? {
            pickId: pickRuleProfile.pickId,
            protections: pickRuleProfile.protections,
            swaps: pickRuleProfile.swaps,
            conveyance: pickRuleProfile.conveyance,
            selectionSpecs: pickRuleProfile.selectionSpecs,
          }
        : null;

      // Run classifier
      const sanityResult = classifyEntitlement({
        entitlement: entitlementInput,
        ledgerPick: ledgerPickInput,
        pickRuleProfile: pickRuleProfileInput,
        targetTeamCode: team,
      });

      // Update counts
      if (sanityResult.verdict === 'OK') {
        summary.ok++;
      } else if (sanityResult.verdict === 'WARN') {
        summary.warn++;
      } else if (sanityResult.verdict === 'ERROR') {
        summary.error++;
        summary.errorEntitlementIds.push(ent.id);
      }

      // Classification counts
      const cls = sanityResult.classification;
      summary.byClassification[cls] = (summary.byClassification[cls] || 0) + 1;
      grandByClassification[cls] = (grandByClassification[cls] || 0) + 1;
    }

    teamSummaries.push(summary);

    grandTotal += summary.total;
    grandOk += summary.ok;
    grandWarn += summary.warn;
    grandError += summary.error;
  }

  // -----------------------------------------------
  // STEP C: Identify Teams with Errors
  // -----------------------------------------------
  const teamsWithErrors = teamSummaries
    .filter((s) => s.error > 0)
    .map((s) => s.team);

  const passedGuardrail = grandError === 0;

  // -----------------------------------------------
  // STEP D: Build Result Object
  // -----------------------------------------------
  const auditResult: AllTeamsAuditResult = {
    meta: {
      auditDate: new Date().toISOString(),
      teamCount: TEAM_CODES.length,
      inputFiles: {
        ledger: LEDGER_PATH,
        entitlements: ENTITLEMENTS_PATH,
        pickRules: pickRulesData ? PICK_RULES_PATH : null,
      },
    },
    grandTotals: {
      total: grandTotal,
      ok: grandOk,
      warn: grandWarn,
      error: grandError,
    },
    byClassification: grandByClassification,
    teamSummaries,
    teamsWithErrors,
    passedGuardrail,
  };

  // -----------------------------------------------
  // STEP E: Console Output - Summary Table
  // -----------------------------------------------
  console.log('='.repeat(60));
  console.log('TEAM SUMMARY');
  console.log('='.repeat(60));
  console.log('');

  // Header
  console.log(
    `${padRight('Team', 6)} | ${padLeft('Total', 6)} | ${padLeft('OK', 6)} | ${padLeft('WARN', 6)} | ${padLeft('ERROR', 6)}`
  );
  console.log('-'.repeat(46));

  // Rows
  for (const s of teamSummaries) {
    const errorMarker = s.error > 0 ? ' ❌' : '';
    console.log(
      `${padRight(s.team, 6)} | ${padLeft(String(s.total), 6)} | ${padLeft(String(s.ok), 6)} | ${padLeft(String(s.warn), 6)} | ${padLeft(String(s.error), 6)}${errorMarker}`
    );
  }

  console.log('-'.repeat(46));
  console.log(
    `${padRight('TOTAL', 6)} | ${padLeft(String(grandTotal), 6)} | ${padLeft(String(grandOk), 6)} | ${padLeft(String(grandWarn), 6)} | ${padLeft(String(grandError), 6)}`
  );
  console.log('');

  // -----------------------------------------------
  // STEP F: Console Output - Classification Breakdown
  // -----------------------------------------------
  console.log('Classification Breakdown:');
  const sortedClassifications = Object.entries(grandByClassification).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [cls, count] of sortedClassifications) {
    console.log(`  ${cls}: ${count}`);
  }
  console.log('');

  // -----------------------------------------------
  // STEP G: Write JSON Output
  // -----------------------------------------------
  const outputDir = path.join(process.cwd(), 'data/pst/audits');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonOutputPath = path.join(
    outputDir,
    'all_teams_entitlements_sanity_audit.json'
  );
  fs.writeFileSync(
    jsonOutputPath,
    JSON.stringify(auditResult, null, 2),
    'utf8'
  );
  console.log(`JSON output written to: ${jsonOutputPath}`);

  // -----------------------------------------------
  // STEP H: Write Text Output
  // -----------------------------------------------
  const textOutputPath = path.join(
    outputDir,
    'all_teams_entitlements_sanity_audit.txt'
  );
  const textOutput = generateTextOutput(auditResult);
  fs.writeFileSync(textOutputPath, textOutput, 'utf8');
  console.log(`Text output written to: ${textOutputPath}`);

  // -----------------------------------------------
  // STEP I: Guardrail Gate
  // -----------------------------------------------
  console.log('');
  console.log('='.repeat(60));
  console.log('GUARDRAIL RESULT');
  console.log('='.repeat(60));

  if (passedGuardrail) {
    console.log('');
    console.log('✅ PASSED: No ERROR rows detected across all 30 teams.');
    console.log('');
    console.log(`   Total entitlements audited: ${grandTotal}`);
    console.log(`   OK:   ${grandOk}`);
    console.log(`   WARN: ${grandWarn}`);
    console.log(`   ERROR: ${grandError}`);
    console.log('');
    process.exit(0);
  } else {
    console.log('');
    console.log(
      `❌ FAILED: ${grandError} ERROR row(s) detected across ${teamsWithErrors.length} team(s).`
    );
    console.log('');
    console.log(`   Teams with errors: ${teamsWithErrors.join(', ')}`);
    console.log('');
    console.log('   Error breakdown by team:');
    for (const s of teamSummaries.filter((t) => t.error > 0)) {
      console.log(`     ${s.team}: ${s.error} error(s)`);
      for (const entId of s.errorEntitlementIds.slice(0, 3)) {
        console.log(`       - ${entId}`);
      }
      if (s.errorEntitlementIds.length > 3) {
        console.log(`       ... and ${s.errorEntitlementIds.length - 3} more`);
      }
    }
    console.log('');
    process.exit(1);
  }
}

// =====================================================
// TEXT OUTPUT GENERATOR
// =====================================================

function generateTextOutput(result: AllTeamsAuditResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('ALL TEAMS ENTITLEMENTS SANITY AUDIT');
  lines.push('Phase 12.3F - Whole-Dataset Guardrail');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`Audit Date: ${result.meta.auditDate}`);
  lines.push(`Teams Audited: ${result.meta.teamCount}`);
  lines.push('');
  lines.push('Input Files:');
  lines.push(`  Ledger: ${result.meta.inputFiles.ledger}`);
  lines.push(`  Entitlements: ${result.meta.inputFiles.entitlements}`);
  lines.push(
    `  PickRules: ${result.meta.inputFiles.pickRules || '(not loaded)'}`
  );
  lines.push('');

  lines.push('-'.repeat(70));
  lines.push('GRAND TOTALS');
  lines.push('-'.repeat(70));
  lines.push(`Total Entitlements: ${result.grandTotals.total}`);
  lines.push(`  OK:    ${result.grandTotals.ok}`);
  lines.push(`  WARN:  ${result.grandTotals.warn}`);
  lines.push(`  ERROR: ${result.grandTotals.error}`);
  lines.push('');

  lines.push('-'.repeat(70));
  lines.push('GUARDRAIL STATUS');
  lines.push('-'.repeat(70));
  if (result.passedGuardrail) {
    lines.push('✅ PASSED: No ERROR rows detected.');
  } else {
    lines.push(`❌ FAILED: ${result.grandTotals.error} ERROR row(s) detected.`);
    lines.push(`   Teams with errors: ${result.teamsWithErrors.join(', ')}`);
  }
  lines.push('');

  lines.push('-'.repeat(70));
  lines.push('TEAM SUMMARY TABLE');
  lines.push('-'.repeat(70));
  lines.push(
    `${'Team'.padEnd(6)} | ${'Total'.padStart(6)} | ${'OK'.padStart(6)} | ${'WARN'.padStart(6)} | ${'ERROR'.padStart(6)}`
  );
  lines.push('-'.repeat(46));

  for (const s of result.teamSummaries) {
    const errorMarker = s.error > 0 ? ' ❌' : '';
    lines.push(
      `${s.team.padEnd(6)} | ${String(s.total).padStart(6)} | ${String(s.ok).padStart(6)} | ${String(s.warn).padStart(6)} | ${String(s.error).padStart(6)}${errorMarker}`
    );
  }

  lines.push('-'.repeat(46));
  lines.push(
    `${'TOTAL'.padEnd(6)} | ${String(result.grandTotals.total).padStart(6)} | ${String(result.grandTotals.ok).padStart(6)} | ${String(result.grandTotals.warn).padStart(6)} | ${String(result.grandTotals.error).padStart(6)}`
  );
  lines.push('');

  lines.push('-'.repeat(70));
  lines.push('CLASSIFICATION BREAKDOWN');
  lines.push('-'.repeat(70));
  const sortedClassifications = Object.entries(result.byClassification).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [cls, count] of sortedClassifications) {
    lines.push(`  ${cls}: ${count}`);
  }
  lines.push('');

  if (result.teamsWithErrors.length > 0) {
    lines.push('-'.repeat(70));
    lines.push('ERROR DETAILS BY TEAM');
    lines.push('-'.repeat(70));
    for (const s of result.teamSummaries.filter((t) => t.error > 0)) {
      lines.push(`\n${s.team}: ${s.error} error(s)`);
      lines.push('  Error entitlement IDs:');
      for (const entId of s.errorEntitlementIds) {
        lines.push(`    - ${entId}`);
      }
    }
    lines.push('');
  }

  lines.push('-'.repeat(70));
  lines.push('END OF REPORT');
  lines.push('-'.repeat(70));

  return lines.join('\n');
}

// Run main
main();
