import {
  isSignAndTradeEligible,
  resolveSignAndTradeContractPayload,
  validateSignAndTradeContractPayload,
  type SignAndTradeCapHold,
  type SignAndTradeContractCarrier,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import {
  getJanuary15RestrictionDate,
  resolveTradeTimingDate,
} from '../utils/tradeTimingWindows.js';
import { summarizeValidationIssues } from '../utils/validationIssueText.js';
import type {
  TeamContext,
  TradeTeam,
  ValidationIssue,
  ValidationResult,
} from '../constants/types';

type SignAndTradeRulePlayer = SignAndTradeContractCarrier & {
  signAndTrade?: boolean;
  tradeTo?: string | null;
  receivingTeamId?: string | null;
  toTeamId?: string | null;
  destTeamId?: string | null;
  originTeamId?: string | number | null;
  name?: string | null;
  displayName?: string | null;
};

type SignAndTradeRuleTeam = TradeTeam & {
  capHolds?: SignAndTradeCapHold[] | null;
  incomingPlayers?: SignAndTradeRulePlayer[];
  sends?: SignAndTradeRulePlayer[];
  usedTaxpayerMLEThisSeason?: boolean;
  team?: TradeTeam['team'] & {
    capHolds?: SignAndTradeCapHold[] | null;
    usedTaxpayerMLEThisSeason?: boolean;
  };
};

type CapProjectionYear = {
  firstApron?: number;
  [key: string]: unknown;
};

type SignAndTradeTradeContext = TeamContext & {
  offseason?: boolean;
  source?: string | null;
  worldId?: string | null;
  currentYear?: number | null;
  yearKey?: number | string | null;
  capProjections?: Record<string, CapProjectionYear | undefined>;
  teams?: TradeTeam[];
};

type SignAndTradeDetails = {
  hasSignAndTrade: boolean;
  hardCapped: boolean;
};

type SignAndTradeValidationResult = ValidationResult & {
  warnings: ValidationIssue[];
  hardCapped: boolean;
  details: SignAndTradeDetails;
};

function createIssue(
  message: string,
  code: string,
  details: string | null = null,
  meta: Record<string, unknown> | null = null
): ValidationIssue {
  return {
    message,
    severity: 'error',
    rule: 'signAndTrade',
    code,
    details,
    meta,
  };
}

function resolveTeamId(team: SignAndTradeRuleTeam): string | null {
  const teamIdLike =
    team.teamId ||
    team.teamCode ||
    team.team?.teamId ||
    team.team?.teamCode ||
    team.team?.id ||
    null;

  return typeof teamIdLike === 'string' && teamIdLike.trim()
    ? teamIdLike
    : null;
}

function resolveDestinationTeamId(player: SignAndTradeRulePlayer): string | null {
  const destination =
    player.tradeTo ||
    player.receivingTeamId ||
    player.toTeamId ||
    player.destTeamId ||
    null;

  return typeof destination === 'string' && destination.trim() ? destination : null;
}

function isTradeMachinePath(tradeCtx: SignAndTradeTradeContext = {}): boolean {
  return tradeCtx.source === 'tradeMachine';
}

function getValidationYear(
  tradeCtx: SignAndTradeTradeContext = {}
): number | string | null {
  return tradeCtx.currentYear || tradeCtx.yearKey || null;
}

function getSourceTeamCapHolds(team: SignAndTradeRuleTeam): SignAndTradeCapHold[] {
  if (Array.isArray(team.team?.capHolds)) {
    return team.team.capHolds;
  }

  return Array.isArray(team.capHolds) ? team.capHolds : [];
}

function getPlayerLabel(
  player: SignAndTradeRulePlayer,
  fallback = 'Player'
): string {
  return String(player.name || player.displayName || player.id || fallback);
}

function getContractPlayerLabel(player: SignAndTradeRulePlayer): string {
  return String(player.name || player.id || 'Player');
}

function isReceivingTeamTaxpayerMleBlocked(team: SignAndTradeRuleTeam): boolean {
  return (
    team.team?.usedTaxpayerMLEThisSeason === true ||
    team.usedTaxpayerMLEThisSeason === true
  );
}

function buildValidationResult(
  violations: ValidationIssue[],
  details: SignAndTradeDetails
): SignAndTradeValidationResult {
  return {
    passed: violations.length === 0,
    violations,
    warnings: [],
    message:
      violations.length > 0
        ? summarizeValidationIssues(violations)
        : details.hasSignAndTrade
          ? 'Sign-and-trade validation passed'
          : 'No sign-and-trade players in trade',
    hardCapped: details.hardCapped,
    details,
  };
}

export function validateSignAndTrade(
  team: SignAndTradeRuleTeam,
  tradeCtx: SignAndTradeTradeContext = {}
): SignAndTradeValidationResult {
  const violations: ValidationIssue[] = [];
  let hasSignAndTrade = false;
  let hardCapped = false;
  const tradeDateObj = resolveTradeTimingDate(tradeCtx);

  const incomingPlayers = Array.isArray(team.incomingPlayers)
    ? team.incomingPlayers
    : [];
  const outgoingPlayers = Array.isArray(team.sends) ? team.sends : [];

  const incomingSignAndTradePlayers = incomingPlayers.filter(
    (player) => player.signAndTrade === true
  );
  const outgoingSignAndTradePlayers = outgoingPlayers.filter(
    (player) => player.signAndTrade === true
  );

  if (
    incomingSignAndTradePlayers.length === 0 &&
    outgoingSignAndTradePlayers.length === 0
  ) {
    return buildValidationResult([], {
      hasSignAndTrade: false,
      hardCapped: false,
    });
  }

  hasSignAndTrade = true;
  const strictContractPayload = isTradeMachinePath(tradeCtx);
  const validationYear = getValidationYear(tradeCtx);
  const sourceTeamId = resolveTeamId(team);
  const sourceTeamCapHolds = getSourceTeamCapHolds(team);
  const activeTeamCount = Array.isArray(tradeCtx.teams) ? tradeCtx.teams.length : 2;
  const requireExplicitDestination =
    strictContractPayload || activeTeamCount >= 3;

  if (!tradeCtx.offseason) {
    violations.push(
      createIssue(
        'Sign-and-trade players can only be traded during the offseason',
        'SIGN_AND_TRADE__OFFSEASON_ONLY'
      )
    );
  }

  if (outgoingSignAndTradePlayers.length > 0 && outgoingPlayers.length > 1) {
    violations.push(
      createIssue(
        'Sign-and-trade player must be traded alone.',
        'SIGN_AND_TRADE__OUTGOING_AGGREGATION_BLOCKED'
      )
    );
  }

  if (incomingSignAndTradePlayers.length > 0) {
    const otherIncomingPlayers = incomingPlayers.filter(
      (player) => player.signAndTrade !== true
    );

    if (otherIncomingPlayers.length > 0) {
      violations.push(
        createIssue(
          'Cannot aggregate other players with sign-and-trade player.',
          'SIGN_AND_TRADE__INCOMING_AGGREGATION_BLOCKED'
        )
      );
    }

    if (incomingSignAndTradePlayers.length > 1) {
      violations.push(
        createIssue(
          'Cannot aggregate other players with sign-and-trade player.',
          'SIGN_AND_TRADE__INCOMING_AGGREGATION_BLOCKED'
        )
      );
    }
  }

  if (
    incomingSignAndTradePlayers.length > 0 &&
    isReceivingTeamTaxpayerMleBlocked(team)
  ) {
    violations.push(
      createIssue(
        'Teams that used the taxpayer MLE cannot receive sign-and-trade players',
        'SIGN_AND_TRADE__TAXPAYER_MLE_RECEIVER_BLOCKED'
      )
    );
  }

  const validateContractPayload = (
    player: SignAndTradeRulePlayer,
    direction: 'incoming' | 'outgoing'
  ) => {
    if (!validationYear) {
      violations.push(
        createIssue(
          'Cannot validate sign-and-trade: currentYear is required',
          'SIGN_AND_TRADE__MISSING_VALIDATION_YEAR'
        )
      );
      return;
    }

    if (strictContractPayload && !player.signAndTradeContract) {
      violations.push(
        createIssue(
          `Sign-and-trade player ${getContractPlayerLabel(player)} is missing signAndTradeContract payload`,
          'SIGN_AND_TRADE__MISSING_CONTRACT_PAYLOAD',
          null,
          {
            playerId: player.id || null,
            direction,
          }
        )
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
          createIssue(
            `Sign-and-trade player ${getContractPlayerLabel(player)} (${direction}) ${reason}`,
            'SIGN_AND_TRADE__INVALID_CONTRACT_PAYLOAD',
            reason,
            {
              playerId: player.id || null,
              direction,
              reasonCode: contractValidation.reasonCode,
            }
          )
        );
      });
    }
  };

  outgoingSignAndTradePlayers.forEach((player) => {
    const jan15RestrictionDate = getJanuary15RestrictionDate(tradeDateObj);
    if (tradeDateObj < jan15RestrictionDate) {
      violations.push(
        createIssue(
          `${player.name || 'Player'} cannot be traded until January 15 (sign-and-trade)`,
          'SIGN_AND_TRADE__JANUARY_15_RESTRICTED',
          null,
          { playerId: player.id || null }
        )
      );
    }

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
        createIssue(
          `Sign-and-trade player ${getContractPlayerLabel(player)} is ineligible (${eligibility.reasonCode})`,
          'SIGN_AND_TRADE__INELIGIBLE_PLAYER',
          eligibility.reasonCode,
          {
            playerId: player.id || null,
            status: eligibility.status,
          }
        )
      );
    }

    const destinationTeamId = resolveDestinationTeamId(player);
    if (requireExplicitDestination && !destinationTeamId) {
      violations.push(
        createIssue(
          `Sign-and-trade player ${getContractPlayerLabel(player)} must include destination team`,
          'SIGN_AND_TRADE__MISSING_DESTINATION_TEAM',
          null,
          { playerId: player.id || null }
        )
      );
    }

    validateContractPayload(player, 'outgoing');

    if (
      player.originTeamId &&
      sourceTeamId &&
      player.originTeamId !== sourceTeamId
    ) {
      violations.push(
        createIssue(
          `Sign-and-trade player ${getContractPlayerLabel(player)} can only be traded by origin team ${player.originTeamId}`,
          'SIGN_AND_TRADE__ORIGIN_TEAM_MISMATCH',
          null,
          {
            playerId: player.id || null,
            originTeamId: player.originTeamId,
            sourceTeamId,
          }
        )
      );
    }
  });

  incomingSignAndTradePlayers.forEach((player) => {
    validateContractPayload(player, 'incoming');
  });

  if (hasSignAndTrade && incomingSignAndTradePlayers.length > 0) {
    hardCapped = true;

    const teamTotalSalary =
      Number(team.teamTotalSalary || team.team?.teamTotalSalary || 0) || 0;
    const salaryIn = Number(team.salaryIn || 0) || 0;
    const salaryOut = Number(team.salaryOut || 0) || 0;
    const projectedSalary = teamTotalSalary + salaryIn - salaryOut;

    const currentYear = tradeCtx.currentYear;
    if (!currentYear) {
      violations.push(
        createIssue(
          'Cannot validate sign-and-trade: currentYear not provided in trade context',
          'SIGN_AND_TRADE__MISSING_CURRENT_YEAR'
        )
      );
    } else {
      const currentYearKey = `${currentYear - 1}-${currentYear
        .toString()
        .slice(-2)}`;
      const yearSettings = tradeCtx.capProjections?.[currentYearKey] || {};
      const firstApron =
        yearSettings.firstApron || tradeCtx.capSettings?.firstApron;

      if (!firstApron) {
        violations.push(
          createIssue(
            'Cannot validate sign-and-trade hard cap: firstApron not available for season',
            'SIGN_AND_TRADE__MISSING_FIRST_APRON'
          )
        );
      } else if (projectedSalary > firstApron) {
        violations.push(
          createIssue(
            `Team would exceed hard-cap (first apron: ${firstApron.toLocaleString()}) after receiving sign-and-trade player`,
            'SIGN_AND_TRADE__FIRST_APRON_HARD_CAP_EXCEEDED',
            null,
            {
              projectedSalary,
              firstApron,
              teamId: resolveTeamId(team),
            }
          )
        );
      }
    }
  }

  return buildValidationResult(violations, {
    hasSignAndTrade,
    hardCapped,
  });
}
