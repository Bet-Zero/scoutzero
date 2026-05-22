/**
 * FILE: src/features/architect/guidedQuestions/answerTeamStatus.ts
 * PURPOSE: Stage 4B helpers for team-status guided answers (Family A).
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * Pure functions. Read from ArchitectWorkspaceContext only. No React,
 * no Firestore, no mutation callbacks, no validators.
 */

import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { getCatalogEntry } from './questionCatalog';
import type {
  Stage4EvidenceChip,
  Stage4GuidedAnswer,
  Stage4NavigationTarget,
} from './types';

const NAV_CAP_SHEET: Stage4NavigationTarget = {
  id: 'cap',
  label: 'Open Cap Sheet',
  intent: 'navigate',
};

const NAV_ROSTER: Stage4NavigationTarget = {
  id: 'roster',
  label: 'Open Roster',
  intent: 'navigate',
};

const NAV_OFFSEASON: Stage4NavigationTarget = {
  id: 'offseason',
  label: 'Open Offseason',
  intent: 'navigate',
};

function formatDollars(value: number): string {
  const abs = Math.abs(value) / 1_000_000;
  return `$${abs.toFixed(1)}M`;
}

function dedupeAuthorityLabels(
  chips: Stage4EvidenceChip[]
): Stage4GuidedAnswer['authorityLabels'] {
  const seen = new Set<string>();
  const out: Stage4GuidedAnswer['authorityLabels'] = [];
  for (const chip of chips) {
    if (!seen.has(chip.authority)) {
      seen.add(chip.authority);
      out.push(chip.authority);
    }
  }
  return out;
}

export function buildCapPostureAnswer(
  context: ArchitectWorkspaceContext
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('cap-posture')!;
  const cap = context.cap;

  if (cap.status !== 'available') {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer:
        cap.status === 'loading'
          ? 'Cap posture is loading.'
          : 'Cap posture is unavailable.',
      evidence: [],
      authorityLabels:
        cap.status === 'loading'
          ? ['committed-world / current-season']
          : ['unavailable'],
      navigationTargets: [NAV_CAP_SHEET],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason:
            cap.status === 'loading'
              ? 'Team cap sheet is still loading.'
              : cap.reason,
          authority:
            cap.status === 'loading'
              ? 'committed-world / current-season'
              : 'unavailable',
        },
      ],
      severity: 'info',
    };
  }

  const chips: Stage4EvidenceChip[] = [];
  let severity: Stage4GuidedAnswer['severity'] = 'info';
  const blockers: Stage4GuidedAnswer['blockingConstraints'] = [];

  chips.push({
    label: `Cap allocations: ${formatDollars(cap.totalCapAllocations)}`,
    authority: 'committed-world / current-season',
  });
  chips.push({
    label: cap.isOverCap
      ? `Over cap by ${formatDollars(-cap.capSpace)}`
      : `Cap space: ${formatDollars(cap.capSpace)}`,
    authority: 'committed-world / current-season',
    severity: cap.isOverCap ? 'warning' : 'success',
  });
  chips.push({
    label: cap.isOverTax
      ? `Over tax by ${formatDollars(-cap.taxSpace)}`
      : `Tax space: ${formatDollars(cap.taxSpace)}`,
    authority: 'committed-world / current-season',
    severity: cap.isOverTax ? 'warning' : 'info',
  });
  chips.push({
    label: cap.isAtOrAboveFirstApron ? 'At/Above first apron' : 'Below first apron',
    authority: 'committed-world / current-season',
    severity: cap.isAtOrAboveFirstApron ? 'warning' : 'info',
  });
  chips.push({
    label: cap.isAboveSecondApron ? 'Above second apron' : 'Below second apron',
    authority: 'committed-world / current-season',
    severity: cap.isAboveSecondApron ? 'danger' : 'info',
  });

  if (cap.isAboveSecondApron) {
    severity = 'danger';
    blockers.push({
      label: 'Above second apron — hard-cap rules apply.',
      authority: 'committed-world / current-season',
      severity: 'danger',
    });
  } else if (cap.isAtOrAboveFirstApron) {
    severity = 'warning';
    blockers.push({
      label: 'At or above first apron — exception use is restricted.',
      authority: 'committed-world / current-season',
      severity: 'warning',
    });
  } else if (cap.isOverTax) {
    severity = 'warning';
    blockers.push({
      label: 'Above luxury tax line.',
      authority: 'committed-world / current-season',
      severity: 'warning',
    });
  } else if (cap.isOverCap) {
    severity = 'info';
  } else {
    severity = 'success';
  }

  const postureSummary = cap.isAboveSecondApron
    ? 'Above the second apron'
    : cap.isAtOrAboveFirstApron
      ? 'At or above the first apron'
      : cap.isOverTax
        ? 'Above the luxury tax line'
        : cap.isOverCap
          ? 'Over the salary cap'
          : 'Below the salary cap';

  const shortAnswer = `${postureSummary} in ${cap.seasonLabel}. Cap allocations ${formatDollars(
    cap.totalCapAllocations
  )} against a ${formatDollars(cap.salaryCap)} cap.`;

  return {
    ...entry,
    status: 'available',
    shortAnswer,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV_CAP_SHEET],
    blockingConstraints: blockers,
    deferredReasons: [
      {
        reason:
          'Hard-cap activation status is not exposed by the workspace cap summary. See Cap Sheet for full hard-cap detail.',
        authority: 'deferred',
      },
    ],
    severity,
  };
}

