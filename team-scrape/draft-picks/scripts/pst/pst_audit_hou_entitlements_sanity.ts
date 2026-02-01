/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts
 * PURPOSE: Comprehensive sanity audit for HOU entitlements - joins entitlements, ledger, and pick rules
 *          to explain why HOU may appear to have "too many picks" in the UI.
 *          Uses deterministic classification with OK/WARN/ERROR verdicts.
 * OWNERSHIP: PST Audit (Phase 12.3E)
 * HISTORY:
 *   - 2026-02-01: Created (Phase 12.3D)
 *   - 2026-02-01: Added classification matrix + verdicts (Phase 12.3E)
 * LINKS: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
 */

import fs from 'fs';
import path from 'path';
import {
  classifyEntitlement,
  SanityResult,
  SanityClassification,
  SanityVerdict,
  EntitlementInput,
  LedgerPickInput,
  PickRuleProfileInput,
} from './_utils/entitlementSanityClassifier';

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

interface AuditRow {
  entitlementId: string;
  team: string;
  kind: string;
  seasonYear: number;
  round: number;
  underlyingPickId: string | null;
  poolUnderlyingPickIds: string[] | null;
  swapControllerPickId: string | null;
  underlyingStatus: string | null;
  description: string;

  // Ledger join fields
  ledgerOwner: string | null;
  ledgerOriginalTeam: string | null;
  ledgerOwnershipSource: string | null;
  ledgerEvidenceRowRefsCount: number;
  ledgerEvidenceRowRefsSample: string[];

  // PickRules join fields
  protectionsSummary: string | null;
  conditionsSummary: string | null;
  hasPickRules: boolean;
  hasRankedConveyance: boolean;
  hasSwapCondition: boolean;
  hasDidNotConvey: boolean;

  // NEW: Sanity classification result
  sanity: SanityResult;
}

interface YearRoundBucket {
  year: number;
  round: number;
  count: number;
  entitlementIds: string[];
  underlyingPickIds: string[];
}

interface AuditSummary {
  total: number;
  ok: number;
  warn: number;
  error: number;
  byKind: Record<string, number>;
  byClassification: Record<string, number>;
  byYearRound: YearRoundBucket[];
  busyBuckets: YearRoundBucket[];
}

