export function canSignFreeAgent(
  player,
  teamCapSheet,
  capProjections,
  year = 2025
) {
  const rights = player.birdRights || 'None';
  const teamSalary = teamCapSheet.activeContracts.reduce((sum, p) => {
    const sal = p.salaryByYear?.[year] || 0;
    return sum + sal;
  }, 0);

  const key = `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  const capData = capProjections[key] || {};

  const overCap = teamSalary > (capData.cap || 0);
  const hardCapped = teamCapSheet.hardCapped;

  // 1. Hard cap restriction
  if (
    hardCapped &&
    player.askingSalary + teamSalary > (capData.secondApron || 0)
  ) {
    return { 
      allowed: false, 
      reason: "Cannot sign player — team is hard capped at 2nd apron" 
    };
  }

  // 2. No rights — must have cap space
  if (rights === 'None' && overCap) {
    return { 
      allowed: false, 
      reason: "Cannot sign player without Bird rights or cap space" 
    };
  }

  // 3. Non-Bird — can only offer 120% of prior salary or minimum
  if (rights === 'Non' && player.askingSalary > player.previousSalary * 1.2) {
    return { 
      allowed: false, 
      reason: "Cannot exceed Non-Bird limit (120% of prior salary)" 
    };
  }

  // 4. Early Bird — capped to 175% of prior salary or 105% of average salary
  if (
    rights === 'Early' &&
    player.askingSalary >
      Math.max(
        player.previousSalary * 1.75,
        (capData.cap || 0) * 0.1 * 1.05
      )
  ) {
    return { 
      allowed: false, 
      reason: "Exceeds Early Bird maximum" 
    };
  }

  // 5. Full Bird — can exceed cap with full raises
  if (rights === 'Full') {
    return { allowed: true };
  }

  // 6. If under cap, team can sign anyone up to remaining space
  if (!overCap && player.askingSalary <= (capData.cap || 0) - teamSalary) {
    return { allowed: true };
  }

  // Fallback
  return { 
    allowed: false, 
    reason: "Cap space or exception required to sign this player" 
  };
}