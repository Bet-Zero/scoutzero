import { validationFlags } from '@/config/validationFlags.js';
import { collectConsentViolations } from '@/utils/architect/consentUtils.js';

export function enforceConsent(
  teamCtx,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const enforcement = validationFlags.consent;
  const violations = [];
  const consentMap = tradeCtx.consent || {};
  const seen = new Set();

  (teamCtx.outgoingPlayers || []).forEach((p) => {
    // Enhanced destination team determination for 2-team trades
    let destId = p.tradeTo ?? p.toTeamId;

    // If not explicitly set, try to infer from trade context
    if (!destId) {
      // Method 1: Use teamNames if available
      const teamNames = tradeCtx.teamNames || {};
      const otherTeamIds = Object.keys(teamNames).filter(
        (id) => id !== teamCtx.teamId
      );
      if (otherTeamIds.length === 1) {
        destId = otherTeamIds[0];
      }

      // Method 2: For 2-team trades, get the other team ID
      if (!destId && tradeCtx.teams && tradeCtx.teams.length === 2) {
        const currentTeamId = teamCtx.teamId || teamCtx.team?.id;
        const otherTeam = tradeCtx.teams.find(
          (t) => (t.team?.id || t.id) !== currentTeamId
        );
        if (otherTeam) {
          destId = otherTeam.team?.id || otherTeam.id;
        }
      }
    }

    const consent = consentMap[p.id] || {};
    const msgs = collectConsentViolations(p, destId, consent, { reject });
    msgs.forEach((msg) => {
      if (!seen.has(msg)) {
        violations.push(msg);
        seen.add(msg);
        if (enforcement === 'warn') warn(msg);
      }
    });
  });

  return violations;
}
