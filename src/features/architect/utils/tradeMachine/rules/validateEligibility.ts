import { validationFlags } from '@/config/validationFlags.js';
import {
  EligibilityValidationResult,
  TeamContext,
  TradeExceptionPlayer,
  TradeTeam,
  ValidationIssue,
} from '../constants/types';
import { summarizeValidationIssues } from '../utils/validationIssueText';
import { collectEligibilityReacquisitionIssues } from './validateReacquisition';

interface EligibilityPlayer extends TradeExceptionPlayer {
  isTwoWay?: boolean;
  contractType?: string;
  contract?: {
    contractType?: string;
    isTwoWay?: boolean;
    [key: string]: unknown;
  };
}

interface EnforcementCallbacks {
  warn?: (message: string) => void;
  reject?: (message: string) => void;
}

function createIssue(
  message: string,
  code: string,
  details: string | null = null,
  meta: Record<string, unknown> | null = null
): ValidationIssue {
  return {
    message,
    severity: 'error',
    rule: 'eligibility',
    code,
    details,
    meta,
  };
}

function isTwoWayPlayer(player: EligibilityPlayer | null | undefined): boolean {
  if (!player) return false;
  if (player.isTwoWay === true) return true;
  if (player.contractType?.toLowerCase() === 'two-way') return true;
  if (player.contract?.contractType?.toLowerCase() === 'two-way') return true;
  if (player.contract?.isTwoWay === true) return true;
  return false;
}

export function validateEligibility(
  team: TradeTeam,
  tradeCtx: TeamContext = {}
): EligibilityValidationResult {
  const violations: ValidationIssue[] = [];
  const outgoingPlayers = Array.isArray(team.sends)
    ? (team.sends as EligibilityPlayer[])
    : Array.isArray(team.outgoingPlayers)
      ? (team.outgoingPlayers as EligibilityPlayer[])
      : [];

  outgoingPlayers.forEach((player) => {
    if (isTwoWayPlayer(player)) {
      violations.push(
        createIssue(
          `Two-way contract: ${player.name || 'Player'} cannot be traded. Two-way players must be waived, not traded.`,
          'ELIGIBILITY__TWO_WAY_PLAYER_BLOCKED',
          null,
          { playerName: player.name || 'Player' }
        )
      );
    }
  });

  violations.push(...collectEligibilityReacquisitionIssues(team, tradeCtx));

  return {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? 'Player eligibility restrictions in effect'
        : 'Player eligibility validated',
    details: summarizeValidationIssues(violations),
  };
}

export function enforceEligibility(
  team: TradeTeam,
  tradeCtx: TeamContext = {},
  callbacks: EnforcementCallbacks = {}
): string[] {
  const enforcement = validationFlags.reAcquisition || validationFlags.eligibility;
  const result = validateEligibility(team, tradeCtx);
  const violations = result.violations.map((issue) => issue.message);

  violations.forEach((message) => {
    if (enforcement === 'warn') {
      (callbacks.warn || (() => {}))(message);
      return;
    }

    (callbacks.reject || (() => {}))(message);
  });

  return violations;
}
