import { getSalaryForYear } from '@/utils/architect/tradeHelpers.js';
import {
  isExpiredTPE,
  canUseTPE,
  SECOND_APRON_TPE_BLOCK,
} from '@/utils/architect/tradeMachine/tpeUtils.js';

export function validateTradeExceptions(team) {
  const violations = [];
  let addedGeneric = false;
  if (team.tradeExceptions?.some((e) => e.isBeingUsed)) {
    team.tradeExceptions
      .filter((e) => e.isBeingUsed)
      .forEach((e) =>
        violations.push(
          `TPE ${e.id} is already being processed in another transaction`
        )
      );
  }
  const usedTPEs = new Set();
  const yearKey = team?.context?.yearKey ?? new Date().getFullYear();
  const onDate = team.context?.tradeDate || new Date().toISOString();

  const addBlock = () => {
    if (!addedGeneric) {
      violations.push(SECOND_APRON_TPE_BLOCK);
      addedGeneric = true;
    }
  };

  team.incomingPlayers.forEach((player) => {
    if (!player.acquiredViaTPE) return;

    const tpe = team.tradeExceptions.find((e) => e.id === player.tpeId);
    if (!tpe) {
      violations.push(`No valid TPE found for ${player.name}`);
      return;
    }
    if (usedTPEs.has(tpe.id)) {
      violations.push(
        `TPE ${tpe.id} is being used multiple times in this trade`
      );
      return;
    }
    if (team.outgoingPlayers?.some((p) => p.toTeamId === player.fromTeamId)) {
      violations.push('Cannot aggregate trade exception with outgoing salary');
      return;
    }
    if (team.postTradeStatus?.isAtOrAboveSecondApron) {
      addBlock();
      return;
    }
    if (!canUseTPE(team, tpe, { currentSeason: yearKey, onDate })) {
      if (isExpiredTPE(tpe, onDate)) {
        violations.push(`Trade exception ${tpe.id} is expired`);
      } else {
        violations.push(`Cannot use trade exception ${tpe.id}`);
      }
      return;
    }
    const incoming = getSalaryForYear(player, yearKey);
    if (incoming > tpe.amount) {
      violations.push(`Trade exception ${tpe.id} is too small`);
      return;
    }
    usedTPEs.add(tpe.id);
    tpe.remaining = tpe.amount - incoming;
    tpe.isUsed = tpe.remaining === 0;
  });

  if (
    team.postTradeStatus?.isAtOrAboveSecondApron &&
    Array.isArray(team.appliedTPEs)
  ) {
    if (team.appliedTPEs.length) {
      addBlock();
    }
  }

  return violations;
}
