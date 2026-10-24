/**
 * Default-path first-round no-write gate against the real Auth/Firestore emulators.
 *
 * The former D4 fixture created worlds with the client and expected ungoverned
 * first-round transfers and guessed DARE outcomes. Those expectations predate
 * trusted world creation, the inventory fence and the accepted first-round Apply
 * prohibition. Reuse the accepted complete synthetic review fixture, without its
 * non-serializable mutation permission, and verify the current boundary instead.
 * Authorized positive review-only persistence is covered by the retained
 * draft-review and draft-season browser proofs and draftReviewConsumption tests.
 * No NBA fact or real-data positive path is asserted by this software fixture.
 */
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import admin from 'firebase-admin';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';
import { seedSyntheticDraftReviewWorld } from '../../../../tests/e2e/fixtures/syntheticDraftReviewWorld';
import type { SyntheticDraftMutationSource } from '@/schemas/draftPickReviewMutation';
import type { ApplyWorldMutationArgs } from '@/features/architect/utils/mutationPipeline.types.ingress';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';

const worldId = 'phaseD4_current_first_round_boundary';
let adminApp: admin.app.App;
let adminDb: FirebaseFirestore.Firestore;
let userId: string;
let source: SyntheticDraftMutationSource;

// Compare the original complete world inventory, including every Team/player,
// entitlement, event, history/receipt and any newly created document.
async function savedWorld() {
  const result: Record<string, unknown> = {};
  async function visit(ref: FirebaseFirestore.DocumentReference) {
    const snapshot = await ref.get();
    if (snapshot.exists) result[ref.path] = snapshot.data();
    for (const col of await ref.listCollections()) {
      for (const child of (await col.get()).docs) await visit(child.ref);
    }
  }
  await visit(adminDb.collection(ARCHITECT_WORLDS_COLLECTION).doc(worldId));
  return result;
}
function tradeArgs(operationId: string): ApplyWorldMutationArgs {
  return {
    userId,
    worldId,
    seasonId: source.seasonId,
    mutationType: 'executeTrade',
    operationId,
    payload: structuredClone(source.proposal),
    timestamp: Date.parse(source.asOf),
  };
}

beforeAll(async () => {
  const projectId = process.env.GCLOUD_PROJECT ?? '';
  if (
    !projectId.startsWith('demo-') ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  )
    throw new Error('D4 requires the selected loopback demo project.');
  adminApp = admin.initializeApp(
    { projectId },
    'd4-default-first-round-boundary'
  );
  adminDb = adminApp.firestore();
  const credential = await createUserWithEmailAndPassword(
    auth,
    `d4-${Date.now()}@scoutzero.test`,
    'local-emulator-only-password'
  );
  userId = credential.user.uid;
});
beforeEach(async () => {
  source = await seedSyntheticDraftReviewWorld(
    userId,
    worldId,
    'legal',
    adminApp
  );
});
afterAll(async () => {
  if (adminDb)
    await adminDb.recursiveDelete(
      adminDb.collection(ARCHITECT_WORLDS_COLLECTION).doc(worldId)
    );
  if (auth.currentUser) await auth.currentUser.delete();
  await signOut(auth);
  if (adminApp) await adminApp.delete();
});

describe('D4: real emulator preserves the default first-round boundary', () => {
  it('rejects a complete stipulated first-round exchange without the authorized review permission, including retries', async () => {
    const before = await savedWorld();
    for (const operationId of ['d4-first', 'd4-retry']) {
      const result = await applyWorldMutation(tradeArgs(operationId));
      expect(result.success).toBe(false);
      // Discriminate the actual first-round gate from an unrelated setup failure.
      expect(JSON.stringify(result.violations)).toMatch(
        /Stepien|governedDraftHistory/
      );
      expect(await savedWorld()).toEqual(before);
    }
  });
  it('rejects copied review metadata as mutation permission without writing a receipt or changing either team', async () => {
    const before = await savedWorld();
    const result = await applyWorldMutation({
      ...tradeArgs('d4-forged'),
      draftReviewAuthority: { ...source.reviews[0], eligible: true },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(
      /Unrecognized or unavailable draft review permission/
    );
    expect(await savedWorld()).toEqual(before);
  });
  it('does not infer a season transition or draft outcome from the unqualified fixture', async () => {
    const before = await savedWorld();
    const result = await advanceSeasonInWorld(worldId, { optionDecisions: {} });
    expect(result.success).toBe(false);
    expect(await savedWorld()).toEqual(before);
  });
  it('keeps direct client world creation forbidden while the seeded owner can read the test world', async () => {
    const ref = doc(db, ARCHITECT_WORLDS_COLLECTION, worldId);
    expect((await getDoc(ref)).data()?.createdBy).toBe(userId);
    await expect(
      setDoc(doc(db, ARCHITECT_WORLDS_COLLECTION, `${worldId}_client`), {
        createdBy: userId,
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(
      (
        await adminDb
          .collection(ARCHITECT_WORLDS_COLLECTION)
          .doc(`${worldId}_client`)
          .get()
      ).exists
    ).toBe(false);
  });
});
