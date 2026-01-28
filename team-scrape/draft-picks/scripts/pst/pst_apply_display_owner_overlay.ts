#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BasePick } from './pst_build_base_ledger';
import type { OwnerOverlayItem } from './pst_build_owner_overlay';
import { isSwapOnlyOverlayItem } from './pst_owner_model_utils';
import { CODE_TO_PST_SLUG } from './pst_team_slugs';

/**
 * pst_apply_display_owner_overlay.ts
 *
 * GOAL: Merge base ledger and owner overlay to produce a display-owner ledger.
 *
 * RULES:
 * - Start with base ledger.
 * - Apply overlay if exists for pickId.
 * - SWAP GATE: If overlay item is swap-only (not explicit conveyance), do NOT change owner.
 * - RANKED CONVEYANCE GATE: If overlay item describes a ranked/conditional conveyance
 *   (mentionsLeastMostFavorable=true), do NOT use it to determine owner.
 * - Precedence:
 *   1. rowKind: transaction > condition_not_met > own
 *   2. sourceTeamPage matches displayOwner (preference for "I have it" vs "They have it")
 *   3. Stable sort
 */

const BASE_LEDGER_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_base_ledger_2026_2033.json'
);
const OVERLAY_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_owner_overlay.json'
);
const NORMALIZED_ROWS_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_phase_3_normalized_rows.json'
);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_ledger_with_display_owner.json'
);

type NormalizedRowWithFlags = {
  normalizedText: string;
  flags?: {
    mentionsSwap?: boolean;
    mentionsLeastMostFavorable?: boolean;
    mentionsProtection?: boolean;
  };
  provenance?: {
    rowRef?: string;
    sourceTeamPage?: string;
  };
};

type DisplayLedgerItem = BasePick & {
  ownershipSource: 'BASE' | 'PST_DISPLAY';
  rowKind?: 'own' | 'transaction' | 'condition_not_met';
  provenance?: {
    sourceTeamPage: string;
    sourceUrl: string;
    snapshotPath: string;
    rowRef: string;
  };
};

const ROW_KIND_PRIORITY = {
  transaction: 3,
  condition_not_met: 2,
  own: 1,
};

