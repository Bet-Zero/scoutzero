/**
 * FILE: src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E82 firebaseTeamPlanHelpers TS authority + JS shim split.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-13: E82 - Added compatibility and behavior-preservation guardrails for firebaseTeamPlanHelpers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FREE_AGENTS_COLLECTION,
} from '@/constants/collections';
import { TeamListFull } from '@/constants/teamList';
import * as firebaseTeamPlanHelpersModule from '@/features/architect/utils/firebaseTeamPlanHelpers';
import {
  prepareCapSheet,
  hydrateBaseTeam,
  loadTeamCapSheet,
  getAllTeams,
  saveFreeAgents,
  loadFreeAgents,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { readLooseBaseTeamDoc } from '@/features/architect/utils/firebaseTeamPlanHelpers.readers';

type FirestoreDocData = Record<string, unknown>;
type DocValue = FirestoreDocData | null;
type SnapshotDoc = { id: string; data: FirestoreDocData };
type BatchSetWrite = { ref: { id: string }; data: FirestoreDocData };
type HydratedPlayerFixture = FirestoreDocData & { id: string };
type HydratedTeamFixture = FirestoreDocData & {
  roster: unknown;
  players: HydratedPlayerFixture[];
  baseline: FirestoreDocData;
  exceptions: FirestoreDocData;
  activeContracts: FirestoreDocData[];
};

const firestoreState = vi.hoisted(() => ({
  baseTeamDocs: new Map<string, DocValue>(),
  basePlayerDocs: new Map<string, DocValue>(),
  baseTeamsSnapshotDocs: [] as SnapshotDoc[],
  baseTeamsEmpty: true,
  baseTeamsShouldThrow: false,
  freeAgentDocs: [] as SnapshotDoc[],
  freeAgentsShouldThrow: false,
  getDocOrder: [] as string[],
  maxConcurrentGetDoc: 0,
  activeGetDoc: 0,
  throwGetDocForKey: new Map<string, Error>(),
  writeBatchSets: [] as BatchSetWrite[],
  batchCommitShouldThrow: false,
  batchCommitCalls: 0,
}));

vi.mock('@/firebaseConfig', () => ({
  db: { kind: 'mock-db' },
}));

vi.mock('@/data/firestorePaths', () => ({
  baseTeamRef: (teamCode: string) => ({ kind: 'baseTeamRef', teamCode }),
  baseTeamsCol: () => ({ kind: 'baseTeamsCollection' }),
  basePlayerRef: (playerId: string) => ({ kind: 'basePlayerRef', playerId }),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, _collectionName: string, id: string) => ({
    kind: 'freeAgentDoc',
    id,
  })),
  collection: vi.fn((_db: unknown, collectionName: string) => ({
    kind: 'freeAgentsCollection',
    collectionName,
  })),
  getDoc: vi.fn(async (ref: { kind: string; teamCode?: string; playerId?: string }) => {
    const key =
      ref.kind === 'baseTeamRef'
        ? `baseTeam:${ref.teamCode}`
        : `basePlayer:${ref.playerId}`;

    firestoreState.getDocOrder.push(
      ref.kind === 'baseTeamRef' ? String(ref.teamCode) : String(ref.playerId)
    );
    firestoreState.activeGetDoc += 1;
    firestoreState.maxConcurrentGetDoc = Math.max(
      firestoreState.maxConcurrentGetDoc,
      firestoreState.activeGetDoc
    );

    try {
      await Promise.resolve();

      const thrownError = firestoreState.throwGetDocForKey.get(key);
      if (thrownError) {
        throw thrownError;
      }

      const data =
        ref.kind === 'baseTeamRef'
          ? firestoreState.baseTeamDocs.get(String(ref.teamCode))
          : firestoreState.basePlayerDocs.get(String(ref.playerId));

      return {
        exists: () => data !== null && data !== undefined,
        data: () => data || {},
      };
    } finally {
      firestoreState.activeGetDoc -= 1;
    }
  }),
  getDocs: vi.fn(async (ref: { kind: string }) => {
    if (ref.kind === 'baseTeamsCollection') {
      if (firestoreState.baseTeamsShouldThrow) {
        throw new Error('base teams failed');
      }

      return {
        empty: firestoreState.baseTeamsEmpty,
        docs: firestoreState.baseTeamsSnapshotDocs.map((docSnap) => ({
          id: docSnap.id,
          data: () => docSnap.data,
        })),
      };
    }

    if (firestoreState.freeAgentsShouldThrow) {
      throw new Error('free agents failed');
    }

    return {
      docs: firestoreState.freeAgentDocs.map((docSnap) => ({
        id: docSnap.id,
        data: () => docSnap.data,
      })),
    };
  }),
  writeBatch: vi.fn(() => ({
    set: vi.fn((ref: { id: string }, data: FirestoreDocData) => {
      firestoreState.writeBatchSets.push({ ref, data });
    }),
    commit: vi.fn(async () => {
      firestoreState.batchCommitCalls += 1;
      if (firestoreState.batchCommitShouldThrow) {
        throw new Error('batch failed');
      }
    }),
  })),
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '../../features/architect');
const deletedShimPath = path.join(srcRoot, 'utils/firebaseTeamPlanHelpers.js');
const authorityPath = path.join(srcRoot, 'utils/firebaseTeamPlanHelpers.ts');

const expectedNamedExports = [
  'getAllTeams',
  'hydrateBaseTeam',
  'loadFreeAgents',
  'loadTeamCapSheet',
  'prepareCapSheet',
  'saveFreeAgents',
];

const expectedHydratedTeamKeys = [
  'id',
  'teamCode',
  'teamName',
  'season',
  'abbreviation',
  'players',
  'roster',
  'activeContracts',
  'capHolds',
  'draftPicks',
  'draftPicksInventory',
  'draftPicksObligations',
  'draftPicksContested',
  'draftAssets',
  'entitlementIds',
  'offerSheets',
  'incomingOfferSheets',
  'exceptions',
  'hardCapLevel',
  'hardCapReason',
  'hardCapTriggeredBy',
  'hardCapped',
  'deadCap',
  'baseline',
  'totals',
  'salaryBookInputs',
];

beforeEach(() => {
  firestoreState.baseTeamDocs.clear();
  firestoreState.basePlayerDocs.clear();
  firestoreState.baseTeamsSnapshotDocs = [];
  firestoreState.baseTeamsEmpty = true;
  firestoreState.baseTeamsShouldThrow = false;
  firestoreState.freeAgentDocs = [];
  firestoreState.freeAgentsShouldThrow = false;
  firestoreState.getDocOrder = [];
  firestoreState.maxConcurrentGetDoc = 0;
  firestoreState.activeGetDoc = 0;
  firestoreState.throwGetDocForKey.clear();
  firestoreState.writeBatchSets = [];
  firestoreState.batchCommitShouldThrow = false;
  firestoreState.batchCommitCalls = 0;
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('E82 firebaseTeamPlanHelpers compatibility guardrails', () => {
  it('rejects malformed governed salary-book inputs at the Firestore read boundary', () => {
    expect(() =>
      readLooseBaseTeamDoc(
        {
          teamName: 'Malformed Books',
          salaryBookInputs: {
            version: 1,
            salaryCapYear: 2026,
            apronAdjustments: { status: 'ready', lineItems: 'not-an-array' },
            taxSalary: { status: 'not-evaluated', reason: 'fixture' },
          },
        },
        'LAL',
        'architect_baseTeams/LAL'
      )
    ).toThrow();
  });
  it('firebaseTeamPlanHelpers.js is absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(deletedShimPath)).toBe(false);
  });

  it('extensionless import exposes the same named API as the surviving authority with no default export', () => {
    // Compatibility invariant: every required canonical name is still on
    // the extensionless module surface and is the same reference as the
    // imported authority binding. Stage 6B: later refactors split internal
    // helpers into sub-modules that re-export additional names via
    // `export *`. Those extra re-exports are non-breaking, since callers
    // never depended on the surface being closed.
    const source = fs.readFileSync(authorityPath, 'utf-8');

    const moduleKeys = new Set(Object.keys(firebaseTeamPlanHelpersModule));
    for (const name of expectedNamedExports) {
      expect(
        moduleKeys.has(name),
        `extensionless firebaseTeamPlanHelpers surface must still export ${name}`
      ).toBe(true);
    }
    expect(firebaseTeamPlanHelpersModule.prepareCapSheet).toBe(prepareCapSheet);
    expect(firebaseTeamPlanHelpersModule.hydrateBaseTeam).toBe(hydrateBaseTeam);
    expect(firebaseTeamPlanHelpersModule.loadTeamCapSheet).toBe(loadTeamCapSheet);
    expect(firebaseTeamPlanHelpersModule.getAllTeams).toBe(getAllTeams);
    expect(firebaseTeamPlanHelpersModule.saveFreeAgents).toBe(saveFreeAgents);
    expect(firebaseTeamPlanHelpersModule.loadFreeAgents).toBe(loadFreeAgents);
    expect(source).not.toContain('export default');
  });

  it('preserves prepareCapSheet pass-through behavior for weaker export coverage', () => {
    const prepared = prepareCapSheet({
      teamCode: 'LAL',
      capHolds: null,
      note: 'keep',
    }) as {
      teamCode: string;
      capHolds: unknown[];
      note: string;
      updatedAt: string;
    };

    expect(Object.keys(prepared)).toEqual([
      'teamCode',
      'capHolds',
      'note',
      'updatedAt',
    ]);
    expect(prepared.capHolds).toEqual([]);
    expect(prepared.note).toBe('keep');
    expect(typeof prepared.updatedAt).toBe('string');
  });

  it('hydrates canonical exception ownership shape, fallback behavior, and sequential player hydration', async () => {
    const baseDoc = {
      teamName: 'Los Angeles Lakers',
      season: '2025-26',
      abbreviation: 'LAL',
      roster: ['alpha', 'missing', 'beta'],
      capHolds: [{ id: 'hold-1' }],
      draftPicks: [{ id: 'pick-1' }],
      draftPicksObligations: [{ id: 'owed-1' }],
      draftPicksContested: [{ id: 'swap-1' }],
      draftAssets: [{ id: 'asset-1', assetType: 'outright_pick' }],
      entitlementIds: ['ent-1'],
      offerSheets: [{ id: 'offer-1' }],
      incomingOfferSheets: [{ id: 'incoming-1' }],
      tpMle: {
        totalAmount: 5_200_000,
        usedAmount: 1_000_000,
        remainingAmount: 4_200_000,
      },
      tradeExceptions: [
        {
          id: 'legacy-tpe-1',
          amount: 1_250_000,
          remaining: 1_000_000,
          createdFrom: 'legacy-trade-1',
          expires: '2026-08-01',
        },
      ],
      exceptions: {
        mle: {
          totalAmount: 12_800_000,
          usedAmount: 3_000_000,
          remainingAmount: 9_800_000,
        },
        bae: {
          totalAmount: 4_700_000,
          usedAmount: 0,
          remainingAmount: 4_700_000,
        },
        tpe: [
          {
            id: 'tpe-1',
            label: 'TPE One',
            totalAmount: 2_000_000,
            usedAmount: 500_000,
            remainingAmount: 1_500_000,
            createdFrom: 'trade-1',
            expiresOn: '2026-07-01',
          },
        ],
      },
      deadCap: [{ id: 'dead-1' }],
      salaryBookInputs: {
        version: 1 as const,
        salaryCapYear: 2026,
        apronAdjustments: {
          status: 'not-evaluated' as const,
          reason: 'Compatibility fixture',
        },
        taxSalary: {
          status: 'not-evaluated' as const,
          reason: 'Compatibility fixture',
        },
      },
      // Genuinely hard-capped: the team used its NT-MLE. `hardCapLevel` alone
      // is only the apron-band descriptor and must not mark a team hard-capped.
      hardCapTriggeredBy: 'NT-MLE',
      totals: {
        totalSalary: 190_000_000,
        hardCapLevel: 'firstApron',
      },
    };

    firestoreState.basePlayerDocs.set('alpha', {
      playerId: 'alpha',
      displayName: 'Alpha Player',
      bio: {
        position: 'G',
        age: 24,
        experience: 3,
      },
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      contract: {
        salariesByYear: [
          {
            season: '2025-26',
            salary: 12_000_000,
          },
        ],
        yearsRemaining: 2,
        contractType: 'Standard',
        birdRights: {
          yearsOfService: 3,
        },
      },
      futureContract: {
        salariesByYear: [
          {
            season: '2026-27',
            salary: 13_000_000,
          },
        ],
      },
      representation: {
        agent: 'Agent Alpha',
      },
    });
    firestoreState.basePlayerDocs.set('beta', {
      playerId: 'beta',
      displayName: 'Beta Player',
      bio: {
        position: 'F',
        age: 27,
      },
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      contract: {
        salariesByYear: [],
        yearsRemaining: 1,
      },
    });

    const hydratedTeam = (await hydrateBaseTeam(
      'LAL',
      baseDoc
    )) as HydratedTeamFixture;

    expect(Object.keys(hydratedTeam)).toEqual(expectedHydratedTeamKeys);
    expect(hydratedTeam.teamCode).toBe('LAL');
    expect(hydratedTeam.id).toBe('lakers');
    expect(hydratedTeam.roster).toBe(hydratedTeam.players);
    expect(hydratedTeam.baseline).not.toBe(baseDoc);
    expect(hydratedTeam.hardCapLevel).toBe('firstApron');
    expect(hydratedTeam.hardCapped).toBe(true);
    expect(hydratedTeam.salaryBookInputs).toEqual(baseDoc.salaryBookInputs);
    expect(hydratedTeam.exceptions).toEqual(
      expect.objectContaining({
        mle: expect.objectContaining({
          remainingAmount: 9_800_000,
        }),
        tpmle: expect.objectContaining({
          remainingAmount: 4_200_000,
        }),
        bae: expect.objectContaining({
          remainingAmount: 4_700_000,
        }),
        tpe: expect.arrayContaining([
          expect.objectContaining({
            id: 'legacy-tpe-1',
            amount: 1_250_000,
            remaining: 1_000_000,
          }),
          expect.objectContaining({
            id: 'tpe-1',
            remainingAmount: 1_500_000,
          }),
        ]),
      })
    );
    expect(hydratedTeam.exceptions.taxpayerMle).toBeUndefined();
    expect(hydratedTeam.exceptions.tpMle).toBeUndefined();
    expect(hydratedTeam.exceptions.biAnnual).toBeUndefined();
    expect(hydratedTeam.mle).toBeUndefined();
    expect(hydratedTeam.tpMle).toBeUndefined();
    expect(hydratedTeam.bae).toBeUndefined();
    expect(hydratedTeam.tradeExceptions).toBeUndefined();
    expect(hydratedTeam.baseline.tradeExceptions).toBeUndefined();
    expect(hydratedTeam.players.map((player: { id: string }) => player.id)).toEqual([
      'alpha',
      'missing',
      'beta',
    ]);

    expect(Object.keys(hydratedTeam.players[0])).toEqual([
      'id',
      'player_id',
      'name',
      'displayName',
      'position',
      'age',
      'teamCode',
      'teamName',
      'contract',
      'futureContract',
      'bio',
      'representation',
      'original',
    ]);
    expect(Object.keys(hydratedTeam.players[1])).toEqual([
      'id',
      'player_id',
      'name',
      'displayName',
      'contract',
      'bio',
      'original',
    ]);
    expect(hydratedTeam.players[1]).toEqual({
      id: 'missing',
      player_id: 'missing',
      name: 'missing',
      displayName: 'missing',
      contract: null,
      bio: {},
      original: null,
    });
    expect(Object.keys(hydratedTeam.activeContracts[0])).toEqual([
      'name',
      'player_id',
      'contract',
      'years',
      'type',
      'signAndTrade',
      'guaranteed',
      'isMinimum',
      'yearsOfService',
    ]);
    expect(hydratedTeam.draftPicksInventory).toEqual(baseDoc.draftPicks);
    expect(hydratedTeam.draftPicksObligations).toEqual(baseDoc.draftPicksObligations);
    expect(hydratedTeam.draftPicksContested).toEqual(baseDoc.draftPicksContested);
    expect(firestoreState.getDocOrder).toEqual(['alpha', 'missing', 'beta']);
    expect(firestoreState.maxConcurrentGetDoc).toBe(1);
  });

  it('preserves loadTeamCapSheet team-code resolution, null fallbacks, and error handling', async () => {
    firestoreState.baseTeamDocs.set('LAL', {
      teamName: 'Los Angeles Lakers',
      roster: [],
      totals: {
        hardCapLevel: 'none',
      },
    });

    const fromSlug = await loadTeamCapSheet('lakers');
    const fromLowerCode = await loadTeamCapSheet('lal');

    expect(fromSlug?.teamCode).toBe('LAL');
    expect(fromLowerCode?.teamCode).toBe('LAL');
    expect(fromLowerCode?.hardCapLevel).toBe('none');
    expect(fromLowerCode?.hardCapped).toBe(false);

    const missingTeamId = await loadTeamCapSheet(null);
    expect(missingTeamId).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'Unable to resolve team code for:',
      null
    );

    const missingTeam = await loadTeamCapSheet('BOS');
    expect(missingTeam).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      'No base team data found for:',
      'BOS'
    );

    firestoreState.throwGetDocForKey.set(
      'baseTeam:NYK',
      new Error('team load failed')
    );
    const erroredTeam = await loadTeamCapSheet('nyk');
    expect(erroredTeam).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Error loading base team:',
      expect.any(Error)
    );
  });

  it('preserves getAllTeams firestore mapping and static fallback behavior', async () => {
    firestoreState.baseTeamsEmpty = false;
    firestoreState.baseTeamsSnapshotDocs = [
      {
        id: 'LAL',
        data: { teamName: 'Override Lakers' },
      },
      {
        id: 'SEA',
        data: { teamName: 'Seattle Supersonics' },
      },
    ];

    const loadedTeams = await getAllTeams();

    expect(loadedTeams).toEqual([
      {
        id: 'lakers',
        code: 'LAL',
        name: 'Los Angeles Lakers',
        conference: 'West',
      },
      {
        id: 'sea',
        code: 'SEA',
        name: 'Seattle Supersonics',
        conference: null,
      },
    ]);

    firestoreState.baseTeamsEmpty = true;
    firestoreState.baseTeamsSnapshotDocs = [];
    expect(await getAllTeams()).toEqual(
      TeamListFull.map(
        (team: {
          id: string;
          code: string;
          teamName: string;
          conference: string | null;
        }) => ({
        id: team.id,
        code: team.code,
        name: team.teamName,
        conference: team.conference,
      })
      )
    );

    firestoreState.baseTeamsShouldThrow = true;
    expect(await getAllTeams()).toEqual(
      TeamListFull.map(
        (team: {
          id: string;
          code: string;
          teamName: string;
          conference: string | null;
        }) => ({
        id: team.id,
        code: team.code,
        name: team.teamName,
        conference: team.conference,
      })
      )
    );
    expect(console.error).toHaveBeenCalledWith(
      'Error getting base teams:',
      expect.any(Error)
    );
  });

  it('preserves saveFreeAgents write behavior and loadFreeAgents fallback behavior', async () => {
    const saveResult = await saveFreeAgents([
      { id: 'fa-1', name: 'First Agent' },
      { name: 'Fallback Name Agent' },
    ]);

    expect(saveResult).toBe(true);
    expect(firestoreState.batchCommitCalls).toBe(1);
    expect(firestoreState.writeBatchSets).toEqual([
      {
        ref: { kind: 'freeAgentDoc', id: 'fa-1' },
        data: { id: 'fa-1', name: 'First Agent' },
      },
      {
        ref: { kind: 'freeAgentDoc', id: 'Fallback Name Agent' },
        data: { name: 'Fallback Name Agent' },
      },
    ]);
    expect(console.log).toHaveBeenCalledWith('Saved free agents');

    firestoreState.batchCommitShouldThrow = true;
    expect(await saveFreeAgents([{ id: 'fa-2', name: 'Second Agent' }])).toBe(
      false
    );
    expect(console.error).toHaveBeenCalledWith(
      'Error saving free agents:',
      expect.any(Error)
    );

    firestoreState.freeAgentDocs = [
      {
        id: 'fa-1',
        data: { name: 'First Agent', sourceCollection: FREE_AGENTS_COLLECTION },
      },
      {
        id: 'fa-2',
        data: { name: 'Second Agent' },
      },
    ];

    expect(await loadFreeAgents()).toEqual([
      {
        id: 'fa-1',
        name: 'First Agent',
        sourceCollection: FREE_AGENTS_COLLECTION,
      },
      {
        id: 'fa-2',
        name: 'Second Agent',
      },
    ]);

    firestoreState.freeAgentsShouldThrow = true;
    expect(await loadFreeAgents()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      'Error loading free agents:',
      expect.any(Error)
    );
  });
});
