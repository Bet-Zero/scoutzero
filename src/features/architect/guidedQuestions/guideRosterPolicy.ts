import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import {
  evaluateRosterCountsAgainstLimits,
  isCurrentRegularSeasonRosterDate,
} from '@/features/architect/utils/tradeMachine/rules/validateRoster';
import type { Stage4BlockingConstraint } from './types';

export function evaluateGuideRoster(context: ArchitectWorkspaceContext): {
  warnings: Stage4BlockingConstraint[];
  unavailableReason: string | null;
} {
  const { roster, seasons, worldDate } = context;
  if (roster.standardCount === null || roster.twoWayCount === null) {
    return {
      warnings: [],
      unavailableReason: 'Standard and Two-Way roster counts are unavailable.',
    };
  }
  if (
    worldDate.status !== 'available' ||
    seasons.viewingSeasonDiffersFromWorldSeason !== false ||
    !isCurrentRegularSeasonRosterDate(worldDate.value)
  ) {
    return {
      warnings: [],
      unavailableReason: 'Roster limits are checked for the current regular season at the saved world date.',
    };
  }

  const limits = evaluateRosterCountsAgainstLimits(
    roster.standardCount,
    roster.twoWayCount
  );
  const authority = 'committed-world / current-season';
  const warnings: Stage4BlockingConstraint[] = [];
  if (limits.isAboveMaximumStandard) {
    warnings.push({
      label: `${limits.standardCount} Standard players exceed the ordinary limit of ${limits.maximumStandard}. Check for a hardship allowance.`,
      severity: 'danger',
      authority,
    });
  }
  if (limits.exceedsTwoWayLimit) {
    warnings.push({
      label: `${limits.twoWayCount} Two-Way players exceed the limit of ${limits.maximumTwoWay}.`,
      severity: 'danger',
      authority,
    });
  }
  if (limits.isBelowMinimumStandard) {
    warnings.push({
      label: `${limits.standardCount} Standard players fall below the ordinary minimum of ${limits.minimumStandard}. Check the dated shortage allowance.`,
      severity: 'warning',
      authority,
    });
  }
  return { warnings, unavailableReason: null };
}
