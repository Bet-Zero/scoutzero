/**
 * FILE: src/features/architect/utils/capTotals/index.ts
 * PURPOSE: Barrel export for capTotals utilities.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E130 - TS-backed the capTotals barrel and retired index.js
 *  - 2025-12-29: Created as part of Single Source of Truth initiative.
 *  - 2026-02-01: Phase 75 - Added canUseRoomException export
 */

export {
  computeTeamCapTotals,
  createCanonicalTeamTotalsSnapshot,
  synchronizeTeamTotalsSnapshot,
  warnOnTotalsDivergence,
  resetWarnedKeys,
  canUseRoomException,
  default,
} from './computeTeamCapTotals';
