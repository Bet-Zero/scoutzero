/**
 * FILE: src/features/ranker/utils/seasonInLeague.ts
 * PURPOSE: Which season in the league a player was in for a given season (1 = rookie), from draft year or years pro
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-31: Created for the pool finder's experience column
 *
 * LINKS:
 *  - Same rule as the profile header: src/features/profile/PlayerDetails/PlayerHeader/index.tsx (formatProfileYearsPro)
 *  - Used in: src/features/ranker/hooks/usePoolFinder.ts
 */
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

// Player records carry these on bio, though not every player type declares them
type ExperienceBio = {
  draft?: { year?: unknown } | null;
  display?: { yearsPro?: unknown } | null;
} | null | undefined;

const toInt = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(n) ? n : null;
};

// Years pro on record is for the current season; more than this is bad data
const MAX_YEARS_PRO = 30;

/**
 * The player's season number in the league during `seasonCode` ("2026-27"):
 * 1 for a rookie, 2 for a second-year player. Like the profile: the years
 * pro on record, unless it's missing or more than one off what the draft
 * year gives (then the draft year). Null when neither is known or the player
 * hadn't arrived yet.
 */
export const seasonInLeague = (
  player: { bio?: unknown } | null | undefined,
  seasonCode: string,
  currentSeasonStartYear: number = DEFAULT_SALARY_YEAR
): number | null => {
  const startYear = Number.parseInt(seasonCode.slice(0, 4), 10);
  if (!Number.isFinite(startYear)) return null;
  const bio = player?.bio as ExperienceBio;
  const draftYear = toInt(bio?.draft?.year);
  const yearsPro = toInt(bio?.display?.yearsPro);
  const recorded =
    yearsPro !== null && yearsPro >= 0 && yearsPro <= MAX_YEARS_PRO
      ? yearsPro - (currentSeasonStartYear - startYear)
      : null;
  const fromDraft = draftYear !== null && draftYear > 1900 ? startYear - draftYear : null;
  const yearsIn =
    fromDraft !== null && (recorded === null || Math.abs(recorded - fromDraft) > 1)
      ? fromDraft
      : recorded;
  return yearsIn !== null && yearsIn >= 0 ? yearsIn + 1 : null;
};
