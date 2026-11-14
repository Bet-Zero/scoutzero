/**
 * Private, local: build the thirty-team SIMULATION money baseline (V1 item A2).
 *
 * Rosters and contracts come from the selected contract release's retained
 * source documents. Each team keeps its base snapshot team fields (dead money,
 * holds, exceptions) from the private read-only source snapshot. A base roster
 * player the release never recorded keeps his base contract and is reported.
 * The output stays outside the repository; nothing here writes Firestore.
 * Current candidates use --release, --snapshot-dir, --teams, --team-state and
 * --dead-money-contracts (each as --name=<private-path>). Integrity verification
 * does not grant factual acceptance or production activation.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyContractSourceRelease } from '../../src/features/architect/utils/contractSource/contractSourceRelease';
import { buildSimulationTeam } from '../../src/features/architect/utils/simulationFinancialInputs';
import { prepareSimulationFinancialBaseline } from '../../src/features/architect/utils/prepareSimulationFinancialBaseline';
import { TeamListFull } from '../../src/constants/teamList';
import { loadSnapshot, DATA_DIR, digest } from '../dev/cloudData';
import { decodeFields } from '../dev/cloudPipeline';
import { SimulationRareEventsFileZ } from '../../src/schemas/simulationRareEvents';

type Doc = Record<string, unknown> & {
  playerId?: unknown;
  teamCode?: unknown;
  contract?: { salariesByYear?: Array<Record<string, unknown>> } | null;
};

const RELEASE_FILE =
  'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json';
const args = process.argv.slice(2);
const option = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const releasePath = option('release') ?? RELEASE_FILE;
// Replay an already checked package with its retained check time. This does
// not backdate source evidence; a new build defaults to the actual check time.
const checkedAtFlag = args.find((arg) => arg.startsWith('--checked-at='));
const checkedAt =
  checkedAtFlag?.slice('--checked-at='.length) ?? new Date().toISOString();
if (
  !Number.isFinite(Date.parse(checkedAt)) ||
  new Date(checkedAt).toISOString() !== checkedAt
)
  throw new Error('--checked-at must be a retained ISO UTC check timestamp.');
const eventsFlag = args.indexOf('--events');
const eventsFile = eventsFlag >= 0 ? args[eventsFlag + 1] : undefined;
if (eventsFlag >= 0 && !eventsFile)
  throw new Error('--events needs a private events file path.');
const [output] = args.filter(
  (a, i) => !a.startsWith('--') && !(eventsFlag >= 0 && i === eventsFlag + 1)
);
if (!output)
  throw new Error(
    'Usage: npm run architect:simulation-financial -- <private-output.json> [--events <private-events.json>] [--checked-at=<retained-ISO-UTC-check-time>] [--release=<private-release.json>] [--snapshot-dir=<private-snapshot>] [--teams=<private-teams.json>] [--team-state=<private-team-state.json>] [--dead-money-contracts=<private-contracts.json>]'
  );
// V1 D5: optional private rare-event intake (grievances, Required Tenders).
const rareEvents = eventsFile
  ? SimulationRareEventsFileZ.parse(
      JSON.parse(await readFile(eventsFile, 'utf8'))
    ).events
  : [];

const releaseInput = JSON.parse(await readFile(releasePath, 'utf8'));
const release = await verifyContractSourceRelease(
  releaseInput,
  option('release') ? releaseInput : undefined
);
const SEASON = `${release.salaryCapYear - 1}-${String(release.salaryCapYear).slice(-2)}`;
const snapshot = await loadSnapshot(option('snapshot-dir') ?? DATA_DIR).catch(
  () => {
    throw new Error(
      'No usable private snapshot; run npm run cloud:data:refresh first.'
    );
  }
);
const collection = (name: string) =>
  snapshot.documents
    .filter((d) => d.name.split('/').at(-2) === name)
    .map((d) => ({
      id: d.name.split('/').at(-1)!,
      data: decodeFields(d.fields ?? {}) as Doc,
    }));
const baseTeams = new Map(
  collection('architect_baseTeams').map((d) => [d.id, d.data])
);
if (option('teams')) {
  const replacement = JSON.parse(
    await readFile(option('teams')!, 'utf8')
  ) as Record<string, Doc>;
  baseTeams.clear();
  Object.entries(replacement).forEach(([code, doc]) =>
    baseTeams.set(code, doc)
  );
}
const currentStates = option('team-state')
  ? (JSON.parse(await readFile(option('team-state')!, 'utf8')) as Record<
      string,
      NonNullable<
        Parameters<typeof buildSimulationTeam>[0]['currentSeasonState']
      >
    >)
  : {};
const currentDeadMoneyDocs = option('dead-money-contracts')
  ? (JSON.parse(
      await readFile(option('dead-money-contracts')!, 'utf8')
    ) as Record<string, Doc>)
  : {};
const basePlayers = new Map(
  collection('architect_basePlayers').map((d) => [d.id, d.data])
);

const observations = new Map(
  release.observations.map((o) => [o.observationId, o])
);
const current = new Map<string, Record<string, Doc>>();
for (const record of release.records) {
  const state = record.resultingState;
  if (!state.terms.salaries.some((row) => row.season === SEASON)) continue;
  if (state.teamId === 'FREE') continue;
  const observation = observations.get(record.sourceObservationId);
  if (!observation) throw new Error(`${record.contractId}: no observation.`);
  const doc = JSON.parse(observation.artifactContent) as Doc;
  const sourceRow = doc.contract?.salariesByYear?.find(
    (row) => row.season === SEASON
  );
  const stateRow = state.terms.salaries.find((row) => row.season === SEASON)!;
  if (
    record.sourceContractPath !== 'contract' ||
    doc.playerId !== record.playerId ||
    sourceRow?.capHit !== stateRow.capHit ||
    sourceRow?.salary !== stateRow.salary
  )
    throw new Error(
      `${record.contractId}: retained document does not reproduce the release.`
    );
  const team = (current.get(state.teamId) ?? {}) as Record<string, Doc>;
  if (team[record.playerId])
    throw new Error(`${record.playerId}: two current contracts.`);
  team[record.playerId] = doc;
  current.set(state.teamId, team);
}
const currentPlayers = new Set(
  [...current.values()].flatMap((team) => Object.keys(team))
);

// Every retained document per player, for the contracts behind dead money.
const personKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
const docsByPerson = new Map<string, Doc[]>();
for (const record of release.records) {
  const observation = observations.get(record.sourceObservationId);
  if (!observation) continue;
  const doc = JSON.parse(observation.artifactContent) as Doc;
  const contract = (doc as Record<string, unknown>)[record.sourceContractPath];
  const keyed = { ...doc, contract } as Doc;
  for (const key of [
    `id:${record.playerId}`,
    `name:${personKey(String(doc.displayName ?? ''))}`,
  ]) {
    docsByPerson.set(key, [...(docsByPerson.get(key) ?? []), keyed]);
  }
}
// The dead charge's own contract: same player, a 2025-26 row of that amount.
function deadMoneyDoc(entry: Record<string, unknown>): Doc | undefined {
  const amount = (
    entry.amountByYear as Array<{ season?: unknown; amount?: unknown }>
  )?.find((row) => row.season === SEASON)?.amount;
  const candidates = [
    ...(docsByPerson.get(`id:${String(entry.playerId)}`) ?? []),
    ...(docsByPerson.get(`name:${personKey(String(entry.playerName ?? ''))}`) ??
      []),
  ].filter((doc) =>
    doc.contract?.salariesByYear?.some(
      (row) =>
        String(row.season ?? '').slice(0, 7) === SEASON && row.salary === amount
    )
  );
  return candidates[0] ?? currentDeadMoneyDocs[String(entry.playerId)];
}

// Base ids that differ only in punctuation or a name suffix from a release id.
const nameKey = (id: string) =>
  id.replace(/_(i{2,3}|iv|jr|sr)$/, '').replace(/[^a-z]/g, '');
// Retained evidence that raises a snapshot hard-cap label (BZE-345 notes).
const HARD_CAP_CORRECTIONS = {
  TOR: {
    level: 'firstApron',
    evidence:
      'retained March 6, 2026 financial report (BZE-345): Non-Taxpayer MLE acquisition trigger',
  },
} as const;
const unknownTeams = rareEvents.filter(
  (event) => !TeamListFull.some((t) => t.code === event.team)
);
if (unknownTeams.length)
  throw new Error(
    `Rare events name unknown teams: ${unknownTeams.map((e) => e.id).join(', ')}.`
  );
const evidenceReferences = [
  `${release.releaseId} v${release.releaseVersion} ${release.releaseDigest}`,
  `private source snapshot sha256:${digest(snapshot)} captured ${snapshot.capturedAt}`,
];
const teams: Record<string, Record<string, unknown>> = {};
const reports = [];
for (const { code } of [...TeamListFull].sort((a, b) =>
  a.code.localeCompare(b.code)
)) {
  const baseDoc = baseTeams.get(code);
  if (!baseDoc) throw new Error(`${code}: no base team document.`);
  const releaseDocs = current.get(code) ?? {};
  const releaseKeys = new Set(Object.keys(releaseDocs).map(nameKey));
  const baseOnlyDocs: Record<string, Doc> = {};
  const aliases: string[] = [];
  for (const raw of (baseDoc.roster as unknown[]) ?? []) {
    const id = String(raw);
    // A current release contract decides his team. A player the release holds
    // only as an incomplete record keeps his base contract: a known liability.
    if (currentPlayers.has(id)) continue;
    const doc = basePlayers.get(id);
    if (release.salaryCapYear !== 2026)
      throw new Error(
        `${code}/${id}: current roster lacks its current contract.`
      );
    if (doc && doc.teamCode === code) baseOnlyDocs[id] = doc;
    else if (releaseKeys.has(nameKey(id))) aliases.push(id);
    else throw new Error(`${code}/${id}: base roster player cannot be placed.`);
  }
  if (
    release.salaryCapYear !== 2026 &&
    Object.keys(releaseDocs).sort().join() !==
      [...(baseDoc.roster as string[])].sort().join()
  )
    throw new Error(
      `${code}: current contract release and roster membership differ.`
    );
  const built = await buildSimulationTeam({
    teamCode: code,
    asOf: release.effectiveAt,
    salaryCapYear: release.salaryCapYear,
    baseDoc: baseDoc as never,
    releaseDocs,
    baseOnlyDocs,
    deadMoneyDocs: Object.fromEntries(
      ((baseDoc.deadCap as Record<string, unknown>[]) ?? []).flatMap(
        (entry) => {
          const doc = deadMoneyDoc(entry);
          return doc ? [[String(entry.playerId), doc]] : [];
        }
      )
    ),
    hardCapCorrection:
      release.salaryCapYear === 2026
        ? HARD_CAP_CORRECTIONS[code as keyof typeof HARD_CAP_CORRECTIONS]
        : undefined,
    currentSeasonState: currentStates[code],
    assumption: { checkedAt, evidenceReferences },
    rareEvents: rareEvents.filter((event) => event.team === code),
  });
  teams[code] = built.team as unknown as Record<string, unknown>;
  reports.push({ ...built.report, aliasesDropped: aliases });
}

const prepared = await prepareSimulationFinancialBaseline({
  asOf: release.effectiveAt,
  seasonId: SEASON,
  teams,
  financialInputs: Object.fromEntries(
    Object.entries(teams).map(([code, team]) => [code, team.salaryBookInputs])
  ),
  ...(option('release') ? { contractRelease: release } : {}),
});
const bytes = JSON.stringify(prepared);
await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
console.table(
  reports.map((r) => ({
    team: r.teamCode,
    players: r.players,
    teamSalary: r.teamSalary,
    apron: r.apronTeamSalary,
    tax: r.taxSalary,
    bonuses: r.performanceBonuses,
    uplift: r.minimumUplifts.reduce((n, u) => n + u.uplift, 0),
    upliftRows: r.minimumUplifts
      .map((u) => `${u.playerId}${u.bounded ? '*' : ''}=${u.uplift}`)
      .join(' '),
    holds: r.freeAgentAmounts,
    hardCap: `${r.hardCap.level}${r.hardCap.corrected ? '*' : ''}`,
    tpe: r.openTradedPlayerExceptions,
    baseOnly: r.baseOnlyPlayers.join(' '),
  }))
);
console.log(
  JSON.stringify({
    classification: prepared.classification,
    teams: Object.keys(prepared.teams).length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    output,
  })
);
