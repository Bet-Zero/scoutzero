/**
 * FILE: src/features/architect/utils/entitlements/dare/resolutionReceipt.ts
 * PURPOSE: Generate human-readable resolution receipts for DARE output.
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 */

import type {
  DAREResolutionReceipt,
  DAREReceiptEntry,
  EntitlementResolution,
  EntitlementResolutionOutcome,
} from './types';

// =============================================================================
// RECEIPT BUILDER
// =============================================================================

interface ReceiptBuilderInput {
  draftYear: number;
  resolvedAt: string;
  entries: DAREReceiptEntry[];
  warnings: string[];
}

/**
 * Build a human-readable resolution receipt from input.
 */
export function buildResolutionReceipt(
  input: ReceiptBuilderInput
): DAREResolutionReceipt {
  const { draftYear, resolvedAt, entries, warnings } = input;

  // Count by outcome
  const byOutcome: Record<EntitlementResolutionOutcome, number> = {
    conveyed: 0,
    rolled: 0,
    converted: 0,
    swap_resolved: 0,
    expired: 0,
    unchanged: 0,
  };

  for (const entry of entries) {
    if (entry.outcome in byOutcome) {
      byOutcome[entry.outcome]++;
    }
  }

  return {
    draftYear,
    resolvedAt,
    totalResolutions: entries.length,
    byOutcome,
    entries,
    warnings,
  };
}

// =============================================================================
// ENTRY BUILDERS
// =============================================================================

/**
 * Convert an EntitlementResolution to a DAREReceiptEntry.
 */
export function resolutionToReceiptEntry(
  resolution: EntitlementResolution
): DAREReceiptEntry {
  return {
    entitlementId: resolution.entitlementId,
    teamCode: resolution.originalOwner,
    description: buildEntryDescription(resolution),
    outcome: resolution.outcome,
    details: resolution.reason,
  };
}

/**
 * Build a human-readable description for an entry.
 */
function buildEntryDescription(resolution: EntitlementResolution): string {
  const { entitlementId, outcome, year } = resolution;

  // Shorten entitlement ID for readability
  const shortId = shortenEntitlementId(entitlementId);

  switch (outcome) {
    case 'conveyed':
      return `${shortId} conveyed in ${year}`;

    case 'rolled':
      return `${shortId} rolled to ${resolution.newYear}`;

    case 'converted':
      return `${shortId} converted to round ${resolution.convertedToRound}`;

    case 'swap_resolved':
      return `${shortId} swap won by ${resolution.swapWinner}`;

    case 'expired':
      return `${shortId} final year - conveyed`;

    case 'unchanged':
      return `${shortId} unchanged`;

    default:
      return `${shortId} ${outcome}`;
  }
}

/**
 * Shorten an entitlement ID for display.
 *
 * e.g., "ent:BKN:2026:1:own:6d6555d2" -> "BKN 2026 1st own"
 */
function shortenEntitlementId(entId: string): string {
  if (!entId || typeof entId !== 'string') {
    return entId;
  }

  // Parse ent:{team}:{year}:{round}:{kind}:{uuid} format
  const match = entId.match(/^ent:([A-Z]{3}):(\d{4}):(\d):(\w+):/);
  if (match) {
    const [, team, year, round, kind] = match;
    const roundStr = round === '1' ? '1st' : '2nd';
    return `${team} ${year} ${roundStr} ${kind}`;
  }

  // Fallback: truncate if too long
  if (entId.length > 30) {
    return entId.slice(0, 27) + '...';
  }

  return entId;
}

// =============================================================================
// RECEIPT FORMATTING
// =============================================================================

/**
 * Format a receipt as a human-readable string.
 */
export function formatReceiptAsText(receipt: DAREResolutionReceipt): string {
  const lines: string[] = [];

  lines.push(`=== DARE Resolution Receipt ===`);
  lines.push(`Draft Year: ${receipt.draftYear}`);
  lines.push(`Resolved At: ${receipt.resolvedAt}`);
  lines.push(`Total Resolutions: ${receipt.totalResolutions}`);
  lines.push('');

  // Summary by outcome
  lines.push('Summary:');
  for (const [outcome, count] of Object.entries(receipt.byOutcome)) {
    if (count > 0) {
      lines.push(`  - ${outcome}: ${count}`);
    }
  }
  lines.push('');

  // Detailed entries
  if (receipt.entries.length > 0) {
    lines.push('Resolutions:');
    for (const entry of receipt.entries) {
      lines.push(`  [${entry.outcome.toUpperCase()}] ${entry.description}`);
      lines.push(`    Team: ${entry.teamCode}`);
      lines.push(`    Details: ${entry.details}`);
    }
    lines.push('');
  }

  // Warnings
  if (receipt.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of receipt.warnings) {
      lines.push(`  - ${warning}`);
    }
    lines.push('');
  }

  lines.push(`=== End Receipt ===`);

  return lines.join('\n');
}

/**
 * Format a receipt as a compact summary string.
 */
export function formatReceiptAsSummary(receipt: DAREResolutionReceipt): string {
  const parts: string[] = [];

  if (receipt.byOutcome.conveyed > 0) {
    parts.push(`${receipt.byOutcome.conveyed} conveyed`);
  }
  if (receipt.byOutcome.rolled > 0) {
    parts.push(`${receipt.byOutcome.rolled} rolled`);
  }
  if (receipt.byOutcome.converted > 0) {
    parts.push(`${receipt.byOutcome.converted} converted`);
  }
  if (receipt.byOutcome.swap_resolved > 0) {
    parts.push(`${receipt.byOutcome.swap_resolved} swaps resolved`);
  }
  if (receipt.byOutcome.expired > 0) {
    parts.push(`${receipt.byOutcome.expired} expired`);
  }

  if (parts.length === 0) {
    return `DARE ${receipt.draftYear}: No resolutions`;
  }

  return `DARE ${receipt.draftYear}: ${parts.join(', ')}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const _testExports = {
  shortenEntitlementId,
  buildEntryDescription,
};
