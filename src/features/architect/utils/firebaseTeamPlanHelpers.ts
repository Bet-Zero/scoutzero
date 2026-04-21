/**
 * FILE: src/features/architect/utils/firebaseTeamPlanHelpers.ts
 * PURPOSE: Firebase helpers for loading base team/player data and free agents.
 * OWNERSHIP: Feature: architect/core
 *
 * ARCHITECT READ-STACK LAYER: base hydration authority.
 * - Owns base team/player/free-agent reads and hydrated base team shapes.
 * - Not world-aware; lineage fallback belongs in teamLoader.ts.
 * - Not a committed-write authority; world writes live in higher authorities.
 *
 * HISTORY:
 *  - 2025-12-25: Removed legacy teamPlans save/load functions (worlds-only cleanup)
 *  - 2026-01-21: Added entitlementIds pass-through for base team hydration
 *  - 2026-03-13: Migrated authoritative implementation to TypeScript without changing helper behavior
 *
 * NOTE: All team mutations now go through mutationPipeline.ts for world persistence.
 *       This file only handles READ operations for base data and free agents.
 */

import {
  doc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  baseTeamRef,
  baseTeamsCol,
  basePlayerRef,
} from '@/data/firestorePaths';
import { FREE_AGENTS_COLLECTION } from '@/constants/collections';
import {
  TeamListFull,
  TeamSlugToCode,
  TeamCodeMap,
} from '@/constants/teamList';
import { normalizeTeamExceptionOwnership } from '@/features/architect/utils/exceptions/exceptionOwnership';
import { normalizeTeamTpeSchema } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type { TeamTotals } from '@/features/architect/types';
import {
  hasArchitectField,
  readArchitectBoolean,
  readArchitectContract,
  readArchitectNumber,
  readArchitectRecord,
  readArchitectString,
  readArchitectStringArray,
  readArchitectUnknownArray,
  requireArchitectRecord,
} from '@/features/architect/utils/architectFirestoreBoundary';

type UnknownRecord = Record<string, unknown>;
type TeamIdLike = string | null | undefined;

interface LooseCapSheet extends UnknownRecord {
  capHolds?: unknown[] | null;
}

interface LooseExceptionValue extends UnknownRecord {
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
}

interface LooseTradeException extends LooseExceptionValue {
  id?: string;
  label?: string | null;
  createdFrom?: string | null;
  expiresOn?: string | null;
  expires?: string | null;
}

interface LooseExceptionData extends UnknownRecord {
  mle?: LooseExceptionValue | null;
  tpmle?: LooseExceptionValue | null;
  taxpayerMle?: LooseExceptionValue | null;
  tpMle?: LooseExceptionValue | null;
  nonTaxpayerMle?: LooseExceptionValue | null;
  fullMLE?: LooseExceptionValue | null;
  bae?: LooseExceptionValue | null;
  biAnnual?: LooseExceptionValue | null;
  room?: LooseExceptionValue | null;
  roomMLE?: LooseExceptionValue | null;
  roommle?: LooseExceptionValue | null;
  rmle?: LooseExceptionValue | null;
  dpe?: LooseExceptionValue | null;
  tpe?: LooseTradeException[] | null;
}

interface LooseBaseTeamDoc extends UnknownRecord {
  roster?: unknown[] | null;
  teamName?: string;
  season?: string;
  abbreviation?: string | null;
  capHolds?: unknown[] | null;
  draftPicks?: unknown[] | null;
  draftPicksInventory?: unknown[] | null;
  draftPicksObligations?: unknown[] | null;
  draftPicksContested?: unknown[] | null;
  draftAssets?: unknown;
  entitlementIds?: string[] | null;
  offerSheets?: unknown[] | null;
  incomingOfferSheets?: unknown[] | null;
  exceptions?: LooseExceptionData | null;
  tradeExceptions?: LooseTradeException[] | null;
  hardCapLevel?: string | null;
  hardCapReason?: string | null;
  hardCapTriggeredBy?: string | null;
  deadCap?: unknown[] | null;
  totals?:
    | (UnknownRecord & {
        hardCapLevel?: string | null;
        hardCapReason?: string | null;
        hardCapDetail?: string | null;
      })
    | null;
}

