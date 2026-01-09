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

import {
  BaseTeamDocZ,
  type BaseTeamDoc,
} from '../../../../src/schemas/architect.js';

type CliArgs = {
  team: string;
  season?: string;
  validate: boolean;
  outDir: string;
  ledgerDir?: string;
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
  season?: string;
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
  owner?: string; // Canonical owner field
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
  relation?: 'inventory' | 'obligation' | 'contested'; // Ledger-derived relation tag
};

type StructuredDraftPickGroup = {
  incoming?: RawDraftPick[];
  outgoing?: RawDraftPick[];
  own?: RawDraftPick[];
  contested?: RawDraftPick[];
};

type NormalizedDraftPick = BaseTeamDoc['draftPicks'][number];

/**
 * Ledger-derived team pick views from buildPickLedger.ts
 */
type LedgerTeamViews = {
  teamCode: string;
  inventory: RawDraftPick[];
  obligations: RawDraftPick[];
  contested: RawDraftPick[];
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

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const PLAYER_INDEX_PATH = path.join(
  PROJECT_ROOT,
  'player-scrape/shared/outputs/player_index.json'
);
const TEAM_DATA_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'team-data',
  'output'
);
const DRAFT_PICKS_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  '_artifacts',
  'output'
);
const MERGED_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  '_artifacts',
  'output',
  'merged'
);
const DEFAULT_LEDGER_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  '_artifacts',
  'output',
  'ledger'
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
      '_artifacts',
      'output'
    ),
    ledgerDir: DEFAULT_LEDGER_DIR,
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
    } else if (arg === '--ledgerDir') {
      cli.ledgerDir = path.resolve(PROJECT_ROOT, args[i + 1] || cli.ledgerDir);
      i += 1;
    } else if (arg.startsWith('--ledgerDir=')) {
      cli.ledgerDir = path.resolve(PROJECT_ROOT, arg.split('=')[1] ?? cli.ledgerDir);
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
  const hash = createHash('md5')
    .update(`${name}:${salt}`)
    .digest('hex')
    .slice(0, 6);
  return `tmp_${base}_${hash}`;
}

