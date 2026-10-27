import { DraftConditionalReceiptZ } from '@/schemas/draftConditionalReceipt';
/** Draft transition owned by Season Manager; no source writes or production authority. */
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import {
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';
import { loadConditionalWorld } from './draftReview/conditionalWorld';
import {
  activeConditionalStage,
  conditionalProtectionLadder,
  resolveConditionalDraft,
} from './draftReview/conditionalProgram';
import {
  retainedSimulationEntitlement,
  assertSimulationInventory,
} from './draftReview/simulationInventory';
import { mutationSnapshotText } from './mutationPipeline.snapshotDigest';
import {
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
} from './persistenceContracts';

export async function advanceConditionalDraftInWorld(
  worldId: string,
  request: {
    operationId: string;
    expectedRevision: number;
    draftYear: number;
    positions: Record<string, number>;
  }
) {
  if (
    !isSyntheticDraftReviewEnvironment() ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(request.operationId)
  )
    throw new Error('An exact protected draft operation is required.');
  const state = await loadConditionalWorld(worldId);
  const { metadata, programs, entitlements, teams } = state;
  if (
    state.revision !== request.expectedRevision ||
    metadata.currentSeason !==
      `${request.draftYear - 1}-${String(request.draftYear % 100).padStart(2, '0')}`
  )
    throw new Error(
      'The draft operation is stale or belongs to another season.'
    );
  const calendar = metadata.draftSimulationCalendar;
  if (
    !Array.isArray(calendar) ||
    calendar.filter((c) => c.year === request.draftYear).length !== 1
  )
    throw new Error('The governed test draft date is missing or conflicting.');
  const date = calendar.find((c) => c.year === request.draftYear)?.date;
  if (
    typeof date !== 'string' ||
    !new RegExp(`^${request.draftYear}-06-(0[1-9]|[12][0-9]|30)$`).test(date) ||
    date < metadata.asOfDate
  )
    throw new Error(
      'The draft date must advance this test world without changing seasons.'
    );
  const due = programs.filter(
    (p) => activeConditionalStage(p)?.year === request.draftYear
  );
  if (
    !due.length ||
    programs.some(
      (p) => (activeConditionalStage(p)?.year ?? Infinity) < request.draftYear
    ) ||
    mutationSnapshotText(Object.keys(request.positions).sort()) !==
      mutationSnapshotText(
        [...new Set(due.map((p) => p.originalTeam))].sort()
      ) ||
    new Set(Object.values(request.positions)).size !==
      Object.values(request.positions).length
  )
    throw new Error(
      'Supply exactly the due draft positions without duplicates or skipped obligations.'
    );
  const updated = programs.map((p) =>
    due.includes(p)
      ? resolveConditionalDraft(p, request.positions[p.originalTeam])
      : p
  );
  const nextEntitlements = structuredClone(entitlements);
  const lines: string[] = [];
  const affected = new Set<string>();
  for (const program of due) {
    const stage = activeConditionalStage(program)!;
    const beneficiary = String(entitlements[stage.entitlementId].holderTeam);
    const nextProgram = updated.find((p) => p.id === program.id)!;
    const next = activeConditionalStage(nextProgram);
    const outcome = nextProgram.results.at(-1)!;
    if (beneficiary === program.originalTeam)
      throw new Error('Trade the conditional obligation before resolving it.');
    affected.add(program.originalTeam);
    affected.add(beneficiary);
    nextEntitlements[stage.entitlementId] = {
      ...retainedSimulationEntitlement(
        state.catalogue,
        stage.entitlementId,
        state.sources[stage.entitlementId]
      ),
      holderTeam: next ? program.originalTeam : beneficiary,
    };
    if (next)
      nextEntitlements[next.entitlementId] = {
        ...nextEntitlements[next.entitlementId],
        holderTeam: beneficiary,
        protectionLadder: conditionalProtectionLadder(nextProgram),
      };
    lines.push(
      `${program.originalTeam}: ${stage.year} first-round pick ${outcome.outcome} at pick ${outcome.position}${next ? `; ${next.year} first owed to ${beneficiary}` : ` to ${beneficiary}`}`
    );
    lines.push(
      `${beneficiary}: ${outcome.outcome === 'deferred' ? `in ${next!.year} conditional first-round obligation` : `in ${stage.year} conveyed first-round pick`} from ${program.originalTeam}`
    );
  }
  const nextTeams = Object.fromEntries(
    Object.entries(teams).map(([team, data]) => [
      team,
      {
        ...data,
        entitlementIds: Object.entries(nextEntitlements)
          .filter(([, e]) => e.holderTeam === team)
          .map(([id]) => id),
      },
    ])
  );
  assertSimulationInventory(
    state.catalogue,
    { ...metadata, asOfDate: date, draftConditionalPrograms: updated },
    nextTeams,
    nextEntitlements,
    state.sources
  );
  const movements = Object.entries(nextEntitlements).flatMap(([id, value]) => {
    if (value.holderTeam === entitlements[id].holderTeam) return [];
    const pick = state.catalogue.data.records.find(
      (r) => r.entitlementId === id
    )!.originalPick!;
    return [
      {
        entitlementId: id,
        originalTeam: pick.originalTeam,
        year: pick.draftYear,
        round: 1 as const,
        fromTeam: String(entitlements[id].holderTeam),
        toTeam: String(value.holderTeam),
      },
    ];
  });
  const eventId = `conditionalDraft__${request.draftYear}`;
  const eventRef = doc(
    state.root,
    ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
    eventId
  );
  const occurredAt = new Date().toISOString();
  const event = {
    eventId,
    type: 'draftConveyance',
    mutationType: 'draftConveyance',
    operationId: request.operationId,
    worldId,
    seasonId: metadata.currentSeason,
    timestamp: occurredAt,
    occurredAt,
    teamsAffected: [...affected],
    teamCodes: [...affected],
    metadata: {
      type: 'draftConveyance',
      summary: lines.filter((_, index) => index % 2 === 0).join(' · '),
      picksTraded: lines,
      conditionalDraftReceipt: DraftConditionalReceiptZ.parse({
        worldId,
        operationId: request.operationId,
        movements,
        scope: 'governed-simulation-only',
        catalogueSha256: metadata.draftSimulationCatalogue,
        before: programs,
        after: updated,
        positions: request.positions,
        draftYear: request.draftYear,
        date,
      }),
    },
  };
  assertPersistableOrThrow({
    obj: event,
    contract: PERSISTENCE_CONTRACTS.EVENT,
    label: 'EVENT',
  });
  await runTransaction(db, async (transaction) => {
    const entries = Object.entries(state.snapshots);
    const current = await Promise.all(
      entries.map(([path]) => transaction.get(doc(db, path)))
    );
    const existing = await transaction.get(eventRef);
    if (existing.exists()) throw new Error('This draft was already applied.');
    if (
      current.some(
        (s, i) =>
          !s.exists() || mutationSnapshotText(s.data()) !== entries[i][1]
      )
    )
      throw new Error(
        'Stale/concurrent draft transaction. Prepare the current world again.'
      );
    for (const team of affected)
      transaction.update(
        doc(state.root, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION, team),
        { entitlementIds: nextTeams[team].entitlementIds }
      );
    for (const [id, entitlement] of Object.entries(nextEntitlements))
      if (
        mutationSnapshotText(entitlement) !==
        mutationSnapshotText(entitlements[id])
      )
        transaction.set(
          doc(state.root, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION, id),
          entitlement
        );
    transaction.set(eventRef, event);
    transaction.update(state.root, {
      draftConditionalPrograms: updated,
      draftInventoryRevision: state.revision + 1,
      actionCount: Number(metadata.actionCount ?? 0) + 1,
      asOfDate: date,
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: [...affected],
    });
  });
  return { eventId, programs: updated };
}
