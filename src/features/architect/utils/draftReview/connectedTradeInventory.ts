/** Exact-candidate inventory conservation, reached only with an opaque reviewed
 * capability. Legacy underlier uniqueness cannot represent partitioned rights.
 */
import type { DraftReviewCapabilityRecord } from './capability';
import type { ComputeResultLike } from '../mutationPipeline';
import { canonicalStringify } from '../contractSource/deterministicDigest';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
} from '@/constants/collections';

export function validateConnectedTradeInventory(
  review: DraftReviewCapabilityRecord,
  computed: ComputeResultLike
) {
  if (review.scope !== 'governed-world-fixture' || !review.connectedInventory)
    throw new Error('Connected custody requires its reviewed baseline.');
  const root = `${ARCHITECT_WORLDS_COLLECTION}/${review.worldId}/`;
  const read = (collection: string) =>
    Object.fromEntries(
      Object.entries(review.documentSnapshots)
        .filter(
          ([path]) =>
            path.startsWith(`${root}${collection}/`) &&
            path.slice(`${root}${collection}/`.length).split('/').length === 1
        )
        .map(([path, text]) => {
          if (!text) throw new Error('Connected inventory snapshot is absent.');
          return [
            path.slice(`${root}${collection}/`.length),
            JSON.parse(text) as Record<string, unknown>,
          ];
        })
    );
  const entitlements = read(ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION);
  const teams = read(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION);
  const same = (a: unknown, b: unknown) =>
    canonicalStringify(a) === canonicalStringify(b);
  const sorted = (a: string[]) => [...a].sort();
  if (Object.keys(teams).length !== 30)
    throw new Error('All connected counterparties must be retained.');
  const seen = new Set<string>();
  for (const [team, data] of Object.entries(teams)) {
    if (!Array.isArray(data.entitlementIds))
      throw new Error('Connected membership is absent.');
    for (const id of data.entitlementIds) {
      if (
        typeof id !== 'string' ||
        seen.has(id) ||
        entitlements[id]?.holderTeam !== team
      )
        throw new Error(
          'A connected interest is duplicated, missing or held by another team.'
        );
      seen.add(id);
    }
  }
  if (seen.size !== Object.keys(entitlements).length)
    throw new Error('A connected counterparty claim disappeared.');
  const after = Object.fromEntries(
    Object.entries(entitlements).map(([id, e]) => [id, e.holderTeam])
  );
  for (const move of review.movements) {
    if (after[move.entitlementId] !== move.fromTeam)
      throw new Error('Connected interest custody changed.');
    after[move.entitlementId] = move.toTeam;
  }
  if (
    !same(
      sorted(
        (computed.entitlementUpdates ?? []).map(
          (e) => `${e.entitlementId}:${e.holderTeam}`
        )
      ),
      sorted(review.movements.map((m) => `${m.entitlementId}:${m.toTeam}`))
    )
  )
    throw new Error(
      'Computed connected transfers differ from the reviewed interests.'
    );
  const parties = sorted([
    ...new Set(
      [...review.movements, ...(review.playerMovements ?? [])].flatMap((m) => [
        m.fromTeam,
        m.toTeam,
      ])
    ),
  ]);
  if (
    !same(
      sorted((computed.teamUpdates ?? []).map((t) => String(t.teamCode))),
      parties
    )
  )
    throw new Error('Connected trade must update exactly its participants.');
  for (const update of computed.teamUpdates ?? []) {
    if (
      !Array.isArray(update.team?.entitlementIds) ||
      !same(
        sorted(update.team.entitlementIds as string[]),
        sorted(Object.keys(after).filter((id) => after[id] === update.teamCode))
      )
    )
      throw new Error(
        'Computed trade dropped or duplicated an existing connected obligation.'
      );
  }
  return { valid: true as const };
}
