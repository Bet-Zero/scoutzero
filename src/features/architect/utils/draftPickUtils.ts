/**
 * FILE: src/features/architect/utils/draftPickUtils.ts
 * PURPOSE: Frozen-pick detection utility for second-apron draft asset rules.
 * OWNERSHIP: Feature: architect/draft-assets
 */

interface DraftPick {
  round?: number | string;
  year?: number | string;
  originalTeam?: string;
  originalTeamId?: string;
  teamId?: string;
}

interface FrozenPickOptions {
  currentSeason?: number | string;
  teamIsSecondApron?: boolean;
  teamId?: string;
}

const toNumericYear = (value: number | string | null | undefined): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isFirstRoundPick = (round: number | string | undefined): boolean =>
  round === 1 || round === '1st' || round === 'first';

const isOwnPick = (pick: DraftPick, teamId: string | undefined): boolean => {
  if (teamId == null) return true;

  return (
    pick?.originalTeam === teamId ||
    pick?.originalTeamId === teamId ||
    pick?.teamId === teamId
  );
};

export function isFrozenPick(pick: DraftPick | null | undefined, options: FrozenPickOptions = {}): boolean {
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
