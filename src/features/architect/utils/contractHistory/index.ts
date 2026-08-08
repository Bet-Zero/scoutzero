/**
 * FILE: src/features/architect/utils/contractHistory/index.ts
 * PURPOSE: Barrel export for the immutable contract event history.
 * OWNERSHIP: Feature: architect/contract history
 *
 * HISTORY:
 *  - 2026-08-08: BZE-271 - Created for the contract event ledger and dated projection.
 */

export {
  appendContractEvents,
  CONTRACT_EVENT_FAMILIES,
  CONTRACT_EVENT_KINDS,
  CONTRACT_ROOT_EVENT_KIND,
  ContractEventLedgerError,
  createContractEventLedger,
  effectiveTime,
  eventKey,
  isContractEventKind,
  reviseContractEvent,
  validateContractEventLedger,
  walkChain,
} from './contractEventRecords';
export type {
  LifecycleEventKind,
  LifecycleEventLedger,
  LifecycleEventLedgerInput,
  LifecycleEventRecord,
  LifecycleEventStatus,
  LifecycleEventSubject,
  LifecycleLedgerProblem,
  LifecycleLedgerProblemKind,
  LifecycleLedgerValidation,
  LifecycleLedgerValidationState,
} from './contractEventRecords';

export {
  projectContractStateAsOf,
  verifyContractProjectionManifest,
} from './contractStateProjection';
export type {
  LifecycleLedgerIdentity,
  LifecycleManifestDrift,
  LifecycleManifestDriftKind,
  LifecycleManifestVerification,
  LifecycleProjectionEvent,
  LifecycleProjectionManifest,
  LifecycleProjectionState,
  LifecycleStateProjection,
  LifecycleProjectionRequest,
} from './contractStateProjection';

export {
  CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
  ContractEventLedgerPayloadError,
  deserializeContractEventLedger,
  readContractEventLedger,
  serializeContractEventLedger,
  toContractEventLedgerPayload,
} from './contractEventSerialization';
export type { LifecycleEventLedgerPayload } from './contractEventSerialization';

export {
  ALLOWED_GOVERNED_HISTORY_IMPORT,
  FENCED_MUTABLE_CONTRACT_PATTERNS,
  MUTABLE_CONTRACT_CONSUMERS,
} from './contractHistoryFence';
