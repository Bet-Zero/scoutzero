import type { ComparisonEventRow } from '@/features/architect/comparison/deriveComparisonViewModel';
import { deriveDraftAssetDelta } from '@/features/architect/comparison/deriveDraftAssetDelta';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import { prepareSyntheticDraftReview } from '@/features/architect/utils/draftReview/capability';
import { prepareSyntheticDraftSeasonReview } from '@/features/architect/utils/draftReview/seasonCapability';
import { buildSyntheticFreezeEvents } from '@/features/architect/utils/draftReview/seasonEvidence';
import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';
import { DraftReviewSeasonReceiptZ } from '@/schemas/draftReviewSeason';
import * as firestore from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  failMockBatchCommitAfter,
  getAllMockData,
  getMockData,
  resetMockDataStore,
  seedMockData,
} from '../__mocks__/firebase';
import {
  syntheticDraftSeasonBaseline,
  syntheticDraftSeasonFixture,
} from '../e2e/fixtures/syntheticDraftSeasonWorld';

const mode = vi.hoisted(() => ({ allowed: true, userId: 'review-user' }));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
  auth: {},
  isSyntheticDraftReviewEnvironment: () => mode.allowed,
}));
vi.mock('firebase/firestore', async () => {
  const mock = await import('../__mocks__/firebase');
  // Exercise the SDK's document-relative overload, absent from the older global mock.
  const parts = (first: unknown, rest: string[]) =>
    first && typeof first === 'object' && 'path' in first
      ? [String(first.path), ...rest]
      : rest;
  return {
    ...mock,
    doc: (first: unknown, ...rest: string[]) =>
      mock.doc({}, ...parts(first, rest)),
    collection: (first: unknown, ...rest: string[]) =>
      mock.collection({}, ...parts(first, rest)),
    // Every fixture entitlement's id is identical to its document ID.
    documentId: () => 'id',
    getDocs: async (target: Parameters<typeof mock.getDocs>[0]) => {
      const snapshot = await mock.getDocs(target);
      return {
        ...snapshot,
        docs: snapshot.docs.map((row) => ({
          ...row,
          ref: mock.doc({}, row.path),
        })),
      };
    },
  };
});
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async (input: unknown) => {
    const { publishCertifiedSeasonTransition } = await import(
      '@/features/architect/utils/seasonManager.server'
    );
    const ref = (path: string): any => ({
      path,
      doc: (id: string) => ref(`${path}/${id}`),
      collection: (id: string) => ({
        ...ref(`${path}/${id}`),
        isCollection: true,
      }),
    });
    const db = {
      doc: ref,
      collection: ref,
      runTransaction: async (callback: (tx: any) => Promise<unknown>) =>
        firestore.runTransaction({} as any, async (tx) =>
          callback({
            get: async (target: any) => {
              if (target.isCollection) {
                const rows = await firestore.getDocs(
                  firestore.collection({}, target.path)
                );
                return { ...rows, size: rows.docs.length };
              }
              const row = await tx.get(firestore.doc({}, target.path));
              return { exists: row.exists(), data: () => row.data() };
            },
            set: (target: any, data: any) =>
              tx.set(firestore.doc({}, target.path), data),
            update: (target: any, data: any) =>
              tx.update(firestore.doc({}, target.path), data),
            create: (target: any, data: any) => {
              if (getMockData(target.path)) throw new Error('Already exists');
              tx.set(firestore.doc({}, target.path), data);
            },
          })
        ),
    };
    return {
      data: await publishCertifiedSeasonTransition(
        db as any,
        mode.userId,
        input
      ),
    };
  },
}));
const worldId = 'synthetic-season-test';
const root = `architect_worlds/${worldId}`;
const transitionId = 'seasonAdvance__2025-26__2026-27';
const request = {
  worldId,
  userId: 'review-user',
  operationId: 'synthetic-season-advance',
};
const state = () => structuredClone(getAllMockData());
async function seed() {
  const fixture = syntheticDraftSeasonFixture(request.userId, worldId);
  seedMockData(root, fixture.metadata);
  for (const [id, team] of Object.entries(fixture.teams))
    seedMockData(`${root}/teams/${id}`, team);
  for (const [id, ent] of Object.entries(fixture.source.entitlements))
    seedMockData(`${root}/entitlements/${id}`, ent);
  for (const [path, data] of Object.entries(
    await syntheticDraftSeasonBaseline(fixture)
  ))
    seedMockData(path, data);
  return fixture;
}
beforeEach(() => {
  resetMockDataStore();
  mode.allowed = true;
  mode.userId = 'review-user';
  vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
  vi.stubEnv('GCLOUD_PROJECT', 'demo-architect-review');
  vi.restoreAllMocks();
});

