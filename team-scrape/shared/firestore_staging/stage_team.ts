#!/usr/bin/env tsx
/**
 * stage_team.ts
 *
 * Transforms merged team scrape outputs into Firestore-ready `/architect/baseTeams/{teamCode}` docs.
 * Mirrors the player staging pipeline so we can diff-final payloads before any uploads occur.
 *
 * Usage:
 *   npm run stage:team -- --team=LAL
 *   tsx team-scrape/shared/firestore_staging/stage_team.ts --team=LAL --season=2025-26 --validate
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BaseTeamDocZ, type BaseTeamDoc } from '../../../src/schemas/architect.js';

type CliArgs = {
  team: string;
  season?: string;
  validate: boolean;
  outDir: string;
};

type RawTeamRosterEntry = {
  displayName?: string;
  playerId?: string;
  sourceUrl?: string;
};

type RawCapHoldEntry = RawTeamRosterEntry & {
  capHoldAmount?: number;
  type?: string;
  rights?: string;
};

type RawException = {
  type?: string;
  total?: number;
  totalAmount?: number;
  used?: number;
  usedAmount?: number;
  remaining?: number;
  remainingAmount?: number;
  available?: boolean;
  expiresOn?: string;
  expires?: string;
  createdFrom?: string;
  createdOn?: string;
};

type RawTradeException = RawException & {
  id: string;
};

type RawTeamData = {
  teamCode: string;
  teamName: string;
  season: string;
  roster?: RawTeamRosterEntry[];
  capHolds?: RawCapHoldEntry[];
  exceptions?: {
    mle?: RawException;
    taxpayerMle?: RawException;
    room?: RawException;
    bae?: RawException;
    dpe?: RawException;
    tpe?: RawTradeException[];
  };
  totals?: Record<string, unknown>;
  draftPicks?: RawDraftPick[];
  source?: {
    provider?: string;
    teamPageUrl?: string;
    scrapedAt?: string;
  };
  lastUpdated?: string;
  version?: string;
};

type RawDraftPick = {
  id?: string;
  year: number;
  round: number;
  status: string;
  originalTeam?: string;
  currentOwner?: string;
  via?: string;
  recipient?: string;
  stepienEligible?: boolean;
  tradeable?: boolean;
  protection?: string | null;
  pickNumber?: number | null;
  isSwap?: boolean;
  detailUrl?: string;
  tradedOn?: string;
  title?: string;
  notes?: string;
  contendingTeams?: string[];
  route?: string[];
};

type StructuredDraftPickGroup = {
  incoming?: RawDraftPick[];
  outgoing?: RawDraftPick[];
  own?: RawDraftPick[];
  contested?: RawDraftPick[];
};

type PlayerIndexEntry = {
  fullName: string;
  nbaId?: number;
  salarySwishSlug?: string;
  teamCode?: string;
};

type PlayerIndex = Record<string, PlayerIndexEntry>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const PLAYER_INDEX_PATH = path.join(
  PROJECT_ROOT,
  'player-scrape/shared/outputs/player_index.json',
);
const TEAM_DATA_DIR = path.join(PROJECT_ROOT, 'team-scrape', 'team-data', 'output');
const DRAFT_PICKS_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  'output',
  'structured',
);
const MERGED_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'output',
  'merged',
);

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const cli: CliArgs = {
    team: 'LAL',
    validate: false,
    outDir: path.join(
      PROJECT_ROOT,
      'team-scrape',
      'shared',
      'firestore_staging',
      'output',
    ),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--team' || arg === '-t') {
      cli.team = (args[i + 1] || 'LAL').toUpperCase();
      i += 1;
    } else if (arg.startsWith('--team=')) {
      cli.team = arg.split('=')[1]!.toUpperCase();
    } else if (arg === '--season' || arg === '-s') {
      cli.season = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--season=')) {
      cli.season = arg.split('=')[1];
    } else if (arg === '--validate') {
      cli.validate = true;
    } else if (arg === '--outDir') {
      cli.outDir = path.resolve(PROJECT_ROOT, args[i + 1] || cli.outDir);
      i += 1;
    } else if (arg.startsWith('--outDir=')) {
      cli.outDir = path.resolve(PROJECT_ROOT, arg.split('=')[1] ?? cli.outDir);
    }
  }

  return cli;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function normalizeDisplayName(displayName?: string | null): string | null {
  if (!displayName) return null;
  const commaParts = displayName.split(',').map((part) => part.trim());
  if (commaParts.length === 2) {
    return `${commaParts[1]} ${commaParts[0]}`.replace(/\s+/g, ' ').trim();
  }
  return displayName.replace(/\s+/g, ' ').trim();
}

function slugFromUrl(url?: string): string | null {
  if (!url) return null;
  const lastSegment = url.split('/').filter(Boolean).pop();
  if (!lastSegment) return null;
  return lastSegment.replace(/[^a-z0-9-]/gi, '').toLowerCase();
}

function toPlayerIdSeed(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function fallbackPlayerId(name: string, salt?: string): string {
  const base = toPlayerIdSeed(name);
  if (!salt) return `tmp_${base}`;
  const hash = createHash('md5').update(`${name}:${salt}`).digest('hex').slice(0, 6);
  return `tmp_${base}_${hash}`;
}

type PlayerIdResolver = {
  resolve: (entry: RawTeamRosterEntry, context: string) => {
    playerId: string;
    playerName: string;
    resolvedVia: string;
  };
  unresolved: Set<string>;
};

function buildResolver(index: PlayerIndex): PlayerIdResolver {
  const nameToId = new Map<string, string>();
  const slugToId = new Map<string, string>();

  for (const [playerId, entry] of Object.entries(index)) {
    if (!entry) continue;
    const normalizedName = entry.fullName.trim().toLowerCase();
    nameToId.set(normalizedName, playerId);

    if (entry.salarySwishSlug) {
      slugToId.set(entry.salarySwishSlug.toLowerCase(), playerId);
    }
  }

  const unresolved = new Set<string>();

  return {
    resolve(entry, context) {
      const name = normalizeDisplayName(entry.displayName) ?? entry.displayName ?? '';
      const normalizedName = name.trim().toLowerCase();
      if (normalizedName && nameToId.has(normalizedName)) {
        return { playerId: nameToId.get(normalizedName)!, playerName: name, resolvedVia: 'fullName' };
      }

      const slug = slugFromUrl(entry.sourceUrl);
      if (slug && slugToId.has(slug)) {
        const resolvedId = slugToId.get(slug)!;
        const resolvedName =
          index[resolvedId]?.fullName ?? (name || resolvedId);
        return { playerId: resolvedId, playerName: resolvedName, resolvedVia: 'slug' };
      }

      if (entry.playerId) {
        return {
          playerId: entry.playerId,
          playerName: name || entry.playerId,
          resolvedVia: 'provided',
        };
      }

      const fallbackId = fallbackPlayerId(name || context, slug ?? context);
      unresolved.add(`${context}::${name || 'UNKNOWN'}`);
      return { playerId: fallbackId, playerName: name || context, resolvedVia: 'fallback' };
    },
    unresolved,
  };
}

function mapException(src?: RawException | null) {
  if (!src) return undefined;
  const totalAmount = src.totalAmount ?? src.total ?? null;
  const usedAmount = src.usedAmount ?? src.used ?? null;
  const remainingAmount = src.remainingAmount ?? src.remaining ?? null;
  return {
    type: src.type,
    available: src.available,
    totalAmount: totalAmount ?? undefined,
    usedAmount: usedAmount ?? undefined,
    remainingAmount: remainingAmount ?? undefined,
    expiresOn: src.expiresOn ?? src.expires ?? undefined,
    createdFrom: src.createdFrom,
    createdOn: src.createdOn,
  };
}

function mapTradeExceptions(src?: RawTradeException[] | null) {
  if (!src?.length) return undefined;
  return src.map((row) => ({
    id: row.id,
    totalAmount: row.totalAmount ?? row.total ?? undefined,
    usedAmount: row.usedAmount ?? row.used ?? undefined,
    remainingAmount: row.remainingAmount ?? row.remaining ?? undefined,
    createdFrom: row.createdFrom,
    createdOn: row.createdOn,
    expiresOn: row.expiresOn ?? row.expires ?? undefined,
  }));
}

function buildExceptions(raw: RawTeamData['exceptions']) {
  if (!raw) return undefined;
  const mapped = {
    mle: mapException(raw.mle),
    taxpayerMle: mapException(raw.taxpayerMle),
    room: mapException(raw.room),
    bae: mapException(raw.bae),
    dpe: mapException(raw.dpe),
    tpe: mapTradeExceptions(raw.tpe),
  };

  if (
    !mapped.mle &&
    !mapped.taxpayerMle &&
    !mapped.room &&
    !mapped.bae &&
    !mapped.dpe &&
    (!mapped.tpe || mapped.tpe.length === 0)
  ) {
    return undefined;
  }

  return mapped;
}

function coalesceDraftPicks(args: {
  teamCode: string;
  primary?: RawDraftPick[];
  grouped?: StructuredDraftPickGroup;
  fallback?: RawDraftPick[];
}): RawDraftPick[] {
  if (args.primary?.length) return args.primary;

  if (args.grouped) {
    const { incoming = [], outgoing = [], own = [], contested = [] } = args.grouped;
    return [...incoming, ...outgoing, ...own, ...contested];
  }

  return args.fallback ?? [];
}

function normalizeDraftPick(teamCode: string, pick: RawDraftPick) {
  const owner = pick.currentOwner ?? (pick.status === 'incoming' ? teamCode : teamCode);
  const notes: string[] = [];
  if (pick.notes) notes.push(pick.notes);
  if (pick.title) notes.push(pick.title);
  if (pick.tradedOn) notes.push(`Traded on ${pick.tradedOn}`);
  if (pick.contendingTeams?.length) {
    notes.push(`Contending teams: ${pick.contendingTeams.join(', ')}`);
  }
  const combinedNotes = notes.length ? notes.join(' | ') : undefined;

  return {
    id: pick.id ?? `${teamCode}_${pick.year}_${pick.round}_${pick.status}`,
    year: pick.year,
    round: pick.round,
    pick: pick.pickNumber ?? null,
    owner,
    originalTeam: pick.originalTeam ?? teamCode,
    status: pick.status,
    notes: combinedNotes,
    detailUrl: pick.detailUrl,
    isSwap: pick.isSwap ?? false,
    protection: pick.protection ?? null,
    via: pick.via,
    recipient: pick.recipient,
    stepienEligible: pick.stepienEligible ?? null,
    tradeable: pick.tradeable ?? null,
  };
}

function normalizeTotals(rawTotals: RawTeamData['totals']): BaseTeamDoc['totals'] | undefined {
  if (!rawTotals) return undefined;
  const totals: BaseTeamDoc['totals'] = {};
  const mapNumber = (value: unknown): number | undefined =>
    typeof value === 'number' ? value : undefined;

  const assignments: Array<[keyof BaseTeamDoc['totals'], number | undefined]> = [
    ['totalSalary', mapNumber(rawTotals.totalSalary)],
    ['guaranteedSalary', mapNumber(rawTotals.guaranteedSalary)],
    ['nonGuaranteedSalary', mapNumber(rawTotals.nonGuaranteedSalary)],
    ['rosterCount', mapNumber(rawTotals.rosterCount)],
    ['guaranteedContracts', mapNumber(rawTotals.guaranteedContracts)],
    ['nonGuaranteedContracts', mapNumber(rawTotals.nonGuaranteedContracts)],
    ['twoWayContracts', mapNumber(rawTotals.twoWayCount ?? rawTotals.twoWayContracts)],
    ['emptyRosterCharges', mapNumber(rawTotals.incompleteRosterCharges)],
    ['capSpace', mapNumber(rawTotals.capSpace)],
    ['capRoom', mapNumber(rawTotals.capRoom)],
    ['effectiveCap', mapNumber(rawTotals.effectiveCap)],
    ['luxuryTaxLine', mapNumber(rawTotals.luxuryTaxLine)],
    ['taxablePayroll', mapNumber(rawTotals.taxablePayroll)],
    ['isOverTax', typeof rawTotals.isOverTax === 'boolean' ? rawTotals.isOverTax : undefined],
    ['taxBill', mapNumber(rawTotals.taxBill)],
    ['taxRate', mapNumber(rawTotals.taxRate)],
    ['firstApron', mapNumber(rawTotals.firstApron ?? rawTotals.firstApronLine)],
    ['firstApronRoom', mapNumber(rawTotals.firstApronRoom)],
    ['isFirstApron', typeof rawTotals.firstApronTriggered === 'boolean' ? rawTotals.firstApronTriggered : undefined],
    ['secondApron', mapNumber(rawTotals.secondApron ?? rawTotals.secondApronLine)],
    ['secondApronRoom', mapNumber(rawTotals.secondApronRoom)],
    ['isSecondApron', typeof rawTotals.secondApronTriggered === 'boolean' ? rawTotals.secondApronTriggered : undefined],
    ['isHardCapped', typeof rawTotals.isHardCapped === 'boolean' ? rawTotals.isHardCapped : undefined],
  ];

  for (const [key, value] of assignments) {
    if (value !== undefined) {
      totals[key] = value as never;
    }
  }

  const hardCapReason = (rawTotals as Record<string, unknown>).hardCapReason;
  if (typeof hardCapReason === 'string') {
    totals.hardCapLevel = hardCapReason;
  }

  const hardCapLevel = (rawTotals as Record<string, unknown>).hardCappedAt;
  if (typeof hardCapLevel === 'string') {
    totals.hardCapLevel = hardCapLevel;
  }

  return Object.keys(totals).length ? totals : undefined;
}

async function loadPlayerIndex(): Promise<PlayerIndex> {
  return readJson<PlayerIndex>(PLAYER_INDEX_PATH);
}

async function loadTeamData(teamCode: string): Promise<RawTeamData> {
  const pathCandidates = [
    path.join(TEAM_DATA_DIR, `team_${teamCode}.json`),
    path.join(TEAM_DATA_DIR, 'team.json'),
  ];

  for (const candidate of pathCandidates) {
    try {
      return await readJson<RawTeamData>(candidate);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  throw new Error(
    `Unable to locate team data for ${teamCode}. Run the SalarySwish parser first (npm run parse).`,
  );
}

async function loadDraftPicks(teamCode: string): Promise<{
  picks: RawDraftPick[];
  source?: { provider?: string; url?: string; scrapedAt?: string };
}> {
  const structuredPath = path.join(DRAFT_PICKS_DIR, `draft_picks_${teamCode}.json`);
  try {
    const picks = await readJson<RawDraftPick[]>(structuredPath);
    return { picks, source: { provider: 'RealGM', url: undefined } };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const mergedPath = path.join(MERGED_DIR, `${teamCode}_merged.json`);
  try {
    const merged = await readJson<{
      draftPicks?: StructuredDraftPickGroup;
      sources?: { draftPicks?: { provider?: string; url?: string; scrapedAt?: string } };
    }>(mergedPath);
    const picks = coalesceDraftPicks({
      teamCode,
      grouped: merged.draftPicks,
    });
    if (picks.length) {
      return { picks, source: merged.sources?.draftPicks };
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  return { picks: [], source: undefined };
}

function buildBaseTeamDoc({
  rawTeam,
  draftPicks,
  pickSource,
  resolver,
  seasonOverride,
}: {
  rawTeam: RawTeamData;
  draftPicks: RawDraftPick[];
  pickSource?: { provider?: string; url?: string; scrapedAt?: string };
  resolver: PlayerIdResolver;
  seasonOverride?: string;
}): BaseTeamDoc {
  const rosterIds = (rawTeam.roster ?? []).map((entry) =>
    resolver.resolve(entry, `roster`).playerId,
  );

  const capHolds = (rawTeam.capHolds ?? []).map((entry) => {
    const resolved = resolver.resolve(entry, 'capHold');
    return {
      playerId: resolved.playerId,
      playerName: resolved.playerName,
      amount: entry.capHoldAmount ?? 0,
      type: entry.type ?? entry.rights ?? 'Unknown',
      expiresOn: undefined,
      isSigned: false,
    };
  });

  const normalizedPicks = draftPicks.map((pick) => normalizeDraftPick(rawTeam.teamCode, pick));

  const totals = normalizeTotals(rawTeam.totals);

  return {
    teamCode: rawTeam.teamCode,
    teamName: rawTeam.teamName,
    season: seasonOverride ?? rawTeam.season,
    abbreviation: rawTeam.teamCode,
    roster: rosterIds,
    deadCap: [],
    capHolds,
    exceptions: buildExceptions(rawTeam.exceptions),
    draftPicks: normalizedPicks,
    totals,
    source: {
      provider: rawTeam.source?.provider,
      teamPageUrl: rawTeam.source?.teamPageUrl,
      scrapedAt: rawTeam.source?.scrapedAt,
      season: rawTeam.season,
      type: 'SalarySwish',
      baseTeamVersion: rawTeam.version,
      generatedAt: new Date().toISOString(),
      ...pickSource,
    },
    lastUpdated: rawTeam.lastUpdated ?? new Date().toISOString(),
    version: rawTeam.version ?? '1.0',
  };
}

async function stageTeam({ team, season, validate, outDir }: CliArgs) {
  const teamCode = team.toUpperCase();

  console.log(`📦 Staging baseTeam document for ${teamCode}`);

  const [playerIndex, rawTeam] = await Promise.all([
    loadPlayerIndex(),
    loadTeamData(teamCode),
  ]);

  const resolver = buildResolver(playerIndex);
  const { picks: structuredPicks, source: pickSource } = await loadDraftPicks(teamCode);
  const fallbackPicks =
    structuredPicks.length > 0
      ? structuredPicks
      : process.env.ALLOW_SALARYSWISH_DRAFT_BACKFILL === '1'
        ? rawTeam.draftPicks ?? []
        : [];

  if (structuredPicks.length === 0) {
    if (process.env.ALLOW_SALARYSWISH_DRAFT_BACKFILL === '1') {
      console.warn(
        `⚠️  No RealGM draft picks found for ${teamCode}. Falling back to SalarySwish draftPicks from team_data.`,
      );
    } else {
      console.warn(
        `⚠️  No RealGM draft picks found for ${teamCode}. Draft picks will be empty until RealGM scrape succeeds.`,
      );
    }
  }

  const baseTeamDoc = buildBaseTeamDoc({
    rawTeam,
    draftPicks: fallbackPicks,
    pickSource,
    resolver,
    seasonOverride: season,
  });

  if (validate) {
    BaseTeamDocZ.parse(baseTeamDoc);
  }

  const baseTeamsDir = path.join(outDir, 'baseTeams');
  const snapshotsDir = path.join(outDir, 'snapshots');
  const teamSnapshotDir = path.join(snapshotsDir, teamCode);
  await Promise.all([
    mkdir(baseTeamsDir, { recursive: true }),
    mkdir(teamSnapshotDir, { recursive: true }),
  ]);

  await writeFile(
    path.join(baseTeamsDir, `${teamCode}.json`),
    JSON.stringify(baseTeamDoc, null, 2),
    'utf8',
  );

  await writeFile(
    path.join(teamSnapshotDir, 'team_data.json'),
    JSON.stringify(rawTeam, null, 2),
    'utf8',
  );

  await writeFile(
    path.join(teamSnapshotDir, 'draft_picks.json'),
    JSON.stringify(fallbackPicks, null, 2),
    'utf8',
  );

  if (resolver.unresolved.size > 0) {
    console.warn(`⚠️  Unresolved player names (${resolver.unresolved.size}):`);
    for (const entry of resolver.unresolved) {
      console.warn(`   - ${entry}`);
    }
  }

  console.log('✅ baseTeams document staged successfully.');
  console.log(`   → ${path.relative(PROJECT_ROOT, path.join(baseTeamsDir, `${teamCode}.json`))}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  stageTeam(parseArgs()).catch((err) => {
    console.error('❌ Failed to stage team:', err);
    process.exit(1);
  });
}

