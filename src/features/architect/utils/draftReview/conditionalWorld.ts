import { readApronSimulation, apronInputFromHistory } from './apronSimulation';
import { DraftApronSeasonReceiptZ } from '@/schemas/draftApronSimulation';
import { swapProgram } from './swapProgram';
/** Read-only preparation for an explicitly governed simulation world. */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
} from '@/constants/collections';
import {
  loadSimulationCatalogue,
  assertSimulationInventory,
} from './simulationInventory';
import { conditionalPrograms } from './conditionalProgram';
import { requireDraftInventoryRevision } from './inventoryFence';
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';

export async function loadConditionalWorld(worldId: string) {
  if (!isSyntheticDraftReviewEnvironment() || !auth.currentUser)
    throw new Error(
      'Conditional lifecycle requires the protected test environment.'
    );
  const root = doc(db, ARCHITECT_WORLDS_COLLECTION, worldId);
  const metadata = (await getDoc(root)).data();
  if (
    !metadata ||
    metadata.createdBy !== auth.currentUser.uid ||
    metadata.parentWorldId != null ||
    !['protection-programs', 'swap-program', 'apron-lifecycle'].includes(
      metadata.draftSimulationBranches
    )
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
      ? swapProgram(metadata.draftSwapProgram, catalogue, entitlements)
      : null;
  const apron =
    metadata.draftSimulationBranches === 'apron-lifecycle'
      ? readApronSimulation(metadata)
      : null;
  if (!programs.length && !swap && !apron)
    throw new Error('Complete protection programs are required.');
  const snapshots = {
    [root.path]: mutationSnapshotText(metadata),
    ...Object.fromEntries(
      [...teamDocs.docs, ...entitlementDocs.docs, ...sourceDocs].map((d) => [
        d.ref.path,
        mutationSnapshotText(d.data()),
      ])
    ),
  };
  if (apron) {
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
                  2033,
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
  return {
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
}
