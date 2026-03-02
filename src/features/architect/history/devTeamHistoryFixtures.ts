export const DEV_TEAM_HISTORY_FIXTURE_FLAG = 'hz.dev.teamHistoryFixtures';
const DEV_TEAM_HISTORY_FIXTURE_MARKER = '__hzDevTeamHistoryFixture';

type TeamHistoryEntry = Record<string, unknown>;

type TeamCapSheetLike = {
  teamCode?: string;
  abbreviation?: string;
  id?: string;
  waivedContracts?: TeamHistoryEntry[];
  exceptionHistory?: TeamHistoryEntry[];
  mleHistory?: TeamHistoryEntry[];
  pickLog?: TeamHistoryEntry[];
  currentPicks?: Record<string, unknown>;
  historyTimeline?: TeamHistoryEntry[];
  [key: string]: unknown;
};

function resolveTeamCode(teamCapSheet: TeamCapSheetLike): string {
  const rawTeamCode =
    teamCapSheet?.teamCode || teamCapSheet?.abbreviation || teamCapSheet?.id;
  if (!rawTeamCode) return 'TEAM';
  return String(rawTeamCode).toUpperCase();
}

function withFixtureMarker(entry: TeamHistoryEntry): TeamHistoryEntry {
  return {
    ...entry,
    [DEV_TEAM_HISTORY_FIXTURE_MARKER]: true,
  };
}

function isFixtureEntry(entry: TeamHistoryEntry | null | undefined): boolean {
  return Boolean(entry?.[DEV_TEAM_HISTORY_FIXTURE_MARKER]);
}

function stripFixtureEntries(entries: unknown): TeamHistoryEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry): entry is TeamHistoryEntry => {
    return Boolean(
      entry && typeof entry === 'object' && !isFixtureEntry(entry)
    );
  });
}

function buildFixtureTimeline(teamCode: string): TeamHistoryEntry[] {
  return [
    withFixtureMarker({
      id: `th-fixture-trade-${teamCode}`,
      category: 'trade',
      type: 'Trade Executed',
      timestamp: '2026-02-10T14:00:00.000Z',
      teamsInvolved: [teamCode, 'BOS'],
      summary:
        'Acquired two players and one protected pick; outgoing salary offset generated net cap delta.',
      primaryDeltas: 'Players +2 / Assets +1 / Salary +$2,100,000',
      capDelta: 2_100_000,
      mutationId: `mutation-trade-${teamCode}-001`,
    }),
    withFixtureMarker({
      id: `th-fixture-fa-${teamCode}`,
      category: 'free-agency',
      type: 'Free Agent Signed',
      timestamp: '2026-02-09T18:30:00.000Z',
      teamsInvolved: [teamCode],
      summary: 'Signed DEV Fixture Forward to a 2-year standard contract.',
      primaryDeltas: 'Players +1 / Contract 2 years',
      capDelta: 5_500_000,
      mutationId: `mutation-fa-${teamCode}-001`,
    }),
    withFixtureMarker({
      id: `th-fixture-cap-${teamCode}`,
      category: 'cap-transaction',
      type: 'Waive & Stretch',
      timestamp: '2026-02-08T16:00:00.000Z',
      teamsInvolved: [teamCode],
      summary:
        'Waived DEV Fixture Veteran and stretched remaining guaranteed salary.',
      primaryDeltas: 'Dead cap redistributed across 3 seasons',
      capDelta: -1_200_000,
      mutationId: `mutation-cap-${teamCode}-001`,
    }),
    withFixtureMarker({
      id: `th-fixture-entitlement-${teamCode}`,
      category: 'entitlements',
      type: 'Exception Updated',
      timestamp: '2026-02-07T20:15:00.000Z',
      teamsInvolved: [teamCode],
      summary: 'Adjusted trade exception availability after partial usage.',
      primaryDeltas: 'TPE Remaining -$1,750,000',
      capDelta: -1_750_000,
      mutationId: `mutation-entitlement-${teamCode}-001`,
    }),
    withFixtureMarker({
      id: `th-fixture-draft-${teamCode}`,
      category: 'draft',
      type: 'Draft Pick Log Entry',
      timestamp: '2026-02-06T12:00:00.000Z',
      teamsInvolved: [teamCode, 'SAS'],
      summary:
        'Synthetic pick-log entry recorded for deterministic Team History coverage.',
      primaryDeltas: '2029 2nd Round Pick (top-55 protected)',
      capDelta: 0,
      mutationId: `mutation-draft-${teamCode}-001`,
    }),
  ];
}

