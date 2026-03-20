import {
  ReacquisitionValidationResult,
  TeamContext,
  TradeExceptionPlayer,
  TradeTeam,
  ValidationIssue,
} from '../constants/types';
import { summarizeValidationIssues } from '../utils/validationIssueText.js';

type ReacquisitionPlayer = TradeExceptionPlayer & {
  name?: string;
  lastTradedFromTeamId?: string | number | null;
  lastTradedFrom?: string | number | null;
  lastTradedDate?: string | number | null;
  lastTradeDate?: string | number | null;
  wasWaivedByTeamId?: string | number | null;
  waivedBy?: string | number | null;
  contractEndDate?: string | number | null;
};

type ReacquisitionRule = 'eligibility' | 'reacquisition';

function createIssue(
  rule: ReacquisitionRule,
  message: string,
  code: string,
  details: string | null = null,
  meta: Record<string, unknown> | null = null
): ValidationIssue {
  return {
    message,
    severity: 'error',
    rule,
    code,
    details,
    meta,
  };
}

function getPlayerKey(player: ReacquisitionPlayer): string | undefined {
  return player.id || player.name || undefined;
}

function getPlayerName(player: ReacquisitionPlayer): string {
  return player.name || 'player';
}

function parseTradeDate(value: string | number | null | undefined): Date {
  if (value == null || value === '') {
    return new Date();
  }

  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const numericDate = new Date(parseInt(String(value), 10));
  if (!Number.isNaN(numericDate.getTime())) {
    return numericDate;
  }

  return new Date();
}

function resolveEligibilityIncomingPlayers(
  team: TradeTeam,
  teams: TradeTeam[]
): ReacquisitionPlayer[] {
  const incomingPlayers = Array.isArray(team.incomingPlayers)
    ? [...(team.incomingPlayers as ReacquisitionPlayer[])]
    : [];

  if (incomingPlayers.length > 0 || teams.length < 2) {
    return incomingPlayers;
  }

  teams.forEach((otherTeam) => {
    if (otherTeam.teamId === team.teamId) {
      return;
    }

    const outgoingPlayers = Array.isArray(otherTeam.sends)
      ? (otherTeam.sends as ReacquisitionPlayer[])
      : [];
    outgoingPlayers.forEach((player) => {
      incomingPlayers.push(player);
    });
  });

  return incomingPlayers;
}

export function collectEligibilityReacquisitionIssues(
  team: TradeTeam,
  tradeCtx: TeamContext = {}
): ValidationIssue[] {
  const violations: ValidationIssue[] = [];
  const teams = Array.isArray(tradeCtx.teams) ? tradeCtx.teams : [];
  const tradeDate = new Date(tradeCtx.asOfDate || new Date().toISOString());
  const incomingPlayers = resolveEligibilityIncomingPlayers(team, teams);

  incomingPlayers.forEach((player) => {
    if (typeof tradeCtx.wasTradedAwayWithinOneYear === 'function') {
      const isViolation = tradeCtx.wasTradedAwayWithinOneYear(
        getPlayerKey(player),
        team.teamId
      );

      if (isViolation) {
        violations.push(
          createIssue(
            'eligibility',
            `Re-acquisition bar: Cannot reacquire ${getPlayerName(player)} within one year of trade`,
            'ELIGIBILITY__REACQUISITION_TRADE_BACK_BLOCKED',
            null,
            { playerId: getPlayerKey(player), teamId: team.teamId || null }
          )
        );
        return;
      }
    }

    const lastTradedFrom = player.lastTradedFromTeamId || player.lastTradedFrom;
    if (lastTradedFrom === team.teamId) {
      const lastTradeDate = parseTradeDate(player.lastTradedDate || player.lastTradeDate);
      const daysSinceDeparture =
        (tradeDate.getTime() - lastTradeDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDeparture < 365) {
        violations.push(
          createIssue(
            'eligibility',
            `Re-acquisition bar: Cannot reacquire ${getPlayerName(player)} within one year of trade (${Math.ceil(
              365 - daysSinceDeparture
            )} days remaining)`,
            'ELIGIBILITY__REACQUISITION_TRADE_BACK_BLOCKED',
            null,
            {
              playerId: getPlayerKey(player),
              teamId: team.teamId || null,
              daysRemaining: Math.ceil(365 - daysSinceDeparture),
            }
          )
        );
      }
    }

    const waivedBy = player.wasWaivedByTeamId || player.waivedBy;
    if (waivedBy === team.teamId) {
      const contractEndDate = parseTradeDate(player.contractEndDate);
      const contractEndYear = contractEndDate.getFullYear() + 1;
      const julyFirst = new Date(contractEndYear, 6, 1);

      if (tradeDate < julyFirst) {
        violations.push(
          createIssue(
            'eligibility',
            `Re-acquisition bar: Cannot reacquire waived ${getPlayerName(player)} until July 1, ${contractEndYear}`,
            'ELIGIBILITY__REACQUISITION_WAIVER_BLOCKED',
            null,
            { playerId: getPlayerKey(player), teamId: team.teamId || null, contractEndYear }
          )
        );
      }
    }
  });

  return violations;
}

function collectAuthoritativeReacquisitionIssues(
  team: TradeTeam,
  tradeCtx: TeamContext = {}
): ValidationIssue[] {
  const violations: ValidationIssue[] = [];

  if (typeof tradeCtx.wasTradedAwayWithinOneYear !== 'function') {
    return violations;
  }

  const destTeamId = team.teamId || team.team?.id || team.team?.teamName;
  const teams = Array.isArray(tradeCtx.teams) ? tradeCtx.teams : [];

  teams.forEach((otherTeam) => {
    if (otherTeam === team) {
      return;
    }

    const outgoingPlayers = Array.isArray(otherTeam.sends)
      ? (otherTeam.sends as ReacquisitionPlayer[])
      : [];
    outgoingPlayers.forEach((player) => {
      const wasTraded =
        tradeCtx.wasTradedAwayWithinOneYear?.(player.id, destTeamId) ?? false;

      if (wasTraded) {
        const playerLabel = player.name || player.id || 'player';
        violations.push(
          createIssue(
            'reacquisition',
            `Cannot re-acquire ${playerLabel} within one year of trading them away`,
            'REACQUISITION__ONE_YEAR_TRADE_BACK_BLOCKED',
            null,
            { playerId: player.id || null, destTeamId: destTeamId || null }
          )
        );
      }
    });
  });

  return violations;
}

export function validateReacquisition(
  team: TradeTeam,
  tradeCtx: TeamContext = {}
): ReacquisitionValidationResult {
  const violations = collectAuthoritativeReacquisitionIssues(team, tradeCtx);

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? 'Re-acquisition restriction violation'
        : 'Re-acquisition rules validated',
    details: summarizeValidationIssues(violations),
  };
}
