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
  validateContractEventLedger,
  walkChain,
} from './contractEventRecords';
export type {
  ContractEventKind,
  ContractEventLedger,
  ContractEventLedgerInput,
  ContractEventRecord,
  ContractEventStatus,
  ContractEventSubject,
  ContractLedgerProblem,
  ContractLedgerProblemKind,
  ContractLedgerValidation,
  ContractLedgerValidationState,
} from './contractEventRecords';

export {
  projectContractStateAsOf,
  verifyContractProjectionManifest,
} from './contractStateProjection';
export type {
  ContractLedgerIdentity,
  ContractManifestDrift,
  ContractManifestDriftKind,
  ContractManifestVerification,
  ContractProjectionEvent,
  ContractProjectionManifest,
  ContractProjectionState,
  ContractStateProjection,
  ContractStateProjectionRequest,
} from './contractStateProjection';

export {
  CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
  ContractEventLedgerPayloadError,
  deserializeContractEventLedger,
  readContractEventLedger,
  serializeContractEventLedger,
  toContractEventLedgerPayload,
} from './contractEventSerialization';
export type { ContractEventLedgerPayload } from './contractEventSerialization';

export {
  ALLOWED_GOVERNED_HISTORY_IMPORT,
  FENCED_MUTABLE_CONTRACT_PATTERNS,
  MUTABLE_CONTRACT_CONSUMERS,
} from './contractHistoryFence';
