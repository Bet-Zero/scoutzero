export function computeTradeKicker(player, tradeCtx) {
  // No kicker if not specified
  if (!player.tradeKicker?.percentage) {
    return 0;
  }

  const baseSalary = player.newSalary;
  const kickerPct = player.tradeKicker.percentage;
  const kickerAmount = Math.floor(baseSalary * kickerPct);

  // Handle waiver if specified
  const waivedAmount = player.tradeKicker.waived
    ? Math.floor(kickerAmount * player.tradeKicker.waived)
    : 0;

  const effectiveKicker = kickerAmount - waivedAmount;

  // Prorate based on days if specified
  if (tradeCtx?.daysRemainingInSeason && tradeCtx?.daysInSeason) {
    return Math.floor(
      effectiveKicker * (tradeCtx.daysRemainingInSeason / tradeCtx.daysInSeason)
    );
  }

  return effectiveKicker;
}
