/**
 * FILE: src/features/architect/utils/capTotals/index.js
 * PURPOSE: Barrel export for capTotals utilities.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2025-12-29: Created as part of Single Source of Truth initiative.
 *  - 2026-02-01: Phase 75 - Added canUseRoomException export
 */

export {
  computeTeamCapTotals,
  warnOnTotalsDivergence,
  resetWarnedKeys,
  canUseRoomException,
  default,
} from './computeTeamCapTotals';