function buildFixtureWaivedContracts(): TeamHistoryEntry[] {
  return [
    withFixtureMarker({
      id: 'waive-fixture-001',
      name: 'DEV Fixture Veteran',
      waivedOn: '2026-02-08',
      stretched: true,
      deadCap: {
        2026: 3_000_000,
        2027: 3_000_000,
        2028: 3_000_000,
      },
    }),
  ];
}

function buildFixtureExceptionHistory(teamCode: string): TeamHistoryEntry[] {
  return [
    withFixtureMarker({
      id: 'exception-fixture-001',
      timestamp: '2026-02-07T20:15:00.000Z',
      type: 'consumeTradeException',
      amountCreated: 6_250_000,
      amountConsumed: 1_750_000,
      amountRemaining: 4_500_000,
      sourcePlayerName: 'DEV Fixture Wing',
      sourceTeamCode: teamCode,
      targetTeamCode: 'BOS',
      expiresAt: '2027-02-07T20:15:00.000Z',
    }),
  ];
}

function buildFixtureMleHistory(): TeamHistoryEntry[] {
  return [
    withFixtureMarker({
      id: 'mle-fixture-001',
      year: '2026-27',
      total: 14_100_000,
      used: 5_500_000,
      notes: 'Signed DEV Fixture Forward',
    }),
  ];
}

function buildFixturePickLog(teamCode: string): TeamHistoryEntry[] {
  return [
    withFixtureMarker({
      id: 'pick-fixture-001',
      date: '2026-02-06',
      action: 'Acquired',
      pick: '2029 2nd Round (top-55 protected)',
      partner: 'SAS',
      notes: `Synthetic fixture entry for ${teamCode}`,
    }),
  ];
}

function buildFixtureCurrentPicks(): Record<string, unknown> {
  return {
    2027: {
      first: 'Own',
      second: 'Own',
    },
    2029: {
      first: 'Own',
      second: 'From SAS (top-55 protected)',
    },
  };
}

function sortTimeline(entries: TeamHistoryEntry[]): TeamHistoryEntry[] {
  return [...entries].sort((a, b) => {
    const aTs = Date.parse(String(a.timestamp || a.occurredAt || 0));
    const bTs = Date.parse(String(b.timestamp || b.occurredAt || 0));
    return bTs - aTs;
  });
}

export function injectTeamHistoryFixtures(
  teamCapSheet: TeamCapSheetLike
): TeamCapSheetLike {
  if (!teamCapSheet) return teamCapSheet;

  const teamCode = resolveTeamCode(teamCapSheet);
  const timeline = sortTimeline(buildFixtureTimeline(teamCode));

  return {
    ...teamCapSheet,
    waivedContracts: [
      ...stripFixtureEntries(teamCapSheet.waivedContracts),
      ...buildFixtureWaivedContracts(),
    ],
    exceptionHistory: [
      ...stripFixtureEntries(teamCapSheet.exceptionHistory),
      ...buildFixtureExceptionHistory(teamCode),
    ],
    mleHistory: [
      ...stripFixtureEntries(teamCapSheet.mleHistory),
      ...buildFixtureMleHistory(),
    ],
    pickLog: [
      ...stripFixtureEntries(teamCapSheet.pickLog),
      ...buildFixturePickLog(teamCode),
    ],
    currentPicks: {
      ...(teamCapSheet.currentPicks &&
      typeof teamCapSheet.currentPicks === 'object'
        ? teamCapSheet.currentPicks
        : {}),
      ...buildFixtureCurrentPicks(),
    },
    historyTimeline: [
      ...stripFixtureEntries(teamCapSheet.historyTimeline),
      ...timeline,
    ],
  };
}

export function clearTeamHistoryFixtures(
  teamCapSheet: TeamCapSheetLike
): TeamCapSheetLike {
  if (!teamCapSheet) return teamCapSheet;

  return {
    ...teamCapSheet,
    waivedContracts: stripFixtureEntries(teamCapSheet.waivedContracts),
    exceptionHistory: stripFixtureEntries(teamCapSheet.exceptionHistory),
    mleHistory: stripFixtureEntries(teamCapSheet.mleHistory),
    pickLog: stripFixtureEntries(teamCapSheet.pickLog),
    historyTimeline: stripFixtureEntries(teamCapSheet.historyTimeline),
  };
}

export function hasInjectedTeamHistoryFixtures(
  teamCapSheet: TeamCapSheetLike | null | undefined
): boolean {
  if (!teamCapSheet) return false;

  const collections = [
    teamCapSheet.waivedContracts,
    teamCapSheet.exceptionHistory,
    teamCapSheet.mleHistory,
    teamCapSheet.pickLog,
    teamCapSheet.historyTimeline,
  ];

  return collections.some((entries) => {
    if (!Array.isArray(entries)) return false;
    return entries.some((entry) => isFixtureEntry(entry as TeamHistoryEntry));
  });
}
