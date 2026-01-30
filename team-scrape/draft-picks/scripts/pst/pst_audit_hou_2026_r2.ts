/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_audit_hou_2026_r2.ts
 * PURPOSE: Audit HOU 2026 R2 ownership to reconcile ledger vs entitlement mapping
 * OWNERSHIP: PST Audit
 * HISTORY: Created 2026-01-28
 * LINKS: plans/pst-hou-2026-r2-audit/
 */

import fs from 'fs';
import path from 'path';

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
  kind: string;
  underlyingPickId?: string;
  description: string;
  evidenceRowRefs: string[];
  underlyingStatus?: string;
}

interface AuditRow {
  entitlementId: string;
  underlyingPickId: string;
  entitlementHolderTeam: string;
  entitlementUnderlyingStatus: string;
  ledgerOwner: string;
  ledgerOwnershipSource: string;
  ledgerEvidenceRowRefs: string[];
  match: boolean;
}

interface AuditResult {
  meta: {
    auditDate: string;
    targetTeam: string;
    targetYear: number;
    targetRound: number;
  };
  summary: {
    totalEntitlements: number;
    matchCount: number;
    mismatchCount: number;
  };
  rows: AuditRow[];
  mismatches: string[];
}

function main() {
  console.log('=== HOU 2026 R2 Ownership Audit ===\n');

  // Load data files
  const ledgerPath = path.join(
    process.cwd(),
    'data/pst/pst_pick_ledger_final_2026_2033.json'
  );
  const entitlementsPath = path.join(
    process.cwd(),
    'data/pst/pst_entitlement_assets_2026_2033.json'
  );

  const ledgerData = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const entitlementsData = JSON.parse(
    fs.readFileSync(entitlementsPath, 'utf8')
  );

  // Build ledger lookup map
  const ledgerMap = new Map<string, LedgerPick>();
  for (const pick of ledgerData.picks) {
    ledgerMap.set(pick.pickId, pick);
  }

  // Filter HOU 2026 R2 pick_ownership entitlements
  const houEntitlements = entitlementsData.assets.filter(
    (asset: Entitlement) => {
      return (
        asset.holderTeam === 'HOU' &&
        asset.seasonYear === 2026 &&
        asset.round === 2 &&
        asset.kind === 'pick_ownership'
      );
    }
  );

  console.log(
    `Found ${houEntitlements.length} HOU 2026 R2 pick_ownership entitlements\n`
  );

  // Audit each entitlement
  const rows: AuditRow[] = [];
  const mismatches: string[] = [];

  for (const ent of houEntitlements) {
    const underlyingPickId = ent.underlyingPickId!;
    const ledgerPick = ledgerMap.get(underlyingPickId);

    if (!ledgerPick) {
      console.error(`ERROR: No ledger entry found for ${underlyingPickId}`);
      continue;
    }

    const match = ledgerPick.owner === ent.holderTeam;

    const row: AuditRow = {
      entitlementId: ent.id,
      underlyingPickId,
      entitlementHolderTeam: ent.holderTeam,
      entitlementUnderlyingStatus: ent.underlyingStatus || 'unknown',
      ledgerOwner: ledgerPick.owner,
      ledgerOwnershipSource: ledgerPick.ownershipSource,
      ledgerEvidenceRowRefs: ledgerPick.evidenceRowRefs,
      match,
    };

    rows.push(row);

    if (!match) {
      mismatches.push(underlyingPickId);
    }
  }

  // Sort rows by underlyingPickId for consistent output
  rows.sort((a, b) => a.underlyingPickId.localeCompare(b.underlyingPickId));

  // Calculate summary
  const matchCount = rows.filter((r) => r.match).length;
  const mismatchCount = rows.filter((r) => !r.match).length;

  const auditResult: AuditResult = {
    meta: {
      auditDate: new Date().toISOString(),
      targetTeam: 'HOU',
      targetYear: 2026,
      targetRound: 2,
    },
    summary: {
      totalEntitlements: rows.length,
      matchCount,
      mismatchCount,
    },
    rows,
    mismatches,
  };

  // Print results to console
  console.log('AUDIT RESULTS:');
  console.log('==============\n');
  console.log(`Total HOU 2026 R2 pick_ownership entitlements: ${rows.length}`);
  console.log(`Matches: ${matchCount}`);
  console.log(`Mismatches: ${mismatchCount}\n`);

  if (mismatches.length > 0) {
    console.log('MISMATCHED PICKS:');
    mismatches.forEach((pickId) => console.log(`  - ${pickId}`));
    console.log();
  }

  console.log('DETAILED ROWS:');
  console.log('==============\n');
  rows.forEach((row) => {
    console.log(`Entitlement: ${row.entitlementId}`);
    console.log(`  Underlying Pick: ${row.underlyingPickId}`);
    console.log(`  Entitlement Holder: ${row.entitlementHolderTeam}`);
    console.log(`  Entitlement Status: ${row.entitlementUnderlyingStatus}`);
    console.log(`  Ledger Owner: ${row.ledgerOwner}`);
    console.log(`  Ledger Ownership Source: ${row.ledgerOwnershipSource}`);
    console.log(
      `  Ledger Evidence Rows: ${row.ledgerEvidenceRowRefs.join(', ')}`
    );
    console.log(`  MATCH: ${row.match ? 'YES' : 'NO'}`);
    console.log();
  });

  // Write JSON output
  const jsonOutputPath = path.join(
    process.cwd(),
    'data/pst/audits/hou_2026_r2_audit.json'
  );
  fs.writeFileSync(
    jsonOutputPath,
    JSON.stringify(auditResult, null, 2),
    'utf8'
  );
  console.log(`JSON output written to: ${jsonOutputPath}`);

  // Write text output
  const textOutputPath = path.join(
    process.cwd(),
    'data/pst/audits/hou_2026_r2_audit.txt'
  );
  const textOutput = generateTextOutput(auditResult);
  fs.writeFileSync(textOutputPath, textOutput, 'utf8');
  console.log(`Text output written to: ${textOutputPath}`);

  // Print conclusion
  console.log('\n=== AUDIT CONCLUSION ===');
  if (mismatchCount === 0) {
    console.log('✅ All entitlements match ledger ownership.');
    console.log(
      '✅ No entitlement-vs-ledger mismatch detected for HOU 2026 R2.'
    );
    if (rows.length <= 2) {
      console.log(`✅ Count looks plausible for HOU 2026 R2: ${rows.length}.`);
    } else {
      console.log(
        `⚠️ Count is high (${rows.length}). This may still be a ledger/overlay ownership issue — investigate overlay sources.`
      );
    }
  } else {
    console.log(
      '❌ Mismatches detected between entitlements and ledger ownership.'
    );
    console.log(
      '➡️ This indicates an entitlement build or ledger inconsistency. Investigate the mismatched pickIds above.'
    );
  }
}

