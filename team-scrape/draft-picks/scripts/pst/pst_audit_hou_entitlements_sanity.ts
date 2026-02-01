/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_audit_hou_entitlements_sanity.ts
 * PURPOSE: Comprehensive sanity audit for HOU entitlements - joins entitlements, ledger, and pick rules
 *          to explain why HOU may appear to have "too many picks" in the UI
 * OWNERSHIP: PST Audit (Phase 12.3D)
 * HISTORY: Created 2026-02-01
 * LINKS: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
 */

import fs from 'fs';
import path from 'path';

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
  hasRankedConveyance: boolean;
  hasSwapCondition: boolean;
  hasDidNotConvey: boolean;

  // Flags
  flag_missing_underlyingPickId: boolean;
  flag_owner_mismatch: boolean;
  flag_ranked_conveyance_present: boolean;
  flag_pool_or_swap_without_expected_kind: boolean;
  flag_source_is_PST_DISPLAY: boolean;
}

interface YearRoundBucket {
  year: number;
  round: number;
  count: number;
  entitlementIds: string[];
  underlyingPickIds: string[];
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
  summary: {
    totalHOUEntitlements: number;
    byKind: Record<string, number>;
    byYearRound: YearRoundBucket[];
    busyBuckets: YearRoundBucket[];
  };
  rows: AuditRow[];
  suspiciousRows: AuditRow[];
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
  // Check swaps for ranked patterns
  const swapsRanked = profile.swaps?.some(
    (s) =>
      s.mostLeast === 'least_favorable' ||
      s.mostLeast === 'most_favorable' ||
      s.description?.toLowerCase().includes('least favorable') ||
      s.description?.toLowerCase().includes('most favorable')
  );

  // Check selectionSpecs for rank/order patterns
  const specsRanked = profile.selectionSpecs?.some(
    (s) =>
      s.order === 'least' ||
      s.order === 'most' ||
      s.rank != null ||
      s.description?.toLowerCase().includes('rank') ||
      s.description?.toLowerCase().includes('least favorable') ||
      s.description?.toLowerCase().includes('most favorable')
  );

  // Check conveyance for patterns
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
  console.log('=== HOU Entitlements Sanity Audit ===');
  console.log(
    'Phase 12.3D - Comprehensive Entitlements + PickRules + Ledger Join\n'
  );

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

  // Filter to HOU entitlements
  const houEntitlements = entitlementsData.assets.filter(
    (e) => e.holderTeam === 'HOU'
  );

  console.log(`\nFiltered to ${houEntitlements.length} HOU entitlements.\n`);

  // -----------------------------------------------
  // STEP B: Produce One Row Per HOU Entitlement
  // -----------------------------------------------
  console.log('Building audit rows...');

  const rows: AuditRow[] = [];

  for (const ent of houEntitlements) {
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

    // Build row
    const row: AuditRow = {
      entitlementId: ent.id,
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
      hasRankedConveyance: pickRuleProfile
        ? hasRankedConveyancePattern(pickRuleProfile)
        : false,
      hasSwapCondition: pickRuleProfile
        ? hasSwapConditionPattern(pickRuleProfile)
        : false,
      hasDidNotConvey: pickRuleProfile
        ? hasDidNotConveyPattern(pickRuleProfile)
        : false,

      // Flags (computed below)
      flag_missing_underlyingPickId: false,
      flag_owner_mismatch: false,
      flag_ranked_conveyance_present: false,
      flag_pool_or_swap_without_expected_kind: false,
      flag_source_is_PST_DISPLAY: false,
    };

    // -----------------------------------------------
    // STEP C: Compute Flags
    // -----------------------------------------------

    // flag_missing_underlyingPickId: pick_ownership must have underlyingPickId
    if (ent.kind === 'pick_ownership' && !ent.underlyingPickId) {
      row.flag_missing_underlyingPickId = true;
    }

    // flag_owner_mismatch: ledgerOwner exists and != HOU
    if (ledgerPick && ledgerPick.owner !== 'HOU') {
      row.flag_owner_mismatch = true;
    }

    // flag_ranked_conveyance_present
    if (row.hasRankedConveyance) {
      row.flag_ranked_conveyance_present = true;
    }

    // flag_pool_or_swap_without_expected_kind
    // Example: entitlement.kind === 'pick_ownership' but pickRules shows ranked conveyance or swap conditions
    if (
      ent.kind === 'pick_ownership' &&
      (row.hasRankedConveyance || row.hasSwapCondition)
    ) {
      row.flag_pool_or_swap_without_expected_kind = true;
    }

    // flag_source_is_PST_DISPLAY
    if (ledgerPick?.ownershipSource === 'PST_DISPLAY') {
      row.flag_source_is_PST_DISPLAY = true;
    }

    rows.push(row);
  }

  // Sort rows by seasonYear, round, then entitlementId
  rows.sort((a, b) => {
    if (a.seasonYear !== b.seasonYear) return a.seasonYear - b.seasonYear;
    if (a.round !== b.round) return a.round - b.round;
    return a.entitlementId.localeCompare(b.entitlementId);
  });