interface AuditResult {
  meta: {
    auditDate: string;
    targetTeam: string;
    inputFiles: {
      ledger: string;
      entitlements: string;
      pickRules: string | null;
    };
  };
  summary: AuditSummary;
  rows: AuditRow[];
  errorRows: AuditRow[];
  warnRows: AuditRow[];
  okRows: AuditRow[];
  hou2026R2Section: {
    count: number;
    rows: AuditRow[];
  };
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

function summarizeProtections(protections: any[]): string {
  if (!protections || protections.length === 0) return 'none';
  return protections
    .map((p) => {
      if (typeof p === 'string') return p;
      if (p.description) return p.description;
      if (p.type) return p.type;
      return JSON.stringify(p).slice(0, 50);
    })
    .join('; ');
}

function summarizeConditions(profile: PickRuleProfile): string {
  const parts: string[] = [];

  if (profile.swaps?.length) {
    parts.push(
      `swaps(${profile.swaps.length}): ${profile.swaps.map((s) => s.controller || s.description?.slice(0, 30) || 'swap').join(', ')}`
    );
  }

  if (profile.conveyance?.length) {
    parts.push(
      `conveyance(${profile.conveyance.length}): ${profile.conveyance.map((c) => c.description?.slice(0, 30) || 'conv').join(', ')}`
    );
  }

  if (profile.didNotConvey?.length) {
    parts.push(`didNotConvey(${profile.didNotConvey.length})`);
  }

  if (profile.selectionSpecs?.length) {
    parts.push(
      `selectionSpecs(${profile.selectionSpecs.length}): ${profile.selectionSpecs.map((s) => s.kind || 'spec').join(', ')}`
    );
  }

  return parts.length ? parts.join(' | ') : 'none';
}

function hasRankedConveyancePattern(profile: PickRuleProfile): boolean {
  const swapsRanked = profile.swaps?.some(
    (s) =>
      s.mostLeast === 'least_favorable' ||
      s.mostLeast === 'most_favorable' ||
      s.description?.toLowerCase().includes('least favorable') ||
      s.description?.toLowerCase().includes('most favorable')
  );

  const specsRanked = profile.selectionSpecs?.some(
    (s) =>
      s.order === 'least' ||
      s.order === 'most' ||
      s.rank != null ||
      s.description?.toLowerCase().includes('rank') ||
      s.description?.toLowerCase().includes('least favorable') ||
      s.description?.toLowerCase().includes('most favorable')
  );

  const convRanked = profile.conveyance?.some(
    (c) =>
      c.description?.toLowerCase().includes('least favorable') ||
      c.description?.toLowerCase().includes('most favorable')
  );

  return swapsRanked || specsRanked || convRanked || false;
}

function hasSwapConditionPattern(profile: PickRuleProfile): boolean {
  return (
    (profile.swaps?.length || 0) > 0 ||
    profile.selectionSpecs?.some(
      (s) => s.kind === 'swap' || s.kind === 'swap_right'
    ) ||
    false
  );
}

function hasDidNotConveyPattern(profile: PickRuleProfile): boolean {
  return (profile.didNotConvey?.length || 0) > 0;
}

// =====================================================
// MAIN AUDIT FUNCTION
// =====================================================

function main() {
  // Parse CLI args for optional --team flag
  const args = process.argv.slice(2);
  let targetTeam = 'HOU'; // Default
  for (const arg of args) {
    if (arg.startsWith('--team=')) {
      targetTeam = arg.split('=')[1].toUpperCase();
    }
  }

  console.log('=== Entitlements Sanity Audit ===');
  console.log(
    'Phase 12.3E - Deterministic Classification with OK/WARN/ERROR Verdicts\n'
  );
  console.log(`Target Team: ${targetTeam}\n`);

  // -----------------------------------------------
  // STEP A: Load and Index Data
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

  // Filter to target team entitlements
  const teamEntitlements = entitlementsData.assets.filter(
    (e) => e.holderTeam === targetTeam
  );

  console.log(
    `\nFiltered to ${teamEntitlements.length} ${targetTeam} entitlements.\n`
  );

  // -----------------------------------------------
  // STEP B: Produce One Row Per Entitlement with Classification
  // -----------------------------------------------
  console.log('Building audit rows with classifications...');

  const rows: AuditRow[] = [];

  for (const ent of teamEntitlements) {
    // Determine the primary underlying pickId for ledger/rules lookup
    const primaryPickId =
      ent.underlyingPickId ||
      ent.swapControllerPickId ||
      (ent.poolUnderlyingPickIds?.length ? ent.poolUnderlyingPickIds[0] : null);

    // Ledger join
    const ledgerPick = primaryPickId ? ledgerByPickId.get(primaryPickId) : null;

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
      targetTeamCode: targetTeam,
    });