async function main() {
  console.log('Applying Display Owner Overlay...');

  // Load Data
  const basePicks = JSON.parse(
    await fs.readFile(BASE_LEDGER_PATH, 'utf-8')
  ) as BasePick[];
  const overlayItems = JSON.parse(
    await fs.readFile(OVERLAY_PATH, 'utf-8')
  ) as OwnerOverlayItem[];

  // Load normalized rows for swap-only and ranked conveyance detection
  // File is a top-level array; rowRef is at provenance.rowRef (rowRef is per-page, e.g. r16 on Mavericks vs r16 on Spurs)
  const normalizedRows = JSON.parse(
    await fs.readFile(NORMALIZED_ROWS_PATH, 'utf-8')
  ) as NormalizedRowWithFlags[];

  const normalizedRowsMap = new Map<string, NormalizedRowWithFlags>();
  for (const row of normalizedRows) {
    const rowRef = row.provenance?.rowRef;
    const sourceTeamPage = row.provenance?.sourceTeamPage;
    if (rowRef != null && sourceTeamPage != null) {
      normalizedRowsMap.set(`${sourceTeamPage}|${rowRef}`, row);
    }
  }

  console.log(
    `Loaded ${normalizedRowsMap.size} normalized rows for swap/ranked conveyance detection`
  );

  // Group overlay by pickId
  const overlayMap = new Map<string, OwnerOverlayItem[]>();
  for (const item of overlayItems) {
    if (!overlayMap.has(item.pickId)) {
      overlayMap.set(item.pickId, []);
    }
    overlayMap.get(item.pickId)!.push(item);
  }

  const finalLedger: DisplayLedgerItem[] = [];
  let swapOnlySkipped = 0;
  let rankedConveyanceSkipped = 0;

  /**
   * Helper: Check if an overlay claim is a ranked conveyance (most/least favorable)
   * These describe conditional ownership where the recipient depends on standings,
   * not explicit ownership transfers.
   */
  function isRankedConveyanceClaim(overlay: OwnerOverlayItem): boolean {
    const key = `${overlay.sourceTeamPage}|${overlay.rowRef}`;
    const normalizedRow = normalizedRowsMap.get(key);
    if (!normalizedRow?.flags) return false;
    return normalizedRow.flags.mentionsLeastMostFavorable === true;
  }

  for (const pick of basePicks) {
    const allOverlays = overlayMap.get(pick.pickId);

    if (!allOverlays || allOverlays.length === 0) {
      // No overlay -> Stick with Base
      finalLedger.push({
        ...pick,
        ownershipSource: 'BASE',
      });
      continue;
    }

    // RANKED CONVEYANCE GATE: Filter out claims that are ranked conveyances
    // Keep only claims where the text does NOT mention "most/least favorable of"
    const overlays = allOverlays.filter((o) => !isRankedConveyanceClaim(o));

    if (overlays.length === 0) {
      // ALL claims are ranked conveyances -> Keep base owner
      rankedConveyanceSkipped++;
      finalLedger.push({
        ...pick,
        ownershipSource: 'BASE', // Keep base owner - ranked conveyance requires runtime resolution
      });
      continue;
    }

    // Resolve Precedence among remaining claims
    // Sort descending by priority, so first element is the winner
    overlays.sort((a, b) => {
      // 1. Row Kind Priority
      const pA = ROW_KIND_PRIORITY[a.rowKind];
      const pB = ROW_KIND_PRIORITY[b.rowKind];
      if (pA !== pB) {
        return pB - pA; // Descending
      }

      // 2. Source Page Match Preference
      // Prefer if sourceTeamPage == displayOwner (The owner claims it)
      return compareSourceMatch(a, b);
    });

    const winner = overlays[0];

    // SWAP GATE: Check if ANY overlay item is swap-only (should NOT change owner)
    // We check all overlays because the winner might have empty text, but other overlays might have swap evidence
    let isSwapOnly = false;
    for (const overlay of overlays) {
      if (isSwapOnlyOverlayItem(overlay, normalizedRowsMap)) {
        isSwapOnly = true;
        break;
      }
    }

    if (isSwapOnly) {
      // Swap-only: Keep base owner, don't apply override
      swapOnlySkipped++;
      finalLedger.push({
        ...pick,
        ownershipSource: 'BASE', // Keep base owner
        rowKind: winner.rowKind, // Still record row kind
        provenance: {
          sourceTeamPage: winner.sourceTeamPage,
          sourceUrl: winner.sourceUrl,
          snapshotPath: winner.snapshotPath,
          rowRef: winner.rowRef,
        },
      });
      continue;
    }

    // Explicit conveyance: Apply owner override
    finalLedger.push({
      ...pick,
      owner: winner.displayOwner,
      ownershipSource: 'PST_DISPLAY',
      rowKind: winner.rowKind,
      provenance: {
        sourceTeamPage: winner.sourceTeamPage,
        sourceUrl: winner.sourceUrl,
        snapshotPath: winner.snapshotPath,
        rowRef: winner.rowRef,
      },
    });
  }

  if (rankedConveyanceSkipped > 0) {
    console.log(
      `  ⚠️  Skipped ${rankedConveyanceSkipped} picks with ALL ranked conveyance claims (owner unchanged)`
    );
  }
  if (swapOnlySkipped > 0) {
    console.log(
      `  ⚠️  Skipped ${swapOnlySkipped} swap-only owner overrides (owner unchanged)`
    );
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(finalLedger, null, 2));
  console.log(`✅ Display Ledger written to ${OUTPUT_PATH}`);
  console.log(`   Count: ${finalLedger.length}`);
}

// Helper for tiebreaker 2
function compareSourceMatch(a: OwnerOverlayItem, b: OwnerOverlayItem): number {
  const slugA = CODE_TO_PST_SLUG[a.displayOwner];
  const slugB = CODE_TO_PST_SLUG[b.displayOwner];

  const matchA = a.sourceTeamPage === slugA;
  const matchB = b.sourceTeamPage === slugB;

  if (matchA && !matchB) return -1; // A comes first
  if (!matchA && matchB) return 1; // B comes first

  return 0; // Tie
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
