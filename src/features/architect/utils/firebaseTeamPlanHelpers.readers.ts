/**
 * Wave 38 Step 1: Private types, constants, and reader functions extracted from
 * firebaseTeamPlanHelpers.ts (lines 54–648).
 *
 * Contains Loose* interface types, lookup constants, Firestore boundary readers,
 * buildPlayerEntry, hasActiveContract, and the public reader entry points
 * (readLooseBaseTeamDoc, readLooseFreeAgent) used by the main loader functions.
 */

import {
  TeamListFull,
  TeamSlugToCode,
  TeamCodeMap,
} from '@/constants/teamList';
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
import {
  TeamSalaryBookInputsZ,
  type TeamSalaryBookInputs,
} from '@/schemas/salaryBooks';
import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import {
  TradeHardCapLedgerZ,
  type TradeHardCapLedgerEntry,
} from '@/schemas/tradeApronRestriction';

// ============================================================
// Private types
// ============================================================

type UnknownRecord = Record<string, unknown>;
export type TeamIdLike = string | null | undefined;

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

export interface LooseBaseTeamDoc extends UnknownRecord {
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
  salaryBookInputs?: TeamSalaryBookInputs | null;
  contractEventLedgers?: ContractEventLedgerPayload[] | null;
  hardCapLedger?: TradeHardCapLedgerEntry[] | null;
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

export interface LooseBasePlayerDoc extends UnknownRecord {
  playerId?: string;
  displayName?: string;
  bio?: LooseBio | null;
  teamCode?: string | null;
  teamName?: string | null;
  contract?: LooseContract | null;
  futureContract?: LooseContract | null;
  representation?: unknown;
}

export interface LooseFreeAgent extends UnknownRecord {
  id?: string;
  name?: string;
}

// ============================================================
// Lookup constants
// ============================================================

type TeamCodeMapValue = (typeof TeamCodeMap)[keyof typeof TeamCodeMap];

const TEAM_SLUG_TO_CODE_LOOKUP = TeamSlugToCode as Record<
  string,
  string | undefined
>;
export const TEAM_CODE_LOOKUP = TeamCodeMap as Record<
  string,
  TeamCodeMapValue | undefined
>;

// ============================================================
// Utility: prepare cap sheet
// ============================================================

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

export const resolveTeamCode = (teamId: TeamIdLike) => {
  if (!teamId) return null;
  const slugTeamCode = TEAM_SLUG_TO_CODE_LOOKUP[teamId];
  if (slugTeamCode) return slugTeamCode;
  if (TEAM_CODE_LOOKUP[teamId]) return teamId;
  return teamId.toUpperCase();
};

// ============================================================
// Private readers
// ============================================================

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

export function readLooseBasePlayerDoc(
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

export function readLooseBaseTeamDoc(
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
  if (record.salaryBookInputs === null) {
    normalized.salaryBookInputs = null;
  } else if (record.salaryBookInputs !== undefined) {
    normalized.salaryBookInputs = TeamSalaryBookInputsZ.parse(
      record.salaryBookInputs
    );
  }
  if (record.hardCapLedger === null) {
    normalized.hardCapLedger = null;
  } else if (record.hardCapLedger !== undefined) {
    normalized.hardCapLedger = TradeHardCapLedgerZ.parse(
      record.hardCapLedger
    );
  }
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

export function readLooseFreeAgent(
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

// ============================================================
// Player builder + hydration helpers
// ============================================================

export const buildPlayerEntry = (
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

export type HydratedBaseTeamPlayer = ReturnType<typeof buildPlayerEntry>;

type HydratedBaseTeamPlayerWithActiveContract = HydratedBaseTeamPlayer & {
  contract: LooseContract & { salariesByYear: unknown[] };
};

export type HydratedBaseTeamActiveContract = {
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

export type HydratedBaseTeamExceptions = Pick<
  LooseExceptionData,
  'mle' | 'tpmle' | 'bae' | 'room' | 'dpe' | 'tpe'
>;

export function hasActiveContract(
  player: HydratedBaseTeamPlayer
): player is HydratedBaseTeamPlayerWithActiveContract {
  return (
    Array.isArray(player.contract?.salariesByYear) &&
    player.contract.salariesByYear.length > 0
  );
}
