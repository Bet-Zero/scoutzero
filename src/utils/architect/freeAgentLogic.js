export function canSignFreeAgent(
  player,
  teamCapSheet,
  capProjections,
  year = 2025
) {
  const rights = player.birdRights || 'None';

  // Safely calculate current salary obligations
  // Prefer Architect contract.salariesByYear, fall back to contract_clean
  const teamSalary = (teamCapSheet.players || []).reduce((sum, p) => {
    let sal = 0;
    if (p.contract?.salariesByYear?.length) {
      const seasonKey = `${year - 1}-${String(year).slice(-2)}`;
      const yearEntry =
        p.contract.salariesByYear.find((y) => y.season === seasonKey) ||
        p.contract.salariesByYear.find((y) => String(y.season) === String(year));
      sal = yearEntry?.capHit ?? yearEntry?.salary ?? 0;
    } else {
      sal = p.contract_clean?.salaries_by_year?.[year]?.salary || 0;
    }
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
      reason: 'Cannot sign player — team is hard capped at 2nd apron',
    };
  }

  // 2. No Bird rights — must have cap space
  if (rights === 'None' && overCap) {
    return {
      allowed: false,
      reason: 'Cannot sign player without Bird rights or cap space',
    };
  }

  // 3. Non-Bird — can only offer 120% of prior salary or minimum
  if (
    rights === 'Non' &&
    player.previousSalary &&
    player.askingSalary > player.previousSalary * 1.2
  ) {
    return {
      allowed: false,
      reason: 'Cannot exceed Non-Bird limit (120% of prior salary)',
    };
  }

  // 4. Early Bird — capped to 175% of prior salary or 105% of avg salary
  if (
    rights === 'Early' &&
    player.previousSalary &&
    player.askingSalary >
      Math.max(player.previousSalary * 1.75, (capData.cap || 0) * 0.105)
  ) {
    return {
      allowed: false,
      reason: 'Exceeds Early Bird maximum',
    };
  }

  // 5. Full Bird — can exceed cap
  if (rights === 'Full') {
    return { allowed: true };
  }

  // 6. If under cap, team can sign anyone up to remaining space
  if (!overCap && player.askingSalary <= (capData.cap || 0) - teamSalary) {
    return { allowed: true };
  }

  // Default fallback
  return {
    allowed: false,
    reason: 'Cap space or exception required to sign this player',
  };
}
