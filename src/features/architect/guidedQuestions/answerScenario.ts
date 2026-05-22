/**
 * FILE: src/features/architect/guidedQuestions/answerScenario.ts
 * PURPOSE: Stage 4B helpers for scenario / comparison guided answers (Family C).
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * Pure functions. Read only from the Stage 3 comparison view model.
 * Sandbox / loading / error states surface explicit unavailable answers.
 */

import type { Stage3ComparisonViewModel } from '@/features/architect/comparison/types';
import { getCatalogEntry } from './questionCatalog';
import type {
  Stage4EvidenceChip,
  Stage4GuidedAnswer,
  Stage4NavigationTarget,
} from './types';

const NAV_COMPARE: Stage4NavigationTarget = {
  id: 'compare',
  label: 'Open Compare',
  intent: 'navigate',
};

const NAV_HISTORY: Stage4NavigationTarget = {
  id: 'history',
  label: 'Open Team History',
  intent: 'navigate',
};

export type ComparisonSourceStatus = 'sandbox' | 'loading' | 'error' | 'available';

export interface ScenarioAnswerInputs {
  comparisonStatus: ComparisonSourceStatus;
  comparisonViewModel: Stage3ComparisonViewModel | null;
  comparisonError: string | null;
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

function sandboxAnswer(
  id: 'world-changes-summary' | 'comparison-available' | 'comparison-deferred'
): Stage4GuidedAnswer {
  const entry = getCatalogEntry(id)!;
  return {
    ...entry,
    status: 'unavailable',
    shortAnswer: 'Comparison requires an active world.',
    evidence: [],
    authorityLabels: ['sandbox'],
    navigationTargets: [NAV_COMPARE],
    blockingConstraints: [],
    deferredReasons: [
      {
        reason: 'Comparison requires an active world.',
        authority: 'sandbox',
      },
    ],
    severity: 'info',
  };
}

function loadingAnswer(
  id: 'world-changes-summary' | 'comparison-available' | 'comparison-deferred'
): Stage4GuidedAnswer {
  const entry = getCatalogEntry(id)!;
  return {
    ...entry,
    status: 'unavailable',
    shortAnswer: 'Comparison data is loading.',
    evidence: [],
    authorityLabels: ['committed-world / event-derived'],
    navigationTargets: [NAV_COMPARE],
    blockingConstraints: [],
    deferredReasons: [
      {
        reason: 'Comparison view model is still loading committed events.',
        authority: 'committed-world / event-derived',
      },
    ],
    severity: 'info',
  };
}

function errorAnswer(
  id: 'world-changes-summary' | 'comparison-available' | 'comparison-deferred',
  error: string | null
): Stage4GuidedAnswer {
  const entry = getCatalogEntry(id)!;
  return {
    ...entry,
    status: 'unavailable',
    shortAnswer: 'Comparison data failed to load.',
    evidence: [],
    authorityLabels: ['unavailable'],
    navigationTargets: [NAV_COMPARE],
    blockingConstraints: [],
    deferredReasons: [
      {
        reason: error ?? 'Comparison view model returned an error.',
        authority: 'unavailable',
      },
    ],
    severity: 'warning',
  };
}

export function buildWorldChangesSummaryAnswer(
  inputs: ScenarioAnswerInputs
): Stage4GuidedAnswer {
  const id = 'world-changes-summary';
  if (inputs.comparisonStatus === 'sandbox') return sandboxAnswer(id);
  if (inputs.comparisonStatus === 'loading') return loadingAnswer(id);
  if (inputs.comparisonStatus === 'error')
    return errorAnswer(id, inputs.comparisonError);

  const vm = inputs.comparisonViewModel;
  const entry = getCatalogEntry(id)!;
  if (!vm) {
    return errorAnswer(id, 'No comparison view model available.');
  }

  const chips: Stage4EvidenceChip[] = [
    {
      label: `${vm.committedEventCount} committed event${vm.committedEventCount === 1 ? '' : 's'}`,
      authority: 'committed-world',
    },
    {
      label: `${vm.changedTeams.teamCodes.length} team${vm.changedTeams.teamCodes.length === 1 ? '' : 's'} changed`,
      authority: 'committed-world / event-derived',
    },
    {
      label: `${vm.changedPlayers.playerIds.length} player${vm.changedPlayers.playerIds.length === 1 ? '' : 's'} touched`,
      authority: 'committed-world / event-derived',
    },
  ];

  if (vm.isMultiSeasonComparison) {
    chips.push({
      label: 'Multi-season comparison',
      authority: 'committed-world / event-derived',
      severity: 'warning',
    });
  }

  const shortAnswer =
    vm.committedEventCount === 0
      ? 'No committed events in this world yet.'
      : `${vm.committedEventCount} committed event${vm.committedEventCount === 1 ? '' : 's'} affecting ${vm.changedTeams.teamCodes.length} team${vm.changedTeams.teamCodes.length === 1 ? '' : 's'} and ${vm.changedPlayers.playerIds.length} player${vm.changedPlayers.playerIds.length === 1 ? '' : 's'}.`;

  return {
    ...entry,
    status: vm.committedEventCount > 0 ? 'available' : 'partial',
    shortAnswer,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV_COMPARE, NAV_HISTORY],
    blockingConstraints: [],
    deferredReasons:
      vm.committedEventCount === 0
        ? [
            {
              reason:
                'No committed events to summarize yet. Comparison will appear after mutations are committed.',
              authority: 'committed-world',
            },
          ]
        : [],
    severity: vm.isMultiSeasonComparison ? 'warning' : 'info',
  };
}

