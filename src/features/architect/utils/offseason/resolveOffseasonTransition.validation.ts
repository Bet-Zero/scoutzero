/**
 * Wave 17 Step 1: Offseason state validation extracted from resolveOffseasonTransition.ts.
 * Contains countStandardRoster, countTwoWayRoster, and validateOffseasonState.
 */

import {
  getCapRulesForYear,
} from '@/features/architect/utils/capRulesProfile';
import {
  isCapHoldAmountValid,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import {
  validateExceptions,
  validateContractRows,
} from '@/features/architect/utils/capLegalityValidation';
// type-only back-reference — erased at runtime, no circular dep
import type {
  OffseasonPlayer,
  OffseasonTeamCapSheet,
  OffseasonViolation,
  OffseasonTransitionContext,
  OffseasonCapHold,
} from './resolveOffseasonTransition';

export type OffseasonHardCapStateSnapshot = {
  hadHardCap: boolean;
  hardCapTriggered: string | boolean | null | undefined;
  hardCapLevel: string | null | undefined;
  hardCapped: boolean | number | null | undefined;
  totalsIsHardCapped: boolean | null | undefined;
};

function countStandardRoster(players: OffseasonPlayer[]): number {
  if (!Array.isArray(players)) return 0;
  return players.filter((p) => {
    const contractType = p?.contract?.contractType?.toLowerCase() || '';
    return contractType !== 'two-way';
  }).length;
}

function countTwoWayRoster(players: OffseasonPlayer[]): number {
  if (!Array.isArray(players)) return 0;
  return players.filter((p) => {
    const contractType = p?.contract?.contractType?.toLowerCase() || '';
    return contractType === 'two-way';
  }).length;
}

export function validateOffseasonState(
  team: OffseasonTeamCapSheet,
  toYear: number,
  context: OffseasonTransitionContext | undefined,
  preTransitionHardCapState?: OffseasonHardCapStateSnapshot
): { violations: OffseasonViolation[]; warnings: OffseasonViolation[] } {
  const violations: OffseasonViolation[] = [];
  const warnings: OffseasonViolation[] = [];

  const rules = getCapRulesForYear(toYear, context?.capProjections);

  const rosterPlayers = team.players ?? [];
  const standardRosterCount = countStandardRoster(rosterPlayers);
  const twoWayCount = countTwoWayRoster(rosterPlayers);

  const minRoster = rules.roster.graceMin;
  const maxRoster = rules.roster.maxStandard;

  if (standardRosterCount < minRoster) {
    violations.push({
      rule: 'roster_minimum',
      message: `Roster has ${standardRosterCount} standard players (minimum offseason roster is ${minRoster}).`,
      severity: 'error',
    });
  }

  if (standardRosterCount > maxRoster) {
    violations.push({
      rule: 'roster_size',
      message: `Roster has ${standardRosterCount} standard players (max is ${maxRoster}).`,
      severity: 'error',
    });
  }

  if (twoWayCount > rules.roster.maxTwoWay) {
    violations.push({
      rule: 'two_way_limit',
      message: `Roster has ${twoWayCount} two-way contracts (max is ${rules.roster.maxTwoWay}).`,
      severity: 'error',
    });
  }

  // Phase E1.1: Use pre-transition hard cap state if available (fixes ordering
  // bug where clearHardCapState ran before validation, making this check dead code).
  const hardCapTriggered = preTransitionHardCapState
    ? preTransitionHardCapState.hadHardCap
    : team?.hardCapTriggered ||
      team?.hardCapFirstApron?.active ||
      team?.hardCapSecondApron?.active ||
      team?.hardCapped === true ||
      team?.hardCapped === 1 ||
      team?.hardCapped === 2 ||
      team?.totals?.isHardCapped;

  if (hardCapTriggered) {
    // Phase E1.1: Derive level from pre-transition snapshot if available
    const hcState = preTransitionHardCapState;
    const hardCapLevel = (
      hcState
        ? hcState.hardCapLevel === 'secondApron' || hcState.hardCapped === 2
        : team?.hardCapSecondApron?.active ||
          team?.hardCapTriggered === 'SecondApron' ||
          team?.hardCapped === 2
    )
      ? 'secondApron'
      : 'firstApron';
    const ceiling =
      hardCapLevel === 'secondApron'
        ? rules.cap.secondApron
        : rules.cap.firstApron;
    const projectedCap = Number(team?.totals?.totalCapAllocations || 0);
    if (projectedCap > ceiling) {
      violations.push({
        rule: 'hard_cap_violation',
        message: `Projected cap allocations (${projectedCap}) exceed ${hardCapLevel} ceiling (${ceiling}).`,
        severity: 'error',
      });
    }
  }

  const exceptionSubset: Pick<
    NonNullable<OffseasonTeamCapSheet['exceptions']>,
    'mle' | 'tpmle' | 'bae' | 'room'
  > = {};
  if (team?.exceptions && typeof team.exceptions === 'object') {
    for (const key of ['mle', 'tpmle', 'bae', 'room'] as const) {
      if (team.exceptions[key]) {
        exceptionSubset[key] = team.exceptions[key];
      }
    }
  }

  const exceptionValidation = validateExceptions(exceptionSubset);
  if (exceptionValidation.violations?.length) {
    exceptionValidation.violations.forEach((violation) => {
      violations.push({
        rule: violation.rule || 'exceptions_invalid',
        message: violation.message || 'Invalid exceptions data',
        severity: 'error',
      });
    });
  }

  if (exceptionValidation.warnings?.length) {
    exceptionValidation.warnings.forEach((warning) => {
      warnings.push({
        rule: warning.rule || 'exceptions_warning',
        message: warning.message || 'Exception warning',
        severity: 'warning',
      });
    });
  }

  const capHolds = Array.isArray(team?.capHolds) ? team.capHolds : [];
  for (const hold of capHolds) {
    const validation = isCapHoldAmountValid(hold as OffseasonCapHold);
    if (!validation.valid) {
      violations.push({
        rule: 'cap_hold_invalid',
        message: validation.reason || 'Invalid cap hold entry',
        severity: 'error',
      });
    }
  }

  // Phase E1.1: Validate contract rows for all remaining players (shared
  // validator from capLegalityValidation — same check the mutation pipeline
  // runs on every signing/extension).
  const players = Array.isArray(team?.players) ? team.players : [];
  for (const player of players) {
    if (!player?.contract) continue;
    const rowResult = validateContractRows(player.contract);
    if (rowResult.violations?.length) {
      for (const v of rowResult.violations) {
        violations.push({
          rule: v.rule || 'contract_row_invalid',
          message: `[${player.displayName || player.player_id || 'Unknown'}] ${v.message || 'Invalid contract row'}`,
          severity: 'error',
        });
      }
    }
    if (rowResult.warnings?.length) {
      for (const w of rowResult.warnings) {
        warnings.push({
          rule: w.rule || 'contract_row_warning',
          message: `[${player.displayName || player.player_id || 'Unknown'}] ${w.message || 'Contract row warning'}`,
          severity: 'warning',
        });
      }
    }
  }

  return { violations, warnings };
}
