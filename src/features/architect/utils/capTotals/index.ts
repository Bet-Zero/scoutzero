/**
 * FILE: src/features/architect/utils/capTotals/index.ts
 * PURPOSE: Barrel export for capTotals utilities.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E130 - TS-backed the capTotals barrel and retired index.js
 *  - 2025-12-29: Created as part of Single Source of Truth initiative.
 *  - 2026-02-01: Phase 75 - Added canUseRoomException export
 *  - 2026-08-08: BZE-270 - Added the governed dated salary-ledger entry point
 */

export {
  computeTeamCapTotals,
  createCanonicalTeamTotalsSnapshot,
  synchronizeTeamTotalsSnapshot,
  warnOnTotalsDivergence,
  resetWarnedKeys,
  canUseRoomException,
} from './computeTeamCapTotals';
// updated: Wave 3 retained export default on computeTeamCapTotals for smoke-test compat; barrel must re-export it
export { default } from './computeTeamCapTotals';

export {
  SALARY_LEDGER_KINDS,
  evaluateDatedSalaryLedgers,
} from './datedSalaryLedgers';
export type {
  DatedSalaryLedgerContext,
  DatedSalaryLedgerEvaluation,
  DatedSalaryLedgerRequest,
  EvaluatedSalaryLedgerLineItem,
  SalaryLedgerInput,
  SalaryLedgerKind,
  SalaryLedgerLineItem,
  SalaryLedgerResult,
  SalaryLedgerStatus,
  SalaryLedgerTeamContext,
} from './datedSalaryLedgers';

export { evaluateGovernedDatedSalaryLedgers } from './governedDatedSalaryLedgers';
export type {
  GovernedDatedSalaryLedgerContext,
  GovernedDatedSalaryLedgerEvaluation,
  GovernedDatedSalaryLedgerRequest,
} from './governedDatedSalaryLedgers';
