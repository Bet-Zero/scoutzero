/** Keep materialized player views aligned with a protected season's team snapshot. */
import { getDoc, type Transaction } from 'firebase/firestore';
import { worldPlayerRef } from '@/features/architect/utils/architectFirestorePaths';
import { mutationSnapshotText } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import type { PreparedSeasonAdvanceTeam } from '@/features/architect/utils/seasonManager.history';

type RecordValue = Record<string, unknown>;
const playerId = (player: RecordValue) => {
  const id = player.player_id ?? player.playerId ?? player.id;
  if (typeof id !== 'string' || !id.trim())
    throw new Error(
      'Season player publication requires a stable player identity.'
    );
  return id;
};
const players = (team: RecordValue) => {
  const values = Array.isArray(team.players) ? team.players : [];
  if (
    !values.every(
      (value): value is RecordValue =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
    )
  )
    throw new Error(
      'Season player publication requires complete player records.'
    );
  return values;
};

export async function prepareSeasonPlayerOverrides(
  worldId: string,
  teams: PreparedSeasonAdvanceTeam[]
) {
  return Promise.all(
    teams.flatMap((team) =>
      players(team.committedTeam).map(async (player) => {
        const id = playerId(player);
        const ref = worldPlayerRef(worldId, team.teamCode, id);
        const snapshot = await getDoc(ref);
        const before = snapshot.exists() ? snapshot.data() : null;
        const priorPlayer = players(team.beforeTeam).find(
          (value) => playerId(value) === id
        );
        if (
          before &&
          Object.hasOwn(before, 'contract') &&
          mutationSnapshotText(before.contract) !==
            mutationSnapshotText(priorPlayer?.contract)
        )
          throw new Error(
            `Saved player Contract for ${team.teamCode}/${id} conflicts with the pre-season team. Reload and resolve it before advancing.`
          );
        return {
          ref,
          before: before ? mutationSnapshotText(before) : null,
          // Preserve override-only user fields. Do not manufacture overrides for
          // every source player; absent documents still join the stale-state fence.
          after: before
            ? {
                ...before,
                ...(player.contract !== undefined
                  ? { contract: player.contract }
                  : {}),
              }
            : null,
        };
      })
    )
  );
}

type PlayerOverridePlan = Awaited<
  ReturnType<typeof prepareSeasonPlayerOverrides>
>;

export async function assertSeasonPlayerOverridesCurrent(
  transaction: Transaction,
  plan: PlayerOverridePlan
) {
  const snapshots = await Promise.all(
    plan.map((entry) => transaction.get(entry.ref))
  );
  for (const [i, snapshot] of snapshots.entries()) {
    const actual = snapshot.exists()
      ? mutationSnapshotText(snapshot.data())
      : null;
    if (actual !== plan[i].before)
      throw new Error(
        'Stale/concurrent player override detected before Season Advance commit.'
      );
  }
}

export function writeSeasonPlayerOverrides(
  transaction: Transaction,
  plan: PlayerOverridePlan
) {
  for (const entry of plan)
    if (entry.after) transaction.set(entry.ref, entry.after);
}

export async function confirmSeasonPlayerOverrides(plan: PlayerOverridePlan) {
  await Promise.all(
    plan
      .filter((entry) => entry.after)
      .map(async (entry) => {
        const saved = await getDoc(entry.ref);
        if (
          !saved.exists() ||
          mutationSnapshotText(saved.data()) !==
            mutationSnapshotText(entry.after)
        )
          throw new Error(
            'Season Advance committed, but player override reload verification diverged.'
          );
      })
  );
}