interface LooseBirdRights extends UnknownRecord {
  status?: string | null;
  yearsOfService?: number | null;
  yearsWithTeam?: number | null;
  eligibleFor?: string[] | null;
}

interface LooseContract extends UnknownRecord {
  salariesByYear?: unknown[] | null;
  yearsRemaining?: number | null;
  contractType?: string | null;
  isExtension?: boolean | null;
  isRookieScale?: boolean | null;
  signedUsing?: string | null;
  signingTeam?: string | null;
  signingDate?: string | null;
  totalValue?: number | null;
  birdRights?: LooseBirdRights | null;
  freeAgency?:
    | { year?: number | string | null; type?: string | null }
    | string
    | null;
}

interface LooseBio extends UnknownRecord {
  position?: string | null;
  age?: number | null;
  experience?: number | null;
}

interface LooseBasePlayerDoc extends UnknownRecord {
  playerId?: string;
  displayName?: string;
  bio?: LooseBio | null;
  teamCode?: string | null;
  teamName?: string | null;
  contract?: LooseContract | null;
  futureContract?: LooseContract | null;
  representation?: unknown;
}

interface LooseFreeAgent extends UnknownRecord {
  id?: string;
  name?: string;
}

type TeamCodeMapValue = (typeof TeamCodeMap)[keyof typeof TeamCodeMap];

const TEAM_SLUG_TO_CODE_LOOKUP = TeamSlugToCode as Record<
  string,
  string | undefined
>;
const TEAM_CODE_LOOKUP = TeamCodeMap as Record<
  string,
  TeamCodeMapValue | undefined
>;

// ===== Utility to Prepare Cap Sheet =====

// In the new model, cap holds are managed in the `capHolds` array in state.
// We no longer need to calculate them on every save from player attributes.
// Logic for creating them happens on "Decline Option" or similar events.
export const prepareCapSheet = <TCapSheet extends LooseCapSheet>(
  capSheet: TCapSheet /* , capProjections , year = 2025 */
) => {
  // Just pass through, or maybe sort the capHolds if needed?
  return {
    ...capSheet,
    capHolds: capSheet.capHolds || [],
    updatedAt: new Date().toISOString(),
  };
};

// ===== Load Real-World Base Team Data (read-only) =====

const resolveTeamCode = (teamId: TeamIdLike) => {
  if (!teamId) return null;
  const slugTeamCode = TEAM_SLUG_TO_CODE_LOOKUP[teamId];
  if (slugTeamCode) return slugTeamCode;
  if (TEAM_CODE_LOOKUP[teamId]) return teamId;
  return teamId.toUpperCase();
};

