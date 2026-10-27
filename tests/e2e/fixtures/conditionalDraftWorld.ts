/** All finances, positions and protection terms below are software assumptions. */
import { seedRetainedDraftSimulation } from './retainedDraftSimulationWorld';
import { syntheticDraftSeasonFixture } from './syntheticDraftSeasonWorld';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { conditionalProtectionLadder } from '@/features/architect/utils/draftReview/conditionalProgram';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { TeamListFull } from '@/constants/teamList';

export async function seedConditionalDraftWorld(
  uid: string,
  worldId: string,
  origin = 'TOR',
  recipient = 'MIA'
) {
  const catalogue = await seedRetainedDraftSimulation(uid, worldId);
  const original = (team: string, year: number) => {
    const row = catalogue.data.records.find(
      (r) =>
        r.originalPick?.originalTeam === team &&
        r.originalPick.draftYear === year
    );
    if (!row) throw new Error('Retained original missing');
    return row.entitlementId;
  };
  const program = {
    id: 'governed-protection',
    originalTeam: origin,
    stages: [
      {
        entitlementId: original(origin, 2026),
        year: 2026,
        protectedThrough: 10,
      },
      {
        entitlementId: original(origin, 2027),
        year: 2027,
        protectedThrough: 0,
      },
    ],
    results: [],
  };
  const db = getReviewAdminDb();
  const root = db.doc(`architect_worlds/${worldId}`);
  const sourceTeams = syntheticDraftSeasonFixture(uid, worldId).teams;
  const entitlements = (await root.collection('entitlements').get()).docs.map(
    (d) => ({ id: d.id, data: d.data() })
  );
  const batch = db.batch();
  for (const row of catalogue.data.records) {
    if (
      row.originalPick &&
      [origin, recipient].includes(row.originalPick.originalTeam)
    ) {
      const entitlement = entitlements.find((e) => e.id === row.entitlementId)!;
      entitlement.data.holderTeam = row.originalPick.originalTeam;
      if (row.entitlementId === program.stages[0].entitlementId)
        entitlement.data.protectionLadder =
          conditionalProtectionLadder(program);
      batch.set(
        root.collection('entitlements').doc(row.entitlementId),
        entitlement.data
      );
    }
  }
  const nextBooks: Record<string, unknown> = {};
  for (const [teamCode, base] of Object.entries(sourceTeams)) {
    const players = base.players.map((p) => ({
      ...p,
      contract: {
        ...p.contract,
        salariesByYear: p.contract.salariesByYear.map((s) => ({
          ...s,
          salary: p.isTwoWay ? 578577 : 2000000,
          capHit: p.isTwoWay ? 578577 : 2000000,
        })),
      },
    }));
    const bare = {
      ...base,
      teamName: TeamListFull.find((t) => t.code === teamCode)!.teamName,
      players,
      entitlementIds: entitlements
        .filter((e) => e.data.holderTeam === teamCode)
        .map((e) => e.id),
    };
    const next = withDerivedGovernedSalaryBooks(bare, {
      salaryCapYear: 2027,
      asOfDate: '2026-07-01T00:00:00-04:00',
    }).salaryBookInputs;
    const current = withDerivedGovernedSalaryBooks(bare, {
      salaryCapYear: 2026,
      asOfDate: '2026-06-05T00:00:00Z',
    }).salaryBookInputs;
    delete next.incompleteRosterCharge;
    delete current.incompleteRosterCharge;
    const unsigned = {
      ...base.salaryBookInputs.unsignedFirstRoundPickState,
      salaryCapYear: 2026,
      source: {
        ...base.salaryBookInputs.unsignedFirstRoundPickState.source,
        authenticatedAt: '2026-06-05T00:00:00Z',
      },
    };
    current.unsignedFirstRoundPickState = unsigned;
    next.unsignedFirstRoundPickState = { ...unsigned, salaryCapYear: 2027 };
    nextBooks[teamCode] = next;
    const team = { ...bare, salaryBookInputs: current };
    const totals = createCanonicalTeamTotalsSnapshot(team, 2026, {
      asOfDate: '2026-06-05',
    });
    if (totals.apronTeamSalary !== 30000000 || totals.taxSalary !== 30000000)
      throw new Error(
        `Incomplete conditional fixture books for ${teamCode}: ${JSON.stringify(totals.salaryBooks)}`
      );
    batch.set(root.collection('teams').doc(teamCode), {
      ...team,
      totals,
    });
  }
  batch.update(root, {
    draftSimulationTeams: [origin, recipient],
    draftSimulationBranches: 'protection-programs',
    draftConditionalPrograms: [program],
    draftSimulationSeasonBooks: nextBooks,
    draftSimulationCalendar: [
      { year: 2026, date: '2026-06-30' },
      { year: 2027, date: '2027-06-30' },
    ],
  });
  await batch.commit();
  return { program, considerationId: original(recipient, 2029), catalogue };
}