export function buildRosterCountAnswer(
  context: ArchitectWorkspaceContext
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('roster-count')!;
  const roster = context.roster;

  if (roster.status !== 'available') {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer:
        roster.status === 'loading'
          ? 'Roster summary is loading.'
          : 'Roster summary is unavailable.',
      evidence: [],
      authorityLabels:
        roster.status === 'loading'
          ? ['committed-world / current-season']
          : ['unavailable'],
      navigationTargets: [NAV_ROSTER],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason:
            roster.status === 'loading'
              ? 'Team cap sheet is still loading.'
              : 'Team cap sheet did not expose a players or roster array.',
          authority:
            roster.status === 'loading'
              ? 'committed-world / current-season'
              : 'unavailable',
        },
      ],
      severity: 'info',
    };
  }

  const chips: Stage4EvidenceChip[] = [
    {
      label: `${roster.count} roster spot${roster.count === 1 ? '' : 's'} used`,
      authority: 'committed-world / current-season',
    },
    {
      label: `Source: ${roster.source}`,
      authority: 'derived',
    },
  ];

  const blockers: Stage4GuidedAnswer['blockingConstraints'] = [];
  let severity: Stage4GuidedAnswer['severity'] = 'info';

  if (roster.count > 17) {
    severity = 'danger';
    blockers.push({
      label: `Roster has ${roster.count} entries — above the 17-roster CBA limit.`,
      authority: 'committed-world / current-season',
      severity: 'danger',
    });
  } else if (roster.count < 14) {
    severity = 'warning';
    blockers.push({
      label: `Roster has only ${roster.count} entries — below the 14-roster floor.`,
      authority: 'committed-world / current-season',
      severity: 'warning',
    });
  }

  return {
    ...entry,
    status: 'available',
    shortAnswer: `${roster.count} roster spot${roster.count === 1 ? '' : 's'} used (source: ${roster.source}).`,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV_ROSTER],
    blockingConstraints: blockers,
    deferredReasons: [],
    severity,
  };
}

export function buildExceptionsAvailableAnswer(
  context: ArchitectWorkspaceContext
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('exceptions-available')!;
  const exc = context.exceptions;

  if (exc.status !== 'available') {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer:
        exc.status === 'loading'
          ? 'Exception summary is loading.'
          : 'Exception summary is unavailable.',
      evidence: [],
      authorityLabels:
        exc.status === 'loading'
          ? ['committed-world / current-season']
          : ['unavailable'],
      navigationTargets: [NAV_CAP_SHEET],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason:
            exc.status === 'loading'
              ? 'Team cap sheet is still loading.'
              : exc.reason,
          authority:
            exc.status === 'loading'
              ? 'committed-world / current-season'
              : 'unavailable',
        },
      ],
      severity: 'info',
    };
  }

  const chips: Stage4EvidenceChip[] = [];
  if (exc.hasAvailableMle) {
    chips.push({
      label: 'MLE available',
      authority: 'committed-world / current-season',
      severity: 'success',
    });
  }
  if (exc.hasAvailableBae) {
    chips.push({
      label: 'BAE available',
      authority: 'committed-world / current-season',
      severity: 'success',
    });
  }
  if (exc.hasAvailableRoom) {
    chips.push({
      label: 'Room exception available',
      authority: 'committed-world / current-season',
      severity: 'success',
    });
  }
  if (exc.tpeCount > 0) {
    chips.push({
      label: `${exc.tpeCount} TPE${exc.tpeCount === 1 ? '' : 's'} active`,
      authority: 'committed-world / current-season',
      severity: 'success',
    });
  }
  if (chips.length === 0) {
    chips.push({
      label: 'No exceptions active',
      authority: 'committed-world / current-season',
    });
  }

  const shortAnswer = exc.hasAnyActive
    ? 'At least one exception is available. See Cap Sheet for amount details.'
    : 'No exceptions are currently active.';

  return {
    ...entry,
    status: exc.hasAnyActive ? 'available' : 'partial',
    shortAnswer,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV_CAP_SHEET],
    blockingConstraints: [],
    deferredReasons: exc.hasAnyActive
      ? [
          {
            reason: 'Per-exception amounts are visible in Cap Sheet.',
            authority: 'deferred',
          },
        ]
      : [],
    severity: 'info',
  };
}

// Re-exported for tests / sibling helpers.
export const __team_status_nav__ = {
  NAV_CAP_SHEET,
  NAV_ROSTER,
  NAV_OFFSEASON,
};
