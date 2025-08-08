import { wouldExceedHardCap } from '@/utils/architect/tradeHelpers.js';

export function validateSignAndTrade(team, tradeCtx = {}) {
  const violations = [];
  const sntIn = team.incomingPlayers.filter(
    (p) => p.isSignAndTrade || p.signAndTrade
  );
  const sntOut = team.sends.filter((p) => p.signAndTrade);
  const anySnt = sntIn.length > 0 || sntOut.length > 0;

  if (!anySnt) return violations;

  if (tradeCtx.offseason === false) {
    violations.push('Sign-and-trade only permitted in offseason');
  }

  if (sntOut.length > 0) {
    if (sntOut.length > 0 && (team.sends.length > 1 || team.picksOut.length)) {
      violations.push('Sign-and-trade player must be traded alone');
    }
    sntOut.forEach((p) => {
      const teamId = team.team?.id ?? team.teamId;
      if (p.originTeamId && p.originTeamId !== teamId) {
        violations.push(
          "Sign-and-trade must be executed by player's original team"
        );
      }
    });
  }

  if (sntIn.length > 0) {
    if (
      team.usedTaxpayerMLEThisSeason ||
      team.team?.usedTaxpayerMLEThisSeason
    ) {
      violations.push(
        'Teams using taxpayer MLE cannot receive sign-and-trade players'
      );
    }
    if (
      wouldExceedHardCap(
        { hardCapTriggered: 'FirstApron' },
        team.projectedSalary,
        team.context.capSettings
      )
    ) {
      violations.push('Sign-and-trade would hard-cap team at 1st apron');
    }
    team.hardCapped = true;
    if (team.team) team.team.hardCapTriggered = true;
    sntIn.forEach((p) => {
      const years = p.contractYears ?? p.years ?? 0;
      if (years < 3 || years > 4) {
        violations.push(`S&T contract for ${p.name} must be 3-4 years`);
      }
      if (p.firstYearGuaranteed === false) {
        violations.push(`First year of ${p.name}'s deal must be guaranteed`);
      }
    });
  }

  return violations;
}
