/**
 * FILE: scripts/dev/rankerScore.ts
 * PURPOSE: Compute each player's Player Ranker Top-N score during the stats refresh so the app can read it off the main player record
 * OWNERSHIP: Operations tooling (NBA maintenance pipeline)
 * HISTORY: 2026-10-22 — Created; scores use the app's formula (src/features/ranker/utils/playerImpact.ts)
 * LINKS: scripts/dev/cloudPipeline.ts (preparePlayer); scripts/dev/maintenanceStats.ts (planStatistics); src/schemas/players_v2.ts (RankerScoreZ)
 */
import {
  earlierSeasonCodes,
  RANKER_SCORE_FORMULA_VERSION,
  rankerScoreFromSeasons,
  type ImpactStatLine,
} from '../../src/features/ranker/utils/playerImpact.js';
import { RankerScoreZ, type RankerScore } from '../../src/schemas/players_v2.js';

type StagedPlayer = {
  doc?: { currentSeasonStats?: ImpactStatLine | null };
  seasons?: Record<string, { stats?: ImpactStatLine | null } | undefined>;
  // The run brought this player's stats, so a stored current line it omits is being cleared
  statsProvided?: boolean;
};

// Decoded fields of a document in the run's database copy, or null if absent
export type ReadSnapshotDoc = (path: string) => Record<string, unknown> | null;

const asStatLine = (value: unknown): ImpactStatLine | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ImpactStatLine) : null;

/**
 * The player's score for `season` (the season being refreshed), from this
 * run's staged seasons where present and the database copy otherwise. A
 * missing current-season record falls back to the main record's current
 * stats, exactly like the app, unless this run is replacing them.
 */
export function rankerScoreFromSnapshot(
  readDoc: ReadSnapshotDoc,
  playerId: string,
  staged: StagedPlayer,
  season: string
): RankerScore {
  const seasonLine = (code: string): ImpactStatLine | null => {
    const fromRun = asStatLine(staged.seasons?.[code]?.stats);
    if (fromRun) return fromRun;
    return asStatLine(readDoc(`players_v2/${playerId}/seasons/${code}`)?.stats);
  };
  const current =
    seasonLine(season) ??
    asStatLine(staged.doc?.currentSeasonStats) ??
    (staged.statsProvided ? null : asStatLine(readDoc(`players_v2/${playerId}`)?.currentSeasonStats));
  const value = rankerScoreFromSeasons(current, earlierSeasonCodes(season).map(seasonLine), {
    isCurrentSeason: true,
  });
  return RankerScoreZ.parse({ value, season, formulaVersion: RANKER_SCORE_FORMULA_VERSION });
}
