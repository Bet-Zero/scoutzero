export function enforceTradeKicker(player, ctx = {}) {
  const { daysRemainingInSeason, daysInSeason } = ctx;
  const kickerPct = player.tradeKickerPct || 0;

  if (kickerPct === 0) return 0;

  const baseSalary = player.salary || 0;
  const baseKicker = baseSalary * kickerPct;
  const waivedPct = player.tradeKickerWaivedPct || 0;
  const kickerAmount = baseKicker * (1 - waivedPct);

  // Check remaining guaranteed money for kicker cap
  const remainingGuaranteed = player.remainingGuaranteedOnCurrentContract || 0;
  const maxKicker = Math.max(0, remainingGuaranteed - baseSalary);

  // Prorate based on days remaining if provided
  if (daysRemainingInSeason && daysInSeason) {
    const prorationFactor = daysRemainingInSeason / daysInSeason;
    return Math.min(kickerAmount * prorationFactor, maxKicker);
  }

  return Math.min(kickerAmount, maxKicker);
}
