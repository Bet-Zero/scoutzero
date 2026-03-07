/**
 * Validates sign-and-trade rules for NBA trades.
 * Fail-closed contract + eligibility checks are shared with apply-time utilities.
 */

import {
  isSignAndTradeEligible,
  resolveSignAndTradeContractPayload,
  validateSignAndTradeContractPayload,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import {
  getJanuary15RestrictionDate,
  resolveTradeTimingDate,
} from '../utils/tradeTimingWindows.js';

function resolveTeamId(team) {
  return (
    team.teamId ||
    team.teamCode ||
    team.team?.teamId ||
    team.team?.teamCode ||
    team.team?.id ||
    null
  );
}

function resolveDestinationTeamId(player) {
  return (
    player?.tradeTo ||
    player?.receivingTeamId ||
    player?.toTeamId ||
    player?.destTeamId ||
    null
  );
}

function isTradeMachinePath(tradeCtx = {}) {
  return tradeCtx?.source === 'tradeMachine';
}

function getValidationYear(tradeCtx = {}) {
  return tradeCtx.currentYear || tradeCtx.yearKey || null;
}

export function validateSignAndTrade(team, tradeCtx = {}) {
  const violations = [];
  let hasSignAndTrade = false;
  let hardCapped = false;
  const tradeDateObj = resolveTradeTimingDate(tradeCtx);

  const incomingSignAndTradePlayers = (team.incomingPlayers || []).filter(
    (player) => player.signAndTrade === true
  );
  const outgoingSignAndTradePlayers = (team.sends || []).filter(
    (player) => player.signAndTrade === true
  );

  if (
    incomingSignAndTradePlayers.length === 0 &&
    outgoingSignAndTradePlayers.length === 0
  ) {
    return {
      passed: true,
      violations: [],
      message: 'No sign-and-trade players in trade',
      details: {
        hasSignAndTrade: false,
        hardCapped: false,
      },
    };
  }

  hasSignAndTrade = true;
  const strictContractPayload = isTradeMachinePath(tradeCtx);
  const validationYear = getValidationYear(tradeCtx);
  const sourceTeamId = resolveTeamId(team);
  const sourceTeamCapHolds = team.team?.capHolds || team.capHolds || [];
  const activeTeamCount = Array.isArray(tradeCtx?.teams)
    ? tradeCtx.teams.length
    : 2;
  const requireExplicitDestination = strictContractPayload || activeTeamCount >= 3;

  // Rule 1: Sign-and-trades only allowed during offseason
  if (!tradeCtx.offseason) {
    violations.push(
      'Sign-and-trade players can only be traded during the offseason'
    );
  }

  // Rule 1.5: Sign-and-trade players must be traded alone (outgoing)
  if (
    outgoingSignAndTradePlayers.length > 0 &&
    (team.sends || []).length > 1
  ) {
    violations.push('Sign-and-trade player must be traded alone.');
  }

  // Rule 1.6: Receiving team cannot aggregate other players with S&T player
  if (incomingSignAndTradePlayers.length > 0) {
    const otherIncomingPlayers = (team.incomingPlayers || []).filter(
      (player) => player.signAndTrade !== true
    );

    if (otherIncomingPlayers.length > 0) {
      violations.push(
        'Cannot aggregate other players with sign-and-trade player.'
      );
    }

    if (incomingSignAndTradePlayers.length > 1) {
      violations.push(
        'Cannot aggregate other players with sign-and-trade player.'
      );
    }
  }

  // Rule 2: Teams using taxpayer MLE cannot receive sign-and-trade players
  if (
    incomingSignAndTradePlayers.length > 0 &&
    (team.team?.usedTaxpayerMLEThisSeason || team.usedTaxpayerMLEThisSeason)
  ) {
    violations.push(
      'Teams that used the taxpayer MLE cannot receive sign-and-trade players'
    );
  }

  const validateContractPayload = (player, direction) => {
    if (!validationYear) {
      violations.push('Cannot validate sign-and-trade: currentYear is required');
      return;
    }

    if (strictContractPayload && !player.signAndTradeContract) {
      violations.push(
        `Sign-and-trade player ${player.name || player.id} is missing signAndTradeContract payload`
      );
      return;
    }

    const contract = resolveSignAndTradeContractPayload(player, validationYear, {
      allowPlayerContractFallback: !strictContractPayload,
    });

    const contractValidation = validateSignAndTradeContractPayload(
      contract,
      validationYear,
      { requireActiveYearRow: true }
    );

    if (!contractValidation.valid) {
      contractValidation.reasons.forEach((reason) => {
        violations.push(
          `Sign-and-trade player ${player.name || player.id} (${direction}) ${reason}`
        );
      });
    }
  };

  outgoingSignAndTradePlayers.forEach((player) => {
    const jan15RestrictionDate = getJanuary15RestrictionDate(tradeDateObj);
    if (tradeDateObj < jan15RestrictionDate) {
      violations.push(
        `${player.name || 'Player'} cannot be traded until January 15 (sign-and-trade)`
      );
    }

    // Rule 3: Must be free-agent/cap-hold eligible by canonical status resolver
    const eligibility = isSignAndTradeEligible({
      player,
      yearKey: validationYear,
      sourceTeamId,
      worldId: tradeCtx.worldId || null,
      sourceTeamCapHolds,
      allowLegacyInference: !strictContractPayload,
    });

    if (!eligibility.eligible) {
      violations.push(
        `Sign-and-trade player ${player.name || player.id} is ineligible (${eligibility.reasonCode})`
      );
    }

    // Rule 4: Destination must be explicit
    const destinationTeamId = resolveDestinationTeamId(player);
    if (requireExplicitDestination && !destinationTeamId) {
      violations.push(
        `Sign-and-trade player ${player.name || player.id} must include destination team`
      );
    }

    // Rule 5: Contract payload must be complete
    validateContractPayload(player, 'outgoing');

    // Rule 6: Player must be traded by origin team
    if (player.originTeamId && sourceTeamId && player.originTeamId !== sourceTeamId) {
      violations.push(
        `Sign-and-trade player ${player.name || player.id} can only be traded by origin team ${player.originTeamId}`
      );
    }
  });

  incomingSignAndTradePlayers.forEach((player) => {
    validateContractPayload(player, 'incoming');
  });

  // Rule 7: Receiving team becomes hard-capped at first apron
  if (hasSignAndTrade && incomingSignAndTradePlayers.length > 0) {
    hardCapped = true;

    const teamTotalSalary = team.teamTotalSalary || team.team?.teamTotalSalary || 0;
    const salaryIn = team.salaryIn || 0;
    const salaryOut = team.salaryOut || 0;
    const projectedSalary = teamTotalSalary + salaryIn - salaryOut;

    const currentYear = tradeCtx.currentYear;
    if (!currentYear) {
      violations.push(
        'Cannot validate sign-and-trade: currentYear not provided in trade context'
      );
    } else {
      const currentYearKey = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      const yearSettings = tradeCtx.capProjections?.[currentYearKey] || {};
      const firstApron = yearSettings.firstApron || tradeCtx.capSettings?.firstApron;

      if (!firstApron) {
        violations.push(
          'Cannot validate sign-and-trade hard cap: firstApron not available for season'
        );
      } else if (projectedSalary > firstApron) {
        violations.push(
          `Team would exceed hard-cap (first apron: ${firstApron.toLocaleString()}) after receiving sign-and-trade player`
        );
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? violations.join('; ')
        : 'Sign-and-trade validation passed',
    hardCapped,
    details: {
      hasSignAndTrade,
      hardCapped,
    },
  };
}
