#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BasePick } from './pst_build_base_ledger';
import type { OwnerOverlayItem } from './pst_build_owner_overlay';

/**
 * pst_apply_display_owner_overlay.ts
 *
 * GOAL: Merge base ledger and owner overlay to produce a display-owner ledger.
 *
 * RULES:
 * - Start with base ledger.
 * - Apply overlay if exists for pickId.
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
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/pst/pst_ledger_with_display_owner.json'
);

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

  // Group overlay by pickId
  const overlayMap = new Map<string, OwnerOverlayItem[]>();
  for (const item of overlayItems) {
    if (!overlayMap.has(item.pickId)) {
      overlayMap.set(item.pickId, []);
    }
    overlayMap.get(item.pickId)!.push(item);
  }

  const finalLedger: DisplayLedgerItem[] = [];

  for (const pick of basePicks) {
    const overlays = overlayMap.get(pick.pickId);

    if (!overlays || overlays.length === 0) {
      // No overlay -> Stick with Base
      finalLedger.push({
        ...pick,
        ownershipSource: 'BASE',
      });
      continue;
    }

    // Resolve Precedence
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
      // Note: sourceTeamPage is usually the slug, displayOwner is code.
      // We need to match loosely or use helper.
      // But we can check if the page *contains* the team name or corresponds to it.
      // Or we can rely on `pst_team_slugs` but I don't want to import it just for this if I can avoid it.
      // Wait, I SHOULD import it to be correct.
      // Actually, let's assume `sourceTeamPage` is the slug (e.g. "Mavericks").
      // We'd need to convert displayOwner (DAL) to slug (Mavericks).
      // Let's defer that complexity if possible, or do a simple check?
      // "prefer the row whose sourceTeamPage matches the owner"
      // I'll grab the helper.
      return compareSourceMatch(a, b);
    });

    const winner = overlays[0];

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

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(finalLedger, null, 2));
  console.log(`✅ Display Ledger written to ${OUTPUT_PATH}`);
  console.log(`   Count: ${finalLedger.length}`);
}

import { CODE_TO_PST_SLUG } from './pst_team_slugs';

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