describe('synthetic freeze history through the existing Season Advance writer', () => {
  it('retains all30 accepted trigger results atomically, preserves original IDs, and consumes a later first trade', async () => {
    const fixture = await seed();
    const token = await prepareSyntheticDraftSeasonReview(request);
    expect(Object.isFrozen(token)).toBe(true);
    const result = await advanceSeasonInWorld(worldId, {
      draftReviewAuthority: token,
    });
    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(result.persistenceConfirmed).toBe(true);
    const row = getMockData(`${root}/events/${transitionId}`) as Record<
      string,
      any
    >;
    const receipt = DraftReviewSeasonReceiptZ.parse(
      row.metadata.draftReviewSeasonReceipt
    );
    expect(new TextEncoder().encode(JSON.stringify(row)).length).toBeLessThan(
      900000
    );
    expect(
      receipt.freezeEvents
        .filter((e) => e.freezeTriggered)
        .map((e) => e.originalPick.id)
    ).toEqual(['BOS_2033_1st']);
    for (const [teamCode, team] of Object.entries(fixture.teams)) {
      expect(
        (getMockData(`${root}/teams/${teamCode}`) as any).entitlementIds
      ).toEqual(team.entitlementIds);
      const history = getMockData(
        `${root}/seasonHistory/2025-26__${teamCode}`
      ) as any;
      expect(history.draftReviewFreezeEvent).toEqual(
        receipt.freezeEvents.find(
          (e) => e.originalPick.originalTeam === teamCode
        )
      );
      expect(history.seasonCloseApronMeasurement).toEqual(
        fixture.lifecycle.measurements[teamCode]
      );
      expect(receipt.salaryBookHistory[teamCode]).toEqual({
        historyId: history.historyId,
        beforeTotalsDigest: mutationSnapshotDigest(history.beforeTotals),
        afterTotalsDigest: mutationSnapshotDigest(history.afterTotals),
      });
      for (const book of ['teamSalary', 'apronTeamSalary', 'taxSalary']) {
        expect(row.beforeTotalsByTeam[teamCode][book]).toBe(
          history.beforeTotals[book]
        );
        expect(row.afterTotalsByTeam[teamCode][book]).toBe(
          history.afterTotals[book]
        );
      }
      expect(history.draftReviewFreezeEvent).toMatchObject({
        currentRestriction: 'not-evaluated',
        tradingVerdict: 'not-evaluated',
      });
    }
    const after = state();
    expect(
      (await advanceSeasonInWorld(worldId, { draftReviewAuthority: token }))
        .success
    ).toBe(false);
    expect(state()).toEqual(after);
    const args = {
      ...request,
      operationId: 'synthetic-season-first-exchange',
      seasonId: '2026-27',
      mutationType: 'executeTrade',
      payload: fixture.source.proposal,
    };
    const prepared = await prepareSyntheticDraftReview(args);
    expect(prepared.status, JSON.stringify(prepared)).toBe('prepared');
    if (prepared.status !== 'prepared')
      throw new Error('No component permission');
    expect((await applyWorldMutation(args)).success).toBe(false);
    const trade = await applyWorldMutation({
      ...args,
      draftReviewAuthority: prepared.authority,
    });
    expect(trade.success, JSON.stringify(trade)).toBe(true);
    expect(
      (getMockData(`${root}/entitlements/review-BOS-2028-1`) as any).holderTeam
    ).toBe('MIA');
    const tradeRow = [...getAllMockData().entries()].find(
      ([path, value]) =>
        path.startsWith(`${root}/events/`) &&
        (value as any).mutationType === 'executeTrade'
    )![1] as any;
    const comparisonRow = (raw: any): ComparisonEventRow => ({
      ...raw,
      id: raw.eventId,
      raw,
      teamsInvolved: raw.teamCodes,
    });
    const rows = [comparisonRow(row), comparisonRow(tradeRow)];
    expect(deriveDraftAssetDelta(rows, worldId, 'MIA')?.additions).toEqual([
      {
        entitlementId: 'review-BOS-2028-1',
        displayName: 'BOS 2028 first-round pick',
      },
    ]);
    expect(
      deriveDraftAssetDelta(JSON.parse(JSON.stringify(rows)), worldId, 'BOS')
        ?.removals
    ).toHaveLength(1);
    for (const altered of [
      [rows[1], rows[0]],
      [rows[0], rows[0], rows[1]],
      [{ ...rows[0], raw: { ...row, operationId: 'wrong' } }, rows[1]],
      [{ ...rows[0], raw: { ...row, metadata: {} } }, rows[1]],
    ])
      expect(deriveDraftAssetDelta(altered, worldId, 'BOS')).toBeNull();
    const display = toTeamHistoryEventDisplay(row, { teamCode: 'BOS' });
    expect(JSON.stringify(display)).toContain('Draft Pick Season Record');
    expect(JSON.stringify(display)).toContain('2033 first-round pick');
    expect(JSON.stringify(display)).not.toContain('No event-specific');
    mode.allowed = false;
    expect(
      JSON.stringify(toTeamHistoryEventDisplay(row, { teamCode: 'BOS' }))
    ).not.toContain('Draft Pick Season Record');
  }, 30000);
  it.each(['default', 'forged', 'production'] as const)(
    'blocks %s permission without a write',
    async (kind) => {
      await seed();
      const token = await prepareSyntheticDraftSeasonReview(request);
      const before = state();
      if (kind === 'production') mode.allowed = false;
      const result = await advanceSeasonInWorld(
        worldId,
        kind === 'default'
          ? {}
          : {
              draftReviewAuthority:
                kind === 'forged' ? JSON.parse(JSON.stringify(token)) : token,
            }
      );
      expect(result.success).toBe(false);
      expect(state()).toEqual(before);
    }
  );
  it.each(['date', 'release', 'ownership', 'measurement', 'missing'] as const)(
    'rejects %s before issuance',
    async (kind) => {
      await seed();
      if (kind === 'date' || kind === 'release') {
        const metadata = getMockData(root) as any;
        seedMockData(root, {
          ...metadata,
          ...(kind === 'date'
            ? { asOfDate: '2026-04-11' }
            : {
                draftReviewReleaseText: metadata.draftReviewReleaseText + ' ',
              }),
        });
      } else if (kind === 'ownership') {
        const path = `${root}/entitlements/review-BOS-2033-1`;
        seedMockData(path, {
          ...(getMockData(path) as object),
          holderTeam: 'MIA',
        });
      } else {
        const path = `${root}/teams/BOS`;
        const team = getMockData(path) as any;
        team.salaryBookInputs.seasonCloseApronMeasurement =
          kind === 'missing'
            ? null
            : {
                ...team.salaryBookInputs.seasonCloseApronMeasurement,
                apronTeamSalary: 1,
              };
        seedMockData(path, team);
      }
      const before = state();
      await expect(
        prepareSyntheticDraftSeasonReview(request)
      ).rejects.toThrow();
      expect(state()).toEqual(before);
    }
  );
  it.each(['team', 'entitlement', 'metadata'] as const)(
    'fences actual commit-time %s changes',
    async (kind) => {
      await seed();
      const token = await prepareSyntheticDraftSeasonReview(request);
      const original = firestore.runTransaction;
      let expected: ReturnType<typeof state>;
      vi.spyOn(firestore, 'runTransaction').mockImplementation(
        async (...args) => {
          const path =
            kind === 'team'
              ? `${root}/teams/BOS`
              : kind === 'entitlement'
                ? `${root}/entitlements/review-BOS-2033-1`
                : root;
          seedMockData(path, {
            ...((getMockData(path) as object) ?? {}),
            changedByConcurrentWriter: true,
          });
          expected = state();
          return original(...args);
        }
      );
      const result = await advanceSeasonInWorld(worldId, {
        draftReviewAuthority: token,
      });
      expect(result.success).toBe(false);
      expect(expected, JSON.stringify(result)).toBeDefined();
      expect(result.success ? '' : result.error).toMatch(
        /Stale|concurrent|certified predecessor/
      );
      expect(state()).toEqual(expected!);
    },
    30000
  );
  it('writes nothing on a failed atomic commit and allows a fresh retry exactly once', async () => {
    await seed();
    const token = await prepareSyntheticDraftSeasonReview(request);
    const before = state();
    failMockBatchCommitAfter(0);
    expect(
      (await advanceSeasonInWorld(worldId, { draftReviewAuthority: token }))
        .success
    ).toBe(false);
    expect(state()).toEqual(before);
    const retry = await prepareSyntheticDraftSeasonReview(request);
    expect(
      (await advanceSeasonInWorld(worldId, { draftReviewAuthority: retry }))
        .success
    ).toBe(true);
  }, 30000);
  it('rejects a v2 trade in a world edited to skip the persisted advance', async () => {
    const fixture = await seed();
    seedMockData(root, {
      ...fixture.metadata,
      currentSeason: '2026-27',
      asOfDate: '2026-07-01',
      actionCount: 1,
    });
    for (const [team, data] of Object.entries(fixture.teams))
      seedMockData(`${root}/teams/${team}`, { ...data, season: '2026-27' });
    const before = state();
    await expect(
      prepareSyntheticDraftReview({
        ...request,
        seasonId: '2026-27',
        mutationType: 'executeTrade',
        payload: fixture.source.proposal,
      })
    ).rejects.toThrow();
    expect(state()).toEqual(before);
  });
  it('requires the exact persisted manifest, event and every history before the v2 trade', async () => {
    const fixture = await seed();
    const authority = await prepareSyntheticDraftSeasonReview(request);
    expect(
      (await advanceSeasonInWorld(worldId, { draftReviewAuthority: authority }))
        .success
    ).toBe(true);
    const persisted = state();
    const args = {
      ...request,
      seasonId: '2026-27',
      mutationType: 'executeTrade',
      payload: fixture.source.proposal,
    };
    for (const [path, field, value] of [
      [`${root}/seasonTransitions/${transitionId}`, '__missing__', null],
      [`${root}/events/${transitionId}`, '__missing__', null],
      [`${root}/seasonHistory/2025-26__WAS`, '__missing__', null],
      [
        `${root}/seasonTransitions/${transitionId}`,
        'operationId',
        'wrong-operation',
      ],
      [`${root}/events/${transitionId}`, 'metadata', {}],
      [`${root}/seasonHistory/2025-26__WAS`, 'worldId', 'other-world'],
      [`${root}/seasonHistory/2025-26__BOS`, 'afterTotals', {}],
      [`${root}/seasonHistory/2025-26__MIA`, 'draftReviewFreezeEvent', {}],
      [`${root}/transitionProvenance/baseline`, '__missing__', null],
      [`${root}/transitionProvenance/baseline`, 'stateHashes', {}],
      [`${root}/transitionProvenance/${transitionId}`, '__missing__', null],
      [`${root}/transitionProvenance/${transitionId}`, 'publishedHashes', {}],
      [`${root}/transitionProvenance/head`, 'worldId', 'another-world'],
    ] as const) {
      resetMockDataStore();
      for (const [key, data] of persisted.entries()) seedMockData(key, data);
      expect(state()).toEqual(persisted);
      if (field === '__missing__') {
        resetMockDataStore();
        for (const [key, data] of persisted.entries())
          if (key !== path) seedMockData(key, data);
      } else
        seedMockData(path, {
          ...(getMockData(path) as object),
          [field]: value,
        });
      const before = state();
      await expect(
        prepareSyntheticDraftReview(args),
        `${path}:${field}`
      ).rejects.toThrow();
      expect(state()).toEqual(before);
    }
  }, 30000);
  it.each([
    'seasonHistory/2025-26__WAS',
    'transitionProvenance/baseline',
    'transitionProvenance/head',
  ])(
    'fences %s changed at the actual later-trade transaction',
    async (relativePath) => {
      const fixture = await seed();
      const authority = await prepareSyntheticDraftSeasonReview(request);
      expect(
        (
          await advanceSeasonInWorld(worldId, {
            draftReviewAuthority: authority,
          })
        ).success
      ).toBe(true);
      const args = {
        ...request,
        operationId: 'trade-after-season',
        seasonId: '2026-27',
        mutationType: 'executeTrade',
        payload: fixture.source.proposal,
      };
      const prepared = await prepareSyntheticDraftReview(args);
      expect(prepared.status).toBe('prepared');
      if (prepared.status !== 'prepared') throw new Error('No prepared trade');
      const original = firestore.runTransaction;
      let expected: ReturnType<typeof state> | undefined;
      vi.spyOn(firestore, 'runTransaction').mockImplementation(
        async (...transactionArgs) => {
          const path = `${root}/${relativePath}`;
          seedMockData(path, {
            ...(getMockData(path) as object),
            changedAfterTradeReview: true,
          });
          expected = state();
          return original(...transactionArgs);
        }
      );
      const result = await applyWorldMutation({
        ...args,
        draftReviewAuthority: prepared.authority,
      });
      expect(expected).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/changed before commit/);
      expect(state()).toEqual(expected);
    },
    30000
  );
});

