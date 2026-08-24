import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TradeHardCapLedgerZ } from '@/schemas/tradeApronRestriction';
import { CANON_GOVERNED_SEASON_REGISTRY } from '@/features/architect/utils/governedSeason';
import { parseTradeHardCapLedger } from '@/features/architect/utils/tradeMachine/utils/tradeHardCapLedgerAuthority';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.resolve(__dirname, '../../../firestore.rules');

const PROJECT_ID = 'architect-rules-integration-e1';
const WORLD_ID = 'world_owner_uid_a';
const CLAIMED_CHILD_ID = 'world_claimed_child_uid_a';
const TEAM_CODE = 'LAL';
const EVENT_ID = 'evt_1';
const ENTITLEMENT_ID = 'ent_1';
const PLAYER_ID = 'player_1';
const OFFER_SHEET_ID = 'offer_sheet_1';
const SEASON_TRANSITION_ID = 'seasonAdvance__2025-26__2026-27';
const SEASON_HISTORY_ID = '2025-26__LAL';
const RULES_SEASON_TEAM_CODES = [
  TEAM_CODE,
  ...Array.from(
    { length: 29 },
    (_, index) => `T${String(index).padStart(2, '0')}`
  ),
];
const UID_A = 'uid-owner-a';
const UID_B = 'uid-non-owner-b';
const HAS_FIRESTORE_EMULATOR_HOST = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST
);

let testEnv: RulesTestEnvironment;

function requireEmulatorHost(): { host: string; port: number } {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is required for firestoreRules.integration.test.ts. Run via npm run test:rules.'
    );
  }

  const [host, portRaw] = emulatorHost.split(':');
  const port = Number(portRaw);
  if (!host || Number.isNaN(port)) {
    throw new Error(
      `Invalid FIRESTORE_EMULATOR_HOST "${emulatorHost}". Expected host:port (for example 127.0.0.1:8082).`
    );
  }

  return { host, port };
}

function ownerDb() {
  return testEnv.authenticatedContext(UID_A).firestore();
}

function nonOwnerDb() {
  return testEnv.authenticatedContext(UID_B).firestore();
}

async function seedOwnedWorld(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'architect_worlds', WORLD_ID), {
      worldId: WORLD_ID,
      name: 'Rules Integration World',
      createdBy: UID_A,
      isArchived: false,
      lastModifiedAt: 1,
    });
  });
}

async function seedOwnedList(listId: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'lists', listId), {
      ownerUid: UID_A,
      title: 'Owner List',
    });
  });
}

async function seedOwnedTierList(tierListId: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'tierLists', tierListId), {
      ownerUid: UID_A,
      title: 'Owner Tier List',
    });
  });
}

function offerSheetAuthorizationData(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    authorizationVersion: 1,
    worldId: WORLD_ID,
    offerSheetId: OFFER_SHEET_ID,
    dedupKey: `os:${WORLD_ID}:LAL:${PLAYER_ID}:2025-26`,
    playerId: PLAYER_ID,
    homeTeamId: 'BOS',
    offeringTeamId: 'LAL',
    salaryCapYear: 2026,
    pendingLifecycleDigest: `fnv1a64:${'a'.repeat(16)}`,
    immutableEvidenceDigest: `fnv1a64:${'b'.repeat(16)}`,
    ...overrides,
  };
}

function seasonTransitionManifestData(): Record<string, unknown> {
  return {
    schemaVersion: 'season-transition-manifest-v1',
    transitionId: SEASON_TRANSITION_ID,
    operationId: 'rules-season-advance',
    eventId: SEASON_TRANSITION_ID,
    worldId: WORLD_ID,
    fromSeason: '2025-26',
    toSeason: '2026-27',
    fromSalaryCapYear: 2026,
    toSalaryCapYear: 2027,
    seasonCloseDate: '2026-04-12',
    transitionEffectiveAt: '2026-07-01T00:00:00Z',
    committedAt: '2026-07-01T00:00:00Z',
    authority: { registryId: 'rules-fixture' },
    authorityDigest: `fnv1a64:${'a'.repeat(16)}`,
    entitlementBoundary: { mode: 'preserve-or-fail' },
    preAdvanceMetadataDigest: `fnv1a64:${'b'.repeat(16)}`,
    teamRecords: RULES_SEASON_TEAM_CODES.map((teamCode) => ({ teamCode })),
    reconciliation: {
      expectedTeamCount: 30,
      preparedTeamCount: 30,
      completeBookCount: 30,
      historyRecordCount: 30,
      entitlementPreservationCount: 30,
    },
    canonLeafIds: ['CBA2-L08.1'],
  };
}

