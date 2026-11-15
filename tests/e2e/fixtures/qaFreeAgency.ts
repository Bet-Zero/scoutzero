/** Explicit controlled acceptance inputs, never current NBA source data. */
import { expect, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  ARCHITECT_BASE_PLAYERS_PATH,
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
} from '@/constants/collections';
import {
  makeGovernedOfferSheetEvidence,
  makeGovernedOfferSheetRightsLedger,
} from '../../fixtures/architect/governedOfferSheet';
import { makeRightsLedgerForIdentity } from '../../fixtures/architect/rightsHistory';
import { withDerivedGovernedSalaryBooks } from '../../../src/tests/fixtures/governedSalaryBookInputs';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';

export async function seedQaRfaEvidence(worldId: string) {
  if (process.env.PLAYWRIGHT_ARCHITECT_REVIEW_MODE !== 'true')
    throw new Error(
      'Controlled RFA evidence is restricted to the isolated review emulator.'
    );
  const db = getReviewAdminDb();
  const playerId = `qa_rfa_${worldId}`;
  const displayName = `Review RFA ${worldId.slice(-7)}`;
  const home = db.doc(
    `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_TEAMS_SUBCOLLECTION}/BOS`
  );
  const team = (await home.get()).data()!;
  const base = JSON.parse(
    await readFile(
      'scripts/emu/review_seed/basePlayers/review_offer_sheet_guard.json',
      'utf8'
    )
  );
  const old = makeGovernedOfferSheetEvidence();
  // Explicitly dated current-season fixture; this does not relabel an NBA package.
  const evidence = makeGovernedOfferSheetEvidence({
    worldId,
    homeTeamId: 'BOS',
    playerId,
    salaryCapYear: 2027,
    observedAt: '2026-07-01T09:00:00-04:00',
    qualifyingOffer: {
      ...old.qualifyingOffer,
      deliveredAt: '2026-06-29T17:00:00-04:00',
      openThrough: '2026-10-01T23:59:59-04:00',
      calculation: {
        ...old.qualifyingOffer.calculation,
        calculationYear: 2027,
      },
    },
    homeTeamMatchingAuthority: {
      ...old.homeTeamMatchingAuthority,
      effectiveFrom: '2026-07-01T00:00:00-04:00',
      effectiveThrough: '2027-03-01T23:59:59-05:00',
    },
    league: {
      ...old.league,
      salaryCap: 164_961_000,
      maximumSalaryBySeason: ['2026-27', '2027-28', '2028-29', '2029-30'].map(
        (season) => ({ season, amount: 40_000_000 })
      ),
    },
  });
  // Like mutationPipeline.offerSheetCreation.emulator.test.ts, this supplies
  // controlled immutable INPUT before exercising the browser writer. Runtime
  // world documents may not author RFA/QO authority. Each journey gets a new
  // immutable synthetic source identity; never overwrite the shared seed or
  // another world's evidence. No real player or production source is touched.
  if (
    db.projectId !== 'demo-architect-review' ||
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8082'
  )
    throw new Error('RFA fixture refuses non-review projects.');
  const sourceCollection = db.collection(ARCHITECT_BASE_PLAYERS_PATH);
  const sharedSeed = sourceCollection.doc('review_offer_sheet_guard');
  const sharedBefore = (await sharedSeed.get()).data();
  const priorInputs = await sourceCollection
    .where('qaFixtureKind', '==', 'isolated-rfa-input')
    .get();
  await sourceCollection.doc(playerId).create({
    ...base,
    id: playerId,
    playerId,
    player_id: playerId,
    displayName,
    qaFixtureKind: 'isolated-rfa-input',
    rfaContext: { governedEvidence: evidence },
  });
  expect((await sharedSeed.get()).data()).toEqual(sharedBefore);
  for (const prior of priorInputs.docs) {
    expect((await prior.ref.get()).data()).toEqual(prior.data());
  }
  await home.set(
    withDerivedGovernedSalaryBooks(
      {
        ...team,
        capHolds: [
          {
            playerId,
            playerName: displayName,
            amount: 7_200_000,
            season: '2026-27',
            type: 'RFA Rights',
            active: true,
            isSigned: false,
          },
        ],
        rightsLedger: makeGovernedOfferSheetRightsLedger({
          worldId,
          homeTeamId: 'BOS',
          playerId,
          salaryCapYear: 2027,
        }),
      },
      { salaryCapYear: 2027, asOfDate: '2026-07-01T00:00:00-04:00' }
    )
  );
  await db
    .doc(`${ARCHITECT_WORLDS_COLLECTION}/${worldId}`)
    .update({ rightsLedgerVersion: 1 });
  return { playerId, displayName };
}

