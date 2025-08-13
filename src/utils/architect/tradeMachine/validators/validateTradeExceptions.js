import {
  playerFitsInTPE,
  getApronStatus,
} from '@/utils/architect/tradeHelpers.js';
import {
  isExpiredTPE,
  canUseTPE,
  isCurrentSeasonTPE,
  SECOND_APRON_TPE_BLOCK,
  isPriorYearTPE,
} from '@/utils/architect/tradeMachine/tpeUtils.js';

export function validateTradeExceptions(team) {
  const violations = [];
  const {
    context,
    incomingPlayers = [],
    teamTotalSalary = 0,
    appliedTPEs = [],
  } = team;
  const { capSettings = {}, yearKey } = context || {};
  const { secondApron = 0 } = capSettings;

  // Check if team is above second apron (can't use TPEs)
  const isAboveSecondApron = getApronStatus(
    team.teamTotalSalary,
    capSettings
  ).includes('2nd Apron');

  if (isAboveSecondApron) {
    // Check for any TPE usage (via appliedTPEs or incoming players)
    const hasAppliedTPEs = Array.isArray(appliedTPEs) && appliedTPEs.length > 0;
    const hasTPEIncoming = incomingPlayers.some(
      (p) => p.absorptionMode === 'TPE'
    );

    if (hasAppliedTPEs || hasTPEIncoming) {
      // Check for prior-year TPE usage first (more specific message)
      const hasPriorYearTPE = appliedTPEs.some((tpe) =>
        isPriorYearTPE(tpe, yearKey)
      );

      if (hasPriorYearTPE) {
        violations.push('Second apron: prior-year TPEs cannot be used.');
      } else {
        violations.push('Second apron team cannot use trade exceptions');
      }
    }
  } else {
    // Only validate TPEs if not above second apron
    incomingPlayers.forEach((player) => {
      if (!player.tpeId && !player.acquiredViaTPE) return;

      const tpe = (team.tradeExceptions || []).find(
        (t) => t.id === player.tpeId
      );
      if (!tpe) {
        violations.push(`Trade exception ${player.tpeId} not found`);
        return;
      }

      // Check if TPE has already been fully consumed (check both properties)
      if (tpe.isUsed || tpe.isBeingUsed) {
        violations.push(`Trade exception ${tpe.id} already being processed`);
        return;
      }

      // Check if TPE is expired (pass current date)
      const currentDate = new Date();
      if (isExpiredTPE(tpe, currentDate)) {
        violations.push(`Trade exception ${tpe.id} is expired`);
        return;
      }

      // Prevent second apron teams from using prior year TPEs
      if (teamTotalSalary >= secondApron && isPriorYearTPE(tpe, yearKey)) {
        violations.push('Second apron: prior-year TPEs cannot be used.');
        return;
      }

      // Calculate player's salary for TPE usage
      const playerSalary = player.matchIncoming || player.salary || 0;

      // Check if player salary exceeds TPE capacity
      if (playerSalary > (tpe.remaining || tpe.amount || 0)) {
        violations.push(
          `Trade exception too small for ${player.name || 'player'}'s salary`
        );
        return;
      }

      // Update TPE remaining balance and mark as used if fully consumed
      const remaining = (tpe.remaining || tpe.amount || 0) - playerSalary;
      tpe.remaining = Math.max(0, remaining);
      tpe.isUsed = remaining <= 0;
    });

    // Check for concurrent TPE usage (simplified check)
    const tpeIds = incomingPlayers.filter((p) => p.tpeId).map((p) => p.tpeId);
    const duplicateTPEs = tpeIds.filter(
      (id, index) => tpeIds.indexOf(id) !== index
    );
    if (duplicateTPEs.length > 0) {
      violations.push('Trade exception already being processed');
    }

    // Check for TPE aggregation with outgoing salary
    const hasOutgoingSalary = (team.sends || []).length > 0;
    const hasTPEUsage = incomingPlayers.some((p) => p.absorptionMode === 'TPE');
    if (hasOutgoingSalary && hasTPEUsage) {
      violations.push('Cannot aggregate trade exception with outgoing salary');
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? 'Trade exception violations detected'
        : 'Trade exception validation passed',
    details: violations.join('; '),
  };
}
