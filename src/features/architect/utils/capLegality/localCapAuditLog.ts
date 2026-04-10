/**
 * FILE: src/features/architect/utils/capLegality/localCapAuditLog.ts
 * PURPOSE: Local CapAuditEventV1-like stream for local-validated apply and
 *          optimistic local preview flows.
 * OWNERSHIP: Feature: architect/core
 */

type TotalsByTeam = Record<string, Record<string, unknown>>;
type DiffSummary = Record<string, unknown>;
type ValidationIssue = Record<string, unknown>;

export interface CapAuditEventV1Like {
  schemaVersion: 'cap-audit-event-v1';
  validatorVersion: string;
  operationId: string;
  mutationType: string;
  occurredAt: string;
  worldId: string | null;
  teamCodes: string[];
  playerIds: string[];
  beforeTotalsByTeam: TotalsByTeam;
  afterTotalsByTeam: TotalsByTeam;
  valid: boolean;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  diffSummary: DiffSummary;
  preview?: boolean;
  authoritativeEventLinked?: boolean;
  authoritativeOperationId?: string;
  persistFailed?: boolean;
  [key: string]: unknown;
}

type LocalCapAuditLogOptions = {
  storageKey?: string;
};

export const BASE_CAP_AUDIT_STORAGE_KEY = 'architect_base_capAuditEvents_v1';
export const WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY =
  'architect_world_preview_capAuditEvents_v1';
export const MAX_LOCAL_CAP_AUDIT_EVENTS = 500;

export const LOCAL_CAP_AUDIT_STREAM_BOUNDARIES = {
  baseLocalValidated: {
    storageKey: BASE_CAP_AUDIT_STORAGE_KEY,
    stateKind: 'local-validated-apply',
    authoritative: false,
    persistsToWorld: false,
    preview: false,
    initialAuthoritativeEventLinked: undefined,
    committedWorldTransition: 'never-links',
  },
  worldOptimisticPreview: {
    storageKey: WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY,
    stateKind: 'optimistic-local-preview',
    authoritative: false,
    persistsToWorld: 'pending-world-persist',
    preview: true,
    initialAuthoritativeEventLinked: false,
    committedWorldTransition: 'links-on-success-or-rolls-back',
  },
} as const;

export const BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM =
  LOCAL_CAP_AUDIT_STREAM_BOUNDARIES.baseLocalValidated;
export const WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM =
  LOCAL_CAP_AUDIT_STREAM_BOUNDARIES.worldOptimisticPreview;

const inMemoryStore = new Map<string, CapAuditEventV1Like[]>();

function getStorageKey(options?: LocalCapAuditLogOptions): string {
  return options?.storageKey || BASE_CAP_AUDIT_STORAGE_KEY;
}

function canUseLocalStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function normalizeEvents(raw: unknown): CapAuditEventV1Like[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (event) => !!event && typeof event === 'object'
  ) as CapAuditEventV1Like[];
}

function readFromLocalStorage(storageKey: string): CapAuditEventV1Like[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    return normalizeEvents(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeToLocalStorage(
  storageKey: string,
  events: CapAuditEventV1Like[]
): boolean {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

function boundEvents(events: CapAuditEventV1Like[]): CapAuditEventV1Like[] {
  if (events.length <= MAX_LOCAL_CAP_AUDIT_EVENTS) return events;
  return events.slice(-MAX_LOCAL_CAP_AUDIT_EVENTS);
}

function readEventsInternal(storageKey: string): CapAuditEventV1Like[] {
  if (!canUseLocalStorage()) {
    return inMemoryStore.get(storageKey) || [];
  }

  const localStorageEvents = readFromLocalStorage(storageKey);
  if (localStorageEvents.length > 0) {
    return localStorageEvents;
  }

  return inMemoryStore.get(storageKey) || [];
}

function writeEventsInternal(
  storageKey: string,
  events: CapAuditEventV1Like[]
): void {
  const bounded = boundEvents(events);

  if (!canUseLocalStorage()) {
    inMemoryStore.set(storageKey, bounded);
    return;
  }

  const wroteToLocalStorage = writeToLocalStorage(storageKey, bounded);
  if (!wroteToLocalStorage) {
    inMemoryStore.set(storageKey, bounded);
  } else {
    inMemoryStore.delete(storageKey);
  }
}

export function appendLocalCapAuditEvent(
  event: CapAuditEventV1Like,
  options: LocalCapAuditLogOptions = {}
): void {
  const storageKey = getStorageKey(options);
  const existing = readEventsInternal(storageKey);
  writeEventsInternal(storageKey, [...existing, event]);
}

export function readLocalCapAuditEvents(
  options: LocalCapAuditLogOptions = {}
): CapAuditEventV1Like[] {
  const storageKey = getStorageKey(options);
  return readEventsInternal(storageKey);
}

export function updateLocalCapAuditEvent(
  operationId: string,
  patch: Partial<CapAuditEventV1Like>,
  options: LocalCapAuditLogOptions = {}
): boolean {
  if (!operationId) return false;

  const storageKey = getStorageKey(options);
  const events = readEventsInternal(storageKey);
  const targetIndex = [...events]
    .reverse()
    .findIndex((event) => event?.operationId === operationId);

  if (targetIndex < 0) {
    return false;
  }

  const absoluteIndex = events.length - 1 - targetIndex;
  const updatedEvents = [...events];
  updatedEvents[absoluteIndex] = {
    ...updatedEvents[absoluteIndex],
    ...patch,
  };
  writeEventsInternal(storageKey, updatedEvents);
  return true;
}

export function clearLocalCapAuditEvents(
  options: LocalCapAuditLogOptions = {}
): void {
  const storageKey = getStorageKey(options);
  inMemoryStore.delete(storageKey);

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // No-op: local storage unavailable or blocked.
  }
}
