/** Load immutable source and the exact mutable world read set. No writes. */
import {
  isGovernedDraftFixtureEnvironment,
  isSimulationDraftLiveEnabled,
} from '@/firebaseConfig';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  ARCHITECT_WORLD_DRAFT_BASELINES_SUBCOLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
} from '@/constants/collections';
import { worldMetadataRef } from './architectFirestorePaths';
import { GOVERNED_DRAFT_WORLD_FIXTURE_PIN as pin } from './governedDraftWorldPin';
import {
  validateGovernedDraftBaseline,
  governedDraftHolders,
} from './governedDraftWorld.baseline';
import {
  canonicalStringify,
  sha256Digest,
} from './contractSource/deterministicDigest';
import { mutationSnapshotText } from './mutationPipeline.snapshotDigest';
import { requireDraftInventoryRevision } from './draftReview/inventoryFence';
import { DraftReviewMutationReceiptZ } from '@/schemas/draftPickReviewMutation';
import { worldPlayerRef } from './architectFirestorePaths';
import type { TradeContextCurrentState } from './tradeContext/types';
import { retainDraftPersistenceSource } from './tradeContext/draftFinancialPersistence';

type LoadedDraftWorld = NonNullable<
  Awaited<ReturnType<typeof loadGovernedDraftWorld>>
>;
const loadedTeams = new WeakMap<object, LoadedDraftWorld>();
export function attachGovernedDraftWorldTeams(
  state: TradeContextCurrentState,
  loaded: LoadedDraftWorld
) {
  for (const { teamCode, team } of state.teams) {
    const raw = loaded.teams[String(teamCode)];
    if (!raw)
      throw new Error('A participating team has no local governed snapshot.');
    team.entitlements = Array.isArray(raw.entitlementIds)
      ? raw.entitlementIds
          .map((id) => loaded.entitlements[String(id)])
          .filter(Boolean)
      : [];
    retainDraftPersistenceSource(team, raw);
    loadedTeams.set(team, loaded);
  }
}
export function getLoadedGovernedDraftWorld(state: TradeContextCurrentState) {
  const loaded = state.teams[0] && loadedTeams.get(state.teams[0].team);
  if (loaded && state.teams.some((t) => loadedTeams.get(t.team) !== loaded))
    throw new Error('The governed draft world read set changed.');
  return loaded;
}

type DraftCopy = {
  parentWorldId: string;
  receiptWorldIds: Record<string, unknown>;
};
function draftCopyOf(metadata: Record<string, unknown>): DraftCopy | null {
  const copy = metadata.draftCopy as Partial<DraftCopy> | null | undefined;
  return copy != null &&
    typeof copy === 'object' &&
    typeof copy.parentWorldId === 'string' &&
    copy.receiptWorldIds != null &&
    typeof copy.receiptWorldIds === 'object'
    ? (copy as DraftCopy)
    : null;
}
/**
 * A world is either its own root, or a server-made copy of a SIMULATION world
 * whose recorded parent is its actual parent (V1 item A6).
 */
export function copiedLineageMatches(
  metadata: Record<string, unknown>,
  classification: string
) {
  if (metadata.parentWorldId == null) return metadata.draftCopy == null;
  const copy = draftCopyOf(metadata);
  return (
    classification === 'simulation' &&
    copy !== null &&
    copy.parentWorldId === metadata.parentWorldId
  );
}
/** A copied transfer keeps the receipt of the world that committed it. */
export function receiptWorldId(
  metadata: Record<string, unknown>,
  worldId: string,
  operationId: string
) {
  const receipts = draftCopyOf(metadata)?.receiptWorldIds;
  if (!receipts || !Object.hasOwn(receipts, operationId)) return worldId;
  const owner = receipts[operationId];
  return typeof owner === 'string' && owner !== '' ? owner : null;
}

function playerIdentity(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return undefined;
  const p = value as Record<string, unknown>;
  return p.player_id ?? p.playerId ?? p.id;
}

/**
 * Software draft fixtures run only in the local emulator. A SIMULATION world
 * may also run where the D2 live switch is on (off by default).
 */