function seasonHistoryData(
  teamCode: string = TEAM_CODE,
  historyId: string = SEASON_HISTORY_ID
): Record<string, unknown> {
  return {
    schemaVersion: 'season-history-v1',
    historyId,
    transitionId: SEASON_TRANSITION_ID,
    worldId: WORLD_ID,
    teamCode,
    fromSeason: '2025-26',
    toSeason: '2026-27',
    seasonCloseDate: '2026-04-12',
    transitionEffectiveAt: '2026-07-01T00:00:00Z',
    preAdvanceState: {},
    preAdvanceStateDigest: `fnv1a64:${'c'.repeat(16)}`,
    finalRoster: [],
    finalRosterDigest: `fnv1a64:${'d'.repeat(16)}`,
    seasonCloseApronMeasurement: {},
    beforeTotals: {},
    afterTotals: {},
    contractEvents: [],
    entitlementStateDigest: `fnv1a64:${'e'.repeat(16)}`,
    authorityDigest: `fnv1a64:${'f'.repeat(16)}`,
  };
}

beforeAll(async () => {
  if (!HAS_FIRESTORE_EMULATOR_HOST) {
    return;
  }

  const rules = await fs.readFile(rulesPath, 'utf8');
  const { host, port } = requireEmulatorHost();

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules,
    },
  });
});

afterEach(async () => {
  if (!testEnv) {
    return;
  }

  await testEnv.clearFirestore();
});

afterAll(async () => {
  if (!testEnv) {
    return;
  }

  await testEnv.cleanup();
});

const describeWithFirestoreEmulator = HAS_FIRESTORE_EMULATOR_HOST
  ? describe
  : describe.skip;

