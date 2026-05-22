/**
 * FILE: src/features/architect/guidedQuestions/answerConstraints.ts
 * PURPOSE: Stage 4B helpers for constraint guided answers (Family B).
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * Pure functions. Read from ArchitectWorkspaceContext only. Deterministic
 * mapping of observed warnings → blocker labels + navigation targets. No
 * recommendation invention.
 */

import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { getCatalogEntry } from './questionCatalog';
import type {
  Stage4BlockingConstraint,
  Stage4EvidenceChip,
  Stage4GuidedAnswer,
  Stage4NavigationTarget,
  Stage4NavigationTargetId,
  Stage4Severity,
} from './types';

const NAV_TARGETS: Record<Stage4NavigationTargetId, Stage4NavigationTarget> = {
  cap: { id: 'cap', label: 'Open Cap Sheet', intent: 'navigate' },
  capfull: { id: 'capfull', label: 'Open Full Cap Table', intent: 'navigate' },
  roster: { id: 'roster', label: 'Open Roster', intent: 'navigate' },
  trade: { id: 'trade', label: 'Open Trade Machine', intent: 'navigate' },
  fa: { id: 'fa', label: 'Open Free Agency', intent: 'navigate' },
  offseason: { id: 'offseason', label: 'Open Offseason', intent: 'navigate' },
  history: { id: 'history', label: 'Open Team History', intent: 'navigate' },
  compare: { id: 'compare', label: 'Open Compare', intent: 'navigate' },
  guide: { id: 'guide', label: 'Open Guide', intent: 'navigate' },
};

interface DetectedConstraint {
  label: string;
  severity: Stage4Severity;
  navigateTo: Stage4NavigationTargetId;
}

const SEVERITY_RANK: Record<Stage4Severity, number> = {
  info: 0,
  success: 1,
  warning: 2,
  danger: 3,
};

function detectConstraints(
  context: ArchitectWorkspaceContext
): DetectedConstraint[] {
  const out: DetectedConstraint[] = [];
  const cap = context.cap;
  if (cap.status === 'available') {
    if (cap.isAboveSecondApron) {
      out.push({
        label: 'Above second apron — hard-cap rules apply.',
        severity: 'danger',
        navigateTo: 'cap',
      });
    } else if (cap.isAtOrAboveFirstApron) {
      out.push({
        label: 'At or above first apron — exception use is restricted.',
        severity: 'warning',
        navigateTo: 'cap',
      });
    } else if (cap.isOverTax) {
      out.push({
        label: 'Above luxury tax line.',
        severity: 'warning',
        navigateTo: 'cap',
      });
    }
  }

  const roster = context.roster;
  if (roster.status === 'available') {
    if (roster.count > 17) {
      out.push({
        label: `Roster has ${roster.count} entries — above the 17-roster CBA limit.`,
        severity: 'danger',
        navigateTo: 'roster',
      });
    } else if (roster.count < 14) {
      out.push({
        label: `Roster has only ${roster.count} entries — below the 14-roster floor.`,
        severity: 'warning',
        navigateTo: 'roster',
      });
    }
  }

  const seasons = context.seasons;
  if (seasons.viewingSeasonDiffersFromWorldSeason === true) {
    out.push({
      label: `Viewing ${seasons.selectedViewingSeasonLabel ?? 'season'} but world is in ${seasons.authoritativeWorldSeasonLabel ?? 'a different season'}.`,
      severity: 'warning',
      navigateTo: 'offseason',
    });
  }

  return out;
}

function pickHighestSeverity(
  constraints: DetectedConstraint[]
): DetectedConstraint | null {
  if (constraints.length === 0) return null;
  let best = constraints[0];
  for (const c of constraints) {
    if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[best.severity]) {
      best = c;
    }
  }
  return best;
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