export function buildComparisonAvailableAnswer(
  inputs: ScenarioAnswerInputs
): Stage4GuidedAnswer {
  const id = 'comparison-available';
  if (inputs.comparisonStatus === 'sandbox') return sandboxAnswer(id);
  if (inputs.comparisonStatus === 'loading') return loadingAnswer(id);
  if (inputs.comparisonStatus === 'error')
    return errorAnswer(id, inputs.comparisonError);

  const vm = inputs.comparisonViewModel;
  const entry = getCatalogEntry(id)!;
  if (!vm) return errorAnswer(id, 'No comparison view model available.');

  const chips: Stage4EvidenceChip[] = [];
  if (vm.capTotalDelta) {
    chips.push({
      label: 'Cap delta available',
      authority: 'committed-world / event-derived',
    });
  }
  if (vm.taxApronPostureDelta) {
    chips.push({
      label: 'Apron posture delta available',
      authority: 'committed-world / event-derived',
    });
  }
  if (vm.rosterAdditions.length > 0) {
    chips.push({
      label: `${vm.rosterAdditions.length} roster addition${vm.rosterAdditions.length === 1 ? '' : 's'}`,
      authority: 'committed-world / event-derived',
    });
  }
  if (vm.rosterRemovals.length > 0) {
    chips.push({
      label: `${vm.rosterRemovals.length} roster removal${vm.rosterRemovals.length === 1 ? '' : 's'}`,
      authority: 'committed-world / event-derived',
    });
  }
  if (vm.rosterChangedPlayers.length > 0) {
    chips.push({
      label: `${vm.rosterChangedPlayers.length} contract change${vm.rosterChangedPlayers.length === 1 ? '' : 's'}`,
      authority: 'committed-world / event-derived',
    });
  }
  if (vm.changedTeams.teamCodes.length > 0) {
    chips.push({
      label: 'Changed teams list available',
      authority: 'committed-world / event-derived',
    });
  }
  if (vm.changedPlayers.playerIds.length > 0) {
    chips.push({
      label: 'Changed players list available',
      authority: 'committed-world / event-derived',
    });
  }

  if (chips.length === 0) {
    chips.push({
      label: 'No comparison fields populated yet',
      authority: 'committed-world',
    });
  }

  const shortAnswer =
    chips.length === 1 && chips[0].label.startsWith('No comparison')
      ? 'No comparison fields are populated yet for this world.'
      : `${chips.length} comparison field${chips.length === 1 ? '' : 's'} currently populated.`;

  return {
    ...entry,
    status: vm.committedEventCount > 0 ? 'available' : 'partial',
    shortAnswer,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV_COMPARE],
    blockingConstraints: [],
    deferredReasons: [],
    severity: 'info',
  };
}

export function buildComparisonDeferredAnswer(
  inputs: ScenarioAnswerInputs
): Stage4GuidedAnswer {
  const id = 'comparison-deferred';
  if (inputs.comparisonStatus === 'sandbox') return sandboxAnswer(id);
  if (inputs.comparisonStatus === 'loading') return loadingAnswer(id);
  if (inputs.comparisonStatus === 'error')
    return errorAnswer(id, inputs.comparisonError);

  const vm = inputs.comparisonViewModel;
  const entry = getCatalogEntry(id)!;
  if (!vm) return errorAnswer(id, 'No comparison view model available.');

  const deferredReasons: Stage4GuidedAnswer['deferredReasons'] = vm.unavailableSummary.map(
    (entry) => ({
      reason: `${entry.field}: ${entry.reason}`,
      authority: 'deferred',
    })
  );

  // Always include the static exception deferral.
  deferredReasons.push({
    reason: `exceptionDelta: ${vm.exceptionDelta.reason}`,
    authority: 'deferred',
  });

  const chips: Stage4EvidenceChip[] = vm.unavailableSummary.map((entry) => ({
    label: entry.field,
    authority: 'deferred',
  }));
  chips.push({
    label: 'exceptionDelta',
    authority: 'deferred',
  });

  const shortAnswer = `${deferredReasons.length} comparison field${deferredReasons.length === 1 ? '' : 's'} are deferred or unavailable.`;

  return {
    ...entry,
    status: 'deferred',
    shortAnswer,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV_COMPARE],
    blockingConstraints: [],
    deferredReasons,
    severity: 'info',
  };
}
