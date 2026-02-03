/**
 * FILE: src/features/architect/utils/runOffseason.js
 * PURPOSE: Single-team offseason runner that delegates to OSTE (offseason transition engine).
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-02-03: Updated to use OSTE SSOT (plan `plans/_archive/offseason-transition-engine-phase1/plan.md`, chunk_n/a)
 *
 * LINKS:
 *  - Plan: plans/_archive/offseason-transition-engine-phase1/plan.md
 *  - Latest Chunk: N/A
 */

import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';

export function runOffseason(
  teamCapSheet,
  currentYear,
  capProjections,
  optionDecisions = {}
) {
  const fromYear = currentYear;
  const toYear = currentYear + 1;

  const result = resolveOffseasonTransition({
    teamCapSheet,
    fromYear,
    toYear,
    optionDecisions,
    context: {
      capProjections,
      teamCode: teamCapSheet?.teamCode,
    },
  });

  if (!result.success) {
    const message =
      result.error ||
      result.violations?.[0]?.message ||
      'Offseason transition blocked';
    const error = new Error(message);
    error.details = result;
    throw error;
  }

  return {
    updatedCapSheet: result.nextTeamCapSheet,
    summary: result.appliedChangesSummary,
  };
}
