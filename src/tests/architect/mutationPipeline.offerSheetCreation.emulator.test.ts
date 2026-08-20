/**
 * BZE-283 real-Firestore proof for governed Offer Sheet creation concurrency.
 *
 * Admin seeds only the immutable base player and world root because production
 * Firestore rules prohibit browser creation of those documents. The owner Web
 * SDK seeds the two starting Team snapshots. All Offer Sheet creation reads,
 * computation, transaction writes, and proof reads use production code and the
 * real Firestore emulator; no Firebase mocks or direct output seeding are used.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import admin from 'firebase-admin';
import { signInAnonymously, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

import { db, auth } from '@/firebaseConfig';
import {
  computeWorldMutation,
  persistWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import { loadStateForMutation } from '@/features/architect/utils/mutationPipeline.read.stateLoader';
import { buildGeneralMutationCommittedTeamUpdates } from '@/features/architect/utils/mutationPipeline.read.persistence.snapshots';
import { buildGovernedOfferSheetAuthorization } from '@/features/architect/utils/offerSheets';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';
import { makeGovernedOfferSheetFixture } from '../../../tests/fixtures/architect/governedOfferSheet';

const WORLD_ID = 'bze_283_offer_sheet_creation_emulator';
const PLAYER_ID = 'bze_283_creation_race_rfa';
const HOME_TEAM = 'BOS';
const OFFERING_TEAM = 'LAL';
const SEASON_ID = '2025-26';
const FIRST_TIMESTAMP = Date.parse('2025-07-08T14:00:01.000Z');

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function makeStandardContract(salary: number) {
  return {
    contractType: 'Standard',
    signingTeam: HOME_TEAM,
    totalValue: salary,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
        option: null,
      },
    ],
  };
}

function makePlayer({
  playerId,
  teamCode,
  salary,
  governedEvidence,
}: {
  playerId: string;
  teamCode: string;
  salary: number;
  governedEvidence?: unknown;
}) {
  return {
    id: playerId,
    playerId,
    player_id: playerId,
    name: playerId,
    displayName: playerId,
    teamCode,
    teamName: teamCode === HOME_TEAM ? 'Boston Celtics' : 'Los Angeles Lakers',
    bio: { position: 'G', age: 24, experience: 3 },
    contract: makeStandardContract(salary),
    ...(governedEvidence === undefined
      ? {}
      : { rfaContext: { governedEvidence } }),
    source: { provider: 'BZE-283 emulator fixture' },
    lastUpdated: '2025-07-08T14:00:00.000Z',
    version: '1.0.0',
  };
}

function makeTeam({
  teamCode,
  players,
  rightsLedger,
}: {
  teamCode: string;
  players: ReturnType<typeof makePlayer>[];
  rightsLedger?: unknown;
}) {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum + Number(player.contract.salariesByYear[0]?.capHit || 0),
    0
  );
  return {
    teamCode,
    teamName: teamCode === HOME_TEAM ? 'Boston Celtics' : 'Los Angeles Lakers',
    season: SEASON_ID,
    roster: players.map((player) => player.playerId),
    players,
    capHolds: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    totals: { totalSalary, capHit: totalSalary },
    ...(rightsLedger === undefined ? {} : { rightsLedger }),
  };
}

describe('BZE-283 governed Offer Sheet creation on the Firestore emulator', () => {
  let adminDb: FirebaseFirestore.Firestore;
  let userId = '';
  let fixture: ReturnType<typeof makeGovernedOfferSheetFixture>;

  beforeAll(async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error(
        'FIRESTORE_EMULATOR_HOST is required; this proof refuses non-emulator execution.'
      );
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || 'scoutzero-bf1ae',
      });
    }
    adminDb = admin.firestore();

    await adminDb.recursiveDelete(adminDb.doc(`architect_worlds/${WORLD_ID}`));
    await adminDb.doc(`architect_basePlayers/${PLAYER_ID}`).delete();

    const credential = await signInAnonymously(auth);
    userId = credential.user.uid;
    fixture = makeGovernedOfferSheetFixture({
      worldId: WORLD_ID,
      playerId: PLAYER_ID,
      homeTeamId: HOME_TEAM,
      offeringTeamId: OFFERING_TEAM,
      offerSheetId: 'bze-283-emulator-creation-race',
      salariesByYear: [
        { season: SEASON_ID, salary: 10_000_000 },
        { season: '2026-27', salary: 10_500_000 },
      ],
    });

    const homePlayer = makePlayer({
      playerId: PLAYER_ID,
      teamCode: HOME_TEAM,
      salary: 9_000_000,
      governedEvidence: fixture.evidence,
    });
    const offeringPlayer = makePlayer({
      playerId: 'bze_283_lal_keeper',
      teamCode: OFFERING_TEAM,
      salary: 7_000_000,
    });

    // These two roots are Admin-authored in production and cannot be created
    // by a browser under firestore.rules. They are fixture setup, not proof
    // output; all governed creation artifacts below come from production code.
    await Promise.all([
      adminDb.doc(`architect_worlds/${WORLD_ID}`).set({
        worldId: WORLD_ID,
        worldName: 'BZE-283 Offer Sheet Creation Emulator Proof',
        name: 'BZE-283 Offer Sheet Creation Emulator Proof',
        createdBy: userId,
        currentSeason: SEASON_ID,
        baselineSeason: SEASON_ID,
        asOfDate: fixture.asOfDate,
        parentWorldId: null,
        childWorlds: [],
        isArchived: false,
        status: 'active',
      }),
      adminDb.doc(`architect_basePlayers/${PLAYER_ID}`).set(clone(homePlayer)),
    ]);

    // Initial mutable Team state is written as the authenticated world owner.
    await Promise.all([
      setDoc(
        doc(db, 'architect_worlds', WORLD_ID, 'teams', HOME_TEAM),
        clone(
          makeTeam({
            teamCode: HOME_TEAM,
            players: [homePlayer],
            rightsLedger: fixture.rightsLedger,
          })
        )
      ),
      setDoc(
        doc(db, 'architect_worlds', WORLD_ID, 'teams', OFFERING_TEAM),
        clone(makeTeam({ teamCode: OFFERING_TEAM, players: [offeringPlayer] }))
      ),
    ]);
  }, 60_000);

  afterAll(async () => {
    await signOut(auth);
    if (adminDb) {
      await adminDb.recursiveDelete(
        adminDb.doc(`architect_worlds/${WORLD_ID}`)
      );
      await adminDb.doc(`architect_basePlayers/${PLAYER_ID}`).delete();
    }
  });

  it('commits exactly one complete creation and rejects its stale competitor without partial writes', async () => {
    const payload = {
      teamCode: OFFERING_TEAM,
      playerId: PLAYER_ID,
      worldId: WORLD_ID,
      contract: {
        ...fixture.contract,
        contractType: 'Offer Sheet',
      },
      offerSheetProposal: fixture.proposal,
      signedUsing: 'Cap Space',
    };

    // Both candidates consume the same persisted starting state before either
    // transaction begins. The emulator then arbitrates the competing commits.
    const [firstState, competingState] = await Promise.all([
      loadStateForMutation(WORLD_ID, 'storeOfferSheet', payload),
      loadStateForMutation(WORLD_ID, 'storeOfferSheet', payload),
    ]);
    const candidates = [firstState, competingState].map((currentState, index) =>
      computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload,
        currentState,
        seasonId: SEASON_ID,
        timestamp: FIRST_TIMESTAMP + index,
        asOfDate: fixture.asOfDate,
        worldId: WORLD_ID,
      })
    );
    for (const candidate of candidates) {
      expect(candidate.success, String(candidate.error)).toBe(true);
    }

    const results = await Promise.all(
      candidates.map((candidate, index) =>
        persistWorldMutation({
          worldId: WORLD_ID,
          seasonId: SEASON_ID,
          mutationType: 'storeOfferSheet',
          computeResult: candidate,
          committedTeamUpdates: buildGeneralMutationCommittedTeamUpdates(
            candidate.teamUpdates,
            SEASON_ID
          ),
          timestamp: FIRST_TIMESTAMP + index,
        })
      )
    );

    const winnerIndexes = results
      .map((result, index) => (result.success ? index : -1))
      .filter((index) => index >= 0);
    const loserIndexes = results
      .map((result, index) => (!result.success ? index : -1))
      .filter((index) => index >= 0);
    expect(winnerIndexes).toHaveLength(1);
    expect(loserIndexes).toHaveLength(1);

    const winnerIndex = winnerIndexes[0] as number;
    const loserIndex = loserIndexes[0] as number;
    const winner = candidates[winnerIndex];
    const loserResult = results[loserIndex];
    expect(loserResult.error).toContain('changed before commit');

    const expectedTeams = new Map(
      buildGeneralMutationCommittedTeamUpdates(
        winner.teamUpdates,
        SEASON_ID
      ).map(({ teamCode, team }) => [teamCode, team])
    );
    const [
      homeSnapshot,
      offeringSnapshot,
      worldSnapshot,
      eventSnapshots,
      authorizationSnapshots,
    ] = await Promise.all([
      getDoc(doc(db, 'architect_worlds', WORLD_ID, 'teams', HOME_TEAM)),
      getDoc(doc(db, 'architect_worlds', WORLD_ID, 'teams', OFFERING_TEAM)),
      getDoc(doc(db, 'architect_worlds', WORLD_ID)),
      getDocs(collection(db, 'architect_worlds', WORLD_ID, 'events')),
      getDocs(
        collection(db, 'architect_worlds', WORLD_ID, 'offerSheetAuthorizations')
      ),
    ]);

    expect(homeSnapshot.data()).toEqual(expectedTeams.get(HOME_TEAM));
    expect(offeringSnapshot.data()).toEqual(expectedTeams.get(OFFERING_TEAM));

    const homeSheets = homeSnapshot.data()?.incomingOfferSheets;
    const offeringSheets = offeringSnapshot.data()?.offerSheets;
    expect(homeSheets).toHaveLength(1);
    expect(offeringSheets).toHaveLength(1);
    expect(homeSheets?.[0]).toEqual(offeringSheets?.[0]);

    const winningLifecycle = GovernedOfferSheetLifecycleZ.parse(
      winner.metadata?.governedOfferSheetLifecycle
    );
    const winningOfferSheetId = String(winner.metadata?.offerSheetId || '');
    const winningDedupKey = String(winner.metadata?.dedupKey || '');
    expect(offeringSheets?.[0]).toMatchObject({
      id: winningOfferSheetId,
      dedupKey: winningDedupKey,
      playerId: PLAYER_ID,
      homeTeamCode: HOME_TEAM,
      offeringTeamCode: OFFERING_TEAM,
    });

    expect(authorizationSnapshots.docs).toHaveLength(1);
    expect(authorizationSnapshots.docs[0]?.id).toBe(winningOfferSheetId);
    expect(authorizationSnapshots.docs[0]?.data()).toEqual(
      buildGovernedOfferSheetAuthorization({
        lifecycle: winningLifecycle,
        offerSheetId: winningOfferSheetId,
        dedupKey: winningDedupKey,
      })
    );

    expect(eventSnapshots.docs).toHaveLength(1);
    expect(eventSnapshots.docs[0]?.data()).toMatchObject({
      mutationType: 'storeOfferSheet',
      timestamp: new Date(FIRST_TIMESTAMP + winnerIndex).toISOString(),
      metadata: {
        offerSheetId: winningOfferSheetId,
        dedupKey: winningDedupKey,
      },
    });
    expect(new Set(worldSnapshot.data()?.lastModifiedTeams)).toEqual(
      new Set([HOME_TEAM, OFFERING_TEAM])
    );

    const losingOfferSheetId = String(
      candidates[loserIndex].metadata?.offerSheetId || ''
    );
    if (losingOfferSheetId !== winningOfferSheetId) {
      expect(
        (
          await getDoc(
            doc(
              db,
              'architect_worlds',
              WORLD_ID,
              'offerSheetAuthorizations',
              losingOfferSheetId
            )
          )
        ).exists()
      ).toBe(false);
    }
  }, 60_000);
});
