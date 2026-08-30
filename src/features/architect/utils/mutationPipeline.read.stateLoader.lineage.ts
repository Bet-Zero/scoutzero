/**
 * Wave 48 Step 1: Lineage helpers extracted from mutationPipeline.read.stateLoader.ts
 * (lines 69–345).
 *
 * Exports toLineageOverrideMergeBio, toLineageOverrideMergePlayer,
 * mergeLineageOverrideSalariesByYear, mergeLineageOverridePlayers,
 * CurrentStateWithBasicTeam, CurrentStateWithBasicTeamAndPlayer,
 * CurrentStateWithSigningPair, getSnapshotRosterMembership,
 * getSnapshotPlayersMembership, resolveWorldLineage,
 * getFirstExplicitWorldTeamSnapshotFromLineage,
 * getFirstExplicitWorldPlayerOverrideFromLineage.
 */

import { getDoc } from 'firebase/firestore';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';
import { resolveWorldLineageIdsFromMetadata } from '@/features/architect/utils/worldManager.readUtils';
import {
  worldTeamRef,
  worldPlayerRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import {
  findPlayerInTeamPlayers,
  getMutationRosterEntryId,
  normalizeCurrentStatePlayerSnapshot,
  toCurrentStatePlayer,
  toOptionalIdString,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';
import {
  materializeCurrentStateTeamForAudit,
  toCurrentStateTeam,
} from './mutationPipeline.read.normalizeTeam';
import type {
  LineageOverrideMergePlayer,
  LineageOverrideSalaryRow,
  LooseRecord,
  MutationCurrentStateOfferSheetTeamIngress,
  MutationCurrentStatePlayerIngress,
  MutationSigningTeamLike,
  NormalizedCurrentStatePlayer,
  PlayerLike,
  TeamLike,
} from './mutationPipeline';

export function toLineageOverrideMergeBio(
  bio: NormalizedCurrentStatePlayer['bio']
): LineageOverrideMergePlayer['bio'] | undefined {
  if (!bio || typeof bio !== 'object' || Array.isArray(bio)) {
    return undefined;
  }

  const normalized: NonNullable<LineageOverrideMergePlayer['bio']> = {};
  const playerId = toOptionalIdString(bio.playerId);
  const displayName = toOptionalTrimmedString(bio.displayName);

  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function toLineageOverrideMergePlayer(
  player: unknown
): LineageOverrideMergePlayer {
  const playerRecord = normalizeCurrentStatePlayerSnapshot(player);
  const normalized: LineageOverrideMergePlayer = {};

  if (!playerRecord) {
    return normalized;
  }

  const {
    player_id,
    id,
    playerId,
    teamCode,
    teamName,
    name,
    displayName,
    playerName,
    bio,
    contract,
  } = playerRecord;
  const mergeBio = toLineageOverrideMergeBio(bio);

  if (player_id !== undefined) {
    normalized.player_id = player_id;
  }
  if (id !== undefined) {
    normalized.id = id;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (teamCode !== undefined) {
    normalized.teamCode = teamCode;
  }
  if (teamName !== undefined) {
    normalized.teamName = teamName;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (playerName !== undefined) {
    normalized.playerName = playerName;
  }
  if (mergeBio !== undefined) {
    normalized.bio = mergeBio;
  }
  if (contract !== undefined) {
    normalized.contract = contract;
  }

  return normalized;
}

export function mergeLineageOverrideSalariesByYear(
  baseSalaries: LineageOverrideSalaryRow[] | null | undefined,
  overrideSalaries: LineageOverrideSalaryRow[] | null | undefined
): LineageOverrideSalaryRow[] | undefined {
  if (!overrideSalaries || overrideSalaries.length === 0) {
    return baseSalaries ? [...baseSalaries] : undefined;
  }

  const merged = baseSalaries ? [...baseSalaries] : [];
  overrideSalaries.forEach((override) => {
    const existingIndex = merged.findIndex(
      (salaryRow) => salaryRow.season === override.season
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], ...override };
    } else {
      merged.push(override);
    }
  });

  return merged.sort((first, second) => {
    const firstYear = Number.parseInt(first.season.split('-')[0], 10);
    const secondYear = Number.parseInt(second.season.split('-')[0], 10);
    return firstYear - secondYear;
  });
}

export function mergeLineageOverridePlayers(
  basePlayer: LineageOverrideMergePlayer,
  overridePlayer: LineageOverrideMergePlayer
): LineageOverrideMergePlayer {
  const merged: LineageOverrideMergePlayer = { ...basePlayer };

  if (overridePlayer.contract) {
    merged.contract = {
      ...(basePlayer.contract ?? {}),
      ...overridePlayer.contract,
    };
    const mergedSalaries = mergeLineageOverrideSalariesByYear(
      basePlayer.contract?.salariesByYear,
      overridePlayer.contract.salariesByYear
    );
    if (mergedSalaries) {
      merged.contract.salariesByYear = mergedSalaries;
    }
  }

  if (overridePlayer.bio) {
    merged.bio = {
      ...(basePlayer.bio ?? {}),
      ...overridePlayer.bio,
    };
  }

  Object.entries(overridePlayer).forEach(([key, value]) => {
    if (key !== 'contract' && key !== 'bio') {
      merged[key] = value;
    }
  });

  return merged;
}

export type CurrentStateWithBasicTeam<
  TCurrentState extends { team?: unknown | null },
> = TCurrentState & {
  team: NonNullable<TCurrentState['team']>;
};

export type CurrentStateWithBasicTeamAndPlayer<
  TCurrentState extends { team?: unknown | null; player?: PlayerLike | null },
> = CurrentStateWithBasicTeam<TCurrentState> & {
  player: PlayerLike;
};

export type CurrentStateWithSigningPair<
  TCurrentState extends {
    team?: MutationSigningTeamLike | null;
    player?: PlayerLike | null;
  },
> = TCurrentState & {
  team: MutationSigningTeamLike;
  player: PlayerLike;
};

export function getSnapshotRosterMembership(
  team: TeamLike | null | undefined,
  playerId: string
) {
  const materializedTeam = materializeCurrentStateTeamForAudit(team);
  if (!Array.isArray(materializedTeam?.roster)) {
    return null;
  }

  return materializedTeam.roster.some(
    (entry) => getMutationRosterEntryId(entry) === playerId
  );
}

export function getSnapshotPlayersMembership(
  team: TeamLike | null | undefined,
  playerId: string
) {
  if (!Array.isArray(team?.players)) {
    return {
      playersMatch: null,
      snapshotPlayer: null,
    };
  }

  const snapshotPlayer = findPlayerInTeamPlayers(team, playerId);
  return {
    playersMatch: snapshotPlayer !== null,
    snapshotPlayer,
  };
}

export function getSnapshotCapHoldMembership(
  team: TeamLike | null | undefined,
  playerId: string
) {
  const materializedTeam = materializeCurrentStateTeamForAudit(team);
  if (!Array.isArray(materializedTeam?.capHolds)) {
    return null;
  }

  return materializedTeam.capHolds.some((hold) => {
    if (!hold || typeof hold !== 'object' || Array.isArray(hold)) {
      return false;
    }

    const record = hold as Record<string, unknown>;
    const candidate = toOptionalIdString(
      record.playerId || record.player_id || record.id
    );

    if (candidate !== playerId) {
      return false;
    }

    return record.active !== false && record.isSigned !== true;
  });
}

export async function resolveWorldLineage(worldId: string) {
  return resolveWorldLineageIdsFromMetadata(worldId, getWorldMetadata);
}

export async function getFirstExplicitWorldTeamSnapshotFromLineage(
  lineageWorldIds: string[],
  teamCode: string
) {
  const resolution = await getWorldTeamSnapshotLineageReceipt(
    lineageWorldIds,
    teamCode
  );
  return resolution.source;
}

export async function getWorldTeamSnapshotLineageReceipt(
  lineageWorldIds: string[],
  teamCode: string
) {
  const checkedSnapshots: Array<{
    worldId: string;
    exists: boolean;
    digest: string | null;
  }> = [];
  for (const lineageWorldId of lineageWorldIds) {
    const snapshot = await getDoc(worldTeamRef(lineageWorldId, teamCode));
    const exists = snapshot.exists();
    const snapshotDigest = exists
      ? mutationSnapshotDigest(snapshot.data())
      : null;
    checkedSnapshots.push({
      worldId: lineageWorldId,
      exists,
      digest: snapshotDigest,
    });
    if (exists) {
      const normalizedTeam = toCurrentStateTeam(
        snapshot.data() as MutationCurrentStateOfferSheetTeamIngress | null,
        'offerSheetResolution',
        { containingTeamCode: teamCode, worldLineage: lineageWorldIds }
      );
      if (!normalizedTeam) {
        continue;
      }
      return {
        source: {
          snapshotWorldId: lineageWorldId,
          snapshotDigest,
          team: normalizedTeam,
        },
        checkedSnapshots,
      };
    }
  }

  return { source: null, checkedSnapshots };
}

export async function getFirstExplicitWorldPlayerOverrideFromLineage(
  lineageWorldIds: string[],
  teamCode: string,
  playerId: string
) {
  const resolution = await getWorldPlayerSnapshotLineageReceipt(
    lineageWorldIds,
    teamCode,
    playerId
  );
  return resolution.source;
}

export async function getWorldPlayerSnapshotLineageReceipt(
  lineageWorldIds: string[],
  teamCode: string,
  playerId: string
) {
  const checkedSnapshots: Array<{
    worldId: string;
    exists: boolean;
    digest: string | null;
  }> = [];
  for (const lineageWorldId of lineageWorldIds) {
    const overrideSnapshot = await getDoc(
      worldPlayerRef(lineageWorldId, teamCode, playerId)
    );
    const exists = overrideSnapshot.exists();
    const snapshotDigest = exists
      ? mutationSnapshotDigest(overrideSnapshot.data())
      : null;
    checkedSnapshots.push({
      worldId: lineageWorldId,
      exists,
      digest: snapshotDigest,
    });
    if (exists) {
      const normalizedPlayer = toCurrentStatePlayer(
        overrideSnapshot.data() as MutationCurrentStatePlayerIngress | null
      );
      if (!normalizedPlayer) {
        continue;
      }
      return {
        source: {
          overrideWorldId: lineageWorldId,
          snapshotDigest,
          player: normalizedPlayer,
        },
        checkedSnapshots,
      };
    }
  }

  return { source: null, checkedSnapshots };
}
