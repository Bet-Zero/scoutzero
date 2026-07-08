/**
 * FILE: src/features/architect/guidedQuestions/answerNavigation.ts
 * PURPOSE: Stage 4B helpers for navigation guidance answers (Family E).
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * Pure, static deterministic mapping. No inputs required. Always available.
 */

import { getCatalogEntry } from './questionCatalog';
import type {
  Stage4EvidenceChip,
  Stage4GuidedAnswer,
  Stage4NavigationTarget,
} from './types';

function staticNavAnswer(
  id:
    | 'navigation-cap'
    | 'navigation-roster'
    | 'navigation-history'
    | 'navigation-comparison',
  shortAnswer: string,
  chipLabel: string,
  target: Stage4NavigationTarget
): Stage4GuidedAnswer {
  const entry = getCatalogEntry(id)!;
  const chips: Stage4EvidenceChip[] = [
    { label: chipLabel, authority: 'navigation-only' },
  ];
  return {
    ...entry,
    status: 'available',
    shortAnswer,
    evidence: chips,
    authorityLabels: ['navigation-only'],
    navigationTargets: [target],
    blockingConstraints: [],
    deferredReasons: [],
    severity: 'info',
  };
}

export function buildNavigationCapAnswer(): Stage4GuidedAnswer {
  return staticNavAnswer(
    'navigation-cap',
    'Cap Sheet shows cap totals, exceptions, and salary detail for the active team and season.',
    'Cap impact → Cap Sheet',
    { id: 'cap', label: 'Open Cap Sheet', intent: 'navigate' }
  );
}

export function buildNavigationRosterAnswer(): Stage4GuidedAnswer {
  return staticNavAnswer(
    'navigation-roster',
    'Roster shows current players grouped by status with contract context.',
    'Roster impact → Roster',
    { id: 'roster', label: 'Open Roster', intent: 'navigate' }
  );
}

export function buildNavigationHistoryAnswer(): Stage4GuidedAnswer {
  return staticNavAnswer(
    'navigation-history',
    'Team History shows the committed event stream for the active team and world.',
    'Event detail → Team History',
    { id: 'history', label: 'Open Team History', intent: 'navigate' }
  );
}

export function buildNavigationComparisonAnswer(): Stage4GuidedAnswer {
  return staticNavAnswer(
    'navigation-comparison',
    'Compare shows committed scenario deltas (rosters, cap, apron standing) for the active world.',
    'Scenario deltas → Compare',
    { id: 'compare', label: 'Open Compare', intent: 'navigate' }
  );
}
