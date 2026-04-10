/**
 * FILE: src/features/architect/utils/capLegality/localCapAuditLog.ts
 * PURPOSE: Local CapAuditEventV1-like stream for local-validated apply and
 *          optimistic local preview flows.
 * OWNERSHIP: Feature: architect/core
 */

type TotalsByTeam = Record<string, Record<string, unknown>>;
type DiffSummary = Record<string, unknown>;
type ValidationIssue = Record<string, unknown>;

export type LocalCapAuditLifecycleState =
  | 'evaluation-blocked'
  | 'local-validated-applied'
  | 'optimistic-preview-pending'
  | 'authoritative-link-established'
  | 'persist-failed-rolled-back';

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
  localAuditLifecycleState?: LocalCapAuditLifecycleState;
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

export const LOCAL_CAP_AUDIT_LIFECYCLE_CONTRACTS = {
  evaluationBlocked: {
    lifecycleState: 'evaluation-blocked',
    callerExpectation:
      'Local audit-only record for a mutation that failed validation before any local apply or authoritative persist scheduling.',
    localOutcome: 'blocked-before-apply',
    authoritativeLinkState: 'never-scheduled',
    representsCommittedWorldTruth: false,
  },
  localValidatedApplied: {
    lifecycleState: 'local-validated-applied',
    callerExpectation:
      'Validated local-only apply record. This mutation changed local state but never becomes committed world truth.',
    localOutcome: 'applied-local-only',
    authoritativeLinkState: 'never-links',
    representsCommittedWorldTruth: false,
  },
  optimisticPreviewPending: {
    lifecycleState: 'optimistic-preview-pending',
    callerExpectation:
      'Optimistic local preview record. Local preview is visible and authoritative persistence is still pending.',
    localOutcome: 'preview-applied-awaiting-persist',
    authoritativeLinkState: 'pending',
    representsCommittedWorldTruth: false,
  },
  authoritativeLinkEstablished: {
    lifecycleState: 'authoritative-link-established',
    callerExpectation:
      'Previously optimistic preview record that is now linked to an authoritative world event. The record remains local audit history, not committed world storage.',
    localOutcome: 'preview-was-linked',
    authoritativeLinkState: 'linked',
    representsCommittedWorldTruth: false,
  },
  persistFailedRolledBack: {
    lifecycleState: 'persist-failed-rolled-back',
    callerExpectation:
      'Optimistic preview record whose authoritative persist failed and whose local preview was rolled back.',
    localOutcome: 'rolled-back-after-persist-failure',
    authoritativeLinkState: 'failed',
    representsCommittedWorldTruth: false,
  },
} as const;

export function getLocalCapAuditLifecycleState(
  event: CapAuditEventV1Like
): LocalCapAuditLifecycleState {
  if (event?.localAuditLifecycleState) {
    return event.localAuditLifecycleState;
  }

  if (event?.persistFailed) {
    return 'persist-failed-rolled-back';
  }

  if (event?.authoritativeEventLinked) {
    return 'authoritative-link-established';
  }

  if (event?.valid === false) {
    return 'evaluation-blocked';
  }

  if (event?.preview) {
    return 'optimistic-preview-pending';
  }

  return 'local-validated-applied';
}

export function getLocalCapAuditLifecycleContract(
  event: CapAuditEventV1Like
) {
  const lifecycleState = getLocalCapAuditLifecycleState(event);

  switch (lifecycleState) {
    case 'evaluation-blocked':
      return LOCAL_CAP_AUDIT_LIFECYCLE_CONTRACTS.evaluationBlocked;
    case 'local-validated-applied':
      return LOCAL_CAP_AUDIT_LIFECYCLE_CONTRACTS.localValidatedApplied;
    case 'optimistic-preview-pending':
      return LOCAL_CAP_AUDIT_LIFECYCLE_CONTRACTS.optimisticPreviewPending;
    case 'authoritative-link-established':
      return LOCAL_CAP_AUDIT_LIFECYCLE_CONTRACTS.authoritativeLinkEstablished;
    case 'persist-failed-rolled-back':
      return LOCAL_CAP_AUDIT_LIFECYCLE_CONTRACTS.persistFailedRolledBack;
    default: {
      const exhaustiveCheck: never = lifecycleState;
      throw new Error(
        `Unhandled local cap audit lifecycle state: ${exhaustiveCheck}`
      );
    }
  }
}

export function withLocalCapAuditLifecycleState(
  event: CapAuditEventV1Like,
  lifecycleState: LocalCapAuditLifecycleState
): CapAuditEventV1Like {
  return {
    ...event,
    localAuditLifecycleState: lifecycleState,
  };
}

export function buildAuthoritativeLinkEstablishedAuditPatch(
  authoritativeOperationId: string
): Partial<CapAuditEventV1Like> {
  return {
    localAuditLifecycleState: 'authoritative-link-established',
    authoritativeEventLinked: true,
    authoritativeOperationId,
    persistFailed: false,
  };
}

export function buildPersistFailedRolledBackAuditPatch(): Partial<CapAuditEventV1Like> {
  return {
    localAuditLifecycleState: 'persist-failed-rolled-back',
    authoritativeEventLinked: false,
    authoritativeOperationId: undefined,
    persistFailed: true,
  };
}

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
