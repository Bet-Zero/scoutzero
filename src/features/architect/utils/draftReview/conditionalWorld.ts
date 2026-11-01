import { DraftReviewMutationReceiptZ } from '@/schemas/draftPickReviewMutation';
import { DraftConditionalReceiptZ } from '@/schemas/draftConditionalReceipt';
import { NativeSelectionTransfersZ } from '@/schemas/draftNativeTrading';
import { nativeTradeDate, requireSameNativeValue } from './nativeTrading';
import { DraftSwapReceiptZ } from '@/schemas/draftSwapReceipt';
import { DraftApronPlanReferenceZ } from '@/schemas/draftApronSimulation';
import { preparePenaltyDraft } from './penaltyDraft';
import { readPenaltyPlacementReceipt } from './penaltyPlacement';
import { unpackApronPlan } from './apronPlanStorage';
import { readApronSimulation, apronInputFromHistory } from './apronSimulation';
import { DraftApronSeasonReceiptZ } from '@/schemas/draftApronSimulation';
import { swapProgram } from './swapProgram';
import { requireAdmittedOverlappingTerms } from './overlappingTerms';
/** Read-only preparation for an explicitly governed simulation world. */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_DRAFT_SEASON_INPUTS_SUBCOLLECTION,
} from '@/constants/collections';
import {
  loadSimulationCatalogue,
  assertSimulationInventory,
} from './simulationInventory';
import { conditionalPrograms } from './conditionalProgram';
import { requireDraftInventoryRevision } from './inventoryFence';
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';

