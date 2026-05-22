/**
 * FILE: src/features/architect/guidedQuestions/answerPostAction.ts
 * PURPOSE: Stage 4B helpers for post-action guided answers (Family D).
 * OWNERSHIP: Feature: architect/guidedQuestions
 *
 * Pure functions. Read only the Stage 2B post-action receipt and (optionally)
 * the most recent committed event reference already present in the Stage 3
 * comparison view model. No new event source is fetched.
 */

import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';
import type {
  Stage3ComparisonViewModel,
  Stage3CommittedEventReference,
} from '@/features/architect/comparison/types';
import { getCatalogEntry } from './questionCatalog';
import type {
  Stage4EvidenceChip,
  Stage4GuidedAnswer,
  Stage4NavigationTarget,
  Stage4NavigationTargetId,
} from './types';

const NAV: Record<Stage4NavigationTargetId, Stage4NavigationTarget> = {
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

export interface PostActionAnswerInputs {
  receipt: ArchitectPostActionReceipt | null;
  comparisonViewModel: Stage3ComparisonViewModel | null;
  sandbox: boolean;
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

function truncate(id: string, max = 8): string {
  if (id.length <= max) return id;
  return `${id.slice(0, max)}…`;
}

function latestEventRef(
  vm: Stage3ComparisonViewModel | null
): Stage3CommittedEventReference | null {
  if (!vm) return null;
  const refs = vm.committedEventReferences;
  if (!refs || refs.length === 0) return null;
  // Pick the most recent by occurredAt where parseable; fallback to last entry.
  let best = refs[0];
  let bestTime = best.occurredAt ? Date.parse(best.occurredAt) : NaN;
  for (const ref of refs) {
    const t = ref.occurredAt ? Date.parse(ref.occurredAt) : NaN;
    if (!Number.isNaN(t) && (Number.isNaN(bestTime) || t > bestTime)) {
      best = ref;
      bestTime = t;
    }
  }
  return best;
}

export function buildLastActionSummaryAnswer(
  inputs: PostActionAnswerInputs
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('last-action-summary')!;

  if (inputs.sandbox) {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer: 'No committed actions in sandbox mode.',
      evidence: [],
      authorityLabels: ['sandbox'],
      navigationTargets: [NAV.history],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason: 'Post-action receipts are scoped to committed worlds.',
          authority: 'sandbox',
        },
      ],
      severity: 'info',
    };
  }

  const receipt = inputs.receipt;
  if (!receipt) {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer: 'No recent committed action recorded in this session.',
      evidence: [],
      authorityLabels: ['committed-world / session-scoped'],
      navigationTargets: [NAV.history],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason:
            'Post-action receipts are session-scoped. Open Team History for the full committed event stream.',
          authority: 'committed-world / session-scoped',
        },
      ],
      severity: 'info',
    };
  }

  const chips: Stage4EvidenceChip[] = [
    {
      label: receipt.headline,
      authority: 'committed-world / session-scoped',
    },
  ];

  if (receipt.changedTeamCodes.length > 0) {
    chips.push({
      label: `Teams: ${receipt.changedTeamCodes.join(', ')}`,
      authority: 'committed-world / session-scoped',
    });
  }
  if (receipt.primaryPlayerIds.length > 0) {
    chips.push({
      label: `${receipt.primaryPlayerIds.length} player${receipt.primaryPlayerIds.length === 1 ? '' : 's'} touched`,
      authority: 'committed-world / session-scoped',
    });
  }
  if (receipt.eventId) {
    chips.push({
      label: `Event ${truncate(receipt.eventId)}`,
      authority: 'committed-world',
    });
  }

  return {
    ...entry,
    status: 'available',
    shortAnswer: `${receipt.headline}${receipt.changedTeamCodes.length > 0 ? ` — affected ${receipt.changedTeamCodes.join(', ')}` : ''}.`,
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: [NAV.history, NAV.cap, NAV.roster],
    blockingConstraints: [],
    deferredReasons: [],
    severity: 'info',
  };
}

