import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { expect, it } from 'vitest';

it('preserves live legacy access and applies the governed write fence only to owner Preview worlds', async () => {
  const endpoint = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  if (!/^127\.0\.0\.1:\d+$/.test(endpoint)) throw new Error('Loopback required');
  const [host, port] = endpoint.split(':');
  const environment = await initializeTestEnvironment({
    projectId: 'demo-owner-preview-rules',
    firestore: { host, port: Number(port), rules: readFileSync('firestore.owner-preview.rules', 'utf8') },
  });
  const legacy = 'architect_worlds/legacy';
  const preview = 'architect_worlds/owner_preview_test';
  const player = 'players_v2/player/contracts/current';
  const source = 'architect_basePickRules/LAC_2028_1st';
  const restrictedSource = 'architect_basePickRules/BOS_2028_1st';
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore();
      await Promise.all([
        setDoc(doc(admin, legacy), { createdBy: 'owner', worldName: 'Old save' }),
        setDoc(doc(admin, preview), { createdBy: 'owner', ownerPreview: true, draftInventoryRevision: 0 }),
        setDoc(doc(admin, `${preview}/contractBaselines/shard`), { ready: true }),
        setDoc(doc(admin, player), { amount: 1 }),
        setDoc(doc(admin, source), { available: true }),
        setDoc(doc(admin, restrictedSource), { available: false }),
      ]);
    });
    const owner = environment.authenticatedContext('owner').firestore();
    const stranger = environment.authenticatedContext('other').firestore();
    const guest = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(guest, player)));
    await assertSucceeds(getDoc(doc(owner, source)));
    await assertFails(getDoc(doc(owner, restrictedSource)));
    await assertFails(setDoc(doc(owner, player), { amount: 2 }));
    await assertSucceeds(getDoc(doc(owner, legacy)));
    await assertSucceeds(setDoc(doc(owner, `${legacy}/teams/CHI`), { teamCode: 'CHI' }));
    await assertSucceeds(setDoc(doc(owner, 'architect_worlds/legacy-new'), {
      createdBy: 'owner', worldName: 'New legacy save', createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(owner, 'architect_worlds/owner_preview_new'), {
      createdBy: 'owner', worldName: 'Unavailable ID', createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(owner, legacy), { ownerPreview: true }));
    await assertFails(setDoc(doc(owner, `${legacy}/events/trade`), { mutationType: 'trade' }));
    await assertFails(getDoc(doc(guest, preview)));
    await assertFails(getDoc(doc(stranger, preview)));
    await assertFails(updateDoc(doc(stranger, preview), { worldName: 'Changed' }));
    await assertSucceeds(getDoc(doc(owner, `${preview}/contractBaselines/shard`)));
    await assertFails(updateDoc(doc(owner, `${preview}/contractBaselines/shard`), { ready: false }));
    await assertFails(updateDoc(doc(owner, preview), { ownerPreview: false }));
    await assertFails(setDoc(doc(owner, `${preview}/teams/CHI`), { teamCode: 'CHI' }));

    const trade = writeBatch(owner);
    trade.update(doc(owner, preview), { draftInventoryRevision: 1 });
    trade.set(doc(owner, `${preview}/teams/CHI`), { teamCode: 'CHI' });
    trade.set(doc(owner, `${preview}/teams/TOR`), { teamCode: 'TOR' });
    trade.set(doc(owner, `${preview}/entitlements/pick`), { ownerTeam: 'TOR' });
    trade.set(doc(owner, `${preview}/events/trade`), { mutationType: 'trade' });
    await assertSucceeds(trade.commit());
    const receipt = await assertSucceeds(getDoc(doc(owner, `${preview}/events/trade`)));
    expect(receipt.data()).toEqual({ mutationType: 'trade' });

    await environment.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), preview), { worldLifecycle: { state: 'deleting' } })
    );
    await assertFails(updateDoc(doc(owner, preview), { worldName: 'Changed' }));
    await assertFails(updateDoc(doc(owner, `${preview}/teams/CHI`), { teamCode: 'TOR' }));
  } finally {
    await environment.clearFirestore();
    await environment.cleanup();
  }
});