function generateTextOutput(result: AuditResult): string {
  const lines: string[] = [];

  lines.push('=== HOU 2026 R2 OWNERSHIP AUDIT ===');
  lines.push('');
  lines.push(`Audit Date: ${result.meta.auditDate}`);
  lines.push(
    `Target: ${result.meta.targetTeam} ${result.meta.targetYear} Round ${result.meta.targetRound}`
  );
  lines.push('');
  lines.push('SUMMARY:');
  lines.push(`  Total Entitlements: ${result.summary.totalEntitlements}`);
  lines.push(`  Matches: ${result.summary.matchCount}`);
  lines.push(`  Mismatches: ${result.summary.mismatchCount}`);
  lines.push('');

  if (result.mismatches.length > 0) {
    lines.push('MISMATCHED PICKS:');
    result.mismatches.forEach((pickId) => {
      lines.push(`  - ${pickId}`);
    });
    lines.push('');
  }

  lines.push('DETAILED AUDIT ROWS:');
  lines.push('===================');
  lines.push('');

  result.rows.forEach((row) => {
    lines.push(`Entitlement ID: ${row.entitlementId}`);
    lines.push(`  Underlying Pick: ${row.underlyingPickId}`);
    lines.push(`  Entitlement Holder: ${row.entitlementHolderTeam}`);
    lines.push(`  Entitlement Status: ${row.entitlementUnderlyingStatus}`);
    lines.push(`  Ledger Owner: ${row.ledgerOwner}`);
    lines.push(`  Ledger Ownership Source: ${row.ledgerOwnershipSource}`);
    lines.push(
      `  Ledger Evidence Rows: ${row.ledgerEvidenceRowRefs.join(', ')}`
    );
    lines.push(`  MATCH: ${row.match ? 'YES' : 'NO'}`);
    lines.push('');
  });

  lines.push('=== CONCLUSION ===');
  if (result.summary.mismatchCount === 0) {
    lines.push('✅ All entitlements match ledger ownership.');
    lines.push(
      '✅ No entitlement-vs-ledger mismatch detected for HOU 2026 R2.'
    );
    if (result.summary.totalEntitlements <= 2) {
      lines.push(
        `✅ Count looks plausible for HOU 2026 R2: ${result.summary.totalEntitlements}.`
      );
    } else {
      lines.push(
        `⚠️ Count is high (${result.summary.totalEntitlements}). This may still be a ledger/overlay ownership issue — investigate overlay sources.`
      );
    }
  } else {
    lines.push('❌ Mismatches found between entitlements and ledger.');
    lines.push(
      '➡️ This indicates an entitlement build or ledger inconsistency. Investigate the mismatched pickIds above.'
    );
    lines.push('');
    lines.push(
      'NEXT STEPS: Review Phase 8 entitlement builder logic for these picks:'
    );
    result.mismatches.forEach((pickId) => {
      lines.push(`  - ${pickId}`);
    });
  }

  return lines.join('\n');
}

// Run the audit
main();
