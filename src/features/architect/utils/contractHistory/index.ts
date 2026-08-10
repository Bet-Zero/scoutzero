/**
 * FILE: src/features/architect/utils/contractHistory/index.ts
 * PURPOSE: Barrel export for the immutable contract event history.
 * OWNERSHIP: Feature: architect/contract history
 *
 * The canonical event and payload contracts live in `@/schemas/contractEventLedger`
 * per AGENTS.md and are re-exported here so a consumer of the history path has
 * one import site.
 *
 * The compatibility-fence metadata is deliberately NOT exported here. Its only
 * reader is the fence test, which imports it from `./contractHistoryFence`
 * directly; publishing it on the runtime barrel would advertise a public API the
 * feature does not have.
 *
 * HISTORY:
 *  - 2026-08-08: BZE-271 - Created for the contract event ledger and dated projection.
 */

export {
  CONTRACT_EVENT_KINDS,
  ContractEventKindZ,
  ContractEventLedgerPayloadZ,
  ContractEventRecordZ,
  ContractEventStatusZ,
  CONTRACT_EVENT_LEDGER_PAYLOAD_VERSION,
  isContractEventKind,
} from '@/schemas/contractEventLedger';
export type {
  ContractEventKind,
  ContractEventLedgerPayload,
  ContractEventRecord,
  ContractEventStatus,
} from '@/schemas/contractEventLedger';

export {
  appendContractEvents,
  CONTRACT_EVENT_FAMILIES,
  CONTRACT_ROOT_EVENT_KIND,
  CONTRACT_ROOT_EVENT_KINDS,
  ContractEventLedgerError,
  createContractEventLedger,
  effectiveTime,
  eventKey,
  isContractRootEventKind,
  reviseContractEvent,
  validateContractEventLedger,
  walkChain,
} from './contractEventRecords';
export {
  ContractEvidenceStatusZ,
  ContractFieldEvidenceZ,
  ContractSalaryTermZ,
  ContractTemporalValueZ,
  decodeContractFieldEvidence,
  encodeContractFieldEvidence,
  GovernedContractStateZ,
  GovernedContractTermsZ,
} from '@/schemas/governedContractState';
export type {
  ContractEvidenceStatus,
  ContractFieldEvidence,
  ContractTemporalValue,
  DecodedContractFieldEvidence,
  GovernedContractState,
  GovernedContractTerms,
} from '@/schemas/governedContractState';
export type {
  LifecycleEventLedger,
  LifecycleEventLedgerInput,
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
  LifecycleProjectionRequest,
  LifecycleProjectionState,
  LifecycleStateProjection,
} from './contractStateProjection';

export {
  ContractEventLedgerPayloadError,
  deserializeContractEventLedger,
  readContractEventLedger,
  serializeContractEventLedger,
  toContractEventLedgerPayload,
} from './contractEventSerialization';
