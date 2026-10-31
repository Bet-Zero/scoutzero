import { apronDraftFixture } from './apronDraftWorld';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { SoftwareSeasonContextZ } from '@/schemas/softwareSeasonContext';
import { DraftApronSimulationPlanZ } from '@/schemas/draftApronSimulation';

/** All values after the initial season are stipulated software inputs, not forecasts. */
export function multiseasonApronFixture(followups: number[] = [1, 1, 0, 0]) {
  const f = apronDraftFixture(1);
  const source = f.plan.steps[0].observations[0].sources;
  const closings = [
    '2026-04-12',
    '2027-04-11',
    '2028-04-16',
    '2029-04-15',
    '2030-04-14',
    '2031-04-13',
  ];
  const seasons = Array.from({ length: 6 }, (_, i) =>
    SoftwareSeasonContextZ.parse({
      kind: 'governed-software-season-v1',
      id: `software-season-${2026 + i}`,
      salaryCapYear: 2026 + i,
      regularSeasonOpening: `${2025 + i}-10-20`,
      regularSeasonClosing: closings[i],
      salaryCap: i === 0 ? 154647000 : 164961000 + (i - 1) * 10000000,
      minimumTeamSalary: i === 0 ? 139182000 : 148465000 + (i - 1) * 9000000,
      luxuryTax: i === 0 ? 187895000 : 200409000 + (i - 1) * 12000000,
      firstApron: i === 0 ? 195945000 : 208986000 + (i - 1) * 13000000,
      secondApron: i === 0 ? 207824000 : 221677000 + (i - 1) * 14000000,
      zeroYosMinimum: 1272870 + i * 100000,
    })
  );
  const excess = [1, ...followups, 0];
  for (const [code, team] of Object.entries(f.teams)) {
    team.players = team.players.map((p, index) => ({
      ...p,
      contract: {
        ...p.contract,
        endSeason: '2030-31',
        salariesByYear: seasons.map((c, i) => {
          const total = ['TOR', 'MIA'].includes(code)
            ? c.secondApron * 100 + (code === 'TOR' ? excess[i] : 0)
            : 3000000000;
          const cents =
            index === 14
              ? total - Math.floor(total / 15) * 14
              : Math.floor(total / 15);
          const salary = p.isTwoWay ? 578577 : cents / 100;
          return {
            season: `${2025 + i}-${String(2026 + i).slice(-2)}`,
            salary,
            capHit: salary,
            guaranteed: !p.isTwoWay,
            option: null,
          };
        }),
      },
    }));
  }
  const booksFor = (code: string, yearIndex: number) => {
    const c = seasons[yearIndex];
    const team = f.teams[code];
    // Drop the older year's context before computing the explicitly selected year.
    const { salaryBookInputs: previous, ...bare } = team;
    const books = withDerivedGovernedSalaryBooks(bare, {
      salaryCapYear: c.salaryCapYear,
      asOfDate: yearIndex
        ? `${2025 + yearIndex}-07-01T00:00:00-04:00`
        : '2026-04-12T00:00:00-04:00',
    }).salaryBookInputs;
    delete books.incompleteRosterCharge;
    books.softwareSeasonContext = c;
    books.unsignedFirstRoundPickState = {
      ...previous.unsignedFirstRoundPickState!,
      salaryCapYear: c.salaryCapYear,
    };
    return books;
  };
  const steps = seasons.slice(0, -1).map((c, i) => {
    const seasonStartYear = c.salaryCapYear - 1;
    const measuredAt = `${c.regularSeasonClosing}T19:00:00-04:00`;
    const observations = Object.entries(f.teams).map(([team, value]) => ({
      team,
      seasonStartYear,
      state: 'supported' as const,
      sourceResultId: `software-observation:${team}:${seasonStartYear}`,
      pendingUntil: null,
      sources: source,
      value: {
        apronTeamSalaryCents: Math.round(
          value.players
            .filter((p) => !p.isTwoWay)
            .reduce((sum, p) => sum + p.contract.salariesByYear[i].salary, 0) *
            100
        ),
        secondApronCents: c.secondApron * 100,
        measuredAt,
        lastRegularSeasonGameStart: measuredAt,
      },
    }));
    const targetBooks = Object.fromEntries(
      Object.keys(f.teams).map((team) => {
        const books = booksFor(team, i + 1);
        const template =
          f.plan.steps[0].targetBooks[team].seasonCloseApronMeasurement!;
        books.seasonCloseApronMeasurement = {
          ...template,
          seasonKey: `${seasonStartYear}-${String(seasonStartYear + 1).slice(-2)}`,
          salaryCapYear: seasonStartYear + 1,
          measuredAt,
          regularSeasonClosing: c.regularSeasonClosing,
          apronTeamSalary:
            observations.find((o) => o.team === team)!.value
              .apronTeamSalaryCents / 100,
          source: {
            ...template.source,
            identity: `software-only:${team}:${seasonStartYear}`,
            measurementRecordId: `software:${team}:${seasonStartYear}`,
            retrievedAt: measuredAt,
            authenticatedAt: measuredAt,
          },
        };
        return [team, books];
      })
    );
    const nextDate = new Date(
      Date.parse(`${c.regularSeasonClosing}T12:00:00Z`) + 86400000
    )
      .toISOString()
      .slice(0, 10);
    return {
      seasonStartYear,
      observations,
      targetBooks,
      regularSeasonEnd: {
        seasonStartYear,
        date: c.regularSeasonClosing,
        dayAfterStartsAt: `${nextDate}T00:00:00-04:00`,
        sources: source,
      },
      tradingWindow: {
        kind: 'governed-test-seven-draft-window' as const,
        asOf: `${seasonStartYear + 1}-07-01T00:00:00-04:00`,
        previousDraftCompletedAt: `${seasonStartYear + 1}-06-30T23:00:00-04:00`,
        firstFutureDraftStartsAt: `${seasonStartYear + 2}-06-23T19:00:00-04:00`,
        firstYear: seasonStartYear + 2,
        lastYear: seasonStartYear + 8,
      },
    };
  });
  for (const code of Object.keys(f.teams))
    f.teams[code].salaryBookInputs = booksFor(code, 0);
  f.plan = DraftApronSimulationPlanZ.parse({
    ...f.plan,
    softwareRetainedFirsts: ['TOR', 'MIA'].flatMap((team) =>
      [2034, 2035, 2036, 2037].map((draftYear) => ({ team, draftYear }))
    ),
    kind: 'governed-apron-lifecycle-v2',
    seasons,
    steps,
    futureObservations: steps
      .slice(1)
      .flatMap((s) =>
        s.observations.map((o) => ({
          ...o,
          state: 'future-pending',
          value: null,
          sourceResultId: null,
          pendingUntil: o.value.measuredAt,
        }))
      ),
  });
  f.metadata.draftApronPlan = f.plan;
  return f;
}
