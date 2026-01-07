// src/utils/architect/stepienUtils.js

/* Stepien-rule helpers
 * 
 * Phase 1 SSOT-1: hasStepienViolation now delegates to canonical validateStepien
 * Phase 4: Added protectionMeta support to buildFirstRoundCalendar
 */

import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien.js';
import { isMeaningfulProtection } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';

/**
 * Phase 4: Gets protection text from pick (supports both string and protectionMeta)
 */
function getProtectionText(pick) {
  if (!pick) return null;
  
  // Prefer protectionMeta if present
  if (pick.protectionMeta) {
    const { type, maxPosition } = pick.protectionMeta;
    switch (type) {
      case 'position':
        return maxPosition ? `Top ${maxPosition}` : null;
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
  if (pick.protection && pick.protection !== 'Swap (+)' && pick.protection !== 'Swap (-)') {
    return pick.protection;
  }
  
  // Fall back to protectionText field if available
  return pick.protectionText ?? null;
}

export function buildFirstRoundCalendar({
  existingPicks = [],
  picksOfferedInTrade = [],
} = {}) {
  const thisYear = new Date().getFullYear();
  const span = [...Array(8)].map((_, i) => thisYear + i);

  const cal = Object.fromEntries(
    span.map((yr) => [yr, { status: 'owned', protection: null }])
  );

  existingPicks.forEach((p) => {
    if (!cal[p.year]) return;
    const protectionText = getProtectionText(p);
    cal[p.year] = {
      status: protectionText ? 'protected' : 'owed',
      protection: protectionText,
    };
  });

  picksOfferedInTrade.forEach((p) => {
    if (!cal[p.year]) return;
    const protectionText = getProtectionText(p);
    // Phase 4: Use isMeaningfulProtection to determine if protected
    const hasMeaningfulProtection = isMeaningfulProtection(p);
    cal[p.year] = {
      status: hasMeaningfulProtection ? 'protected' : 'outgoing',
      protection: protectionText,
    };
  });

  return cal;
}

export function passesStepienRule(cal) {
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
export function hasStepienViolation(picks) {
  if (!picks || picks.length === 0) return false;

  // Delegate to canonical validateStepien with minimal team wrapper
  const result = validateStepien({ outgoingPicks: picks }, {});
  return !result.passed;
}