export function governedDraftWorldAvailable(classification: unknown) {
  return (
    isGovernedDraftFixtureEnvironment() ||
    (classification === 'simulation' && isSimulationDraftLiveEnabled())
  );
}

export async function loadGovernedDraftWorld(
  worldId: string,
  participatingTeamCodes: readonly string[] = []
) {
  const ref = worldMetadataRef(worldId);
  const metadataSnapshot = await getDoc(ref);
  const metadata = metadataSnapshot.data();
  if (!metadata?.draftBaseline) return null;
  if (!governedDraftWorldAvailable(metadata.draftBaseline?.classification))
    throw new Error('No qualified production draft baseline is active.');
  const sourceRef = doc(
    ref,
    ARCHITECT_WORLD_DRAFT_BASELINES_SUBCOLLECTION,
    'root'
  );
  const source = await getDoc(sourceRef);
  if (!source.exists() || source.data().worldId !== worldId)
    throw new Error(
      'The immutable draft baseline is missing or belongs to another world.'
    );
  const baseline = validateGovernedDraftBaseline(source.data().release);
  const digest = (await sha256Digest(canonicalStringify(baseline))).slice(7);
  // A SIMULATION baseline is private, so its identity is the server-written,
  // client-immutable world metadata rather than a source-code pin.
  const expected =
    metadata.draftBaseline?.classification === 'simulation'
      ? {
          releaseId: String(metadata.draftBaseline.releaseId),
          sha256: String(metadata.draftBaseline.sha256),
          classification: 'simulation' as const,
        }
      : pin;
  if (
    digest !== expected.sha256 ||
    baseline.releaseId !== expected.releaseId ||
    baseline.classification !== expected.classification ||
    canonicalStringify(metadata.draftBaseline) !==
      canonicalStringify({
        version: 1,
        ...expected,
        asOf: baseline.asOf,
        seasonId: baseline.seasonId,
      }) ||
    metadata.asOfDate !== baseline.asOf.slice(0, 10) ||
    metadata.currentSeason !== baseline.seasonId ||
    !copiedLineageMatches(metadata, expected.classification)
  )
    throw new Error(
      'The saved world has no matching active draft source and date.'
    );
  requireDraftInventoryRevision(metadata);
  const { holders, transfers } = governedDraftHolders(
    baseline,
    metadata.draftWorldTransfers
  );
  const documentSnapshots: Record<string, string | null> = {
    [ref.path]: mutationSnapshotText(metadata),
    [sourceRef.path]: mutationSnapshotText(source.data()),
  };
  // Each mutable custody entry must have its matching immutable committed receipt.
  for (const transfer of transfers) {
    const eventRef = doc(
      ref,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
      `draft_world_${transfer.operationId}`
    );
    const event = await getDoc(eventRef);
    const receipt = DraftReviewMutationReceiptZ.safeParse(
      event.data()?.metadata?.draftReviewReceipt
    );
    if (
      !event.exists() ||
      event.data()?.valid !== true ||
      !receipt.success ||
      receipt.data.scope !== 'governed-world-fixture' ||
      receipt.data.worldId !==
        receiptWorldId(metadata, worldId, transfer.operationId) ||
      receipt.data.releaseId !== expected.releaseId ||
      receipt.data.releaseSha256 !== digest ||
      receipt.data.operationId !== transfer.operationId ||
      receipt.data.asOfDate !== transfer.asOfDate ||
      receipt.data.assumptions != null ||
      receipt.data.assumptionSha256 != null ||
      receipt.data.playerMovements != null ||
      canonicalStringify(receipt.data.movements) !==
        canonicalStringify(
          transfer.movements.map((m) => {
            const record = baseline.records.find(
              (r) => r.entitlement.id === m.entitlementId
            );
            if (!record)
              throw new Error(
                'Custody receipt includes an unadmitted identity.'
              );
            return {
              ...m,
              originalTeam: record.ownership.pick.originalTeam,
              year: record.ownership.pick.draftYear,
              round: 1,
            };
          })
        )
    )
      throw new Error(
        'Draft custody history has no matching committed receipt.'
      );
    documentSnapshots[eventRef.path] = mutationSnapshotText(event.data());
  }
  const [teamDocs, rightDocs] = await Promise.all([
    getDocs(collection(ref, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION)),
    getDocs(collection(ref, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)),
  ]);
  const teams: Record<string, Record<string, unknown>> = {};
  const entitlements: Record<string, Record<string, unknown>> = {};
  for (const snapshot of teamDocs.docs) {
    teams[snapshot.id] = snapshot.data();
    documentSnapshots[snapshot.ref.path] = mutationSnapshotText(
      snapshot.data()
    );
    // Inventory views and non-participants need custody, not a certified book.
    // Only trading teams contribute financial state to this mutation.
    if (!participatingTeamCodes.includes(snapshot.id)) continue;
    const players = snapshot.data().players;
    // Software fixtures store roster identities; SIMULATION worlds store the
    // roster as player records. Either way each identity is one player.
    const rawRoster = snapshot.data().roster;
    const roster = Array.isArray(rawRoster)
      ? rawRoster.map((entry) =>
          typeof entry === 'string' ? entry : playerIdentity(entry)
        )
      : null;
    if (
      !roster ||
      !Array.isArray(players) ||
      roster.some((id) => typeof id !== 'string' || id === '') ||
      new Set(roster).size !== roster.length ||
      players.length !== roster.length ||
      roster.some(
        (id) => players.filter((p) => playerIdentity(p) === id).length !== 1
      )
    )
      throw new Error(
        'Governed draft trading requires a complete local roster and financial snapshot.'
      );
    if (Array.isArray(roster)) {
      for (const playerId of roster) {
        if (typeof playerId !== 'string')
          throw new Error('Governed roster identity is invalid.');
        const playerRef = worldPlayerRef(worldId, snapshot.id, playerId);
        const player = await getDoc(playerRef);
        // An ordinary trade writes the moved player's override beside the
        // team mirror. It is admitted only while it agrees with that mirror;
        // a divergent override would shadow the financial snapshot.
        const mirrored = players.find((p) => playerIdentity(p) === playerId);
        if (
          player.exists() &&
          (player.data().teamCode !== snapshot.id ||
            canonicalStringify(player.data().contract ?? null) !==
              canonicalStringify(
                (mirrored as Record<string, unknown> | undefined)?.contract ??
                  null
              ))
        )
          throw new Error(
            'Governed draft trading requires a reconciled local financial snapshot without shadowing player overrides.'
          );
        documentSnapshots[playerRef.path] = player.exists()
          ? mutationSnapshotText(player.data())
          : null;
      }
    }
  }
  for (const snapshot of rightDocs.docs) {
    entitlements[snapshot.id] = snapshot.data();
    documentSnapshots[snapshot.ref.path] = mutationSnapshotText(
      snapshot.data()
    );
  }
  if (
    Object.keys(entitlements).length !== baseline.identities.length ||
    Object.values(teams).some(
      (team) =>
        Array.isArray(team.entitlementIds) &&
        (new Set(team.entitlementIds).size !== team.entitlementIds.length ||
          team.entitlementIds.some(
            (id) => !baseline.identities.includes(String(id))
          ))
    )
  )
    throw new Error(
      'Saved draft inventory differs from the full retained identity set.'
    );
  for (const id of baseline.identities) {
    const entitlement = baseline.retainedEntitlements[id];
    const held = entitlements[id];
    if (
      !held ||
      canonicalStringify(held) !==
        canonicalStringify({ ...entitlement, holderTeam: holders[id] })
    )
      throw new Error(
        'Saved draft identity, custody or terms differ from the governed history.'
      );
    const memberships = Object.entries(teams).filter(
      ([, team]) =>
        Array.isArray(team.entitlementIds) && team.entitlementIds.includes(id)
    );
    if (memberships.length !== 1 || memberships[0][0] !== holders[id])
      throw new Error(
        'Saved draft membership differs from the governed custody.'
      );
  }
  return {
    baseline,
    metadata,
    holders,
    transfers,
    teams,
    entitlements,
    documentSnapshots,
    digest,
  };
}
