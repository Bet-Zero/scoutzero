export function getApronStatus(teamSalary, capSettings) {
  if (!capSettings) return null;

  const { salaryCap, secondApron } = capSettings;

  if (teamSalary >= secondApron) {
    return 'SecondApron';
  } else if (teamSalary >= salaryCap) {
    return 'OverCap';
  }
  return 'UnderCap';
}

export function getAllowableIncomingMargin(team, secondApron) {
  const { teamTotalSalary = 0 } = team;
  const isAtOrAboveSecondApron = teamTotalSalary >= secondApron;

  // Second apron teams must match 100%
  if (isAtOrAboveSecondApron) {
    return 0;
  }

  // Teams under the cap have no restrictions
  if (team.isUnderCap) {
    return Infinity;
  }

  // Standard salary matching rules: 125% + $100k for teams under tax
  // 110% + $100k for tax teams
  const marginPercent = team.isTaxTeam ? 1.1 : 1.25;
  const baseMargin = 100000;

  return baseMargin + teamTotalSalary * (marginPercent - 1);
}

export function computeMatchingValues({ teams, yearKey }) {
  if (!teams || !yearKey) return;

  teams.forEach((team) => {
    if (!team.sends) return;

    team.sends.forEach((player) => {
      // Base outgoing value is current salary
      let outgoingValue = player.currentSalary;

      // Handle BYC calculation
      if (player.bycApplies) {
        const bycValue = player.newSalary * 0.5;
        outgoingValue = Math.max(player.previousSalary || 0, bycValue);
      }

      // Base incoming value starts with current salary
      let incomingValue = player.currentSalary;

      // Add prorated trade kicker if applicable
      if (player.tradeKicker && player.tradeKicker.percent > 0) {
        const maxKicker =
          player.remainingGuaranteedOnCurrentContract *
          (player.tradeKicker.percent / 100);
        const kickerAmount = player.tradeKicker.waived
          ? maxKicker * (1 - player.tradeKicker.waivedPercent / 100)
          : maxKicker;
        incomingValue += kickerAmount;
      }

      // For poison pill contracts, use average of current and extension years
      if (player.extensionYears && player.extensionYears.length > 0) {
        const extensionTotal = player.extensionYears.reduce(
          (sum, year) => sum + year.salary,
          0
        );
        incomingValue =
          (player.currentSalary + extensionTotal) /
          (1 + player.extensionYears.length);
      }

      player.matchOutgoing = outgoingValue;
      player.matchIncoming = incomingValue;
    });
  });
}