    // Build row
    const row: AuditRow = {
      entitlementId: ent.id,
      team: ent.holderTeam,
      kind: ent.kind,
      seasonYear: ent.seasonYear,
      round: ent.round,
      underlyingPickId: ent.underlyingPickId || null,
      poolUnderlyingPickIds: ent.poolUnderlyingPickIds || null,
      swapControllerPickId: ent.swapControllerPickId || null,
      underlyingStatus: ent.underlyingStatus || null,
      description: ent.description,

      // Ledger fields
      ledgerOwner: ledgerPick?.owner || null,
      ledgerOriginalTeam: ledgerPick?.originalTeam || null,
      ledgerOwnershipSource: ledgerPick?.ownershipSource || null,
      ledgerEvidenceRowRefsCount: ledgerPick?.evidenceRowRefs?.length || 0,
      ledgerEvidenceRowRefsSample:
        ledgerPick?.evidenceRowRefs?.slice(0, 3) || [],

      // PickRules fields
      protectionsSummary: pickRuleProfile
        ? summarizeProtections(pickRuleProfile.protections)
        : null,
      conditionsSummary: pickRuleProfile
        ? summarizeConditions(pickRuleProfile)
        : null,
      hasPickRules: !!pickRuleProfile,
      hasRankedConveyance: pickRuleProfile
        ? hasRankedConveyancePattern(pickRuleProfile)
        : false,
      hasSwapCondition: pickRuleProfile
        ? hasSwapConditionPattern(pickRuleProfile)
        : false,
      hasDidNotConvey: pickRuleProfile
        ? hasDidNotConveyPattern(pickRuleProfile)
        : false,

      // NEW: Sanity classification result
      sanity: sanityResult,
    };

