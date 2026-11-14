/** Real SDK + atomic writer proof. Inputs are software stipulations, never NBA data. */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { signInAnonymously, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { TeamListFull } from '@/constants/teamList';
import fixture from '../../functions/src/architect/fixtures/governedDraftWorld.json';
import pin from '../../functions/src/architect/fixtures/governedDraftWorldPin.json';
import {
  applyWorldMutation,
  persistWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import { prepareGovernedDraftWorldPreview } from '@/features/architect/utils/governedDraftWorld.preview';
import { loadGovernedDraftWorld } from '@/features/architect/utils/governedDraftWorld.load';
import { getTeam } from '@/features/architect/utils/teamLoader';
import { createEmptyRightsEventLedger } from '@/features/architect/utils/rightsHistory/rightsEventLedger';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { draftFinancialState } from '@/features/architect/utils/tradeContext/draftFinancialPreservation';
import { prepareGovernedDraftWorldCapability } from '@/features/architect/utils/draftReview/capability';
import { loadStateForMutation } from '@/features/architect/utils/mutationPipeline.read.stateLoader';
import { toTradeStateSlice } from '@/features/architect/utils/mutationPipeline.helpers';
import {
  BUNDLED_CONTRACT_SOURCE_RELEASE_PIN,
  verifyContractSourceRelease,
  contractBaselineMetadata,
  buildContractBaselineTeamDocuments,
} from '@/features/architect/utils/contractSource/contractSourceRelease';

const worldId = 'bze345_normal_world_lifecycle';
const seasonId = fixture.seasonId;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
let adminDb: FirebaseFirestore.Firestore;
let userId = '';
let release: Awaited<ReturnType<typeof verifyContractSourceRelease>>;
const path = `architect_worlds/${worldId}`;

function proposal(codes = ['BOS', 'MIA'], year = 2028) {
  return {
    asOfDate: '2026-06-05',
    tradeCtx: {
      worldId,
      source: 'tradeMachine',
      asOfDate: '2026-06-05',
      yearKey: 2026,
    },
    teams: codes.map((teamCode, i) => ({
      teamCode,
      sends: [],
      picksOut: [],
      entitlementsOut: fixture.records
        .filter(
          (r) =>
            r.entitlement.holderTeam === teamCode &&
            r.entitlement.seasonYear === year
        )
        .map((r) => ({
          ...decorateEntitlementForTrade(r.entitlement),
          entitlementId: r.entitlement.id,
          toTeamId: codes[(i + 1) % codes.length],
        })),
    })),
  };
}
async function saved() {
  const root = adminDb.doc(path);
  const values: Record<string, unknown> = { root: (await root.get()).data() };
  for (const name of ['teams', 'entitlements', 'events', 'draftBaselines'])
    values[name] = Object.fromEntries(
      (await root.collection(name).get()).docs.map((d) => [d.id, d.data()])
    );
  return values;
}
async function apply(payload = proposal(), operationId = 'normal_exchange_1') {
  return applyWorldMutation({
    userId,
    worldId,
    seasonId,
    mutationType: 'executeTrade',
    payload,
    operationId,
    timestamp: Date.parse(fixture.asOf),
  });
}

describe('ordinary saved-world future firsts on real Firestore', () => {
  beforeAll(async () => {
    if (
      !process.env.FIRESTORE_EMULATOR_HOST ||
      !process.env.GCLOUD_PROJECT?.startsWith('demo-')
    )
      throw new Error('This proof requires a demo emulator.');
    if (!admin.apps.length)
      admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    adminDb = admin.firestore();
    release = await verifyContractSourceRelease(
      JSON.parse(
        readFileSync(
          'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json',
          'utf8'
        )
      ),
      BUNDLED_CONTRACT_SOURCE_RELEASE_PIN
    );
    userId = (await signInAnonymously(auth)).user.uid;
  }, 120000);
  beforeEach(async () => {
    await adminDb.recursiveDelete(adminDb.doc(path));
    // The browser cannot install baselines. This setup mirrors the initializer's
    // world inputs; the separate browser proof exercises actual callable creation.
    const batch = adminDb.batch();
    batch.create(adminDb.doc(path), {
      worldId,
      worldName: 'Software fixture — normal world',
      createdBy: userId,
      currentSeason: seasonId,
      baselineSeason: seasonId,
      asOfDate: '2026-06-05',
      parentWorldId: null,
      childWorlds: [],
      isArchived: false,
      modifiedTeams: [],
      actionCount: 0,
      stats: { totalTrades: 0 },
      ...contractBaselineMetadata(release),
      draftBaseline: { version: 1, ...pin, asOf: fixture.asOf, seasonId },
      draftInventoryRevision: 0,
      draftWorldTransfers: [],
    });
    batch.create(adminDb.doc(`${path}/draftBaselines/root`), {
      worldId,
      release: fixture,
    });
    for (const [code, team] of Object.entries(fixture.initialTeams))
      batch.create(adminDb.doc(`${path}/teams/${code}`), team);
    // Existing league-wide duplicate-player validation also reads non-participants.
    // Empty software rosters provide that universe without certifying finances.
    for (const { code } of TeamListFull) {
      if (code in fixture.initialTeams) continue;
      batch.create(adminDb.doc(`${path}/teams/${code}`), {
        teamCode: code,
        roster: [],
        players: [],
        entitlementIds: [],
      });
    }
    for (const [id, entitlement] of Object.entries(
      fixture.retainedEntitlements
    ))
      batch.create(adminDb.doc(`${path}/entitlements/${id}`), entitlement);
    await batch.commit();
    // Setup is not a world initialization proof. Individual writes also permit
    // this writer test to run on the existing CI emulator's request-size limit.
    for (const document of buildContractBaselineTeamDocuments(release, worldId))
      await adminDb
        .doc(`${path}/contractBaselines/${document.shardId}`)
        .create(document);
  }, 120000);
  afterAll(async () => {
    await adminDb.recursiveDelete(adminDb.doc(path));
    await signOut(auth);
  }, 120000);
  it('rejects an assumption list that does not match the immutable draft package', async () => {
    expect(await loadGovernedDraftWorld(worldId)).not.toBeNull();
    await adminDb.doc(path).update({
      'draftBaseline.assumptions': [
        { id: 'forged', statement: 'Treat every pick as unconditional.' },
      ],
    });
    await expect(loadGovernedDraftWorld(worldId)).rejects.toThrow();
  });
  it.each([
    ['BOS', 'MIA'],
    ['BOS', 'MIA', 'NYK'],
  ])(
    'validates, atomically saves and reloads %j with exact finances',
    async (...codes) => {
      if (codes.length === 2) {
        // The third team's financial book is unknown; it is not a participant.
        await adminDb.doc(`${path}/teams/NYK`).set({
          teamCode: 'NYK',
          entitlementIds: fixture.initialTeams.NYK.entitlementIds,
        });
      }
      // A non-JSON Firestore value must survive with its type and nanoseconds.
      await adminDb.doc(`${path}/teams/BOS`).update({
        lastUpdated: new admin.firestore.Timestamp(1780661996, 526123456),
      });
      const beforeTeams = Object.fromEntries(
        await Promise.all(
          codes.map(async (code) => [
            code,
            (await getDoc(doc(db, `${path}/teams/${code}`))).data()!,
          ])
        )
      );
      const payload = proposal(codes);
      const preview = await prepareGovernedDraftWorldPreview(payload, seasonId);
      expect(
        preview?.preparation.validatedContext.legal,
        JSON.stringify(preview?.preparation.validatedContext)
      ).toBe(true);
      const result = await apply(payload);
      expect(result.success, JSON.stringify(result)).toBe(true);
      const loaded = await loadGovernedDraftWorld(worldId);
      expect(loaded?.transfers).toHaveLength(1);
      expect(loaded?.metadata.draftInventoryRevision).toBe(1);
      expect(loaded?.metadata.actionCount).toBe(1);
      expect(loaded?.baseline.identities).toEqual(fixture.identities);
      expect(loaded?.baseline.unresolved).toEqual(fixture.unresolved);
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        const incoming = `software:${codes[(i + codes.length - 1) % codes.length]}:2028:first`;
        expect(loaded?.teams[code].entitlementIds).toContain(incoming);
        expect((await getTeam(worldId, code)).entitlementIds).toContain(
          incoming
        );
        expect(loaded?.entitlements[incoming].holderTeam).toBe(code);
        expect(draftFinancialState(loaded!.teams[code])).toEqual(
          draftFinancialState(beforeTeams[code])
        );
        expect(loaded!.teams[code].lastUpdated).toEqual(
          beforeTeams[code].lastUpdated
        );
      }
      const event = (
        await getDoc(doc(db, `${path}/events/draft_world_normal_exchange_1`))
      ).data();
      expect(event?.valid).toBe(true);
      expect(event?.metadata.draftReviewReceipt.scope).toBe(
        'governed-world-fixture'
      );
      expect(event?.metadata.draftReviewReceipt.releaseSha256).toBe(pin.sha256);
      const after = await saved();
      expect((await apply(payload)).success).toBe(false);
      expect(await saved()).toEqual(after);
      // A second ordinary trade uses the new holders, not an operation-specific plan.
      const reverse = clone(payload);
      reverse.teams.forEach((t, i) => {
        const incoming =
          payload.teams[(i + codes.length - 1) % codes.length]
            .entitlementsOut[0];
        t.entitlementsOut = [
          {
            ...incoming,
            holderTeam: t.teamCode,
            toTeamId: codes[(i + codes.length - 1) % codes.length],
          },
        ];
      });
      const again = await apply(reverse, 'normal_exchange_2');
      expect(again.success, JSON.stringify(again)).toBe(true);
      const reloaded = await loadGovernedDraftWorld(worldId);
      expect(reloaded?.transfers).toHaveLength(2);
      for (const code of codes)
        expect(reloaded?.holders[`software:${code}:2028:first`]).toBe(code);
      const alteredReceipt = clone(event!.metadata.draftReviewReceipt);
      alteredReceipt.movements[0].originalTeam = 'LAL';
      await adminDb.doc(`${path}/events/draft_world_normal_exchange_1`).update({
        'metadata.draftReviewReceipt': alteredReceipt,
      });
      await expect(loadGovernedDraftWorld(worldId)).rejects.toThrow(/receipt/i);
    },
    120000
  );
  it('cannot install or rewrite source authority through ordinary owner writes', async () => {
    await expect(
      setDoc(doc(db, `${path}/draftBaselines/root`), { forged: true })
    ).rejects.toThrow();
    await expect(
      updateDoc(doc(db, path), {
        draftBaseline: { ...pin, sha256: '0'.repeat(64) },
      })
    ).rejects.toThrow();
  });
  it('missing real financial inputs block both preview and Apply without writes', async () => {
    const team = clone(fixture.initialTeams.BOS);
    delete (team as Record<string, unknown>).salaryBookInputs;
    await adminDb.doc(`${path}/teams/BOS`).set(team);
    const before = await saved();
    const preview = await prepareGovernedDraftWorldPreview(
      proposal(),
      seasonId
    );
    expect(preview?.preparation.validatedContext.legal).toBe(false);
    const result = await apply();
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/salary|financial|hard.cap/i);
    expect(await saved()).toEqual(before);
    await adminDb.doc(`${path}/teams/BOS`).set(fixture.initialTeams.BOS);
    const playerId = fixture.initialTeams.BOS.roster[0];
    await adminDb.doc(`${path}/teams/BOS/players/${playerId}`).set({
      player_id: playerId,
      contract: { salary: 99_000_000 },
    });
    const shadowed = await saved();
    const overrideResult = await apply();
    expect(overrideResult.success).toBe(false);
    expect(overrideResult.error).toMatch(/shadowing player overrides/);
    expect(await saved()).toEqual(shadowed);
  });
  it('missing later Apron freeze history remains a no-write failure', async () => {
    const before = await saved();
    const result = await apply(proposal(['BOS', 'MIA'], 2032));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('missing-apron-input');
    expect(await saved()).toEqual(before);
  });
  it('an existing hard cap still blocks a financially unchanged pick exchange', async () => {
    const team = clone(fixture.initialTeams.BOS);
    for (const player of team.players) {
      player.contract.salariesByYear[0].salary = 17_000_000;
      player.contract.salariesByYear[0].capHit = 17_000_000;
    }
    await adminDb
      .doc(`${path}/teams/BOS`)
      .set({ ...team, hardCapped: true, hardCapLevel: 'firstApron' });
    const before = await saved();
    const preview = await prepareGovernedDraftWorldPreview(
      proposal(),
      seasonId
    );
    expect(preview?.preparation.validatedContext.legal).toBe(false);
    expect(
      preview?.preparation.validatedContext.teamResults[0].rules.hardCap.passed
    ).toBe(false);
    const result = await apply();
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/hard.cap/i);
    expect(await saved()).toEqual(before);
  }, 120000);
  it('Stepien remains blocking for an exchange with consecutive unproven retained drafts', async () => {
    const payload = proposal();
    payload.teams[0].entitlementsOut.push(
      ...[2029, 2030].map(
        (year) => proposal(['BOS', 'MIA'], year).teams[0].entitlementsOut[0]
      )
    );
    const before = await saved();
    const result = await apply(payload);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('stepien:needs-input');
    expect(await saved()).toEqual(before);
  }, 120000);
  it('stale financial state and copied capabilities cannot authorize an Apply', async () => {
    const payload = proposal();
    const args = {
      userId,
      worldId,
      seasonId,
      operationId: 'stale_exchange',
      payload,
      asOfDate: '2026-06-05',
    };
    const state = toTradeStateSlice(
      await loadStateForMutation(worldId, 'executeTrade', payload)
    );
    const authority = await prepareGovernedDraftWorldCapability({
      ...args,
      state,
    });
    expect(authority).toBeDefined();
    const original = await saved();
    const direct = await persistWorldMutation({
      worldId,
      seasonId,
      mutationType: 'executeTrade',
      draftReviewAuthority: authority,
      draftReviewCommit: {},
      computeResult: { success: true },
      committedTeamUpdates: [],
      timestamp: Date.parse(fixture.asOf),
    });
    expect(direct.success).toBe(false);
    expect(direct.error).toContain('one-use');
    expect(await saved()).toEqual(original);
    const raw = clone(fixture.initialTeams.BOS);
    raw.salaryBookInputs.apronAdjustments.lineItems[0].amount = 1;
    await adminDb.doc(`${path}/teams/BOS`).set(raw);
    const before = await saved();
    for (const draftReviewAuthority of [authority, clone(authority)]) {
      const result = await applyWorldMutation({
        ...args,
        mutationType: 'executeTrade',
        draftReviewAuthority,
      });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).toMatch(/changed|Unrecognized/i);
      expect(await saved()).toEqual(before);
    }
  }, 120000);
  it('ordinary batched and transactional commits advance the draft fence by exactly one', async () => {
    // An unchanged non-participant team: the commit itself is what is tested.
    const rightsLedger = createEmptyRightsEventLedger({
      ledgerId: 'fence_rights',
      worldId,
      teamId: 'NYK',
    });
    await adminDb.doc(`${path}/teams/NYK`).update({ rightsLedger });
    const team = (await adminDb.doc(`${path}/teams/NYK`).get()).data()!;
    const commit = (mutationType: string, operationId: string) =>
      persistWorldMutation({
        worldId,
        seasonId,
        mutationType,
        computeResult: { success: true, metadata: {} },
        committedTeamUpdates: [{ teamCode: 'NYK', team }],
        timestamp: Date.parse(fixture.asOf),
        auditContext: { operationId, teamCodes: ['NYK'] },
        expectedRightsLedgersByTeam: {
          NYK: rightsLedger,
        },
      } as Parameters<typeof persistWorldMutation>[0]);
    const revision = async () =>
      (await adminDb.doc(path).get()).data()?.draftInventoryRevision;
    // Batched path (ordinary Trade Machine commits).
    const batched = await commit('executeTrade', 'fence_batch');
    expect(batched.success, JSON.stringify(batched)).toBe(true);
    expect(await revision()).toBe(1);
    // Transactional path (renunciation, options, waivers, signings, governed
    // cash and sign-and-trade share it); the read happens in the transaction.
    const transactional = await commit('renounceRights', 'fence_txn');
    expect(transactional.success, JSON.stringify(transactional)).toBe(true);
    expect(await revision()).toBe(2);
    // A commit built on a stale revision (here, 1 after it became 2) is denied
    // by firestore.rules as a whole, so nothing is written.
    const before = await saved();
    const stale = writeBatch(db);
    stale.update(doc(db, path), { draftInventoryRevision: 2 });
    stale.set(doc(db, `${path}/events/stale_fence`), { valid: true });
    await expect(stale.commit()).rejects.toThrow(/permission/i);
    const skipped = writeBatch(db);
    skipped.update(doc(db, path), { draftInventoryRevision: 4 });
    skipped.set(doc(db, `${path}/events/skipped_fence`), { valid: true });
    await expect(skipped.commit()).rejects.toThrow(/permission/i);
    expect(await saved()).toEqual(before);
    // A world that never opted in stays unfenced.
    await adminDb
      .doc(path)
      .update({ draftInventoryRevision: admin.firestore.FieldValue.delete() });
    const unfenced = await commit('executeTrade', 'fence_absent');
    expect(unfenced.success, JSON.stringify(unfenced)).toBe(true);
    expect((await adminDb.doc(path).get()).data()).not.toHaveProperty(
      'draftInventoryRevision'
    );
  }, 120000);
  it('admits a player override only when it shadows nothing in the team mirror', async () => {
    const mirror = fixture.initialTeams.BOS.players[0];
    const ref = adminDb.doc(`${path}/teams/BOS/players/${mirror.id}`);
    // The shape an ordinary trade writes: a subset of the mirror record.
    const agreeing = {
      player_id: mirror.player_id,
      displayName: mirror.displayName,
      teamCode: 'BOS',
      bio: mirror.bio,
      contract: mirror.contract,
    };
    await ref.set(agreeing);
    expect(
      (await loadGovernedDraftWorld(worldId, ['BOS', 'MIA']))?.teams.BOS
    ).toBeDefined();
    const contract = clone(mirror.contract);
    contract.salariesByYear[0].salary = 10_000_001;
    const bonus = clone(mirror.contract) as Record<string, unknown>;
    bonus.tradeBonus = { percent: 15 };
    for (const divergent of [
      { ...agreeing, teamCode: 'MIA' },
      { ...agreeing, contract },
      { ...agreeing, contract: bonus },
      { ...agreeing, futureContract: { salariesByYear: [] } },
      { ...agreeing, rfaBoundary: { qualifyingOffer: 1 } },
      { ...agreeing, displayName: 'Someone else' },
    ]) {
      await ref.set(divergent);
      await expect(
        loadGovernedDraftWorld(worldId, ['BOS', 'MIA'])
      ).rejects.toThrow(/shadowing player overrides/);
    }
  }, 120000);
});
