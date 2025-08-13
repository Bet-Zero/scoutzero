export function computeMatchingValues({ teams = [], yearKey }) {
  teams.forEach((team) => {
    (team.sends || []).forEach((player) => {
      // Base Year Compensation
      const isOutgoingBYC =
        player.isBYC && player.newSalary > player.previousSalary;
      const bycOutgoing = isOutgoingBYC
        ? Math.max(player.previousSalary, player.newSalary * 0.5)
        : player.currentSalary;

      // Trade Kicker
      const kickerAmount = player.tradeKicker?.amount || 0;
      const kickerPercentage = player.tradeKicker?.percentage || 0;
      const maxKicker = player.tradeKicker?.maximum || Infinity;

      const rawKickerValue = Math.min(
        player.remainingGuaranteedOnCurrentContract * (kickerPercentage / 100),
        maxKicker
      );

      const prorationFactor = player.tradeKicker?.prorationFactor || 1;
      const proratedKicker = rawKickerValue * prorationFactor;

      // Set outgoing matching value
      player.matchOutgoing = bycOutgoing;

      // Set incoming matching value (includes trade kicker)
      player.matchIncoming = player.currentSalary + proratedKicker;

      // Handle poison pill
      if (player.extensionYears?.length > 0) {
        const totalSalary = player.extensionYears.reduce(
          (sum, year) => sum + year.salary,
          0
        );
        const avgSalary =
          (player.currentSalary + totalSalary) /
          (1 + player.extensionYears.length);
        player.matchIncoming = Math.max(player.matchIncoming, avgSalary);
      }
    });
  });
}