export async function loadConditionalWorld(
  worldId: string,
  options: { allowUnconditionalInventory?: boolean } = {}
) {
  if (!isSyntheticDraftReviewEnvironment() || !auth.currentUser)
    throw new Error(
      'Conditional lifecycle requires the protected test environment.'
    );
  const root = doc(db, ARCHITECT_WORLDS_COLLECTION, worldId);
  const metadata = (await getDoc(root)).data();
  // Only the read-only assets projection opts in. Lifecycle callers retain
  // their existing conditional-program admission requirement.
  const inventoryOnly =
    options.allowUnconditionalInventory === true &&
    metadata?.draftSimulationBranches === 'unconditional';
  if (
    !metadata ||
    metadata.createdBy !== auth.currentUser.uid ||
    metadata.parentWorldId != null ||
    (!inventoryOnly &&
      !['protection-programs', 'swap-program', 'apron-lifecycle'].includes(
        metadata.draftSimulationBranches
      ))
  )
    throw new Error('An owned conditional test world is required.');
  const revision = requireDraftInventoryRevision(metadata);
  const response = await fetch('/api/architect/draft-review', {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
  });
  if (!response.ok) throw new Error('Retained pick catalogue is unavailable.');
  const catalogue = await loadSimulationCatalogue(await response.text());
  const [teamDocs, entitlementDocs] = await Promise.all([
    getDocs(collection(root, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION)),
    getDocs(collection(root, ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)),
  ]);
  if (teamDocs.size !== 30)
    throw new Error('All 30 team inventories are required.');
  const teams = Object.fromEntries(teamDocs.docs.map((d) => [d.id, d.data()]));
  const entitlements = Object.fromEntries(
    entitlementDocs.docs.map((d) => [d.id, d.data()])
  );
  const sourceDocs = await Promise.all(
    catalogue.data.records.map((r) =>
      getDoc(doc(db, ARCHITECT_BASE_ENTITLEMENTS_PATH, r.entitlementId))
    )
  );
  const sources = Object.fromEntries(
    sourceDocs.map((d) => [d.id, d.data() ?? {}])
  );
  assertSimulationInventory(catalogue, metadata, teams, entitlements, sources);
  const programs = conditionalPrograms(
    metadata.draftConditionalPrograms ?? [],
    catalogue.data.records,
    entitlements
  );
  const swap =
    metadata.draftSimulationBranches === 'swap-program'
      ? swapProgram(
          metadata.draftSwapProgram,
          catalogue,
          entitlements,
          metadata.draftNativeTransfers
        )
      : null;
  if (swap?.kind === 'native-overlapping-pool-v1')
    await requireAdmittedOverlappingTerms(swap);
  const reference = DraftApronPlanReferenceZ.safeParse(metadata.draftApronPlan);
  const seasonDocs = reference.success
    ? await Promise.all(
        reference.data.stepSeasons.map((year) =>
          getDoc(
            doc(
              root,
              ARCHITECT_WORLD_DRAFT_SEASON_INPUTS_SUBCOLLECTION,
              String(year)
            )
          )
        )
      )
    : [];
  const plan = reference.success
    ? unpackApronPlan(
        reference.data,
        Object.fromEntries(seasonDocs.map((d) => [d.id, d.data()]))
      )
    : metadata.draftApronPlan;
  const apron =
    metadata.draftSimulationBranches === 'apron-lifecycle'
      ? readApronSimulation({ ...metadata, draftApronPlan: plan })
      : null;
  if (!inventoryOnly && !programs.length && !swap && !apron)
    throw new Error('Complete protection programs are required.');
  const snapshots = {
    [root.path]: mutationSnapshotText(metadata),
    ...Object.fromEntries(
      [
        ...teamDocs.docs,
        ...entitlementDocs.docs,
        ...sourceDocs,
        ...seasonDocs,
      ].map((d) => [d.ref.path, mutationSnapshotText(d.data())])
    ),
  };
  // A saved outcome must descend from its committed draft receipt. Merely
  // inserting a plausible result into world metadata cannot close an obligation.
  for (const year of [
    ...new Set(programs.flatMap((p) => p.results.map((r) => r.year))),
  ].sort()) {
    const event = await getDoc(
      doc(
        root,
        ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
        `conditionalDraft__${year}`
      )
    );
    const receipt = DraftConditionalReceiptZ.safeParse(
      event.data()?.metadata?.conditionalDraftReceipt
    );
    const at = (inclusive: boolean) =>
      programs.map((p) => ({
        ...p,
        results: p.results.filter((r) =>
          inclusive ? r.year <= year : r.year < year
        ),
      }));
    if (
      !receipt.success ||
      receipt.data.worldId !== worldId ||
      receipt.data.operationId !== event.data()?.operationId ||
      receipt.data.catalogueSha256 !== metadata.draftSimulationCatalogue ||
      receipt.data.draftYear !== year ||
      receipt.data.date !==
        metadata.draftSimulationCalendar?.find(
          (c: { year: number }) => c.year === year
        )?.date ||
      mutationSnapshotText(receipt.data.before) !==
        mutationSnapshotText(at(false)) ||
      mutationSnapshotText(receipt.data.after) !==
        mutationSnapshotText(at(true))
    )
      throw new Error(
        'Saved conditional outcomes require their matching committed draft receipts.'
      );
    snapshots[event.ref.path] = mutationSnapshotText(event.data());
  }
  if (apron) {
    if (apron.plan.kind === 'governed-apron-lifecycle-v2') {
      const expected = apron.plan.seasons![apron.history.length];
      if (
        Object.values(teams).some(
          (team) =>
            team.salaryBookInputs?.salaryCapYear !== expected.salaryCapYear ||
            mutationSnapshotText(
              team.salaryBookInputs?.softwareSeasonContext
            ) !== mutationSnapshotText(expected)
        )
      )
        throw new Error(
          'Saved team financial contexts differ from their governed season.'
        );
    }
    for (let i = 0; i < apron.history.length; i++) {
      const entry = apron.history[i];
      const event = await getDoc(
        doc(root, ARCHITECT_WORLD_EVENTS_SUBCOLLECTION, entry.transitionId)
      );
      const receipt = DraftApronSeasonReceiptZ.safeParse(
        event.data()?.metadata?.apronSeasonReceipt
      );
      if (
        !event.exists() ||
        !receipt.success ||
        receipt.data.worldId !== worldId ||
        receipt.data.operationId !== event.data()?.operationId ||
        receipt.data.planDigest !== apron.planDigest ||
        mutationSnapshotText(receipt.data.restrictions) !==
          mutationSnapshotText(
            Object.keys(teams)
              .sort()
              .map((team) =>
                apronInputFromHistory(
                  team,
                  Number(apron.plan.startingSeason.slice(0, 4)) + 8,
                  apron.history.slice(0, i + 1),
                  apron.plan.steps[i].tradingWindow.asOf,
                  apron.plan
                )
              )
          ) ||
        receipt.data.catalogueSha256 !== metadata.draftSimulationCatalogue ||
        mutationSnapshotText(receipt.data.before) !==
          mutationSnapshotText(apron.history.slice(0, i)) ||
        mutationSnapshotText(receipt.data.after) !==
          mutationSnapshotText(apron.history.slice(0, i + 1))
      )
        throw new Error(
          'Committed consecutive apron season receipts are required.'
        );
      snapshots[event.ref.path] = mutationSnapshotText(event.data());
    }
  }
  if (swap && swap.kind !== 'ordered-swap-pool-v1' && swap.result) {
    const event = await getDoc(
      doc(root, ARCHITECT_WORLD_EVENTS_SUBCOLLECTION, `swapDraft__${swap.year}`)
    );
    const receipt = DraftSwapReceiptZ.safeParse(
      event.data()?.metadata?.swapDraftReceipt
    );
    if (
      !receipt.success ||
      receipt.data.worldId !== worldId ||
      receipt.data.operationId !== event.data()?.operationId ||
      receipt.data.catalogueSha256 !== metadata.draftSimulationCatalogue ||
      receipt.data.date !==
        (metadata.draftNativeLifecycle?.claimsEffectiveDate ??
          metadata.draftSimulationCalendar?.find(
            (entry: { year: number }) => entry.year === swap.year
          )?.date) ||
      mutationSnapshotText(receipt.data.nativeLifecycle ?? null) !==
        mutationSnapshotText(metadata.draftNativeLifecycle ?? null) ||
      mutationSnapshotText(receipt.data.after) !== mutationSnapshotText(swap)
    )
      throw new Error(
        'Saved native allocation requires its matching committed receipt.'
      );
    snapshots[event.ref.path] = mutationSnapshotText(event.data());
    const history = NativeSelectionTransfersZ.parse(
      metadata.draftNativeTransfers ?? []
    );
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      nativeTradeDate(
        swap,
        metadata.draftNativeLifecycle,
        history.slice(0, i),
        entry.asOfDate
      );
      if (entry.asOfDate > metadata.asOfDate)
        throw new Error('A saved transfer is later than the world clock.');
      const trade = await getDoc(
        doc(
          root,
          ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
          `draft_review_${entry.operationId}`
        )
      );
      const parsed = DraftReviewMutationReceiptZ.safeParse(
        trade.data()?.metadata?.draftReviewReceipt
      );
      if (
        !parsed.success ||
        parsed.data.worldId !== worldId ||
        parsed.data.operationId !== entry.operationId ||
        trade.data()?.operationId !== entry.operationId ||
        parsed.data.releaseId !== catalogue.release.foundation.release.id ||
        parsed.data.releaseSha256 !== catalogue.release.payloadSha256
      )
        throw new Error(
          'Every native selection transfer needs its committed trade receipt.'
        );
      requireSameNativeValue(
        parsed.data.assumptions?.nativeTrade,
        {
          program: swap,
          lifecycle: metadata.draftNativeLifecycle,
          resolutionOperationId: receipt.data.operationId,
          transfers: history.slice(0, i),
        },
        'Native selection receipt does not follow its original resolution and predecessor.'
      );
      requireSameNativeValue(
        {
          operationId: parsed.data.operationId,
          asOfDate: parsed.data.asOfDate,
          movements: parsed.data.movements,
        },
        entry,
        'Native selection history differs from its committed trade.'
      );
      snapshots[trade.ref.path] = mutationSnapshotText(trade.data());
    }
  }
  const state = {
    apron,
    root,
    metadata,
    revision,
    catalogue,
    programs,
    swap,
    teams,
    entitlements,
    sources,
    snapshots,
  };
  if (metadata.draftPenaltyReceipt !== undefined) {
    const receipt = readPenaltyPlacementReceipt(metadata.draftPenaltyReceipt);
    const expected = preparePenaltyDraft(state);
    if (
      !receipt ||
      receipt.worldId !== worldId ||
      receipt.catalogueSha256 !== metadata.draftSimulationCatalogue ||
      mutationSnapshotText({
        input: receipt.input,
        restrictions: receipt.restrictions,
        positions: receipt.positions,
        planDigest: receipt.planDigest,
      }) !== mutationSnapshotText(expected)
    )
      throw new Error(
        'Saved final positions disagree with draft inputs and consumed history.'
      );
    const event = await getDoc(
      doc(
        root,
        ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
        `penaltyDraft__${receipt.input.draftYear}`
      )
    );
    if (
      !event.exists() ||
      event.data()?.operationId !== receipt.operationId ||
      mutationSnapshotText(event.data()?.metadata?.penaltyDraftReceipt) !==
        mutationSnapshotText(receipt)
    )
      throw new Error(
        'Saved final positions require their committed draft receipt.'
      );
    snapshots[event.ref.path] = mutationSnapshotText(event.data());
  }
  return state;
}
