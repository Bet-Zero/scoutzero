/**
 * Wave 24 Step 1: Private interfaces and parsing helpers extracted from
 * worldManager.ts (lines 38–385).
 */

import {
  hasArchitectField,
  readArchitectBoolean,
  readArchitectNumber,
  readArchitectStringArray,
  requireArchitectRecord,
} from '@/features/architect/utils/architectFirestoreBoundary';

export type UnknownRecord = Record<string, unknown>;

export interface WorldStats extends UnknownRecord {
  totalTrades?: number;
  totalSignings?: number;
  totalWaives?: number;
  totalRenounces?: number;
  teamsInvolved?: number;
}

export interface DraftPositionsEntry extends UnknownRecord {
  positionsMap?: Record<string, number>;
  method?: string;
  updatedAtIso?: string;
}

export interface WorldMetadata extends UnknownRecord {
  worldId?: string;
  worldName?: string;
  description?: string;
  createdBy?: string;
  createdAt?: unknown;
  lastModifiedAt?: unknown;
  currentSeason?: string;
  baselineSeason?: string;
  parentWorldId?: string | null;
  branchedFrom?: unknown | null;
  childWorlds?: string[];
  modifiedTeams?: string[];
  actionCount?: number;
  tags?: string[];
  isArchived?: boolean;
  isFavorite?: boolean;
  stats?: WorldStats;
  draftPositionsByYear?: Record<string, DraftPositionsEntry | null | undefined>;
  asOfDate?: string | null;
  rightsLedgerVersion?: number;
}

export interface CreateWorldParams {
  name?: string;
  description?: string;
  parentWorldId?: string | null;
  userId?: string;
  currentSeason?: string | null;
}

export interface ListUserWorldsOptions {
  includeArchived?: boolean;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface UpdateWorldMetadataInput extends UnknownRecord {
  worldName?: string;
  description?: string;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
}

export interface PurgeWorldResult extends UnknownRecord {
  ok: boolean;
  queued?: boolean;
  message: string;
  details?: unknown;
}

export interface CallableErrorLike {
  code?: string;
  message?: string;
}

export function readStringField(
  record: UnknownRecord,
  field: string,
  context: string
): string | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  if (typeof record[field] !== 'string') {
    throw new Error(`${context}.${field} must be a string when present`);
  }
  return record[field];
}

export function readNullableStringField(
  record: UnknownRecord,
  field: string,
  context: string
): string | null | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  if (record[field] === null) {
    return null;
  }
  if (typeof record[field] !== 'string') {
    throw new Error(`${context}.${field} must be a string or null when present`);
  }
  return record[field];
}

export function readBooleanField(
  record: UnknownRecord,
  field: string,
  context: string
): boolean | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  const value = readArchitectBoolean(record[field]);
  if (value === undefined) {
    throw new Error(`${context}.${field} must be a boolean when present`);
  }
  return value;
}

export function readNumberField(
  record: UnknownRecord,
  field: string,
  context: string
): number | undefined {
  if (!hasArchitectField(record, field) || record[field] === undefined) {
    return undefined;
  }
  const value = readArchitectNumber(record[field]);
  if (value === null) {
    throw new Error(`${context}.${field} must be a finite number when present`);
  }
  return value;
}

export function readWorldStats(value: unknown, context: string): WorldStats | undefined {
  if (value == null) {
    return undefined;
  }
  const record = requireArchitectRecord(value, context);
  const stats = { ...record } as WorldStats;

  for (const field of [
    'totalTrades',
    'totalSignings',
    'totalWaives',
    'totalRenounces',
    'teamsInvolved',
  ]) {
    const numValue = readNumberField(record, field, context);
    if (numValue !== undefined) {
      stats[field] = numValue;
    }
  }

  return stats;
}

