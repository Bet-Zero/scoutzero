export function computeMatchingValues({ teams, yearKey, context = {} }) {
  const { daysUntilTrade = 0, daysInSeason = 177 } = context;

  teams.forEach((team) => {
    team.sends?.forEach((player) => {
      // Base Year Compensation
      if (player.isBaseYear) {
        const bycValue = Math.max(
          player.previousSalary,
          player.newSalary * 0.5
        );
        player.matchOutgoing = bycValue;
        player.matchIncoming = player.newSalary;
        return;
      }

      // Trade Kicker
      if (player.tradeKicker) {
        const fullKickerAmount = player.salary * (player.tradeKicker / 100);
        const proRatedKicker =
          fullKickerAmount * ((daysInSeason - daysUntilTrade) / daysInSeason);
        const effectiveKicker = player.waiveKickerAmount
          ? Math.min(proRatedKicker, player.waiveKickerAmount)
          : proRatedKicker;

        player.matchOutgoing = player.salary;
        player.matchIncoming = player.salary + effectiveKicker;
        return;
      }

      // Poison Pill (Extension)
      if (player.extensionYears?.length) {
        const extensionTotal = player.extensionYears.reduce(
          (sum, year) => sum + year.salary,
          0
        );
        const avgSalary =
          (player.salary + extensionTotal) / (1 + player.extensionYears.length);
        player.matchOutgoing = player.salary;
        player.matchIncoming = avgSalary;
        return;
      }

      // Default case
      player.matchOutgoing = player.salary;
      player.matchIncoming = player.salary;
    });
  });
}
