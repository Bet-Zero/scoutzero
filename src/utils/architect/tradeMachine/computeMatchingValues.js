export function computeMatchingValues({
  teams = [],
  yearKey,
  daysRemainingInSeason,
  daysInSeason,
}) {
  teams.forEach((team) => {
    (team.sends || []).forEach((player) => {
      // Extract salary from different possible sources
      const newSalary =
        player.newSalary ||
        player.contract_clean?.salaries_by_year?.[yearKey]?.salary ||
        player.salary ||
        player.currentSalary ||
        0;

      const currentSalary = player.currentSalary || player.salary || newSalary;

      // Base Year Compensation - use the greater of previous salary or 50% of new salary
      // If player is marked as BYC, use their previous salary for outgoing matching
      const bycOutgoing =
        player.isBYC && player.previousSalary
          ? Math.max(player.previousSalary, newSalary * 0.5)
          : currentSalary;

      // Trade Kicker - handle both data structures
      const kickerPercentage =
        player.tradeKicker?.percentage || player.tradeKickerPct || 0;
      const maxKicker = player.tradeKicker?.maximum || Infinity;

      // Calculate raw kicker value - use guaranteed amount as base
      // Note: tradeKickerPct is already in decimal form (0.15 = 15%)
      const guaranteedAmount =
        player.remainingGuaranteedOnCurrentContract || currentSalary;
      const rawKickerValue = Math.min(
        guaranteedAmount * kickerPercentage,
        maxKicker
      );

      // Handle proration based on timing or waiver
      let prorationFactor = 1; // Default to full proration

      if (player.tradeKicker?.prorationFactor !== undefined) {
        prorationFactor = player.tradeKicker.prorationFactor;
      } else if (daysRemainingInSeason && daysInSeason) {
        // Calculate proration based on remaining season
        prorationFactor = daysRemainingInSeason / daysInSeason;
      }

      // Apply waiver reduction AFTER proration
      if (player.tradeKickerWaivedPct) {
        prorationFactor *= 1 - player.tradeKickerWaivedPct;
      }

      const proratedKicker = rawKickerValue * prorationFactor;

      // Set outgoing matching value
      player.matchOutgoing = bycOutgoing;

      // Set incoming matching value (includes trade kicker)
      player.matchIncoming = currentSalary + proratedKicker;

      // Handle poison pill
      if (player.extensionYears?.length > 0) {
        const totalSalary = player.extensionYears.reduce(
          (sum, year) => sum + year.salary,
          0
        );
        const avgSalary =
          (currentSalary + totalSalary) / (1 + player.extensionYears.length);
        player.matchIncoming = Math.max(player.matchIncoming, avgSalary);
      }
    });
  });
}
