// src/utils/architect/stepienUtils.ts

/* Stepien-rule helpers
 *
 * Phase 1 SSOT-1: hasStepienViolation now delegates to canonical validateStepien
 * Phase 4: Added protectionMeta support to buildFirstRoundCalendar
 */

import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien.js';
import { isMeaningfulProtection } from '@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc';

type LooseRecord = Record<string, unknown>;
type LoosePick = LooseRecord;
type StepienCalendarEntry = {
  status: string;
  protection: string | null;
};
type StepienCalendar = Record<number, StepienCalendarEntry>;

/**
 * Phase 4: Gets protection text from pick (supports both string and protectionMeta)
 */
function getProtectionText(pick: LoosePick | null | undefined): string | null {
  if (!pick) return null;

  // Prefer protectionMeta if present
  if (pick.protectionMeta) {
    const meta = pick.protectionMeta as { type?: string; maxPosition?: number };
    switch (meta.type) {
      case 'position':
        return meta.maxPosition ? `Top ${meta.maxPosition}` : null;
      case 'lottery':
        return 'Lottery';
      case 'playoff':
        return 'Playoff Protected';
      case 'always':
        return null; // Unprotected
      case 'never':
        return 'Unconditional';
      default:
        return null;
    }
  }

  // Fall back to protection string (skip "Swap (+/-)" legacy values)
  const protection = pick.protection as string | undefined;
  if (protection && protection !== 'Swap (+)' && protection !== 'Swap (-)') {
    return protection;
  }

  // Fall back to protectionText field if available
  return (pick.protectionText as string) ?? null;
}

export function buildFirstRoundCalendar({
  existingPicks = [],
  picksOfferedInTrade = [],
}: {
  existingPicks?: LoosePick[];
  picksOfferedInTrade?: LoosePick[];
} = {}): StepienCalendar {
  const thisYear = new Date().getFullYear();
  const span = [...Array(8)].map((_, i) => thisYear + i);

  const cal = Object.fromEntries(
    span.map((yr) => [yr, { status: 'owned', protection: null as any }])
  ) as StepienCalendar;

  existingPicks.forEach((p) => {
    const yr = p.year as number;
    if (!cal[yr]) return;
    const protectionText = getProtectionText(p);
    cal[yr] = {
      status: protectionText ? 'protected' : 'owed',
      protection: protectionText,
    };
  });

  picksOfferedInTrade.forEach((p) => {
    const yr = p.year as number;
    if (!cal[yr]) return;
    const protectionText = getProtectionText(p);
    // Phase 4: Use isMeaningfulProtection to determine if protected
    const hasMeaningfulProtection = isMeaningfulProtection(p);
    cal[yr] = {
      status: hasMeaningfulProtection ? 'protected' : 'outgoing',
      protection: protectionText,
    };
  });

  return cal;
}

export function passesStepienRule(cal: StepienCalendar): boolean {
  const yrs = Object.keys(cal)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = 0; i < yrs.length - 1; i += 1) {
    if (
      cal[yrs[i]].status === 'outgoing' &&
      cal[yrs[i + 1]].status === 'outgoing'
    ) {
      return false; // consecutive unprotected
    }
  }
  return true;
}

/**
 * Checks if a set of picks violates the Stepien Rule.
 *
 * @param {Array} picks - Array of draft picks being traded
 * @returns {boolean} True if a violation exists
 *
 * @note Phase 1 SSOT-1: This now delegates to canonical validateStepien()
 */
export function hasStepienViolation(picks: LoosePick[] | null | undefined): boolean {
  if (!picks || picks.length === 0) return false;

  // Delegate to canonical validateStepien with minimal team wrapper
  const result = validateStepien({ outgoingPicks: picks }, {});
  return !result.passed;
}