type PlayerIdResolver = {
  resolve: (
    entry: RawTeamRosterEntry,
    context: string
  ) => {
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
    // Also add version with hyphens/spaces normalized for better matching
    const normalizedHyphen = normalizedName.replace(/[- ]/g, ' ');
    nameToId.set(normalizedHyphen, playerId);

    if (entry.salarySwishSlug) {
      slugToId.set(entry.salarySwishSlug.toLowerCase(), playerId);
    }
  }
  
  // Populate cleaned names (no punctuation)
  const cleanNameToId = new Map<string, string>();
  for (const [name, id] of nameToId.entries()) {
      cleanNameToId.set(name.replace(/[.,']/g, ''), id);
  }

  // Known manual overrides for tricky names
  const MANUAL_OVERRIDES: Record<string, string> = {
    'ron holland ii': 'ronald_holland_ii',
    'tolu smith iii': 'tolu_smith',
    'nahshon bones hyland': 'bones_hyland',
    'bones hyland': 'bones_hyland',
    'xavier tillman sr': 'xavier_tillman',
    'nicolas claxton': 'nic_claxton',
    'cameron thomas': 'cam_thomas',
    'royce oneale': 'royce_o_neale',
    'jasean tate': 'ja_sean_tate',
    'mo bamba': 'mohamed_bamba',
    'robert williams iii': 'robert_williams',
    'bruce brown jr': 'bruce_brown',
    'daron holmes': 'daron_holmes_ii',
    'trey jemison': 'trey_jemison_iii',
  };

  const unresolved = new Set<string>();

  return {
    resolve(entry, context) {
      const name =
        normalizeDisplayName(entry.displayName) ?? entry.displayName ?? '';
      const normalizedName = name.trim().toLowerCase();

      // Check manual overrides first
      if (MANUAL_OVERRIDES[normalizedName]) {
        const overrideId = MANUAL_OVERRIDES[normalizedName];
        return {
          playerId: overrideId,
          playerName: index[overrideId]?.fullName ?? name,
          resolvedVia: 'manual_override',
        };
      }

      // Try exact match first
      if (normalizedName && nameToId.has(normalizedName)) {
        return {
          playerId: nameToId.get(normalizedName)!,
          playerName: name,
          resolvedVia: 'fullName',
        };
      }

      // Try with hyphens/spaces normalized (e.g., "alexander-walker" -> "alexander walker")
      const normalizedHyphen = normalizedName.replace(/[- ]/g, ' ');
      if (normalizedHyphen && nameToId.has(normalizedHyphen)) {
        return {
          playerId: nameToId.get(normalizedHyphen)!,
          playerName: name,
          resolvedVia: 'fullName',
        };
      }

      // Try with punctuation removed (e.g., "jr." -> "jr", "o'neale" -> "oneale")
      const normalizedClean = normalizedName.replace(/[.,']/g, '');
      if (normalizedClean && cleanNameToId.has(normalizedClean)) {
        return {
          playerId: cleanNameToId.get(normalizedClean)!,
          playerName: name,
          resolvedVia: 'fullNameClean',
        };
      }

      // Try with punctuation removed from the hyphen-normalized version as well for max coverage
      const normalizedHyphenClean = normalizedHyphen.replace(/[.,']/g, '');
       if (normalizedHyphenClean && cleanNameToId.has(normalizedHyphenClean)) {
        return {
          playerId: cleanNameToId.get(normalizedHyphenClean)!,
          playerName: name,
          resolvedVia: 'fullNameClean',
        };
      }


      const slug = slugFromUrl(entry.sourceUrl);
      if (slug && slugToId.has(slug)) {
        const resolvedId = slugToId.get(slug)!;
        const resolvedName =
          index[resolvedId]?.fullName ?? (name || resolvedId);
        return {
          playerId: resolvedId,
          playerName: resolvedName,
          resolvedVia: 'slug',
        };
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
      return {
        playerId: fallbackId,
        playerName: name || context,
        resolvedVia: 'fallback',
      };
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
    const {
      incoming = [],
      outgoing = [],
      own = [],
      contested = [],
    } = args.grouped;
    return [...incoming, ...outgoing, ...own, ...contested];
  }

  return args.fallback ?? [];
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildDraftPickNotes(
  teamCode: string,
  pick: RawDraftPick
): string | undefined {
  const segments = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) {
      segments.add(trimmed);
    }
  };

  if (pick.status && pick.status.toLowerCase() !== 'own') {
    const recipient = pick.recipient ?? pick.owner;
    const targetSuffix =
      recipient && recipient !== teamCode ? ` → ${recipient}` : '';
    add(`Status: ${capitalize(pick.status)}${targetSuffix}`);
  }

  const originalTeam =
    pick.originalTeam ??
    (pick as unknown as { originalTeamCode?: string }).originalTeamCode;
  if (originalTeam && originalTeam !== teamCode) {
    add(`Original team: ${originalTeam}`);
  }

  if (pick.via) {
    add(`Via ${pick.via}`);
  }

  if (pick.protection) {
    add(`Protection: ${pick.protection}`);
  }

  if (pick.isSwap) {
    add('Includes swap rights');
  }

  if (pick.tradeable === false) {
    add('Not tradeable currently');
  }

  if (pick.stepienEligible === false) {
    add('Stepien restricted');
  }

  add(pick.notes);
  add(pick.title);

  if (pick.tradedOn) {
    add(`Traded on ${pick.tradedOn}`);
  }

  if (pick.contendingTeams?.length) {
    add(`Contending teams: ${pick.contendingTeams.join(', ')}`);
  }

  if (pick.route?.length) {
    add(`Route: ${pick.route.join(' → ')}`);
  }

  const conveyance = (
    pick as unknown as {
      conveyanceObligation?: {
        description?: string;
        conditions?: {
          protection?: string;
          ifConveys?: string;
          ifRolls?: string;
        };
      };
    }
  ).conveyanceObligation;

  if (conveyance?.description) {
    add(conveyance.description);
  }
  if (conveyance?.conditions?.protection) {
    add(`Condition: ${conveyance.conditions.protection}`);
  }
  if (conveyance?.conditions?.ifConveys) {
    add(`If conveys: ${conveyance.conditions.ifConveys}`);
  }
  if (conveyance?.conditions?.ifRolls) {
    add(`If rolls: ${conveyance.conditions.ifRolls}`);
  }

  if (segments.size === 0) {
    return undefined;
  }

  return Array.from(segments).join(' | ');
}

function normalizeDraftPick(
  teamCode: string,
  pick: RawDraftPick
): NormalizedDraftPick {
  const owner = pick.owner ?? teamCode;
  const notes = buildDraftPickNotes(teamCode, pick);

  const normalized: NormalizedDraftPick = {
    year: pick.year,
    round: pick.round,
    pick: pick.pickNumber ?? null,
    owner,
  };

  if (pick.id) normalized.id = pick.id;
  if (pick.originalTeam) normalized.originalTeam = pick.originalTeam;
  if (pick.status) normalized.status = pick.status;
  if (typeof pick.isSwap === 'boolean') normalized.isSwap = pick.isSwap;
  if (pick.protection !== undefined)
    normalized.protection = pick.protection ?? null;
  if (typeof pick.stepienEligible === 'boolean') {
    normalized.stepienEligible = pick.stepienEligible;
  }
  if (typeof pick.tradeable === 'boolean') {
    normalized.tradeable = pick.tradeable;
  }
  if (pick.via) normalized.via = pick.via;
  if (pick.recipient) normalized.recipient = pick.recipient;
  if (pick.route?.length) normalized.route = pick.route;
  if (notes) normalized.notes = notes;

  const conveyance = (
    pick as unknown as {
      conveyanceObligation?: {
        id?: string;
        description?: string;
        originalYear?: number;
        currentYear?: number;
        finalYear?: number;
        stepienImpact?: Record<string, unknown>;
        conditions?: Record<string, unknown>;
        affects?: string[];
      };
    }
  ).conveyanceObligation;

  if (conveyance) {
    normalized.conveyance = {
      id: conveyance.id,
      description: conveyance.description,
      originalYear: conveyance.originalYear,
      currentYear: conveyance.currentYear,
      finalYear: conveyance.finalYear,
      stepienImpact: conveyance.stepienImpact,
      conditions: conveyance.conditions,
      affects: conveyance.affects,
    } as NormalizedDraftPick['conveyance'];
  }

  const metadata: Record<string, unknown> = {};

  if (
    (pick as unknown as { swapDetails?: unknown }).swapDetails !== undefined
  ) {
    metadata.swapDetails = (
      pick as unknown as { swapDetails?: unknown }
    ).swapDetails;
  }

  if (pick.contendingTeams?.length) {
    metadata.contendingTeams = pick.contendingTeams;
  }

  if (Object.keys(metadata).length > 0) {
    normalized.metadata = metadata;
  }

  return normalized;
}

function normalizeTotals(
  rawTotals: RawTeamData['totals']
): BaseTeamDoc['totals'] | undefined {
  if (!rawTotals) return undefined;
  const totals: BaseTeamDoc['totals'] = {};
  const mapNumber = (value: unknown): number | undefined =>
    typeof value === 'number' ? value : undefined;

  const assignments: Array<[keyof BaseTeamDoc['totals'], number | boolean | undefined]> =
    [
      ['totalSalary', mapNumber(rawTotals.totalSalary)],
      ['capHit', mapNumber(rawTotals.capHit)],
      ['guaranteedSalary', mapNumber(rawTotals.guaranteedSalary)],
      ['nonGuaranteedSalary', mapNumber(rawTotals.nonGuaranteedSalary)],
      ['rosterCount', mapNumber(rawTotals.rosterCount)],
      ['guaranteedContracts', mapNumber(rawTotals.guaranteedContracts)],
      ['nonGuaranteedContracts', mapNumber(rawTotals.nonGuaranteedContracts)],
      [
        'twoWayContracts',
        mapNumber(rawTotals.twoWayCount ?? rawTotals.twoWayContracts),
      ],
      ['emptyRosterCharges', mapNumber(rawTotals.incompleteRosterCharges)],
      ['capSpace', mapNumber(rawTotals.capSpace)],
      ['capRoom', mapNumber(rawTotals.capRoom)],
      ['effectiveCap', mapNumber(rawTotals.effectiveCap)],
      ['luxuryTaxLine', mapNumber(rawTotals.luxuryTaxLine)],
      ['taxablePayroll', mapNumber(rawTotals.taxablePayroll)],
      [
        'isOverTax',
        typeof rawTotals.isOverTax === 'boolean'
          ? rawTotals.isOverTax
          : undefined,
      ],
      ['taxBill', mapNumber(rawTotals.taxBill)],
      ['taxRate', mapNumber(rawTotals.taxRate)],
      [
        'firstApron',
        mapNumber(rawTotals.firstApron ?? rawTotals.firstApronLine),
      ],
      ['firstApronRoom', mapNumber(rawTotals.firstApronRoom)],
      [
        'isFirstApron',
        typeof rawTotals.firstApronTriggered === 'boolean'
          ? rawTotals.firstApronTriggered
          : undefined,
      ],
      [
        'secondApron',
        mapNumber(rawTotals.secondApron ?? rawTotals.secondApronLine),
      ],
      ['secondApronRoom', mapNumber(rawTotals.secondApronRoom)],
      [
        'isSecondApron',
        typeof rawTotals.secondApronTriggered === 'boolean'
          ? rawTotals.secondApronTriggered
          : undefined,
      ],
      [
        'isHardCapped',
        typeof rawTotals.isHardCapped === 'boolean'
          ? rawTotals.isHardCapped
          : undefined,
      ],
    ];

  for (const [key, value] of assignments) {
    if (value !== undefined) {
      totals[key] = value as never;
    }
  }

  const hardCapDetail =
    (rawTotals as Record<string, unknown>).hardCapDetail ??
    (rawTotals as Record<string, unknown>).hardCapReason;
  if (typeof hardCapDetail === 'string' && hardCapDetail.trim()) {
    totals.hardCapDetail = hardCapDetail.trim();
  }

  const hardCapLevel =
    (rawTotals as Record<string, unknown>).hardCapLevel ??
    (rawTotals as Record<string, unknown>).hardCappedAt;
  if (typeof hardCapLevel === 'string') {
    const normalized = hardCapLevel.trim();
    if (['none', 'firstApron', 'secondApron'].includes(normalized)) {
      totals.hardCapLevel = normalized as BaseTeamDoc['totals']['hardCapLevel'];
    }
  }

  return Object.keys(totals).length ? totals : undefined;
}

async function loadPlayerIndex(): Promise<PlayerIndex> {
  return readJson<PlayerIndex>(PLAYER_INDEX_PATH);
}

async function loadTeamData(teamCode: string): Promise<RawTeamData> {
  const pathCandidates = [
    path.join(TEAM_DATA_DIR, `team_${teamCode}.json`),
    path.join(TEAM_DATA_DIR, 'team-data', `team_${teamCode}.json`),
    path.join(TEAM_DATA_DIR, 'team.json'),
    path.join(TEAM_DATA_DIR, 'team-data', 'team.json'),
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
    `Unable to locate team data for ${teamCode}. Run the SalarySwish parser first (npm run parse).`
  );
}

async function loadDraftPicks(teamCode: string): Promise<{
  picks: RawDraftPick[];
  source?: { provider?: string; url?: string; scrapedAt?: string };
}> {
  const structuredCandidates = [
    path.join(DRAFT_PICKS_DIR, `draft_picks_${teamCode}.json`),
    path.join(DRAFT_PICKS_DIR, 'structured', `draft_picks_${teamCode}.json`),
    path.join(DRAFT_PICKS_DIR, 'draft-picks', `draft_picks_${teamCode}.json`),
    path.join(
      DRAFT_PICKS_DIR,
      'draft-picks',
      'structured',
      `draft_picks_${teamCode}.json`
    ),
  ];

  for (const candidate of structuredCandidates) {
    try {
      const picks = await readJson<RawDraftPick[]>(candidate);
      return { picks, source: { provider: 'RealGM', url: undefined } };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  const mergedPath = path.join(MERGED_DIR, `${teamCode}_merged.json`);
  try {
    const merged = await readJson<{
      draftPicks?: StructuredDraftPickGroup;
      sources?: {
        draftPicks?: { provider?: string; url?: string; scrapedAt?: string };
      };
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

/**
 * Loads ledger-derived team pick views (inventory/obligations/contested)
 * from the ledger builder output.
 */
async function loadLedgerViews(
  teamCode: string,
  ledgerDir: string
): Promise<LedgerTeamViews | null> {
  const viewsPath = path.join(ledgerDir, 'by_team', `${teamCode}.json`);
  try {
    const views = await readJson<LedgerTeamViews>(viewsPath);
    if (views && views.teamCode === teamCode) {
      console.log(
        `  ✓ Loaded ledger views for ${teamCode}: inventory=${views.inventory?.length || 0}, obligations=${views.obligations?.length || 0}, contested=${views.contested?.length || 0}`
      );
      return views;
    }
    return null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`⚠️  Error reading ledger views for ${teamCode}:`, err);
    }
    return null;
  }
}

function buildBaseTeamDoc({
  rawTeam,
  draftPicks,
  ledgerViews,
  pickSource,
  resolver,
  seasonOverride,
}: {
  rawTeam: RawTeamData;
  draftPicks: NormalizedDraftPick[];
  ledgerViews?: LedgerTeamViews | null;
  pickSource?: { provider?: string; url?: string; scrapedAt?: string };
  resolver: PlayerIdResolver;
  seasonOverride?: string;
}): BaseTeamDoc & {
  draftPicksInventory?: NormalizedDraftPick[];
  draftPicksObligations?: NormalizedDraftPick[];
  draftPicksContested?: NormalizedDraftPick[];
} {
  const rosterIds = (rawTeam.roster ?? []).map(
    (entry) => resolver.resolve(entry, `roster`).playerId
  );

  const capHolds = (rawTeam.capHolds ?? []).map((entry) => {
    const resolved = resolver.resolve(entry, 'capHold');
    return {
      playerId: resolved.playerId,
      playerName: resolved.playerName,
      amount: entry.capHoldAmount ?? 0,
      type: entry.type ?? entry.rights ?? 'Unknown',
      season: entry.season ?? rawTeam.season,
      expiresOn: undefined,
      isSigned: false,
    };
  });

  const totals = normalizeTotals(rawTeam.totals);

  // Build ledger-derived views if available
  let draftPicksInventory: NormalizedDraftPick[] | undefined;
  let draftPicksObligations: NormalizedDraftPick[] | undefined;
  let draftPicksContested: NormalizedDraftPick[] | undefined;
  let finalDraftPicks = draftPicks;

  if (ledgerViews) {
    // Normalize ledger picks to match the expected format
    draftPicksInventory = (ledgerViews.inventory || []).map((pick) =>
      normalizeDraftPick(rawTeam.teamCode, pick)
    );
    draftPicksObligations = (ledgerViews.obligations || []).map((pick) =>
      normalizeDraftPick(rawTeam.teamCode, pick)
    );
    draftPicksContested = (ledgerViews.contested || []).map((pick) =>
      normalizeDraftPick(rawTeam.teamCode, pick)
    );

    // Use inventory as the primary draftPicks (for backward compatibility)
    // This ensures existing consumers still see picks the team owns
    finalDraftPicks = draftPicksInventory;
  }

  const baseDoc: BaseTeamDoc & {
    draftPicksInventory?: NormalizedDraftPick[];
    draftPicksObligations?: NormalizedDraftPick[];
    draftPicksContested?: NormalizedDraftPick[];
  } = {
    teamCode: rawTeam.teamCode,
    teamName: rawTeam.teamName,
    season: seasonOverride ?? rawTeam.season,
    abbreviation: rawTeam.teamCode,
    roster: rosterIds,
    deadCap: [],
    capHolds,
    exceptions: buildExceptions(rawTeam.exceptions),
    draftPicks: finalDraftPicks,
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

  // Add ledger-derived views if available
  if (draftPicksInventory) {
    baseDoc.draftPicksInventory = draftPicksInventory;
  }
  if (draftPicksObligations) {
    baseDoc.draftPicksObligations = draftPicksObligations;
  }
  if (draftPicksContested) {
    baseDoc.draftPicksContested = draftPicksContested;
  }

  return baseDoc;
}

async function stageTeam({ team, season, validate, outDir, ledgerDir }: CliArgs) {
  const teamCode = team.toUpperCase();

  console.log(`📦 Staging baseTeam document for ${teamCode}`);

  const [playerIndex, rawTeam] = await Promise.all([
    loadPlayerIndex(),
    loadTeamData(teamCode),
  ]);

  const resolver = buildResolver(playerIndex);
  const { picks: structuredPicks, source: pickSource } =
    await loadDraftPicks(teamCode);

  // Load ledger views if available
  let ledgerViews: LedgerTeamViews | null = null;
  if (ledgerDir) {
    ledgerViews = await loadLedgerViews(teamCode, ledgerDir);
  }

  const fallbackPicks =
    structuredPicks.length > 0
      ? structuredPicks
      : process.env.ALLOW_SALARYSWISH_DRAFT_BACKFILL === '1'
        ? (rawTeam.draftPicks ?? [])
        : [];

  if (structuredPicks.length === 0 && !ledgerViews) {
    // Only warn if BOTH conditions are true:
    // 1. No RealGM structured picks found for this team
    // 2. No ledger views available (ledger wasn't built yet or team not in ledger)
    // When ledgerViews exist, we'll use them for inventory/obligations/contested,
    // even if structuredPicks is empty.
    if (process.env.ALLOW_SALARYSWISH_DRAFT_BACKFILL === '1') {
      console.warn(
        `⚠️  No RealGM draft picks found for ${teamCode}. Falling back to SalarySwish draftPicks from team_data.`
      );
    } else {
      console.warn(
        `⚠️  No RealGM draft picks found for ${teamCode}. Draft picks will be empty until RealGM scrape succeeds.`
      );
    }
  }

  const normalizedPicks = fallbackPicks.map((pick) =>
    normalizeDraftPick(rawTeam.teamCode, pick)
  );

  const baseTeamDoc = buildBaseTeamDoc({
    rawTeam,
    draftPicks: normalizedPicks,
    ledgerViews,
    pickSource,
    resolver,
    seasonOverride: season,
  });

  if (validate) {
    // Validate the base schema. The BaseTeamDocZ schema does not yet include
    // the new ledger-derived fields (draftPicksInventory, draftPicksObligations,
    // draftPicksContested). We strip them for validation purposes.
    // TODO: Update BaseTeamDocZ in src/schemas/architect.ts to include these
    // new fields once they are stable and the Trade Machine is wired to use them.
    BaseTeamDocZ.parse({
      ...baseTeamDoc,
      draftPicksInventory: undefined,
      draftPicksObligations: undefined,
      draftPicksContested: undefined,
    });
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
    'utf8'
  );

  await writeFile(
    path.join(teamSnapshotDir, 'team_data.json'),
    JSON.stringify(rawTeam, null, 2),
    'utf8'
  );

  await writeFile(
    path.join(teamSnapshotDir, 'draft_picks.json'),
    JSON.stringify(normalizedPicks, null, 2),
    'utf8'
  );

  if (fallbackPicks.length > 0) {
    await writeFile(
      path.join(teamSnapshotDir, 'draft_picks_raw.json'),
      JSON.stringify(fallbackPicks, null, 2),
      'utf8'
    );
  }

  // Write ledger views snapshot if available
  if (ledgerViews) {
    await writeFile(
      path.join(teamSnapshotDir, 'ledger_views.json'),
      JSON.stringify(ledgerViews, null, 2),
      'utf8'
    );
  }

  if (resolver.unresolved.size > 0) {
    console.warn(`⚠️  Unresolved player names (${resolver.unresolved.size}):`);
    for (const entry of resolver.unresolved) {
      console.warn(`   - ${entry}`);
    }
  }

  console.log('✅ baseTeams document staged successfully.');
  console.log(
    `   → ${path.relative(PROJECT_ROOT, path.join(baseTeamsDir, `${teamCode}.json`))}`
  );

  // Log ledger stats if available
  if (baseTeamDoc.draftPicksInventory) {
    console.log(`   📊 Ledger views:`);
    console.log(`      - draftPicksInventory: ${baseTeamDoc.draftPicksInventory.length} picks`);
    console.log(`      - draftPicksObligations: ${baseTeamDoc.draftPicksObligations?.length ?? 0} picks`);
    console.log(`      - draftPicksContested: ${baseTeamDoc.draftPicksContested?.length ?? 0} picks`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  stageTeam(parseArgs()).catch((err) => {
    console.error('❌ Failed to stage team:', err);
    process.exit(1);
  });
}