describeWithFirestoreEmulator(
  'ARCHITECT_RULES_INTEGRATION_E1 - Firestore rules integration matrix',
  () => {
    it('1) direct clients cannot create world metadata', async () => {
      const db = ownerDb();
      await assertFails(
        setDoc(doc(db, 'architect_worlds', WORLD_ID), {
          worldId: WORLD_ID,
          createdBy: UID_A,
          name: 'Owner world',
        })
      );
    });

    it('1b) direct clients cannot establish governed baseline shards', async () => {
      const db = ownerDb();
      const batch = writeBatch(db);
      batch.set(doc(db, 'architect_worlds', WORLD_ID), {
        worldId: WORLD_ID,
        createdBy: UID_A,
        name: 'Governed baseline world',
      });
      batch.set(
        doc(db, 'architect_worlds', WORLD_ID, 'contractBaselines', 'LAL-000'),
        { worldId: WORLD_ID, teamId: 'LAL', shardId: 'LAL-000' }
      );
      await assertFails(batch.commit());
    });

    it('1c) non-owner cannot attach a baseline shard to another owner world', async () => {
      await seedOwnedWorld();
      const db = nonOwnerDb();
      await assertFails(
        setDoc(
          doc(db, 'architect_worlds', WORLD_ID, 'contractBaselines', 'LAL-000'),
          { worldId: WORLD_ID, teamId: 'LAL', shardId: 'LAL-000' }
        )
      );
    });

    it('1d) governed baseline shards cannot be added, updated, or deleted after initialization', async () => {
      const db = ownerDb();
      const baselineRef = doc(
        db,
        'architect_worlds',
        WORLD_ID,
        'contractBaselines',
        'LAL-000'
      );
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const trustedDb = context.firestore();
        await setDoc(doc(trustedDb, 'architect_worlds', WORLD_ID), {
          worldId: WORLD_ID,
          createdBy: UID_A,
          name: 'Immutable governed baseline world',
          contractBaselineVersion: 2,
          contractSourceRelease: {
            releaseId: 'release-v1',
            releaseVersion: 1,
            releaseDigest: `sha256:${'1'.repeat(64)}`,
          },
          contractBaselineEffectiveAt: '2026-06-05T12:00:00Z',
          contractBaselineSalaryCapYear: 2026,
          contractBaselineCoverage: { total: 1, complete: 1, needsInput: 0 },
        });
        await setDoc(
          doc(
            trustedDb,
            'architect_worlds',
            WORLD_ID,
            'contractBaselines',
            'LAL-000'
          ),
          { worldId: WORLD_ID, teamId: 'LAL', shardId: 'LAL-000' }
        );
      });

      await assertSucceeds(getDoc(baselineRef));
      await assertSucceeds(
        updateDoc(doc(db, 'architect_worlds', WORLD_ID), {
          name: 'Ordinary metadata still updates',
        })
      );
      for (const governedUpdate of [
        { contractBaselineVersion: 3 },
        {
          contractSourceRelease: {
            releaseId: 'release-v2',
            releaseVersion: 2,
            releaseDigest: `sha256:${'2'.repeat(64)}`,
          },
        },
        { contractBaselineEffectiveAt: '2027-06-05T12:00:00Z' },
        { contractBaselineSalaryCapYear: 2027 },
        {
          contractBaselineCoverage: { total: 2, complete: 2, needsInput: 0 },
        },
      ]) {
        await assertFails(
          updateDoc(doc(db, 'architect_worlds', WORLD_ID), governedUpdate)
        );
      }
      await assertFails(deleteDoc(doc(db, 'architect_worlds', WORLD_ID)));
      await assertFails(updateDoc(baselineRef, { teamId: 'BOS' }));
      await assertFails(deleteDoc(baselineRef));
      await assertFails(
        setDoc(
          doc(db, 'architect_worlds', WORLD_ID, 'contractBaselines', 'BOS-000'),
          { worldId: WORLD_ID, teamId: 'BOS', shardId: 'BOS-000' }
        )
      );
    });

    it('1e) a trusted partial-cleanup claim cannot race client finalization', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const trustedDb = context.firestore();
        await setDoc(doc(trustedDb, 'architect_worlds', WORLD_ID), {
          worldId: WORLD_ID,
          createdBy: UID_A,
          childWorlds: [],
          isArchived: false,
        });
        await setDoc(doc(trustedDb, 'architect_worlds', CLAIMED_CHILD_ID), {
          worldId: CLAIMED_CHILD_ID,
          createdBy: UID_A,
          parentWorldId: WORLD_ID,
          branchedFrom: 1,
          childWorlds: [],
          isArchived: true,
          partialBranchCleanupClaim: {
            state: 'claimed',
            childWorldId: CLAIMED_CHILD_ID,
            parentWorldId: WORLD_ID,
            ownerId: UID_A,
          },
        });
      });

      const db = ownerDb();
      const finalization = writeBatch(db);
      finalization.update(doc(db, 'architect_worlds', CLAIMED_CHILD_ID), {
        isArchived: false,
      });
      finalization.update(doc(db, 'architect_worlds', WORLD_ID), {
        childWorlds: [CLAIMED_CHILD_ID],
      });
      await assertFails(finalization.commit());
      await assertFails(
        updateDoc(doc(db, 'architect_worlds', WORLD_ID), {
          childWorlds: [CLAIMED_CHILD_ID],
        })
      );
      await assertFails(
        setDoc(
          doc(db, 'architect_worlds', CLAIMED_CHILD_ID, 'teams', TEAM_CODE),
          { teamCode: TEAM_CODE }
        )
      );

      const child = await assertSucceeds(
        getDoc(doc(db, 'architect_worlds', CLAIMED_CHILD_ID))
      );
      const parent = await assertSucceeds(
        getDoc(doc(db, 'architect_worlds', WORLD_ID))
      );
      expect(child.data()?.isArchived).toBe(true);
      expect(parent.data()?.childWorlds).toEqual([]);
    });

    it('2) non-owner cannot read world doc', async () => {
      await seedOwnedWorld();
      const db = nonOwnerDb();
      await assertFails(getDoc(doc(db, 'architect_worlds', WORLD_ID)));
    });

    it('2b) owner can list only their architect worlds by createdBy', async () => {
      await seedOwnedWorld();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'architect_worlds', 'world_owner_uid_b'), {
          worldId: 'world_owner_uid_b',
          name: 'Other owner world',
          createdBy: UID_B,
          isArchived: false,
          lastModifiedAt: 2,
        });
      });

      const owner = ownerDb();
      await assertSucceeds(
        getDocs(
          query(
            collection(owner, 'architect_worlds'),
            where('createdBy', '==', UID_A)
          )
        )
      );

      const nonOwner = nonOwnerDb();
      await assertFails(
        getDocs(
          query(
            collection(nonOwner, 'architect_worlds'),
            where('createdBy', '==', UID_A)
          )
        )
      );
    });

    it('3) non-owner cannot write/update world doc', async () => {
      await seedOwnedWorld();
      const db = nonOwnerDb();
      await assertFails(
        updateDoc(doc(db, 'architect_worlds', WORLD_ID), { name: 'intrusion' })
      );
    });

    it('4) owner can write world teams subcollection', async () => {
      await seedOwnedWorld();
      const db = ownerDb();
      await assertSucceeds(
        setDoc(doc(db, 'architect_worlds', WORLD_ID, 'teams', TEAM_CODE), {
          teamCode: TEAM_CODE,
        })
      );
    });

    it('4b) owner-writable team overlays do not provide ledger authority', async () => {
      await seedOwnedWorld();
      const db = ownerDb();
      const registry = CANON_GOVERNED_SEASON_REGISTRY;
      const creationCalendar = registry.calendars.find(
        (record) => record.salaryCapYear === 2026
      );
      const currentCalendar = registry.calendars.find(
        (record) => record.salaryCapYear === 2027
      );
      const firstApron = registry.systemLevels.find(
        (record) =>
          record.salaryCapYear === 2027 && record.levelId === 'first-apron'
      );
      const secondApron = registry.systemLevels.find(
        (record) =>
          record.salaryCapYear === 2027 && record.levelId === 'second-apron'
      );
      if (
        !creationCalendar ||
        !currentCalendar ||
        !firstApron ||
        !secondApron
      ) {
        throw new Error(
          'Expected governed 2026-27 hard-cap authority fixtures.'
        );
      }
      const proofBase = {
        registryId: registry.registryId,
        registryVersion: registry.registryVersion,
        canonCandidateCommit: registry.canonCandidateCommit,
        canonSha256: registry.canonSha256,
      };
      const rowFProof = {
        ...proofBase,
        calendarRecordId: creationCalendar.recordId,
        calendarRecordVersion: creationCalendar.recordVersion,
        apronRecordId: firstApron.recordId,
        apronRecordVersion: firstApron.recordVersion,
      };
      const rowHProof = {
        ...proofBase,
        calendarRecordId: currentCalendar.recordId,
        calendarRecordVersion: currentCalendar.recordVersion,
        apronRecordId: secondApron.recordId,
        apronRecordVersion: secondApron.recordVersion,
      };
      const tpeTiming = {
        tpeId: 'TPE-FORGED-OWNER-OVERLAY',
        createdOn: '2026-02-01T12:00:00-05:00',
        expiresOn: '2027-02-01T12:00:00-05:00',
      };
      const forgedLedger = [
        {
          version: 1,
          entryId: 'FORGED-OWNER-OVERLAY:hard-cap:LAL',
          teamCode: TEAM_CODE,
          salaryCapYear: 2027,
          restrictionRow: 'H',
          salaryMatchingPath: 'AGGREGATED_STANDARD_TPE',
          apronLevel: 'SECOND_APRON',
          ceiling: secondApron.amount,
          triggerTransactionDate: '2026-11-15T12:00:00-05:00',
          effectiveAt: '2026-11-15T17:00:00Z',
          expiresAt: '2027-07-01T00:00:00Z',
          transactionId: 'FORGED-OWNER-OVERLAY',
          tpeIds: [tpeTiming.tpeId],
          tpeTimings: [tpeTiming],
          canonLeafIds: ['CBA2-A02.3', 'CBA2-A05.8', 'CBA2-A05.10'],
          proof: rowHProof,
          triggers: [
            {
              restrictionRow: 'F',
              componentId: tpeTiming.tpeId,
              componentKind: 'HELD_STANDARD_TPE',
              salaryMatchingPath: 'STANDARD_TPE',
              apronLevel: 'FIRST_APRON',
              ceiling: 999_000_000,
              incomingPlayers: [
                {
                  playerId: 'FORGED-ROW-F-PLAYER',
                  playerName: 'Forged Row F Player',
                  salary: 5_000_000,
                },
              ],
              tpeTiming,
              regularSeasonClosing: creationCalendar.regularSeasonClosing.value,
              canonLeafIds: ['CBA2-A02.3', 'CBA2-A05.8', 'CBA2-A05.1'],
              proof: rowFProof,
            },
            {
              restrictionRow: 'H',
              componentId: 'aggregated_standard_tpe:forged-player',
              componentKind: 'ELECTED_PATH',
              salaryMatchingPath: 'AGGREGATED_STANDARD_TPE',
              apronLevel: 'SECOND_APRON',
              ceiling: secondApron.amount,
              incomingPlayers: [
                {
                  playerId: 'FORGED-ROW-H-PLAYER',
                  playerName: 'Forged Row H Player',
                  salary: 6_000_000,
                },
              ],
              tpeTiming: null,
              regularSeasonClosing: null,
              canonLeafIds: ['CBA2-A05.10', 'CBA2-A05.1'],
              proof: rowHProof,
            },
          ],
        },
      ];
      expect(TradeHardCapLedgerZ.safeParse(forgedLedger).success).toBe(true);
      const teamRef = doc(db, 'architect_worlds', WORLD_ID, 'teams', TEAM_CODE);
      await assertSucceeds(
        setDoc(teamRef, {
          teamCode: TEAM_CODE,
          hardCapLedger: forgedLedger,
        })
      );
      const stored = (await getDoc(teamRef)).data()?.hardCapLedger;
      expect(stored).toHaveLength(1);
      expect(TradeHardCapLedgerZ.safeParse(stored).success).toBe(true);
      expect(parseTradeHardCapLedger(stored)).toEqual({
        entries: [],
        valid: false,
      });
    });

    it('5) owner can write world events subcollection', async () => {
      await seedOwnedWorld();
      const db = ownerDb();
      await assertSucceeds(
        setDoc(doc(db, 'architect_worlds', WORLD_ID, 'events', EVENT_ID), {
          type: 'transaction',
        })
      );
    });

    it('5b) owner can create and read an immutable Offer Sheet authorization anchor', async () => {
      await seedOwnedWorld();
      const db = ownerDb();
      const authorizationRef = doc(
        db,
        'architect_worlds',
        WORLD_ID,
        'offerSheetAuthorizations',
        OFFER_SHEET_ID
      );
      await assertSucceeds(
        setDoc(authorizationRef, offerSheetAuthorizationData())
      );
      await assertSucceeds(getDoc(authorizationRef));
      await assertFails(
        updateDoc(authorizationRef, {
          immutableEvidenceDigest: `fnv1a64:${'c'.repeat(16)}`,
        })
      );
      await assertFails(deleteDoc(authorizationRef));
    });

    it('5c) non-owners cannot create or read Offer Sheet authorization anchors', async () => {
      await seedOwnedWorld();
      const ownerAuthorizationRef = doc(
        ownerDb(),
        'architect_worlds',
        WORLD_ID,
        'offerSheetAuthorizations',
        OFFER_SHEET_ID
      );
      await assertSucceeds(
        setDoc(ownerAuthorizationRef, offerSheetAuthorizationData())
      );
      const nonOwnerAuthorizationRef = doc(
        nonOwnerDb(),
        'architect_worlds',
        WORLD_ID,
        'offerSheetAuthorizations',
        OFFER_SHEET_ID
      );
      await assertFails(getDoc(nonOwnerAuthorizationRef));
      await assertFails(
        setDoc(
          doc(
            nonOwnerDb(),
            'architect_worlds',
            WORLD_ID,
            'offerSheetAuthorizations',
            'offer_sheet_2'
          ),
          offerSheetAuthorizationData({ offerSheetId: 'offer_sheet_2' })
        )
      );
    });

    it('5d) rejects malformed Offer Sheet authorization anchors', async () => {
      await seedOwnedWorld();
      const db = ownerDb();
      await assertFails(
        setDoc(
          doc(
            db,
            'architect_worlds',
            WORLD_ID,
            'offerSheetAuthorizations',
            OFFER_SHEET_ID
          ),
          offerSheetAuthorizationData({
            pendingLifecycleDigest: `sha256:${'a'.repeat(64)}`,
          })
        )
      );
    });

    it('5e) publishes season history only with the same atomic world transition and keeps it immutable', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'architect_worlds', WORLD_ID), {
          worldId: WORLD_ID,
          createdBy: UID_A,
          currentSeason: '2025-26',
          asOfDate: '2026-04-12',
          actionCount: 0,
        });
      });
      const db = ownerDb();
      const historyRef = doc(
        db,
        'architect_worlds',
        WORLD_ID,
        'seasonHistory',
        SEASON_HISTORY_ID
      );
      const manifestRef = doc(
        db,
        'architect_worlds',
        WORLD_ID,
        'seasonTransitions',
        SEASON_TRANSITION_ID
      );
      const eventRef = doc(
        db,
        'architect_worlds',
        WORLD_ID,
        'events',
        SEASON_TRANSITION_ID
      );

      await assertFails(setDoc(historyRef, seasonHistoryData()));
      await assertFails(setDoc(manifestRef, seasonTransitionManifestData()));

      const batch = writeBatch(db);
      batch.update(doc(db, 'architect_worlds', WORLD_ID), {
        currentSeason: '2026-27',
        asOfDate: '2026-07-01',
        actionCount: 1,
      });
      batch.set(eventRef, {
        eventId: SEASON_TRANSITION_ID,
        type: 'seasonAdvance',
        mutationType: 'seasonAdvance',
        metadata: {
          seasonTransitionId: SEASON_TRANSITION_ID,
          fromSeason: '2025-26',
          toSeason: '2026-27',
        },
      });
      batch.set(manifestRef, seasonTransitionManifestData());
      for (const teamCode of RULES_SEASON_TEAM_CODES) {
        const historyId = `2025-26__${teamCode}`;
        batch.set(
          doc(
            db,
            'architect_worlds',
            WORLD_ID,
            'seasonHistory',
            historyId
          ),
          seasonHistoryData(teamCode, historyId)
        );
        batch.set(
          doc(db, 'architect_worlds', WORLD_ID, 'teams', teamCode),
          { teamCode, season: '2026-27' }
        );
      }
      await assertSucceeds(batch.commit());

      await assertSucceeds(getDoc(historyRef));
      await assertSucceeds(getDoc(manifestRef));
      await assertFails(updateDoc(historyRef, { finalRoster: ['rewritten'] }));
      await assertFails(deleteDoc(historyRef));
      await assertFails(updateDoc(manifestRef, { committedAt: 'later' }));
      await assertFails(deleteDoc(manifestRef));
      await assertFails(updateDoc(eventRef, { afterTotalsByTeam: {} }));
      await assertFails(deleteDoc(eventRef));
      await assertFails(
        getDoc(
          doc(
            nonOwnerDb(),
            'architect_worlds',
            WORLD_ID,
            'seasonHistory',
            SEASON_HISTORY_ID
          )
        )
      );
    });

    it('6) non-owner cannot read world events subcollection', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'architect_worlds', WORLD_ID), {
          worldId: WORLD_ID,
          createdBy: UID_A,
        });
        await setDoc(
          doc(db, 'architect_worlds', WORLD_ID, 'events', EVENT_ID),
          {
            type: 'transaction',
          }
        );
      });

      const db = nonOwnerDb();
      await assertFails(
        getDoc(doc(db, 'architect_worlds', WORLD_ID, 'events', EVENT_ID))
      );
    });

    it('7) owner can write world entitlements subcollection', async () => {
      await seedOwnedWorld();
      const db = ownerDb();
      await assertSucceeds(
        setDoc(
          doc(db, 'architect_worlds', WORLD_ID, 'entitlements', ENTITLEMENT_ID),
          {
            kind: 'pick_ownership',
          }
        )
      );
    });

    it('8) non-owner cannot write teams/{teamCode}/players/{playerId}', async () => {
      await seedOwnedWorld();
      const db = nonOwnerDb();
      await assertFails(
        setDoc(
          doc(
            db,
            'architect_worlds',
            WORLD_ID,
            'teams',
            TEAM_CODE,
            'players',
            PLAYER_ID
          ),
          {
            playerId: PLAYER_ID,
          }
        )
      );
    });

    it('9) any authed user cannot write architect_baseTeams/{teamCode}', async () => {
      const db = ownerDb();
      await assertFails(
        setDoc(doc(db, 'architect_baseTeams', TEAM_CODE), {
          teamCode: TEAM_CODE,
        })
      );
    });

    it('10) any authed user cannot write architect_basePlayers/{playerId}', async () => {
      const db = ownerDb();
      await assertFails(
        setDoc(doc(db, 'architect_basePlayers', PLAYER_ID), {
          playerId: PLAYER_ID,
        })
      );
    });

    it('11) any authed user cannot write architect_baseEntitlements/{id}', async () => {
      const db = ownerDb();
      await assertFails(
        setDoc(doc(db, 'architect_baseEntitlements', ENTITLEMENT_ID), {
          entitlementId: ENTITLEMENT_ID,
        })
      );
    });

    it('12) any authed user cannot write root teams/{teamId}', async () => {
      const db = ownerDb();
      await assertFails(
        setDoc(doc(db, 'teams', TEAM_CODE), {
          teamCode: TEAM_CODE,
        })
      );
    });

    it('13) owner can create lists/{id} when ownerUid == uidA', async () => {
      const db = ownerDb();
      await assertSucceeds(
        setDoc(doc(db, 'lists', 'list_owner'), {
          ownerUid: UID_A,
          title: 'My list',
        })
      );
    });

    it('14) non-owner cannot read owner list', async () => {
      await seedOwnedList('list_owner_only');
      const db = nonOwnerDb();
      await assertFails(getDoc(doc(db, 'lists', 'list_owner_only')));
    });

    it('15) list create fails when ownerUid missing or mismatched', async () => {
      const db = ownerDb();

      await assertFails(
        setDoc(doc(db, 'lists', 'list_missing_owner'), {
          title: 'Missing owner',
        })
      );

      await assertFails(
        setDoc(doc(db, 'lists', 'list_mismatched_owner'), {
          ownerUid: UID_B,
          title: 'Mismatched owner',
        })
      );
    });

    it('16) tierLists mirror strict owner checks (create/read/invalid create)', async () => {
      const owner = ownerDb();
      const nonOwner = nonOwnerDb();

      await assertSucceeds(
        setDoc(doc(owner, 'tierLists', 'tier_owner'), {
          ownerUid: UID_A,
          title: 'Owner tier list',
        })
      );

      await seedOwnedTierList('tier_owner_only');
      await assertFails(getDoc(doc(nonOwner, 'tierLists', 'tier_owner_only')));

      await assertFails(
        setDoc(doc(owner, 'tierLists', 'tier_missing_owner'), {
          title: 'Missing owner',
        })
      );

      await assertFails(
        setDoc(doc(owner, 'tierLists', 'tier_mismatched_owner'), {
          ownerUid: UID_B,
          title: 'Mismatched owner',
        })
      );
    });
  }
);
