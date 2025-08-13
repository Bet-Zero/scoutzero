import {
  hasFullNTC,
  destinationRequiresLimitedNTCConsent,
  birdRightsVetoApplies,
  requiresConsent,
  hasConsent,
} from '@/utils/architect/consentUtils.js';
import { validationFlags } from '@/config/validationFlags.js';
import debug from '../debug.js';

export function validateConsent(team) {
  const violations = [];

  // Check each outgoing player
  (team.sends || []).forEach((player) => {
    // Full no-trade clause
    if (hasFullNTC(player) && !hasConsent(player)) {
      violations.push(
        `${player.name || 'Player'} has a full no-trade clause and must consent`
      );
    }

    // Limited no-trade clause
    if (
      destinationRequiresLimitedNTCConsent(player, team.team?.id) &&
      !hasConsent(player)
    ) {
      violations.push(
        `${player.name || 'Player'} has not waived their limited no-trade clause for ${team.teamName}`
      );
    }

    // Bird rights one-year deal veto
    if (birdRightsVetoApplies(player, team.team?.id) && !hasConsent(player)) {
      violations.push(
        `${player.name || 'Player'} has Bird rights veto power and must consent`
      );
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Player consent required'
      : 'Player consent validated',
    details: violations.join('; '),
  };
}

export function enforceConsent(
  team,
  { warn = () => {}, reject = () => {} } = {}
) {
  const violations = [];
  const enforcement = validationFlags.consent;

  if (debug.enabled) {
    debug.log(`✋ Trade Consent – ${team.teamName}`, {
      players: (team.sends || []).map((p) => p.name),
    });
  }

  (team.sends || []).forEach((player) => {
    if (requiresConsent(player, team.team?.id) && !hasConsent(player)) {
      const msg = `${player.name || 'Player'} must consent to trade`;
      violations.push(msg);
      if (enforcement === 'warn') {
        warn(msg);
      } else {
        reject(msg);
      }
    }
  });

  return violations;
}
