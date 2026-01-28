#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_trace_owner_overlay_anomalies.ts
 * PURPOSE: Trace HOU 2026 R2 overlay claims to diagnose why HOU is incorrectly set as owner
 * OWNERSHIP: PST Audit
 * HISTORY: Created 2026-01-28
 * LINKS: docs/team-scrape/return_packages/PST_HOU_2026_R2_OVERLAY_FIX_RETURN_PACKAGE.md
 */

import fs from 'node:fs';
import path from 'node:path';

interface OverlayItem {
  pickId: string;
  originalTeam: string;
  year: number;
  round: number;
  displayOwner: string;
  rowKind: string;
  sourceTeamPage: string;
  sourceUrl: string;
  snapshotPath: string;
  rowRef: string;
}

interface NormalizedRow {
  pickId: string;
  year: number;
  round: number;
  originalTeam: string;
  displayOwner: string;
  rowKind: string;
  rawText: string;
  normalizedText: string;
  flags: {
    mentionsSwap: boolean;
    mentionsProtection: boolean;
    mentionsConveyance: boolean;
    mentionsLeastMostFavorable: boolean;
    mentionsDidNotConvey: boolean;
    mentionsCash: boolean;
    mentionsRights: boolean;
  };
  provenance: {
    source: string;
    sourceUrl: string;
    sourceTeamPage: string;
    snapshotPath: string;
    rowRef: string;
  };
}

interface LedgerPick {
  pickId: string;
  year: number;
  round: number;
  originalTeam: string;
  owner: string;
  ownershipSource: string;
  evidenceRowRefs: string[];
}

interface TraceResult {
  pickId: string;
  finalOwner: string;
  finalOwnershipSource: string;
  finalEvidenceRowRefs: string[];
  competingClaims: Array<{
    claimant: string;
    rowKind: string;
    sourceTeamPage: string;
    sourceUrl: string;
    rowRef: string;
    normalizedTextSnippet: string;
    flags: NormalizedRow['flags'] | null;
  }>;
  winningClaim: {
    claimant: string;
    rowKind: string;
    sourceTeamPage: string;
    rowRef: string;
    reason: string;
  } | null;
  causeClassification:
    | 'EXTRACTION_BUG'
    | 'OVERLAY_PRECEDENCE_BUG'
    | 'PST_DATA_AMBIGUITY'
    | 'UNKNOWN';
  causeExplanation: string;
}

// Target picks to trace
const TARGET_PICKS = [
  'CHI_2026_2nd',
  'DAL_2026_2nd',
  'IND_2026_2nd',
  'LAC_2026_2nd',
  'MIA_2026_2nd',
  'PHI_2026_2nd',
];