    rows.push(row);
  }

  // Sort rows by seasonYear, round, then entitlementId
  rows.sort((a, b) => {
    if (a.seasonYear !== b.seasonYear) return a.seasonYear - b.seasonYear;
    if (a.round !== b.round) return a.round - b.round;
    return a.entitlementId.localeCompare(b.entitlementId);
  });

  // -----------------------------------------------
  // STEP C: Separate by Verdict
  // -----------------------------------------------
  const errorRows = rows.filter((r) => r.sanity.verdict === 'ERROR');
  const warnRows = rows.filter((r) => r.sanity.verdict === 'WARN');
  const okRows = rows.filter((r) => r.sanity.verdict === 'OK');

  // -----------------------------------------------
  // STEP D: Aggregate Summary Sections
  // -----------------------------------------------
  console.log('Computing summaries...');

  // Counts by kind
  const byKind: Record<string, number> = {};
  for (const row of rows) {
    byKind[row.kind] = (byKind[row.kind] || 0) + 1;
  }

  // Counts by classification
  const byClassification: Record<string, number> = {};
  for (const row of rows) {
    const cls = row.sanity.classification;
    byClassification[cls] = (byClassification[cls] || 0) + 1;
  }

  // Counts by (year, round)
  const yearRoundMap = new Map<string, YearRoundBucket>();
  for (const row of rows) {
    const key = `${row.seasonYear}_${row.round}`;
    if (!yearRoundMap.has(key)) {
      yearRoundMap.set(key, {
        year: row.seasonYear,
        round: row.round,
        count: 0,
        entitlementIds: [],
        underlyingPickIds: [],
      });
    }
    const bucket = yearRoundMap.get(key)!;
    bucket.count++;
    bucket.entitlementIds.push(row.entitlementId);
    if (row.underlyingPickId) {
      bucket.underlyingPickIds.push(row.underlyingPickId);
    }
  }

  const byYearRound = Array.from(yearRoundMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });

  // Busy buckets (count >= 4)
  const busyBuckets = byYearRound.filter((b) => b.count >= 4);

  // -----------------------------------------------
  // STEP E: Team-Specific 2026 R2 Focused Section
  // -----------------------------------------------
  const team2026R2Rows = rows.filter(
    (r) => r.seasonYear === 2026 && r.round === 2
  );

  // -----------------------------------------------
  // Build Result Object
  // -----------------------------------------------
  const summary: AuditSummary = {
    total: rows.length,
    ok: okRows.length,
    warn: warnRows.length,
    error: errorRows.length,
    byKind,
    byClassification,
    byYearRound,
    busyBuckets,
  };

  const auditResult: AuditResult = {
    meta: {
      auditDate: new Date().toISOString(),
      targetTeam,
      inputFiles: {
        ledger: LEDGER_PATH,
        entitlements: ENTITLEMENTS_PATH,
        pickRules: pickRulesData ? PICK_RULES_PATH : null,
      },
    },
    summary,
    rows,
    errorRows,
    warnRows,
    okRows,
    hou2026R2Section: {
      count: team2026R2Rows.length,
      rows: team2026R2Rows,
    },
  };

  // -----------------------------------------------
  // Console Output
  // -----------------------------------------------
  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Target Team: ${targetTeam}`);
  console.log(`Total Entitlements: ${rows.length}`);
  console.log('');
  console.log('Verdicts:');
  console.log(`  ✅ OK:    ${okRows.length}`);
  console.log(`  ⚠️  WARN:  ${warnRows.length}`);
  console.log(`  ❌ ERROR: ${errorRows.length}`);
  console.log('');
  console.log('By Kind:');
  for (const [kind, count] of Object.entries(byKind)) {
    console.log(`  ${kind}: ${count}`);
  }
  console.log('');
  console.log('By Classification:');
  for (const [cls, count] of Object.entries(byClassification)) {
    console.log(`  ${cls}: ${count}`);
  }

  console.log('\nTop Year/Round Buckets (count >= 4):');
  if (busyBuckets.length === 0) {
    console.log('  (none)');
  } else {
    for (const bucket of busyBuckets) {
      console.log(
        `  ${bucket.year} R${bucket.round}: ${bucket.count} entitlements`
      );
    }
  }

  console.log(
    `\n${targetTeam} 2026 R2 Section: ${team2026R2Rows.length} entitlements`
  );

  // -----------------------------------------------
  // Write JSON Output
  // -----------------------------------------------
  const outputDir = path.join(process.cwd(), 'data/pst/audits');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const teamLower = targetTeam.toLowerCase();
  const jsonOutputPath = path.join(
    outputDir,
    `${teamLower}_entitlements_sanity_audit.json`
  );
  fs.writeFileSync(
    jsonOutputPath,
    JSON.stringify(auditResult, null, 2),
    'utf8'
  );
  console.log(`\nJSON output written to: ${jsonOutputPath}`);

  // -----------------------------------------------
  // Write Text Output
  // -----------------------------------------------
  const textOutputPath = path.join(
    outputDir,
    `${teamLower}_entitlements_sanity_audit.txt`
  );
  const textOutput = generateTextOutput(auditResult);
  fs.writeFileSync(textOutputPath, textOutput, 'utf8');
  console.log(`Text output written to: ${textOutputPath}`);

  // -----------------------------------------------
  // Conclusion
  // -----------------------------------------------
  console.log('\n=== AUDIT CONCLUSION ===');
  if (errorRows.length === 0) {
    console.log(
      '✅ No ERROR rows detected - all entitlements pass sanity checks.'
    );
  } else {
    console.log(
      `❌ ${errorRows.length} ERROR row(s) detected - these require investigation.`
    );
  }

  if (warnRows.length > 0) {
    console.log(
      `⚠️  ${warnRows.length} WARN row(s) detected - expected but complex (no action required).`
    );
  }

  if (team2026R2Rows.length <= 2) {
    console.log(
      `✅ ${targetTeam} 2026 R2 count (${team2026R2Rows.length}) looks plausible.`
    );
  } else {
    console.log(
      `⚠️  ${targetTeam} 2026 R2 count (${team2026R2Rows.length}) is higher than typical - check for pooled/conveyance rights.`
    );
  }

  console.log('\nDone.');
}

// =====================================================
// TEXT OUTPUT GENERATOR
// =====================================================

function generateTextOutput(result: AuditResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push(`${result.meta.targetTeam} ENTITLEMENTS SANITY AUDIT`);
  lines.push(
    'Phase 12.3E - Deterministic Classification with OK/WARN/ERROR Verdicts'
  );
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`Audit Date: ${result.meta.auditDate}`);
  lines.push(`Target Team: ${result.meta.targetTeam}`);
  lines.push('');
  lines.push('Input Files:');
  lines.push(`  Ledger: ${result.meta.inputFiles.ledger}`);
  lines.push(`  Entitlements: ${result.meta.inputFiles.entitlements}`);
  lines.push(`  PickRules: ${result.meta.inputFiles.pickRules || 'MISSING'}`);
  lines.push('');

  // Summary
  lines.push('='.repeat(70));
  lines.push('SUMMARY');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`Total Entitlements: ${result.summary.total}`);
  lines.push('');
  lines.push('VERDICTS:');
  lines.push(`  ✅ OK:    ${result.summary.ok}`);
  lines.push(`  ⚠️  WARN:  ${result.summary.warn}`);
  lines.push(`  ❌ ERROR: ${result.summary.error}`);
  lines.push('');
  lines.push('By Kind:');
  for (const [kind, count] of Object.entries(result.summary.byKind)) {
    lines.push(`  ${kind}: ${count}`);
  }
  lines.push('');
  lines.push('By Classification:');
  for (const [cls, count] of Object.entries(result.summary.byClassification)) {
    lines.push(`  ${cls}: ${count}`);
  }
  lines.push('');

  lines.push('By Year/Round:');
  for (const bucket of result.summary.byYearRound) {
    lines.push(`  ${bucket.year} R${bucket.round}: ${bucket.count}`);
  }
  lines.push('');

  // Busy Buckets
  lines.push('='.repeat(70));
  lines.push('BUSY BUCKETS (count >= 4)');
  lines.push('='.repeat(70));
  lines.push('');
  if (result.summary.busyBuckets.length === 0) {
    lines.push('  (none)');
  } else {
    for (const bucket of result.summary.busyBuckets) {
      lines.push(
        `${bucket.year} R${bucket.round}: ${bucket.count} entitlements`
      );
      lines.push('  Entitlement IDs:');
      for (const id of bucket.entitlementIds) {
        lines.push(`    - ${id}`);
      }
      lines.push('  Underlying Pick IDs:');
      for (const pid of bucket.underlyingPickIds) {
        const row = result.rows.find((r) => r.underlyingPickId === pid);
        if (row) {
          lines.push(
            `    - ${pid} → ledgerOwner=${row.ledgerOwner}, verdict=${row.sanity.verdict}`
          );
        } else {
          lines.push(`    - ${pid}`);
        }
      }
      lines.push('');
    }
  }
  lines.push('');

  // ERROR Rows
  lines.push('='.repeat(70));
  lines.push('ERROR ROWS (require investigation)');
  lines.push('='.repeat(70));
  lines.push('');
  if (result.errorRows.length === 0) {
    lines.push('  (none - all rows passed sanity checks)');
  } else {
    for (const row of result.errorRows) {
      renderRowDetails(lines, row);
    }
  }
  lines.push('');

  // WARN Rows
  lines.push('='.repeat(70));
  lines.push('WARN ROWS (expected but complex)');
  lines.push('='.repeat(70));
  lines.push('');
  if (result.warnRows.length === 0) {
    lines.push('  (none)');
  } else {
    for (const row of result.warnRows) {
      renderRowDetails(lines, row);
    }
  }
  lines.push('');

  // 2026 R2 Section
  lines.push('='.repeat(70));
  lines.push(`${result.meta.targetTeam} 2026 R2 FOCUSED SECTION`);
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`Count: ${result.hou2026R2Section.count}`);
  lines.push('');

  if (result.hou2026R2Section.count === 0) {
    lines.push(`  (no ${result.meta.targetTeam} 2026 R2 entitlements found)`);
  } else {
    for (const row of result.hou2026R2Section.rows) {
      lines.push(`Entitlement: ${row.entitlementId}`);
      lines.push(
        `  Verdict: ${verdictIcon(row.sanity.verdict)} ${row.sanity.verdict}`
      );
      lines.push(`  Classification: ${row.sanity.classification}`);
      lines.push(`  Kind: ${row.kind}`);
      lines.push(`  UnderlyingPickId: ${row.underlyingPickId || '(none)'}`);
      lines.push(
        `  PoolUnderlyingPickIds: ${row.poolUnderlyingPickIds?.join(', ') || '(none)'}`
      );
      lines.push(`  Description: ${row.description}`);
      lines.push(`  LedgerOwner: ${row.ledgerOwner || '(none)'}`);
      lines.push('');
    }
  }

  // Conclusion
  lines.push('='.repeat(70));
  lines.push('CONCLUSION');
  lines.push('='.repeat(70));
  lines.push('');

  if (result.errorRows.length === 0) {
    lines.push(
      '✅ No ERROR rows detected - all entitlements pass sanity checks.'
    );
  } else {
    lines.push(
      `❌ ${result.errorRows.length} ERROR row(s) require investigation.`
    );
    lines.push('');
    lines.push('ERROR classifications indicate:');
    lines.push(
      '  - OWNERSHIP_MISSING_UNDERLYING: pick_ownership without underlyingPickId'
    );
    lines.push(
      '  - OWNERSHIP_OWNER_MISMATCH: ledger shows different owner than entitlement holder'
    );
    lines.push(
      '  - CONVEYANCE_MISSING_UNDERLYING: non-ranked conveyance without pick reference'
    );
  }
  lines.push('');

  if (result.warnRows.length > 0) {
    lines.push(
      `⚠️  ${result.warnRows.length} WARN row(s) detected - these are expected but complex.`
    );
    lines.push('');
    lines.push('WARN classifications indicate:');
    lines.push(
      '  - CONVEYANCE_RANKED_NO_UNDERLYING: ranked conveyance (least/most favorable) intentionally pool-based'
    );
    lines.push(
      '  - OWNERSHIP_WITH_POOL_RULES: ownership with ranked conveyance/swap rules attached'
    );
    lines.push(
      '  - SWAP_POOL_METADATA_MISSING: swap right missing pool details'
    );
    lines.push(
      '  - PROTECTION_RULES_MISSING: protection mentioned but no pick rule seeded'
    );
  }
  lines.push('');

  if (result.hou2026R2Section.count <= 2) {
    lines.push(
      `✅ ${result.meta.targetTeam} 2026 R2 count (${result.hou2026R2Section.count}) looks plausible.`
    );
  } else {
    lines.push(
      `⚠️  ${result.meta.targetTeam} 2026 R2 count (${result.hou2026R2Section.count}) is higher than typical.`
    );
    lines.push(
      '   This may be explained by pooled conveyance rights or swap agreements.'
    );
  }

  lines.push('');
  lines.push('='.repeat(70));
  lines.push('END OF AUDIT REPORT');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

function verdictIcon(verdict: SanityVerdict): string {
  switch (verdict) {
    case 'OK':
      return '✅';
    case 'WARN':
      return '⚠️';
    case 'ERROR':
      return '❌';
    default:
      return '?';
  }
}

function renderRowDetails(lines: string[], row: AuditRow): void {
  lines.push(`Entitlement: ${row.entitlementId}`);
  lines.push(
    `  Verdict: ${verdictIcon(row.sanity.verdict)} ${row.sanity.verdict}`
  );
  lines.push(`  Classification: ${row.sanity.classification}`);
  lines.push(`  Kind: ${row.kind}`);
  lines.push(`  Year/Round: ${row.seasonYear} R${row.round}`);
  lines.push(`  UnderlyingPickId: ${row.underlyingPickId || '(none)'}`);
  lines.push(`  Description: ${row.description}`);
  lines.push('  REASONS:');
  for (const reason of row.sanity.reasons) {
    lines.push(`    - ${reason}`);
  }
  if (row.sanity.suggestedNextAction) {
    lines.push(`  SUGGESTED ACTION: ${row.sanity.suggestedNextAction}`);
  }
  lines.push('');
}

// Run the audit
main();
