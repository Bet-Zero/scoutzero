import { validationFlags } from '@/config/validationFlags.js';

/**
 * Enforces player eligibility rules including re-acquisition restrictions
 */
export function enforceEligibility(
  teamCtx,
  ctx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const enforcement = validationFlags.reAcquisition;
  const violations = [];
  const { asOfDate } = ctx;
  const currentDate = new Date(asOfDate || Date.now());

  (teamCtx.incomingPlayers || []).forEach((p) => {
    // Re-acquisition bar: cannot reacquire within one year
    // Check both direct player properties and callback function
    let blockedByReacquisition = false;

    // Method 1: Check player properties directly
    if (p.lastTradedFromTeamId === teamCtx.teamId && p.lastTradeDate) {
      const lastTradeDate = new Date(p.lastTradeDate);
      const daysSinceLastTrade =
        (currentDate - lastTradeDate) / (1000 * 60 * 60 * 24);

      if (daysSinceLastTrade < 365) {
        blockedByReacquisition = true;
      }
    }

    // Method 2: Check via callback function (used by tests)
    if (
      ctx.wasTradedAwayWithinOneYear &&
      typeof ctx.wasTradedAwayWithinOneYear === 'function'
    ) {
      const teamId = teamCtx.teamId || teamCtx.team?.id;
      if (ctx.wasTradedAwayWithinOneYear(p.id || p.name, teamId)) {
        blockedByReacquisition = true;
      }
    }

    if (blockedByReacquisition) {
      const msg = `Re-acquisition bar: ${p.name || 'Player'} cannot be reacquired within one year of being traded away`;
      violations.push(msg);

      if (enforcement === 'error') {
        reject(msg);
      } else if (enforcement === 'warn') {
        warn(msg);
      }
    }

    // Waiver re-acquisition bar: cannot reacquire waived player before July 1 after contract end
    if (p.wasWaivedByTeamId === teamCtx.teamId && p.contractEndDate) {
      const contractEndDate = new Date(p.contractEndDate);
      const nextJuly1 = new Date(contractEndDate.getFullYear() + 1, 6, 1); // July 1 next year

      if (currentDate < nextJuly1) {
        const msg = `Re-acquisition bar: ${p.name || 'Player'} cannot be reacquired before July 1 following waiver`;
        violations.push(msg);

        if (enforcement === 'error') {
          reject(msg);
        } else if (enforcement === 'warn') {
          warn(msg);
        }
      }
    }

    // December 15 eligibility check
    if (p.eligibleAfter) {
      const eligibleDate = new Date(p.eligibleAfter);

      if (currentDate < eligibleDate) {
        const msg = `${p.name || 'Player'} not eligible to be traded until ${eligibleDate.toLocaleDateString()}`;
        violations.push(msg);

        if (validationFlags.timingEnforcement === 'error') {
          reject(msg);
        } else if (validationFlags.timingEnforcement === 'warn') {
          warn(msg);
        }
      }
    }

    // Two-way contract eligibility
    if (p.isTwoWay && p.twoWayEligibleAfter) {
      const eligibleDate = new Date(p.twoWayEligibleAfter);

      if (currentDate < eligibleDate) {
        const msg = `Two-way player ${p.name || 'Player'} not eligible until ${eligibleDate.toLocaleDateString()}`;
        violations.push(msg);

        if (validationFlags.timingEnforcement === 'error') {
          reject(msg);
        } else if (validationFlags.timingEnforcement === 'warn') {
          warn(msg);
        }
      }
    }
  });

  return violations;
}