function main() {
  console.log('=== HOU 2026 R2 Owner Overlay Trace ===\n');

  // Load data
  const ledgerPath = path.resolve(
    process.cwd(),
    'data/pst/pst_pick_ledger_final_2026_2033.json'
  );
  const overlayPath = path.resolve(
    process.cwd(),
    'data/pst/pst_owner_overlay.json'
  );
  const normalizedRowsPath = path.resolve(
    process.cwd(),
    'data/pst/pst_phase_3_normalized_rows.json'
  );

  const ledgerData = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
  const overlayItems: OverlayItem[] = JSON.parse(
    fs.readFileSync(overlayPath, 'utf-8')
  );
  const normalizedRows: NormalizedRow[] = JSON.parse(
    fs.readFileSync(normalizedRowsPath, 'utf-8')
  );

  // Build lookup maps
  const ledgerMap = new Map<string, LedgerPick>();
  for (const pick of ledgerData.picks) {
    ledgerMap.set(pick.pickId, pick);
  }

  const overlayByPick = new Map<string, OverlayItem[]>();
  for (const item of overlayItems) {
    if (!overlayByPick.has(item.pickId)) {
      overlayByPick.set(item.pickId, []);
    }
    overlayByPick.get(item.pickId)!.push(item);
  }

  // Build normalized rows map by sourceTeamPage|rowRef
  const normalizedRowsMap = new Map<string, NormalizedRow>();
  for (const row of normalizedRows) {
    const key = `${row.provenance.sourceTeamPage}|${row.provenance.rowRef}`;
    // Store by pickId + key for more precise lookup
    const pickKey = `${row.pickId}|${key}`;
    normalizedRowsMap.set(pickKey, row);
    // Also store by just key for fallback
    normalizedRowsMap.set(key, row);
  }

  const traceResults: TraceResult[] = [];

  for (const pickId of TARGET_PICKS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TRACING: ${pickId}`);
    console.log(`${'='.repeat(60)}`);

    const ledgerPick = ledgerMap.get(pickId);
    if (!ledgerPick) {
      console.log(`  ❌ Pick not found in ledger!`);
      continue;
    }

    const overlays = overlayByPick.get(pickId) || [];

    console.log(`\n[1] FINAL LEDGER STATE:`);
    console.log(`  Owner: ${ledgerPick.owner}`);
    console.log(`  Ownership Source: ${ledgerPick.ownershipSource}`);
    console.log(
      `  Evidence Row Refs: ${ledgerPick.evidenceRowRefs?.join(', ') || 'none'}`
    );

    console.log(`\n[2] COMPETING OVERLAY CLAIMS (${overlays.length} total):`);

    const competingClaims: TraceResult['competingClaims'] = [];

    for (const overlay of overlays) {
      // Find corresponding normalized row
      const lookupKey = `${overlay.sourceTeamPage}|${overlay.rowRef}`;
      const pickLookupKey = `${pickId}|${lookupKey}`;
      const normalizedRow =
        normalizedRowsMap.get(pickLookupKey) ||
        normalizedRowsMap.get(lookupKey);

      const snippet = normalizedRow?.normalizedText
        ? normalizedRow.normalizedText.slice(0, 160) + '...'
        : '<no text found>';

      competingClaims.push({
        claimant: overlay.displayOwner,
        rowKind: overlay.rowKind,
        sourceTeamPage: overlay.sourceTeamPage,
        sourceUrl: overlay.sourceUrl,
        rowRef: overlay.rowRef,
        normalizedTextSnippet: snippet,
        flags: normalizedRow?.flags || null,
      });

      console.log(
        `\n  Claim: ${overlay.displayOwner} (via ${overlay.sourceTeamPage} ${overlay.rowRef})`
      );
      console.log(`    rowKind: ${overlay.rowKind}`);
      console.log(`    Text: ${snippet}`);
      if (normalizedRow?.flags) {
        const f = normalizedRow.flags;
        console.log(
          `    Flags: swap=${f.mentionsSwap}, leastMostFav=${f.mentionsLeastMostFavorable}, protection=${f.mentionsProtection}`
        );
      }
    }

    // Determine which claim "won" - sort same as overlay logic
    const ROW_KIND_PRIORITY: Record<string, number> = {
      transaction: 3,
      condition_not_met: 2,
      own: 1,
    };

    const sortedClaims = [...overlays].sort((a, b) => {
      const pA = ROW_KIND_PRIORITY[a.rowKind] || 0;
      const pB = ROW_KIND_PRIORITY[b.rowKind] || 0;
      return pB - pA;
    });

    const winningOverlay = sortedClaims[0];
    let winningClaim: TraceResult['winningClaim'] = null;

    if (winningOverlay && ledgerPick.ownershipSource === 'PST_DISPLAY') {
      winningClaim = {
        claimant: winningOverlay.displayOwner,
        rowKind: winningOverlay.rowKind,
        sourceTeamPage: winningOverlay.sourceTeamPage,
        rowRef: winningOverlay.rowRef,
        reason: `rowKind=${winningOverlay.rowKind} wins precedence (transaction > condition_not_met > own)`,
      };

      console.log(`\n[3] WINNING CLAIM:`);
      console.log(`  Claimant: ${winningClaim.claimant}`);
      console.log(`  rowKind: ${winningClaim.rowKind}`);
      console.log(
        `  Source: ${winningClaim.sourceTeamPage} ${winningClaim.rowRef}`
      );
      console.log(`  Reason: ${winningClaim.reason}`);
    }

    // Analyze cause
    let causeClassification: TraceResult['causeClassification'] = 'UNKNOWN';
    let causeExplanation = '';

    // Check the HOU claims specifically
    const houClaims = overlays.filter((o) => o.displayOwner === 'HOU');
    const nonHouTransactionClaims = overlays.filter(
      (o) => o.displayOwner !== 'HOU' && o.rowKind === 'transaction'
    );

    if (houClaims.length > 0) {
      // Find the normalized rows for HOU claims
      for (const houClaim of houClaims) {
        const key = `${houClaim.sourceTeamPage}|${houClaim.rowRef}`;
        const pickKey = `${pickId}|${key}`;
        const normalizedRow =
          normalizedRowsMap.get(pickKey) || normalizedRowsMap.get(key);

        if (normalizedRow) {
          const text = normalizedRow.normalizedText.toLowerCase();

          // Check for ranked/conditional conveyance patterns
          const hasMostFavorable =
            text.includes('most favorable of') ||
            text.includes('least favorable of') ||
            text.includes('second-least favorable') ||
            text.includes('more favorable of');

          const hasFromClause = text.includes(
            `(from ${pickId.split('_')[0].toLowerCase()})`
          );

          if (hasMostFavorable && !hasFromClause) {
            causeClassification = 'EXTRACTION_BUG';
            causeExplanation = `HOU claim on ${houClaim.sourceTeamPage} ${houClaim.rowRef} describes a RANKED CONVEYANCE ("most/least favorable of X, Y, Z picks"), not explicit ownership. The extraction incorrectly set displayOwner=HOU for a conditional selection right.`;
          } else if (
            houClaim.sourceTeamPage === 'Rockets' &&
            houClaim.rowKind === 'transaction'
          ) {
            // Check if text actually conveys this pick TO Rockets or FROM Rockets
            const originalTeam = pickId.split('_')[0];
            const teamNamesInText = normalizedRow.normalizedText.match(
              /\b(Bulls|Mavericks|Pacers|Clippers|Heat|76ers|Wizards)\b/gi
            );

            // If text says "to Bulls for ..." then Bulls got something, HOU gave something
            if (
              text.includes('to bulls for') ||
              text.includes('to pacers for')
            ) {
              causeClassification = 'EXTRACTION_BUG';
              causeExplanation = `HOU claim on ${houClaim.sourceTeamPage} ${houClaim.rowRef}: The text says HOU traded something TO another team. The pick was received BY the other team, not HOU. Extraction set displayOwner wrong.`;
            } else {
              causeClassification = 'PST_DATA_AMBIGUITY';
              causeExplanation = `Multiple teams claim this pick. HOU's claim comes from ${houClaim.sourceTeamPage} page as a "${houClaim.rowKind}" row. Need manual verification of actual owner.`;
            }
          }
        }
      }
    }

    if (causeClassification === 'UNKNOWN') {
      if (
        nonHouTransactionClaims.length > 0 &&
        winningOverlay?.displayOwner === 'HOU'
      ) {
        causeClassification = 'OVERLAY_PRECEDENCE_BUG';
        causeExplanation = `Non-HOU teams have transaction claims but HOU won. Possible tiebreaker issue.`;
      } else {
        causeClassification = 'PST_DATA_AMBIGUITY';
        causeExplanation =
          'Multiple conflicting claims; requires manual review.';
      }
    }

    console.log(`\n[4] CAUSE CLASSIFICATION: ${causeClassification}`);
    console.log(`  ${causeExplanation}`);

    traceResults.push({
      pickId,
      finalOwner: ledgerPick.owner,
      finalOwnershipSource: ledgerPick.ownershipSource,
      finalEvidenceRowRefs: ledgerPick.evidenceRowRefs || [],
      competingClaims,
      winningClaim,
      causeClassification,
      causeExplanation,
    });
  }

  // Write outputs
  const outputDir = path.resolve(process.cwd(), 'data/pst/audits');
  fs.mkdirSync(outputDir, { recursive: true });

  // JSON output
  const jsonOutput = {
    meta: {
      traceDate: new Date().toISOString(),
      targetPicks: TARGET_PICKS,
    },
    traces: traceResults,
  };
  const jsonPath = path.join(outputDir, 'hou_2026_r2_owner_overlay_trace.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
  console.log(`\n\n✅ JSON output written to: ${jsonPath}`);

  // Text output
  const textLines: string[] = [];
  textLines.push('=== HOU 2026 R2 OWNER OVERLAY TRACE ===');
  textLines.push('');
  textLines.push(`Trace Date: ${new Date().toISOString()}`);
  textLines.push(`Target Picks: ${TARGET_PICKS.join(', ')}`);
  textLines.push('');

  for (const result of traceResults) {
    textLines.push(`${'='.repeat(60)}`);
    textLines.push(`PICK: ${result.pickId}`);
    textLines.push(`${'='.repeat(60)}`);
    textLines.push('');
    textLines.push('FINAL LEDGER STATE:');
    textLines.push(`  Owner: ${result.finalOwner}`);
    textLines.push(`  Ownership Source: ${result.finalOwnershipSource}`);
    textLines.push(
      `  Evidence Rows: ${result.finalEvidenceRowRefs.join(', ') || 'none'}`
    );
    textLines.push('');
    textLines.push(`COMPETING CLAIMS (${result.competingClaims.length}):`);
    for (const claim of result.competingClaims) {
      textLines.push(
        `  - ${claim.claimant} via ${claim.sourceTeamPage} ${claim.rowRef}`
      );
      textLines.push(`    rowKind: ${claim.rowKind}`);
      textLines.push(
        `    Text: ${claim.normalizedTextSnippet.slice(0, 100)}...`
      );
    }
    textLines.push('');
    if (result.winningClaim) {
      textLines.push('WINNING CLAIM:');
      textLines.push(`  Claimant: ${result.winningClaim.claimant}`);
      textLines.push(`  Reason: ${result.winningClaim.reason}`);
    }
    textLines.push('');
    textLines.push(`CAUSE CLASSIFICATION: ${result.causeClassification}`);
    textLines.push(`  ${result.causeExplanation}`);
    textLines.push('');
  }

  textLines.push('=== SUMMARY ===');
  const byClass = new Map<string, string[]>();
  for (const r of traceResults) {
    if (!byClass.has(r.causeClassification)) {
      byClass.set(r.causeClassification, []);
    }
    byClass.get(r.causeClassification)!.push(r.pickId);
  }
  for (const [cls, picks] of byClass) {
    textLines.push(`${cls}: ${picks.join(', ')}`);
  }

  const textPath = path.join(outputDir, 'hou_2026_r2_owner_overlay_trace.txt');
  fs.writeFileSync(textPath, textLines.join('\n'), 'utf-8');
  console.log(`✅ Text output written to: ${textPath}`);

  console.log('\n=== TRACE COMPLETE ===');
}

main();