export function readDraftPositionsEntry(
  value: unknown,
  context: string
): DraftPositionsEntry | null {
  if (value === null || value === undefined) {
    return null;
  }
  const record = requireArchitectRecord(value, context);
  const entry: DraftPositionsEntry = { ...record };

  if (record.positionsMap !== undefined) {
    const posMap = requireArchitectRecord(record.positionsMap, `${context}.positionsMap`);
    entry.positionsMap = posMap as Record<string, number>;
  }

  const method = readStringField(record, 'method', context);
  if (method !== undefined) {
    entry.method = method;
  }

  const updatedAtIso = readStringField(record, 'updatedAtIso', context);
  if (updatedAtIso !== undefined) {
    entry.updatedAtIso = updatedAtIso;
  }

  return entry;
}

export function readDraftPositionsByYear(
  value: unknown,
  context: string
): Record<string, DraftPositionsEntry | null | undefined> | undefined {
  if (value == null) {
    return undefined;
  }

  const record = requireArchitectRecord(value, context);
  const byYear: Record<string, DraftPositionsEntry | null> = {};
  for (const [year, entry] of Object.entries(record)) {
    byYear[year] = readDraftPositionsEntry(entry, `${context}.${year}`);
  }

  return byYear;
}

export function readWorldMetadataDoc(
  value: unknown,
  context: string,
  fallbackWorldId?: string
): WorldMetadata {
  const record = requireArchitectRecord(value, context);
  const metadata = { ...record } as WorldMetadata;

  const worldId = readStringField(record, 'worldId', context) ?? fallbackWorldId;
  if (worldId) {
    metadata.worldId = worldId;
  }

  for (const field of [
    'worldName',
    'description',
    'createdBy',
    'currentSeason',
    'baselineSeason',
  ]) {
    const normalizedValue = readStringField(record, field, context);
    if (normalizedValue !== undefined) {
      metadata[field] = normalizedValue;
    }
  }

  const parentWorldId = readNullableStringField(record, 'parentWorldId', context);
  if (parentWorldId !== undefined) {
    metadata.parentWorldId = parentWorldId;
  }
  const asOfDate = readNullableStringField(record, 'asOfDate', context);
  if (asOfDate !== undefined) {
    metadata.asOfDate = asOfDate;
  }

  for (const field of ['childWorlds', 'modifiedTeams', 'tags']) {
    const normalizedValue = readArchitectStringArray(
      record[field],
      `${context}.${field}`
    );
    if (normalizedValue !== undefined) {
      metadata[field] = normalizedValue;
    }
  }

  const actionCount = readNumberField(record, 'actionCount', context);
  if (actionCount !== undefined) {
    metadata.actionCount = actionCount;
  }
  const rightsLedgerVersion = readNumberField(
    record,
    'rightsLedgerVersion',
    context
  );
  if (rightsLedgerVersion !== undefined) {
    metadata.rightsLedgerVersion = rightsLedgerVersion;
  }

  const isArchived = readBooleanField(record, 'isArchived', context);
  if (isArchived !== undefined) {
    metadata.isArchived = isArchived;
  }
  const isFavorite = readBooleanField(record, 'isFavorite', context);
  if (isFavorite !== undefined) {
    metadata.isFavorite = isFavorite;
  }

  const stats = readWorldStats(record.stats, `${context}.stats`);
  if (stats !== undefined) {
    metadata.stats = stats;
  }

  const draftPositionsByYear = readDraftPositionsByYear(
    record.draftPositionsByYear,
    `${context}.draftPositionsByYear`
  );
  if (draftPositionsByYear !== undefined) {
    metadata.draftPositionsByYear = draftPositionsByYear;
  }

  return metadata;
}

export function generateWorldId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `world_${timestamp}_${random}`;
}

export function getCurrentSeason() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth();
  const seasonStartYear = month < 9 ? currentYear - 1 : currentYear;
  const seasonEndYear = seasonStartYear + 1;
  return `${seasonStartYear}-${String(seasonEndYear).slice(-2)}`;
}