export function buildLastActionInspectAnswer(
  inputs: PostActionAnswerInputs
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('last-action-inspect')!;

  if (inputs.sandbox) {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer: 'No committed actions in sandbox mode.',
      evidence: [],
      authorityLabels: ['sandbox'],
      navigationTargets: [NAV.history],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason: 'Post-action receipts are scoped to committed worlds.',
          authority: 'sandbox',
        },
      ],
      severity: 'info',
    };
  }

  const receipt = inputs.receipt;
  if (!receipt) {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer: 'No recent committed action to inspect.',
      evidence: [],
      authorityLabels: ['committed-world / session-scoped'],
      navigationTargets: [NAV.history],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason:
            'No session-scoped receipt is present. Open Team History to inspect prior committed events.',
          authority: 'committed-world / session-scoped',
        },
      ],
      severity: 'info',
    };
  }

  const navTargets: Stage4NavigationTarget[] = [];
  // Cap impact is relevant when a financial mutation occurred.
  navTargets.push(NAV.cap);
  if (receipt.primaryPlayerIds.length > 0 || receipt.changedTeamCodes.length > 0) {
    navTargets.push(NAV.roster);
  }
  navTargets.push(NAV.history);

  const chips: Stage4EvidenceChip[] = [
    {
      label: 'Cap impact → Cap Sheet',
      authority: 'navigation-only',
    },
  ];
  if (navTargets.some((t) => t.id === 'roster')) {
    chips.push({
      label: 'Roster impact → Roster',
      authority: 'navigation-only',
    });
  }
  chips.push({
    label: 'Event detail → Team History',
    authority: 'navigation-only',
  });

  return {
    ...entry,
    status: 'available',
    shortAnswer:
      'Cap Sheet shows cap impact; Roster reflects player movement; Team History stores the committed event detail.',
    evidence: chips,
    authorityLabels: dedupeAuthorityLabels(chips),
    navigationTargets: navTargets,
    blockingConstraints: [],
    deferredReasons: [],
    severity: 'info',
  };
}

export function buildRecentCommittedEventAnswer(
  inputs: PostActionAnswerInputs
): Stage4GuidedAnswer {
  const entry = getCatalogEntry('recent-committed-event')!;

  if (inputs.sandbox) {
    return {
      ...entry,
      status: 'unavailable',
      shortAnswer: 'No committed events in sandbox mode.',
      evidence: [],
      authorityLabels: ['sandbox'],
      navigationTargets: [NAV.history],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason: 'Committed events are scoped to active worlds.',
          authority: 'sandbox',
        },
      ],
      severity: 'info',
    };
  }

  // Prefer the most recent event reference from the Stage 3 comparison view
  // model. Fall back to the post-action receipt's eventId if present.
  const refFromComparison = latestEventRef(inputs.comparisonViewModel);
  const fallbackEventId = inputs.receipt?.eventId ?? null;

  if (refFromComparison) {
    const chips: Stage4EvidenceChip[] = [
      {
        label: `Event ${truncate(refFromComparison.eventId)}`,
        authority: 'committed-world',
      },
      {
        label: `Type: ${refFromComparison.mutationType}`,
        authority: 'committed-world',
      },
    ];
    if (refFromComparison.occurredAt) {
      chips.push({
        label: refFromComparison.occurredAt,
        authority: 'committed-world',
      });
    }
    return {
      ...entry,
      status: 'available',
      shortAnswer: `Latest committed event: ${refFromComparison.mutationType} (${truncate(refFromComparison.eventId)}).`,
      evidence: chips,
      authorityLabels: dedupeAuthorityLabels(chips),
      navigationTargets: [NAV.history],
      blockingConstraints: [],
      deferredReasons: [],
      severity: 'info',
    };
  }

  if (fallbackEventId) {
    const chips: Stage4EvidenceChip[] = [
      {
        label: `Event ${truncate(fallbackEventId)}`,
        authority: 'committed-world / session-scoped',
      },
    ];
    return {
      ...entry,
      status: 'partial',
      shortAnswer: `Session receipt references event ${truncate(fallbackEventId)}. Open Team History for full detail.`,
      evidence: chips,
      authorityLabels: dedupeAuthorityLabels(chips),
      navigationTargets: [NAV.history],
      blockingConstraints: [],
      deferredReasons: [
        {
          reason:
            'No committed event references from the comparison view model. Falling back to session receipt only.',
          authority: 'committed-world / session-scoped',
        },
      ],
      severity: 'info',
    };
  }

  return {
    ...entry,
    status: 'unavailable',
    shortAnswer: 'No recent committed event reference available.',
    evidence: [],
    authorityLabels: ['committed-world'],
    navigationTargets: [NAV.history],
    blockingConstraints: [],
    deferredReasons: [
      {
        reason:
          'No committed event references in the comparison view model and no session receipt eventId.',
        authority: 'committed-world',
      },
    ],
    severity: 'info',
  };
}