export function buildCurrentConstraintsAnswer(
  context: ArchitectWorkspaceContext
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('current-constraints')!;
  const detected = detectConstraints(context);

  const blockers: Stage4BlockingConstraint[] = detected.map((c) => ({
    label: c.label,
    authority: 'committed-world / current-season',
    severity: c.severity,
  }));

  const navIds = new Set<Stage4NavigationTargetId>();
  for (const c of detected) navIds.add(c.navigateTo);
  const navTargets: Stage4NavigationTarget[] = Array.from(navIds).map(
    (id) => NAV_TARGETS[id]
  );

  const chips: Stage4EvidenceChip[] = detected.map((c) => ({
    label: c.label,
    authority: 'committed-world / current-season',
    severity: c.severity,
  }));

  if (detected.length === 0) {
    chips.push({
      label: 'No observed constraints.',
      authority: 'committed-world / current-season',
      severity: 'success',
    });
  }

  const workspaceDataAvailable =
    context.cap.status === 'available' || context.roster.status === 'available';

  if (!workspaceDataAvailable) {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer: 'Constraint summary is unavailable while cap and roster load.',
      evidence: [],
      authorityLabels: ['unavailable'],
      navigationTargets: [NAV_TARGETS.cap],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason: 'Cap and roster summaries are not yet available.',
          authority: 'unavailable',
        },
      ],
      severity: 'info',
    };
  }

  const highest = pickHighestSeverity(detected);
  const severity: Stage4Severity = highest ? highest.severity : 'success';
  const shortAnswer =
    detected.length === 0
      ? 'No cap, roster, or season-mismatch warnings detected.'
      : `${detected.length} constraint${detected.length === 1 ? '' : 's'} observed; highest severity: ${highest!.severity}.`;

  return {
    ...entry,
    status: 'partial',
    shortAnswer,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: navTargets.length > 0 ? navTargets : [NAV_TARGETS.cap],
    blockingConstraints: blockers,
    deferredReasons: [
      {
        reason:
          'Move-specific legality is determined by Trade Machine and Free Agency validators, not by this guided answer.',
        authority: 'deferred',
      },
    ],
    severity,
  };
}

export function buildInspectFirstAnswer(
  context: ArchitectWorkspaceContext
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('inspect-first')!;
  const detected = detectConstraints(context);
  const highest = pickHighestSeverity(detected);

  const workspaceDataAvailable =
    context.cap.status === 'available' || context.roster.status === 'available';

  if (!workspaceDataAvailable) {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer: 'Cannot recommend an inspection target while workspace data loads.',
      evidence: [],
      authorityLabels: ['unavailable'],
      navigationTargets: [NAV_TARGETS.guide],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason: 'Cap and roster summaries are not yet available.',
          authority: 'unavailable',
        },
      ],
      severity: 'info',
    };
  }

  if (!highest) {
    const chips: Stage4EvidenceChip[] = [
      {
        label: 'No warnings observed',
        authority: 'committed-world / current-season',
        severity: 'success',
      },
    ];
    return {
      ...entry,
      status: 'available',
      shortAnswer:
        'No warnings observed. Continue planning from Cap Sheet or Roster as needed.',
      evidence: chips,
      authorityLabels: dedupeAuthorityLabels(chips),
      navigationTargets: [NAV_TARGETS.cap, NAV_TARGETS.roster],
      blockingConstraints: [],
      deferredReasons: [],
      severity: 'info',
    };
  }

  const chips: Stage4EvidenceChip[] = [
    {
      label: highest.label,
      authority: 'committed-world / current-season',
      severity: highest.severity,
    },
  ];

  return {
    ...entry,
    status: 'available',
    shortAnswer: `Inspect ${NAV_TARGETS[highest.navigateTo].label.replace('Open ', '')} first — ${highest.label}`,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV_TARGETS[highest.navigateTo]],
    blockingConstraints: [
      {
        label: highest.label,
        authority: 'committed-world / current-season',
        severity: highest.severity,
      },
    ],
    deferredReasons: [],
    severity: highest.severity,
  };
}
