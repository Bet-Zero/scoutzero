import { validationFlags } from '@/config/validationFlags.js';
import { hasConsent } from '@/features/architect/utils/consentUtils.js';
import { TeamContext, TradeExceptionPlayer, TradeTeam } from '../constants/types';

interface ConsentEnforcementPlayer extends TradeExceptionPlayer {
  hasFullNTC?: boolean;
  noTradeClause?: boolean;
  hasFullNoTrade?: boolean;
  limitedNTCTeamIds?: Array<string | number>;
  tradeTo?: string | number | null;
  onOneYearBirdDeal?: boolean;
  hasBirdRightsVeto?: boolean;
  consentGranted?: boolean;
}

interface EnforcementCallbacks {
  warn?: (message: string) => void;
  reject?: (message: string) => void;
}

function emitViolation(
  message: string,
  enforcement: string,
  violations: string[],
  callbacks: EnforcementCallbacks
): void {
  violations.push(message);
  if (enforcement === 'warn') {
    (callbacks.warn || (() => {}))(message);
    return;
  }

  (callbacks.reject || (() => {}))(message);
}

export function enforceConsent(
  team: TradeTeam,
  _context: TeamContext = {},
  callbacks: EnforcementCallbacks = {}
): string[] {
  const outgoingPlayers = Array.isArray(team.outgoingPlayers)
    ? (team.outgoingPlayers as ConsentEnforcementPlayer[])
    : [];
  const incomingPlayers = Array.isArray(team.incomingPlayers)
    ? (team.incomingPlayers as ConsentEnforcementPlayer[])
    : [];
  const enforcement = validationFlags.consent || 'error';
  const violations: string[] = [];

  outgoingPlayers.forEach((player) => {
    let violationMsg: string | null = null;

    if ((player.hasFullNTC || player.noTradeClause) && !hasConsent(player)) {
      violationMsg = 'Player NTC — consent required';
    }

    if (Array.isArray(player.limitedNTCTeamIds)) {
      if (
        player.tradeTo &&
        !player.limitedNTCTeamIds.includes(player.tradeTo) &&
        !hasConsent(player)
      ) {
        violationMsg = 'Player NTC — consent required';
      }
    }

    if (player.onOneYearBirdDeal && !hasConsent(player)) {
      violationMsg = '1-yr Bird veto — consent required';
    }

    if (violationMsg) {
      emitViolation(violationMsg, enforcement, violations, callbacks);
    }
  });

  incomingPlayers.forEach((player) => {
    let violationMsg: string | null = null;

    if ((player.hasFullNTC || player.hasFullNoTrade) && !hasConsent(player)) {
      violationMsg = `${player.name} has not waived their no-trade clause`;
    }

    if (Array.isArray(player.limitedNTCTeamIds)) {
      if (!player.limitedNTCTeamIds.includes(team.teamId || '') && !hasConsent(player)) {
        violationMsg = `${player.name} has not approved a trade to ${team.teamName}`;
      }
    }

    if ((player.hasBirdRightsVeto || player.onOneYearBirdDeal) && !hasConsent(player)) {
      violationMsg = `${player.name} has not waived their Bird rights veto`;
    }

    if (violationMsg) {
      emitViolation(violationMsg, enforcement, violations, callbacks);
    }
  });

  return violations;
}