describe('server certification admission', () => {
  it('refuses a different authenticated owner with no writes', async () => {
    await seed();
    const authority = await prepareSyntheticDraftSeasonReview(request);
    const before = state();
    mode.userId = 'different-owner';
    expect(
      (await advanceSeasonInWorld(worldId, { draftReviewAuthority: authority }))
        .success
    ).toBe(false);
    expect(state()).toEqual(before);
  });
  it('refuses production certification even for an otherwise supported payload', async () => {
    const { publishCertifiedSeasonTransition } = await import(
      '@/features/architect/utils/seasonManager.server'
    );
    vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
    await expect(
      publishCertifiedSeasonTransition(null as any, 'review-user', {})
    ).rejects.toThrow(/unavailable/);
  });
});

describe('historical result contract without a new freeze algorithm', () => {
  it.each([
    'missing',
    'duplicate',
    'wrongPick',
    'wrongYear',
    'unqualified',
    'future',
    'timestamp',
  ] as const)('rejects %s supplied evidence', (kind) => {
    const fixture = syntheticDraftSeasonFixture(request.userId, worldId);
    const source = structuredClone(fixture.lifecycle);
    const input = source.freezeInputs[0];
    if (kind === 'missing') input.observations = [];
    if (kind === 'duplicate') source.freezeInputs[1] = structuredClone(input);
    if (kind === 'wrongPick') input.originalPick.draftYear = 2034;
    if (kind === 'wrongYear') input.triggerSeasonStartYear = 2024;
    if (kind === 'unqualified')
      input.observations[0].sources[0].qualification = 'unqualified';
    if (kind === 'future') input.observations[0].state = 'future-pending';
    if (kind === 'timestamp')
      input.observations[0].value!.lastRegularSeasonGameStart =
        '2026-04-11T23:00:00Z';
    expect(() =>
      buildSyntheticFreezeEvents({
        source,
        measurements: fixture.lifecycle.measurements,
        worldId,
        releaseId: 'fixture',
        releaseSha256: 'a'.repeat(64),
        effectiveAt: source.effectiveAt,
      })
    ).toThrow();
  });
});
