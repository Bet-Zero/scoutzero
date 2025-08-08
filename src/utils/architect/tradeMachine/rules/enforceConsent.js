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
    const destId =
      p.tradeTo ??
      p.toTeamId ??
      Object.keys(tradeCtx.teamNames || {}).find((id) => id !== teamCtx.teamId);
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