function readNullableString(
  value: unknown,
  context: string
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string or null when present`);
  }

  return value;
}

function readNullableNumber(
  value: unknown,
  context: string
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const numberValue = readArchitectNumber(value);
  if (numberValue === null) {
    throw new Error(`${context} must be a finite number or null when present`);
  }

  return numberValue;
}

function readNullableBoolean(
  value: unknown,
  context: string
): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const booleanValue = readArchitectBoolean(value);
  if (booleanValue === undefined) {
    throw new Error(`${context} must be a boolean or null when present`);
  }

  return booleanValue;
}

function readLooseBirdRights(
  value: unknown,
  context: string
): LooseBirdRights | null {
  if (value == null) {
    return null;
  }

  const record = requireArchitectRecord(value, context);
  const normalized = { ...record } as LooseBirdRights;
  const status = readNullableString(record.status, `${context}.status`);
  if (status !== undefined) {
    normalized.status = status;
  }
  const yearsOfService = readNullableNumber(
    record.yearsOfService,
    `${context}.yearsOfService`
  );
  if (yearsOfService !== undefined) {
    normalized.yearsOfService = yearsOfService;
  }
  const yearsWithTeam = readNullableNumber(
    record.yearsWithTeam,
    `${context}.yearsWithTeam`
  );
  if (yearsWithTeam !== undefined) {
    normalized.yearsWithTeam = yearsWithTeam;
  }
  const eligibleFor = readArchitectStringArray(
    record.eligibleFor,
    `${context}.eligibleFor`
  );
  if (eligibleFor !== undefined) {
    normalized.eligibleFor = eligibleFor;
  }

  return normalized;
}

function readLooseContract(value: unknown, context: string): LooseContract | null {
  const contract = readArchitectContract(value, context);
  if (!contract) {
    return null;
  }

  const normalized = { ...contract } as LooseContract;
  const yearsRemaining = readNullableNumber(
    contract.yearsRemaining,
    `${context}.yearsRemaining`
  );
  if (yearsRemaining !== undefined) {
    normalized.yearsRemaining = yearsRemaining;
  }

  for (const field of [
    'contractType',
    'signedUsing',
    'signingTeam',
    'signingDate',
  ]) {
    const value = readNullableString(contract[field], `${context}.${field}`);
    if (value !== undefined) {
      normalized[field] = value;
    }
  }

  for (const field of ['isExtension', 'isRookieScale']) {
    const value = readNullableBoolean(contract[field], `${context}.${field}`);
    if (value !== undefined) {
      normalized[field] = value;
    }
  }

  const totalValue = readNullableNumber(contract.totalValue, `${context}.totalValue`);
  if (totalValue !== undefined) {
    normalized.totalValue = totalValue;
  }

  const birdRights = readLooseBirdRights(
    contract.birdRights,
    `${context}.birdRights`
  );
  if (hasArchitectField(contract, 'birdRights')) {
    normalized.birdRights = birdRights;
  }

  if (hasArchitectField(contract, 'freeAgency')) {
    if (
      contract.freeAgency == null ||
      typeof contract.freeAgency === 'string'
    ) {
      normalized.freeAgency = contract.freeAgency;
    } else {
      const freeAgency = requireArchitectRecord(
        contract.freeAgency,
        `${context}.freeAgency`
      );
      let year: number | string | null | undefined;
      if (freeAgency.year === undefined) {
        year = undefined;
      } else if (freeAgency.year === null) {
        year = null;
      } else if (typeof freeAgency.year === 'number') {
        year = readNullableNumber(
          freeAgency.year,
          `${context}.freeAgency.year`
        );
      } else if (typeof freeAgency.year === 'string') {
        year = freeAgency.year;
      } else {
        throw new Error(
          `${context}.freeAgency.year must be a string, finite number, or null when present`
        );
      }

      normalized.freeAgency = {
        ...freeAgency,
        ...(year !== undefined ? { year } : {}),
        type:
          readNullableString(freeAgency.type, `${context}.freeAgency.type`) ??
          null,
      };
    }
  }

  return normalized;
}

function readLooseBio(value: unknown, context: string): LooseBio | null {
  if (value == null) {
    return null;
  }

  const record = requireArchitectRecord(value, context);
  const normalized = { ...record } as LooseBio;

  const position = readNullableString(record.position, `${context}.position`);
  if (position !== undefined) {
    normalized.position = position;
  }
  const age = readNullableNumber(record.age, `${context}.age`);
  if (age !== undefined) {
    normalized.age = age;
  }
  const experience = readNullableNumber(record.experience, `${context}.experience`);
  if (experience !== undefined) {
    normalized.experience = experience;
  }

  return normalized;
}

function readLooseBasePlayerDoc(
  value: unknown,
  playerId: string,
  context: string
): LooseBasePlayerDoc {
  const record = requireArchitectRecord(value, context);
  const normalized = { ...record } as LooseBasePlayerDoc;

  normalized.playerId = readArchitectString(record.playerId) ?? playerId;
  normalized.displayName = readArchitectString(record.displayName);
  normalized.bio = readLooseBio(record.bio, `${context}.bio`);
  normalized.teamCode = readNullableString(record.teamCode, `${context}.teamCode`);
  normalized.teamName = readNullableString(record.teamName, `${context}.teamName`);
  normalized.contract = readLooseContract(record.contract, `${context}.contract`);
  normalized.futureContract = readLooseContract(
    record.futureContract,
    `${context}.futureContract`
  );
  if (hasArchitectField(record, 'representation')) {
    normalized.representation = record.representation;
  }

  return normalized;
}

function readLooseExceptionData(
  value: unknown,
  context: string
): LooseExceptionData | null {
  if (value == null) {
    return null;
  }

  const record = requireArchitectRecord(value, context);
  const normalized = { ...record } as LooseExceptionData;
  const tpe = readArchitectUnknownArray(record.tpe, `${context}.tpe`);
  if (tpe !== undefined) {
    normalized.tpe = tpe.map((entry, index) => {
      const tradeException = requireArchitectRecord(
        entry,
        `${context}.tpe[${index}]`
      );
      return { ...tradeException } as LooseTradeException;
    });
  }

  return normalized;
}

function readLooseTradeExceptions(
  value: unknown,
  context: string
): LooseTradeException[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  return readArchitectUnknownArray(value, context)?.map((entry, index) => {
    const record = requireArchitectRecord(entry, `${context}[${index}]`);
    return { ...record } as LooseTradeException;
  });
}

function readLooseBaseTeamDoc(
  value: unknown,
  teamCode: string,
  context: string
): LooseBaseTeamDoc {
  const record = requireArchitectRecord(value, context);
  const normalized = { ...record } as LooseBaseTeamDoc;

  normalized.roster = readArchitectUnknownArray(record.roster, `${context}.roster`);
  normalized.teamName = readArchitectString(record.teamName);
  normalized.season = readArchitectString(record.season);
  normalized.abbreviation = readNullableString(
    record.abbreviation,
    `${context}.abbreviation`
  );
  normalized.capHolds = readArchitectUnknownArray(
    record.capHolds,
    `${context}.capHolds`
  );
  normalized.draftPicks = readArchitectUnknownArray(
    record.draftPicks,
    `${context}.draftPicks`
  );
  normalized.draftPicksInventory = readArchitectUnknownArray(
    record.draftPicksInventory,
    `${context}.draftPicksInventory`
  );
  normalized.draftPicksObligations = readArchitectUnknownArray(
    record.draftPicksObligations,
    `${context}.draftPicksObligations`
  );
  normalized.draftPicksContested = readArchitectUnknownArray(
    record.draftPicksContested,
    `${context}.draftPicksContested`
  );
  normalized.entitlementIds = readArchitectStringArray(
    record.entitlementIds,
    `${context}.entitlementIds`
  );
  normalized.offerSheets = readArchitectUnknownArray(
    record.offerSheets,
    `${context}.offerSheets`
  );
  normalized.incomingOfferSheets = readArchitectUnknownArray(
    record.incomingOfferSheets,
    `${context}.incomingOfferSheets`
  );
  normalized.exceptions = readLooseExceptionData(
    record.exceptions,
    `${context}.exceptions`
  );
  normalized.tradeExceptions = readLooseTradeExceptions(
    record['tradeExceptions'],
    `${context}.tradeExceptions`
  );
  normalized.hardCapLevel = readNullableString(
    record.hardCapLevel,
    `${context}.hardCapLevel`
  );
  normalized.hardCapReason = readNullableString(
    record.hardCapReason,
    `${context}.hardCapReason`
  );
  normalized.hardCapTriggeredBy = readNullableString(
    record.hardCapTriggeredBy,
    `${context}.hardCapTriggeredBy`
  );
  normalized.deadCap = readArchitectUnknownArray(record.deadCap, `${context}.deadCap`);
  if (record.totals === null) {
    normalized.totals = null;
  } else if (record.totals !== undefined) {
    normalized.totals = requireArchitectRecord(record.totals, `${context}.totals`);
  }

  if (!normalized.teamName) {
    normalized.teamName = TEAM_CODE_LOOKUP[teamCode]?.teamName;
  }

  return normalized;
}

function readLooseFreeAgent(
  value: unknown,
  fallbackId: string,
  context: string
): LooseFreeAgent {
  const record = requireArchitectRecord(value, context);
  const normalized = { id: fallbackId, ...record } as LooseFreeAgent;
  const id = readArchitectString(record.id);
  if (id) {
    normalized.id = id;
  }
  const name = readArchitectString(record.name);
  if (hasArchitectField(record, 'name')) {
    if (!name) {
      throw new Error(`${context}.name must be a non-empty string when present`);
    }
    normalized.name = name;
  }

  return normalized;
}

// Simplified player entry builder - returns new schema format directly
const buildPlayerEntry = (
  playerId: string,
  playerData: LooseBasePlayerDoc | null
) => {
  if (!playerData) {
    return {
      id: playerId,
      player_id: playerId,
      name: playerId,
      displayName: playerId,
      contract: null,
      bio: {} as Record<string, unknown>,
      original: null,
    };
  }

  // Return player in new schema format - no conversion needed
  return {
    id: playerData.playerId || playerId,
    player_id: playerData.playerId || playerId,
    name: playerData.displayName || playerId,
    displayName: playerData.displayName || playerId,
    position: playerData.bio?.position || '',
    age: playerData.bio?.age || null,
    teamCode: playerData.teamCode || null,
    teamName: playerData.teamName || null,
    contract: playerData.contract || null,
    futureContract: playerData.futureContract || null,
    bio: {
      ...(playerData.bio || {}),
      playerId: playerData.playerId || playerId,
      displayName: playerData.displayName || playerId,
    },
    representation: playerData.representation || null,
    original: playerData,
  };
};

type HydratedBaseTeamPlayer = ReturnType<typeof buildPlayerEntry>;

type HydratedBaseTeamPlayerWithActiveContract = HydratedBaseTeamPlayer & {
  contract: LooseContract & { salariesByYear: unknown[] };
};

type HydratedBaseTeamActiveContract = {
  name: HydratedBaseTeamPlayer['name'];
  player_id: HydratedBaseTeamPlayer['player_id'];
  contract: HydratedBaseTeamPlayer['contract'];
  years: number;
  type: string;
  signAndTrade: boolean;
  guaranteed: boolean;
  isMinimum: boolean;
  yearsOfService: number | null;
};

type HydratedBaseTeamExceptions = Pick<
  LooseExceptionData,
  'mle' | 'tpmle' | 'bae' | 'room' | 'dpe' | 'tpe'
>;

function hasActiveContract(
  player: HydratedBaseTeamPlayer
): player is HydratedBaseTeamPlayerWithActiveContract {
  return (
    Array.isArray(player.contract?.salariesByYear) &&
    player.contract.salariesByYear.length > 0
  );
}

export type HydratedBaseTeamCapSheet = {
  id: string;
  teamCode: string;
  teamName?: string;
  season?: string;
  abbreviation: string;
  players: HydratedBaseTeamPlayer[];
  roster: HydratedBaseTeamPlayer[];
  activeContracts: HydratedBaseTeamActiveContract[];
  capHolds: NonNullable<LooseBaseTeamDoc['capHolds']>;
  draftPicks: NonNullable<LooseBaseTeamDoc['draftPicks']>;
  draftPicksInventory: NonNullable<LooseBaseTeamDoc['draftPicksInventory']>;
  draftPicksObligations: NonNullable<LooseBaseTeamDoc['draftPicksObligations']>;
  draftPicksContested: NonNullable<LooseBaseTeamDoc['draftPicksContested']>;
  draftAssets: LooseBaseTeamDoc['draftAssets'] | null;
  entitlementIds: NonNullable<LooseBaseTeamDoc['entitlementIds']>;
  offerSheets: NonNullable<LooseBaseTeamDoc['offerSheets']>;
  incomingOfferSheets: NonNullable<LooseBaseTeamDoc['incomingOfferSheets']>;
  exceptions: HydratedBaseTeamExceptions;
  hardCapLevel: string | null;
  hardCapReason: string | null;
  hardCapTriggeredBy: string | null;
  hardCapped: boolean;
  deadCap: NonNullable<LooseBaseTeamDoc['deadCap']>;
  baseline: LooseBaseTeamDoc;
  totals: TeamTotals;
};

/**
 * Layer 1 of the Architect read stack.
 *
 * Hydrates a base team document into the base-only team shape used by higher
 * read layers. This function deliberately does not resolve world lineage.
 */
export const hydrateBaseTeam = async (
  teamCode: string,
  baseDoc: LooseBaseTeamDoc
): Promise<HydratedBaseTeamCapSheet> => {
  const boundaryBaseDoc = readLooseBaseTeamDoc(
    baseDoc,
    teamCode,
    `hydrateBaseTeam(${teamCode})`
  );
  const normalizedBaseDoc = normalizeTeamExceptionOwnership(
    normalizeTeamTpeSchema(boundaryBaseDoc)
  ) as LooseBaseTeamDoc & {
    exceptions?: HydratedBaseTeamExceptions | null;
  };
  const players: HydratedBaseTeamPlayer[] = [];
  for (const rawPlayerId of normalizedBaseDoc.roster || []) {
    const playerId = String(rawPlayerId || '').trim();
    if (!playerId) {
      continue;
    }
    try {
      const playerSnap = await getDoc(basePlayerRef(playerId));
      if (!playerSnap.exists()) {
        players.push(buildPlayerEntry(playerId, null));
        continue;
      }

      const playerData = readLooseBasePlayerDoc(
        playerSnap.data(),
        playerId,
        `architect_basePlayers/${playerId}`
      );
      // Return player in new schema format - no conversion needed
      const playerEntry = buildPlayerEntry(playerId, playerData);
      players.push(playerEntry);
    } catch (err) {
      console.warn(`Failed to hydrate player ${playerId}`, err);
      players.push(buildPlayerEntry(playerId, null));
    }
  }

  // Build activeContracts from new schema format
  const activeContracts: HydratedBaseTeamActiveContract[] = players
    .filter(hasActiveContract)
    .map((p) => {
      const contract = p.contract;
      const yearsOfService =
        readArchitectNumber(p.bio?.experience) ??
        readArchitectNumber(contract.birdRights?.yearsOfService) ??
        null;

      return {
        name: p.name,
        player_id: p.player_id,
        contract: contract,
        years: contract.yearsRemaining || 0,
        type: contract.contractType || 'Contract',
        signAndTrade: false,
        guaranteed: true,
        isMinimum: false,
        yearsOfService,
      };
    });

  const exceptionData =
    (normalizedBaseDoc.exceptions as HydratedBaseTeamExceptions | null) || {};

  const teamMeta = TEAM_CODE_LOOKUP[teamCode] || null;
  const hardCapLevel =
    normalizedBaseDoc.hardCapLevel ||
    normalizedBaseDoc.totals?.hardCapLevel ||
    null;
  const hardCapReason =
    normalizedBaseDoc.hardCapReason ||
    normalizedBaseDoc.totals?.hardCapReason ||
    normalizedBaseDoc.totals?.hardCapDetail ||
    null;
  const hardCapTriggeredBy = normalizedBaseDoc.hardCapTriggeredBy || null;
  const hardCapped =
    hardCapLevel != null &&
    String(hardCapLevel).toLowerCase() !== 'none' &&
    String(hardCapLevel).toLowerCase() !== 'false';
  const totals = (normalizedBaseDoc.totals || {}) as TeamTotals;

  // Return team in new schema format - no conversion needed
  return {
    id: teamMeta?.id || teamCode.toLowerCase(),
    teamCode,
    teamName: normalizedBaseDoc.teamName,
    season: normalizedBaseDoc.season,
    abbreviation: normalizedBaseDoc.abbreviation || teamCode,
    players,
    roster: players,
    activeContracts,
    capHolds: normalizedBaseDoc.capHolds || [],
    draftPicks: normalizedBaseDoc.draftPicks || [],
    // Draft pick ledger views (from pipeline - see PIPELINE_DRAFT_PICKS_LEDGER__EXECUTION__2026-01-08.md)
    // draftPicksInventory: Picks the team currently owns
    draftPicksInventory:
      normalizedBaseDoc.draftPicksInventory ||
      normalizedBaseDoc.draftPicks ||
      [],
    // draftPicksObligations: Picks the team owes / has traded away (used for Stepien validation)
    draftPicksObligations: normalizedBaseDoc.draftPicksObligations || [],
    // draftPicksContested: Swaps and conditional picks involving the team
    draftPicksContested: normalizedBaseDoc.draftPicksContested || [],
    // draftAssets: Canonical Trade Machine source (see RETURN_PACKAGE_DRAFT_PICKS_TRADE_ASSETS.md)
    // Contains tradeable assets with assetType (outright_pick, conditional_right, swap_right)
    draftAssets: normalizedBaseDoc.draftAssets || null,
    entitlementIds: normalizedBaseDoc.entitlementIds || [],
    offerSheets: normalizedBaseDoc.offerSheets || [],
    incomingOfferSheets: normalizedBaseDoc.incomingOfferSheets || [],
    exceptions: exceptionData,
    hardCapLevel,
    hardCapReason,
    hardCapTriggeredBy,
    hardCapped,
    deadCap: normalizedBaseDoc.deadCap || [],
    baseline: normalizedBaseDoc,
    totals,
  };
};

/**
 * Base-only dashboard loader.
 *
 * Use teamLoader.getTeam(...) when world-aware fallback resolution is required.
 * Use worldTeamData.loadWorldTeamData(...) for dashboard reads that should stay
 * inside the full three-layer read contract.
 */
export const loadTeamCapSheet = async (teamId: TeamIdLike) => {
  try {
    const teamCode = resolveTeamCode(teamId);
    if (!teamCode) {
      console.warn('Unable to resolve team code for:', teamId);
      return null;
    }
    const docSnap = await getDoc(baseTeamRef(teamCode));
    if (!docSnap.exists()) {
      console.warn('No base team data found for:', teamCode);
      return null;
    }
    const baseDoc = readLooseBaseTeamDoc(
      docSnap.data(),
      teamCode,
      `architect_baseTeams/${teamCode}`
    );
    return hydrateBaseTeam(teamCode, baseDoc);
  } catch (error) {
    console.error('Error loading base team:', error);
    return null;
  }
};

export const getAllTeams = async () => {
  try {
    const snapshot = await getDocs(baseTeamsCol());
    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => {
        const code = docSnap.id;
        const meta = TEAM_CODE_LOOKUP[code];
        const teamData = readArchitectRecord(docSnap.data()) ?? {};
        return {
          id: meta?.id || code.toLowerCase(),
          code,
          name: meta?.teamName || readArchitectString(teamData.teamName) || code,
          conference: meta?.conference || null,
        };
      });
    }
  } catch (error) {
    console.error('Error getting base teams:', error);
  }
  // Fallback to static list if architect data unavailable
  return TeamListFull.map((team) => ({
    id: team.id,
    code: team.code,
    name: team.teamName,
    conference: team.conference,
  }));
};

// ===== Free Agent Pool Management =====

export const saveFreeAgents = async (agents: LooseFreeAgent[]) => {
  try {
    const batch = writeBatch(db);
    agents.forEach((agent) => {
      const agentId = readArchitectString(agent.id) ?? readArchitectString(agent.name);
      if (!agentId) {
        throw new Error('Free agent id or name is required');
      }
      const agentRef = doc(db, FREE_AGENTS_COLLECTION, agentId);
      batch.set(agentRef, agent);
    });
    await batch.commit();
    console.log('Saved free agents');
    return true;
  } catch (error) {
    console.error('Error saving free agents:', error);
    return false;
  }
};

export const loadFreeAgents = async () => {
  try {
    const snap = await getDocs(collection(db, FREE_AGENTS_COLLECTION));
    const agents = snap.docs.map((docSnap) =>
      readLooseFreeAgent(
        docSnap.data(),
        docSnap.id,
        `${FREE_AGENTS_COLLECTION}/${docSnap.id}`
      )
    );
    return agents;
  } catch (error) {
    console.error('Error loading free agents:', error);
    return [];
  }
};
