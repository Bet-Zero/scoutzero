import { getSalaryForYear } from '@/utils/architect/tradeHelpers.js';
import { BYC_PERCENT } from '@/utils/architect/cbaConstants.js';

export function outgoingValueBYC({ newSalary, priorSalary }) {
  return Math.max(priorSalary, BYC_PERCENT * newSalary);
}

export function getMatchingValue(player, yearKey, isOutgoing = false) {
  const base = getSalaryForYear(player, yearKey);
  if (isOutgoing) {
    if (player.isBYC)
      return outgoingValueBYC({
        newSalary: base,
        priorSalary: player.previousSalary,
      });
    if (player.isPoisonPill) return player.currentSalary || base; // PPP
    return base;
  }

  if (player.isPoisonPill) {
    const total =
      (player.currentSalary ?? base) +
      (player.extensionYears?.reduce((sum, y) => sum + (y.salary || 0), 0) ||
        0);
    const years = 1 + (player.extensionYears?.length || 0);
    return total / years;
  }

  return base;
}

export function computeMatchingValues({
  teams = [],
  yearKey,
  daysRemainingInSeason,
  daysInSeason,
} = {}) {
  const proration =
    Math.min(
      Math.max((daysRemainingInSeason ?? 0) / (daysInSeason ?? 0), 0),
      1
    ) || 1;

  teams.forEach((team) => {
    (team.sends || []).forEach((player) => {
      const newSalary = getSalaryForYear(player, yearKey);

      let outgoing = newSalary;
      if (player.isBYC) {
        outgoing = outgoingValueBYC({
          newSalary,
          priorSalary: player.previousSalary,
        });
      } else if (player.isPoisonPill && player.currentSalary) {
        outgoing = player.currentSalary;
      }
      player.matchOutgoing = outgoing;

      let incoming = newSalary;
      if (player.isPoisonPill) {
        const total =
          (player.currentSalary ?? newSalary) +
          (player.extensionYears?.reduce(
            (sum, y) => sum + (y.salary || 0),
            0
          ) || 0);
        const years = 1 + (player.extensionYears?.length || 0);
        incoming = total / years;
      }

      const pct = Math.min(player.tradeKickerPct ?? 0, 0.15);
      const waived = Math.min(Math.max(player.tradeKickerWaivedPct ?? 0, 0), 1);
      const effPct = pct * (1 - waived);
      if (effPct > 0 && player.remainingGuaranteedOnCurrentContract > 0) {
        const gross = effPct * player.remainingGuaranteedOnCurrentContract;
        const currentYearAdd = gross * proration;
        incoming = (incoming ?? player.currentYearSalary) + currentYearAdd;
      }

      player.matchIncoming = incoming;
    });
  });
}
