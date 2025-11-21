import { getCapHitForSeason } from './tradeMachine/utils/seasonUtils.js';
import { toSeasonKey } from './seasonUtils';

export function canSignFreeAgent(
  player,
  teamCapSheet,
  capProjections,
  year = 2025
) {
  const rights = player.birdRights || 'None';

  // year is the end-year (e.g., 2025), convert to season format: "2024-25"
  const key = toSeasonKey(year);
  const capData = capProjections[key] || {};

  // Safely calculate current salary obligations using new architect schema
  const teamSalary = (teamCapSheet.players || []).reduce((sum, p) => {
    const capHit =
      getCapHitForSeason(p, key) ||
      p.contract_clean?.salaries_by_year?.[year]?.salary ||
      0;
    return sum + capHit;
  }, 0);

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