  // -----------------------------------------------
  // STEP D: Aggregate Summary Sections
  // -----------------------------------------------
  console.log('Computing summaries...');

  // Counts by kind
  const byKind: Record<string, number> = {};
  for (const row of rows) {
    byKind[row.kind] = (byKind[row.kind] || 0) + 1;
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

  // Suspicious rows
  const suspiciousRows = rows.filter(
    (r) =>
      r.flag_missing_underlyingPickId ||
      r.flag_owner_mismatch ||
      r.flag_ranked_conveyance_present ||
      r.flag_pool_or_swap_without_expected_kind
  );

  // -----------------------------------------------
  // STEP E: HOU 2026 R2 Focused Section
  // -----------------------------------------------
  const hou2026R2Rows = rows.filter(
    (r) => r.seasonYear === 2026 && r.round === 2
  );

  // -----------------------------------------------
  // Build Result Object
  // -----------------------------------------------
  const auditResult: AuditResult = {
    meta: {
      auditDate: new Date().toISOString(),
      targetTeam: 'HOU',
      inputFiles: {
        ledger: LEDGER_PATH,
        entitlements: ENTITLEMENTS_PATH,
        pickRules: pickRulesData ? PICK_RULES_PATH : null,
      },
    },
    summary: {
      totalHOUEntitlements: rows.length,
      byKind,
      byYearRound,
      busyBuckets,
    },
    rows,
    suspiciousRows,
    hou2026R2Section: {
      count: hou2026R2Rows.length,
      rows: hou2026R2Rows,
    },
  };

  // -----------------------------------------------
  // Console Output
  // -----------------------------------------------
  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Total HOU Entitlements: ${rows.length}`);
  console.log('\nBy Kind:');
  for (const [kind, count] of Object.entries(byKind)) {
    console.log(`  ${kind}: ${count}`);
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

  console.log(`\nSuspicious Rows: ${suspiciousRows.length}`);
  console.log(`HOU 2026 R2 Section: ${hou2026R2Rows.length} entitlements`);

  // -----------------------------------------------
  // Write JSON Output
  // -----------------------------------------------
  const outputDir = path.join(process.cwd(), 'data/pst/audits');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonOutputPath = path.join(
    outputDir,
    'hou_entitlements_sanity_audit.json'
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
    'hou_entitlements_sanity_audit.txt'
  );
  const textOutput = generateTextOutput(auditResult);
  fs.writeFileSync(textOutputPath, textOutput, 'utf8');
  console.log(`Text output written to: ${textOutputPath}`);

  // -----------------------------------------------
  // Conclusion
  // -----------------------------------------------
  console.log('\n=== AUDIT CONCLUSION ===');
  if (suspiciousRows.length === 0) {
    console.log('✅ No suspicious rows detected.');
    console.log(
      '✅ All HOU entitlements appear to have consistent ledger ownership and pick rules.'
    );
  } else {
    console.log(
      `⚠️ ${suspiciousRows.length} suspicious row(s) detected. Review the text/JSON output for details.`
    );
  }

  if (hou2026R2Rows.length <= 2) {
    console.log(
      `✅ HOU 2026 R2 count (${hou2026R2Rows.length}) looks plausible.`
    );
  } else {
    console.log(
      `⚠️ HOU 2026 R2 count (${hou2026R2Rows.length}) is higher than expected. Check for pooled/conveyance rights.`
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
  lines.push('HOU ENTITLEMENTS SANITY AUDIT');
  lines.push('Phase 12.3D - Entitlements + PickRules + Ledger Join');
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
  lines.push(`Total HOU Entitlements: ${result.summary.totalHOUEntitlements}`);
  lines.push('');
  lines.push('By Kind:');
  for (const [kind, count] of Object.entries(result.summary.byKind)) {
    lines.push(`  ${kind}: ${count}`);
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
        // Find the row for this pick
        const row = result.rows.find((r) => r.underlyingPickId === pid);
        if (row) {
          lines.push(
            `    - ${pid} → ledgerOwner=${row.ledgerOwner}, source=${row.ledgerOwnershipSource}`
          );
        } else {
          lines.push(`    - ${pid}`);
        }
      }
      lines.push('');
    }
  }
  lines.push('');

  // Suspicious Rows
  lines.push('='.repeat(70));
  lines.push('SUSPICIOUS ROWS (if any)');
  lines.push('='.repeat(70));
  lines.push('');
  if (result.suspiciousRows.length === 0) {
    lines.push('  (none - all rows passed sanity checks)');
  } else {
    for (const row of result.suspiciousRows) {
      lines.push(`Entitlement: ${row.entitlementId}`);
      lines.push(`  Kind: ${row.kind}`);
      lines.push(`  Year/Round: ${row.seasonYear} R${row.round}`);
      lines.push(`  UnderlyingPickId: ${row.underlyingPickId || '(none)'}`);
      lines.push(`  Description: ${row.description}`);
      lines.push('  FLAGS:');
      if (row.flag_missing_underlyingPickId) {
        lines.push('    ❌ flag_missing_underlyingPickId');
      }
      if (row.flag_owner_mismatch) {
        lines.push(
          `    ❌ flag_owner_mismatch (ledgerOwner=${row.ledgerOwner} != HOU)`
        );
      }
      if (row.flag_ranked_conveyance_present) {
        lines.push('    ⚠️ flag_ranked_conveyance_present');
      }
      if (row.flag_pool_or_swap_without_expected_kind) {
        lines.push('    ⚠️ flag_pool_or_swap_without_expected_kind');
      }
      if (row.flag_source_is_PST_DISPLAY) {
        lines.push('    ℹ️ flag_source_is_PST_DISPLAY');
      }
      lines.push('');
    }
  }
  lines.push('');

  // HOU 2026 R2 Section
  lines.push('='.repeat(70));
  lines.push('HOU 2026 R2 FOCUSED SECTION');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`Count: ${result.hou2026R2Section.count}`);
  lines.push('');

  if (result.hou2026R2Section.count === 0) {
    lines.push('  (no HOU 2026 R2 entitlements found)');
  } else {
    for (const row of result.hou2026R2Section.rows) {
      lines.push(`Entitlement: ${row.entitlementId}`);
      lines.push(`  Kind: ${row.kind}`);
      lines.push(`  UnderlyingPickId: ${row.underlyingPickId || '(none)'}`);
      lines.push(
        `  PoolUnderlyingPickIds: ${row.poolUnderlyingPickIds?.join(', ') || '(none)'}`
      );
      lines.push(`  Description: ${row.description}`);
      lines.push(`  LedgerOwner: ${row.ledgerOwner || '(none)'}`);
      lines.push(
        `  LedgerOwnershipSource: ${row.ledgerOwnershipSource || '(none)'}`
      );
      lines.push(`  ProtectionsSummary: ${row.protectionsSummary || '(none)'}`);
      lines.push(`  ConditionsSummary: ${row.conditionsSummary || '(none)'}`);
      lines.push(`  HasRankedConveyance: ${row.hasRankedConveyance}`);
      lines.push(`  HasSwapCondition: ${row.hasSwapCondition}`);
      lines.push(`  HasDidNotConvey: ${row.hasDidNotConvey}`);
      lines.push('  FLAGS:');
      const flags: string[] = [];
      if (row.flag_missing_underlyingPickId)
        flags.push('flag_missing_underlyingPickId');
      if (row.flag_owner_mismatch) flags.push('flag_owner_mismatch');
      if (row.flag_ranked_conveyance_present)
        flags.push('flag_ranked_conveyance_present');
      if (row.flag_pool_or_swap_without_expected_kind)
        flags.push('flag_pool_or_swap_without_expected_kind');
      if (row.flag_source_is_PST_DISPLAY)
        flags.push('flag_source_is_PST_DISPLAY');
      lines.push(`    ${flags.length ? flags.join(', ') : '(none)'}`);
      lines.push('');
    }
  }

  // Conclusion
  lines.push('='.repeat(70));
  lines.push('CONCLUSION');
  lines.push('='.repeat(70));
  lines.push('');

  if (result.suspiciousRows.length === 0) {
    lines.push('✅ No suspicious rows detected.');
    lines.push(
      '✅ All HOU entitlements appear consistent with ledger ownership and pick rules.'
    );
  } else {
    lines.push(
      `⚠️ ${result.suspiciousRows.length} suspicious row(s) require investigation.`
    );
    lines.push('');
    lines.push('Common causes for suspicious flags:');
    lines.push(
      '  - flag_owner_mismatch: The underlying pick is owned by another team in ledger.'
    );
    lines.push(
      '    This may be legitimate if HOU has a conveyance_right or swap_right.'
    );
    lines.push(
      '  - flag_ranked_conveyance_present: Pick rules indicate ranked selection (least/most favorable).'
    );
    lines.push(
      '    This creates multiple entitlements for the same conceptual "slot".'
    );
    lines.push(
      '  - flag_pool_or_swap_without_expected_kind: A pick_ownership entitlement points to'
    );
    lines.push(
      '    a pick with swap/conveyance conditions. This may indicate incorrect entitlement type.'
    );
  }
  lines.push('');

  if (result.hou2026R2Section.count <= 2) {
    lines.push(
      `✅ HOU 2026 R2 count (${result.hou2026R2Section.count}) looks plausible.`
    );
  } else {
    lines.push(
      `⚠️ HOU 2026 R2 count (${result.hou2026R2Section.count}) is higher than typical.`
    );
    lines.push(
      '   This may be explained by pooled conveyance rights or swap agreements.'
    );
    lines.push(
      '   Review the individual entitlements above for justification.'
    );
  }

  lines.push('');
  lines.push('='.repeat(70));
  lines.push('END OF AUDIT REPORT');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

// Run the audit
main();
