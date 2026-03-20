/**
 * FILE: src/features/architect/utils/draftPickUtils.js
 * PURPOSE: Compatibility surface for frozen-pick guardrail tests and legacy imports.
 * OWNERSHIP: Feature: architect/draft-assets
 *
 * HISTORY:
 *  - 2026-03-20: Restored as a small JS compatibility utility during Architect type-hardening follow-up.
 */

const toNumericYear = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isFirstRoundPick = (round) =>
  round === 1 || round === '1st' || round === 'first';

const isOwnPick = (pick, teamId) => {
  if (teamId == null) return true;

  return (
    pick?.originalTeam === teamId ||
    pick?.originalTeamId === teamId ||
    pick?.teamId === teamId
  );
};

export function isFrozenPick(pick, options = {}) {
  const currentYear = toNumericYear(options.currentSeason);
  const pickYear = toNumericYear(pick?.year);

  if (!pick || !options.teamIsSecondApron) return false;
  if (currentYear == null || pickYear == null) return false;

  const yearsOut = pickYear - currentYear;
  return (
    isFirstRoundPick(pick.round) &&
    yearsOut >= 7 &&
    isOwnPick(pick, options.teamId)
  );
}

export default { isFrozenPick };
