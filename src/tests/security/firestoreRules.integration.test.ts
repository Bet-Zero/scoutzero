import { beforeAll, afterAll, afterEach, describe, it } from 'vitest';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.resolve(__dirname, '../../../firestore.rules');

const PROJECT_ID = 'architect-rules-integration-e1';
const WORLD_ID = 'world_owner_uid_a';
const TEAM_CODE = 'LAL';
const EVENT_ID = 'evt_1';
const ENTITLEMENT_ID = 'ent_1';
const PLAYER_ID = 'player_1';
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

    it('5) owner can write world events subcollection', async () => {
      await seedOwnedWorld();
      const db = ownerDb();
      await assertSucceeds(
        setDoc(doc(db, 'architect_worlds', WORLD_ID, 'events', EVENT_ID), {
          type: 'transaction',
        })
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