export async function fillQaOfferSheetNotice(modal: Locator) {
  await modal
    .getByTestId('governed-offer-sheet-signed-at')
    .fill('2026-07-15T09:55:00-04:00');
  await modal
    .getByTestId('governed-offer-sheet-received-at')
    .fill('2026-07-15T10:00:00-04:00');
}

export async function seedQaOwnFaRights(worldId: string) {
  const db = getReviewAdminDb();
  const ref = db.doc(
    `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_TEAMS_SUBCOLLECTION}/MIA`
  );
  const team = (await ref.get()).data()!;
  const ledger = makeRightsLedgerForIdentity({
    worldId,
    teamId: 'MIA',
    playerId: 'mia_grant_holloway',
    salaryCapYear: 2027,
  });
  const rightsLedger = {
    ...ledger,
    events: ledger.events.map((event) =>
      event.eventKind === 'rights-established'
        ? {
            ...event,
            amountRecords: event.amountRecords.map((row) => ({
              ...row,
              amount:
                row.kind === 'prior-regular-salary'
                  ? 12_000_000
                  : [
                        'prior-signing-bonus-allocation',
                        'earned-performance-bonuses',
                      ].includes(row.kind)
                    ? 0
                    : row.amount,
            })),
          }
        : event
    ),
  };
  await ref.set(
    withDerivedGovernedSalaryBooks(
      {
        ...team,
        rightsLedger,
        // C01.4: prior $12m equals declared EAPS, so 150% = $18m.
        capHolds: team.capHolds.map((hold: Record<string, unknown>) =>
          hold.playerId === 'mia_grant_holloway'
            ? { ...hold, amount: 18_000_000 }
            : hold
        ),
      },
      { salaryCapYear: 2027, asOfDate: '2026-07-01T00:00:00-04:00' }
    )
  );
  await db
    .doc(`${ARCHITECT_WORLDS_COLLECTION}/${worldId}`)
    .update({ rightsLedgerVersion: 1 });
}

export async function fillQaSignAndTradeEvidence(modal: Locator) {
  await modal
    .getByTestId('governed-sat-transaction-at')
    .fill('2026-07-15T12:00:00-04:00');
  await modal
    .getByTestId('governed-sat-higher-max')
    .selectOption('not-relied-upon');
  await modal.getByTestId('governed-sat-unlikely-bonuses').fill('0');
  await modal.getByTestId('governed-sat-consent').check();
  await modal.getByTestId('governed-sat-exhibit-6').check();
  await expect(
    modal.getByTestId('governed-sat-physical-status')
  ).toBeDisabled();
}

export async function verifyQaSavedSignAndTrade(worldId: string) {
  const team = (
    await getReviewAdminDb()
      .doc(
        `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_TEAMS_SUBCOLLECTION}/LAL`
      )
      .get()
  ).data()!;
  const player = team.players.find(
    (p: { id?: string; playerId?: string; player_id?: string }) =>
      (p.id || p.playerId || p.player_id) === 'mia_grant_holloway'
  );
  // Declared before execution: three $30m years, not the prior $12m contract.
  expect(
    player.contract.salariesByYear.map(
      (row: { season: string; salary: number }) => ({
        season: row.season,
        salary: row.salary,
      })
    )
  ).toEqual(
    ['2026-27', '2027-28', '2028-29'].map((season) => ({
      season,
      salary: 30_000_000,
    }))
  );
  // CBA2-A05.2/.5, with the pinned SRC2-004 2026–27 First Apron level.
  expect(team.hardCapLedger).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        teamCode: 'LAL',
        salaryCapYear: 2027,
        restrictionRow: 'C',
        apronLevel: 'FIRST_APRON',
        ceiling: 209_015_000,
      }),
    ])
  );
}
