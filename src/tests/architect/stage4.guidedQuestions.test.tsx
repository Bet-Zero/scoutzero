/**
 * FILE: src/tests/architect/stage4.guidedQuestions.test.tsx
 * PURPOSE: Targeted tests for Stage 4B Front Office Guide module and UI.
 * OWNERSHIP: Feature: architect/guidedQuestions + architect/GMDashboard
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  deriveGuidedAnswers,
  STAGE4_QUESTION_CATALOG,
  STAGE4_QUESTION_IDS,
  type ComparisonSourceStatus,
  type Stage4GuidedAnswer,
  type Stage4GuidedAnswersViewModel,
} from '@/features/architect/guidedQuestions';
import { GuideSection } from '@/features/architect/GMDashboard/sections/GuideSection';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { deriveArchitectTeamPlanSaveState } from '@/features/architect/GMDashboard/hooks/teamPlanSaveState';
import type { Stage3ComparisonViewModel } from '@/features/architect/comparison/types';
import type {
  ArchitectPostActionImpact,
  ArchitectPostActionPersistence,
  ArchitectPostActionReceipt,
} from '@/features/architect/GMDashboard/postActionHandoff/types';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeWorkspaceContext = (
  overrides: Partial<ArchitectWorkspaceContext> = {}
): ArchitectWorkspaceContext => ({
  team: { status: 'available', id: 'LAL', label: 'Los Angeles Lakers' },
  world: {
    status: 'available',
    id: 'world_test',
    label: 'Test World',
    labelSource: 'provided',
  },
  seasons: {
    selectedViewingSeason: 2025,
    selectedViewingSeasonLabel: '2025-26',
    authoritativeWorldSeason: '2025-26',
    authoritativeWorldSeasonLabel: '2025-26',
    authoritativeWorldSeasonStatus: 'available',
    viewingSeasonDiffersFromWorldSeason: false,
  },
  worldDate: {
    status: 'available',
    value: '2025-07-01',
    label: '2025-07-01',
  },
  mode: {
    kind: 'committed-world',
    label: 'Committed World',
    shortLabel: 'World',
    detail: 'Committed world',
    tone: 'success',
    worldId: 'world_test',
    isCommittedWorldTruth: true,
  },
  status: {
    isLoading: false,
    isSaving: false,
    worldMetadataLoading: false,
    hasError: false,
    errorMessage: null,
  },
  saveState: deriveArchitectTeamPlanSaveState({ worldId: 'world_test' }),
  roster: {
    status: 'available',
    count: 15,
    standardCount: 15,
    twoWayCount: 0,
    source: 'players',
  },
  cap: {
    status: 'available',
    season: 2025,
    seasonLabel: '2025-26',
    teamSalary: 140_000_000,
    apronTeamSalary: 141_000_000,
    taxSalary: 142_000_000,
    books: {
      teamSalary: { status: 'available', value: 140_000_000, reason: null },
      apronTeamSalary: { status: 'available', value: 141_000_000, reason: null },
      taxSalary: { status: 'available', value: 142_000_000, reason: null },
    },
    salaryCap: 154_000_000,
    capSpace: 14_000_000,
    luxuryTax: 187_000_000,
    taxSpace: 47_000_000,
    firstApron: 196_000_000,
    firstApronSpace: 56_000_000,
    secondApron: 207_000_000,
    secondApronSpace: 67_000_000,
    isOverCap: false,
    isOverTax: false,
    isAtOrAboveFirstApron: false,
    isAboveSecondApron: false,
    source: 'salaryBooks',
  } as ArchitectWorkspaceContext['cap'],
  exceptions: {
    status: 'available',
    tpeCount: 1,
    tpeRemainingAmounts: [],
    hasAvailableMle: true,
    hasAvailableBae: false,
    hasAvailableRoom: false,
    hasAnyActive: true,
    worldSeasonBasis: true,
  },
  draftAssets: {
    status: 'unavailable',
    deferralHint: 'see-trade-history',
    reason: 'No canonical active-world draft asset summary is exposed.',
  },
  recentActivity: { status: 'deferred', entryPoint: 'history-tab' },
  ...overrides,
});

const makeSandboxWorkspaceContext = (): ArchitectWorkspaceContext =>
  makeWorkspaceContext({
    world: {
      status: 'sandbox',
      id: null,
      label: 'Sandbox',
      labelSource: 'sandbox',
    },
    mode: {
      kind: 'sandbox',
      label: 'Sandbox',
      shortLabel: 'Sandbox',
      detail: 'Sandbox',
      tone: 'muted',
      worldId: null,
      isCommittedWorldTruth: false,
    },
    saveState: deriveArchitectTeamPlanSaveState({ worldId: null }),
    seasons: {
      selectedViewingSeason: 2025,
      selectedViewingSeasonLabel: '2025-26',
      authoritativeWorldSeason: null,
      authoritativeWorldSeasonLabel: null,
      authoritativeWorldSeasonStatus: 'unavailable',
      viewingSeasonDiffersFromWorldSeason: null,
    },
  });

const makeComparisonViewModel = (
  overrides: Partial<Stage3ComparisonViewModel> = {}
): Stage3ComparisonViewModel => ({
  scope: {
    teamCode: 'LAL',
    worldId: 'world_test',
    worldName: 'Test World',
    baselineSeason: null,
    currentSeason: '2025-26',
    authority: 'committed-world',
  },
  rosterAdditions: [],
  rosterRemovals: [],
  rosterChangedPlayers: [],
  capTotalDelta: null,
  taxApronPostureDelta: null,
  exceptionDelta: {
    status: 'deferred',
    reason: 'Exception delta is not reliably derivable.',
  },
  changedTeams: { teamCodes: [], authority: 'committed-world / event-derived' },
  changedPlayers: { playerIds: [], authority: 'committed-world / event-derived' },
  committedEventCount: 0,
  committedEventReferences: [],
  isMultiSeasonComparison: false,
  unavailableSummary: [
    { field: 'capTotalDelta', reason: 'No committed events.' },
    { field: 'draftAssetDelta', reason: 'Deferred.' },
  ],
  ...overrides,
});

const makeReceiptPersistence = (): ArchitectPostActionPersistence => ({
  status: 'world-saved',
  saveStateStatus: 'saved',
  label: 'Committed world',
  detail: 'Saved to the active durable Team Plan world.',
});

const makeReceiptImpact = (): ArchitectPostActionImpact => {
  const section = {
    status: 'not-applicable' as const,
    summary: 'No direct effect expected.',
    deltas: [],
  };
  return {
    actionType: 'trade',
    mutationType: 'executeTrade',
    teamCode: 'LAL',
    playerId: 'player_a',
    playerName: null,
    affectedSeasons: [],
    roster: section,
    cap: section,
    exceptions: section,
    rights: section,
    deadMoney: section,
    contract: section,
    notes: [],
  };
};

const makeReceipt = (
  overrides: Partial<ArchitectPostActionReceipt> = {}
): ArchitectPostActionReceipt => ({
  kind: 'trade',
  eventId: 'event_abc12345',
  occurredAt: '2025-07-02T12:00:00Z',
  headline: 'Trade applied',
  changedTeamCodes: ['LAL', 'BOS'],
  primaryTeamCode: 'LAL',
  primaryPlayerIds: ['player_a', 'player_b'],
  ...overrides,
  actionType: overrides.actionType ?? 'trade',
  persistence: overrides.persistence ?? makeReceiptPersistence(),
  impact: overrides.impact ?? makeReceiptImpact(),
  authority: overrides.authority ?? 'committed-world',
});

const baseInput = (overrides: {
  workspaceContext?: ArchitectWorkspaceContext;
  comparisonStatus?: ComparisonSourceStatus;
  comparisonViewModel?: Stage3ComparisonViewModel | null;
  comparisonError?: string | null;
  postActionReceipt?: ArchitectPostActionReceipt | null;
} = {}) => ({
  workspaceContext: overrides.workspaceContext ?? makeWorkspaceContext(),
  comparisonStatus: overrides.comparisonStatus ?? ('available' as ComparisonSourceStatus),
  comparisonViewModel:
    overrides.comparisonViewModel ?? makeComparisonViewModel(),
  comparisonError: overrides.comparisonError ?? null,
  postActionReceipt: overrides.postActionReceipt ?? null,
});

// ---------------------------------------------------------------------------
// deriveGuidedAnswers — structural
// ---------------------------------------------------------------------------

describe('deriveGuidedAnswers — structural', () => {
  it('returns exactly the 15 v1 question ids in canonical order', () => {
    const vm = deriveGuidedAnswers(baseInput());
    expect(vm.answers.map((a) => a.id)).toEqual([...STAGE4_QUESTION_IDS]);
    expect(vm.answers).toHaveLength(15);
  });

  it('every answer has status, shortAnswer, and authority labels', () => {
    const vm = deriveGuidedAnswers(baseInput());
    for (const answer of vm.answers) {
      expect(answer.status).toMatch(/^(available|partial|deferred|unavailable)$/);
      expect(typeof answer.shortAnswer).toBe('string');
      expect(answer.shortAnswer.length).toBeGreaterThan(0);
      expect(Array.isArray(answer.authorityLabels)).toBe(true);
      expect(answer.authorityLabels.length).toBeGreaterThan(0);
    }
  });

  it('deferred and unavailable answers always carry at least one deferred reason', () => {
    const vm = deriveGuidedAnswers(
      baseInput({
        workspaceContext: makeSandboxWorkspaceContext(),
        comparisonStatus: 'sandbox',
        comparisonViewModel: null,
      })
    );
    for (const answer of vm.answers) {
      if (answer.status === 'deferred' || answer.status === 'unavailable') {
        expect(answer.deferredReasons.length).toBeGreaterThan(0);
      }
    }
  });

  it('no answer exposes any mutation-style callback field', () => {
    const vm = deriveGuidedAnswers(baseInput());
    for (const answer of vm.answers) {
      // Navigation targets are navigation-only.
      for (const target of answer.navigationTargets) {
        expect(target.intent).toBe('navigate');
      }
      // No "on*" fields anywhere on the answer.
      const keys = Object.keys(answer);
      for (const key of keys) {
        expect(key.startsWith('on')).toBe(false);
      }
    }
  });

  it('is pure: same inputs produce deep-equal outputs', () => {
    const input = baseInput();
    const a = deriveGuidedAnswers(input);
    const b = deriveGuidedAnswers(input);
    expect(a).toEqual(b);
  });

  it('catalog ids match derived ids', () => {
    const catalogIds = STAGE4_QUESTION_CATALOG.map((e) => e.id);
    expect(catalogIds).toEqual([...STAGE4_QUESTION_IDS]);
  });
});

// ---------------------------------------------------------------------------
// Team status answers
// ---------------------------------------------------------------------------

describe('team-status answers', () => {
  it('cap-posture uses workspace cap data', () => {
    const ctx = makeWorkspaceContext();
    const vm = deriveGuidedAnswers(baseInput({ workspaceContext: ctx }));
    const ans = vm.answers.find((a) => a.id === 'cap-posture')!;
    expect(ans.status).toBe('available');
    expect(ans.shortAnswer).toMatch(/Below the salary cap/);
    expect(ans.evidence.some((c) => c.label.includes('Team Salary'))).toBe(true);
    expect(
      ans.authorityLabels.includes('committed-world / current-season')
    ).toBe(true);
  });

  it('cap-posture flags above-second-apron with danger severity', () => {
    const ctx = makeWorkspaceContext({
      cap: {
        ...((makeWorkspaceContext().cap as unknown) as Record<string, unknown>),
        status: 'available',
        isOverCap: true,
        isOverTax: true,
        isAtOrAboveFirstApron: true,
        isAboveSecondApron: true,
        capSpace: -10_000_000,
        taxSpace: -5_000_000,
      } as ArchitectWorkspaceContext['cap'],
    });
    const vm = deriveGuidedAnswers(baseInput({ workspaceContext: ctx }));
    const ans = vm.answers.find((a) => a.id === 'cap-posture')!;
    expect(ans.severity).toBe('danger');
    expect(ans.blockingConstraints.length).toBeGreaterThan(0);
  });

  it('roster-count uses workspace roster data', () => {
    const vm = deriveGuidedAnswers(baseInput());
    const ans = vm.answers.find((a) => a.id === 'roster-count')!;
    expect(ans.status).toBe('available');
    expect(ans.shortAnswer).toMatch(/15 roster/);
  });

  it('roster-count flags over-limit roster as danger', () => {
    const ctx = makeWorkspaceContext({
      roster: {
        status: 'available',
        count: 18,
        standardCount: 18,
        twoWayCount: 0,
        source: 'players',
      },
    });
    const vm = deriveGuidedAnswers(baseInput({ workspaceContext: ctx }));
    const ans = vm.answers.find((a) => a.id === 'roster-count')!;
    expect(ans.severity).toBe('danger');
    expect(ans.blockingConstraints.length).toBeGreaterThan(0);
  });

  it('roster-count flags below-floor roster as warning', () => {
    const ctx = makeWorkspaceContext({
      roster: {
        status: 'available',
        count: 12,
        standardCount: 12,
        twoWayCount: 0,
        source: 'players',
      },
    });
    const vm = deriveGuidedAnswers(baseInput({ workspaceContext: ctx }));
    const ans = vm.answers.find((a) => a.id === 'roster-count')!;
    expect(ans.severity).toBe('warning');
  });

  it('exceptions-available lists active exceptions', () => {
    const vm = deriveGuidedAnswers(baseInput());
    const ans = vm.answers.find((a) => a.id === 'exceptions-available')!;
    expect(ans.status).toBe('available');
    expect(ans.evidence.some((c) => c.label.includes('MLE available'))).toBe(true);
    expect(ans.evidence.some((c) => c.label.includes('TPE'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Constraint answers
// ---------------------------------------------------------------------------

describe('constraints answers', () => {
  it('current-constraints reports no observed constraints when posture is clean', () => {
    const vm = deriveGuidedAnswers(baseInput());
    const ans = vm.answers.find((a) => a.id === 'current-constraints')!;
    expect(ans.status).toBe('partial');
    expect(ans.shortAnswer).toMatch(/No cap, roster, or season-mismatch warnings/);
  });

  it('current-constraints surfaces second-apron blocker', () => {
    const ctx = makeWorkspaceContext({
      cap: {
        ...(makeWorkspaceContext().cap as ArchitectWorkspaceContext['cap']),
        status: 'available',
        isOverCap: true,
        isOverTax: true,
        isAtOrAboveFirstApron: true,
        isAboveSecondApron: true,
      } as ArchitectWorkspaceContext['cap'],
    });
    const vm = deriveGuidedAnswers(baseInput({ workspaceContext: ctx }));
    const ans = vm.answers.find((a) => a.id === 'current-constraints')!;
    expect(ans.blockingConstraints.length).toBeGreaterThan(0);
    expect(ans.severity).toBe('danger');
  });

  it('current-constraints flags season mismatch', () => {
    const ctx = makeWorkspaceContext({
      seasons: {
        ...makeWorkspaceContext().seasons,
        viewingSeasonDiffersFromWorldSeason: true,
        selectedViewingSeasonLabel: '2024-25',
        authoritativeWorldSeasonLabel: '2025-26',
      },
    });
    const vm = deriveGuidedAnswers(baseInput({ workspaceContext: ctx }));
    const ans = vm.answers.find((a) => a.id === 'current-constraints')!;
    expect(
      ans.blockingConstraints.some((c) =>
        /viewing|world is in/i.test(c.label)
      )
    ).toBe(true);
    expect(
      ans.navigationTargets.some((t) => t.id === 'offseason')
    ).toBe(true);
  });

  it('inspect-first points to highest-severity warning target', () => {
    const ctx = makeWorkspaceContext({
      cap: {
        ...(makeWorkspaceContext().cap as ArchitectWorkspaceContext['cap']),
        status: 'available',
        isOverCap: true,
        isOverTax: true,
        isAtOrAboveFirstApron: true,
        isAboveSecondApron: true,
      } as ArchitectWorkspaceContext['cap'],
    });
    const vm = deriveGuidedAnswers(baseInput({ workspaceContext: ctx }));
    const ans = vm.answers.find((a) => a.id === 'inspect-first')!;
    expect(ans.severity).toBe('danger');
    expect(ans.navigationTargets[0].id).toBe('cap');
  });

  it('inspect-first is available even with no warnings', () => {
    const vm = deriveGuidedAnswers(baseInput());
    const ans = vm.answers.find((a) => a.id === 'inspect-first')!;
    expect(ans.status).toBe('available');
    expect(ans.shortAnswer).toMatch(/No warnings observed/);
  });
});

// ---------------------------------------------------------------------------
// Scenario answers
// ---------------------------------------------------------------------------

describe('scenario answers', () => {
  it('world-changes-summary derives counts from Stage 3 view model', () => {
    const compVm = makeComparisonViewModel({
      committedEventCount: 3,
      changedTeams: {
        teamCodes: ['LAL', 'BOS'],
        authority: 'committed-world / event-derived',
      },
      changedPlayers: {
        playerIds: ['a', 'b', 'c'],
        authority: 'committed-world / event-derived',
      },
    });
    const vm = deriveGuidedAnswers(
      baseInput({ comparisonViewModel: compVm })
    );
    const ans = vm.answers.find((a) => a.id === 'world-changes-summary')!;
    expect(ans.status).toBe('available');
    expect(ans.shortAnswer).toMatch(/3 committed events/);
    expect(ans.shortAnswer).toMatch(/2 teams/);
    expect(ans.shortAnswer).toMatch(/3 players/);
  });

  it('comparison-available lists populated comparison fields', () => {
    const compVm = makeComparisonViewModel({
      committedEventCount: 1,
      capTotalDelta: {
        teamSalaryDelta: 1_000_000,
        apronTeamSalaryDelta: 2_000_000,
        taxSalaryDelta: 3_000_000,
        capSpaceDelta: -1_000_000,
        taxSpaceDelta: -1_000_000,
        firstApronSpaceDelta: -2_000_000,
        secondApronSpaceDelta: -2_000_000,
        authority: 'committed-world / event-derived',
      },
      changedTeams: {
        teamCodes: ['LAL'],
        authority: 'committed-world / event-derived',
      },
    });
    const vm = deriveGuidedAnswers(
      baseInput({ comparisonViewModel: compVm })
    );
    const ans = vm.answers.find((a) => a.id === 'comparison-available')!;
    expect(ans.evidence.some((c) => c.label.includes('Cap delta'))).toBe(true);
  });

  it('comparison-deferred reads unavailableSummary verbatim', () => {
    const compVm = makeComparisonViewModel({
      unavailableSummary: [
        { field: 'capTotalDelta', reason: 'No committed events.' },
        { field: 'draftAssetDelta', reason: 'Deferred.' },
      ],
    });
    const vm = deriveGuidedAnswers(
      baseInput({ comparisonViewModel: compVm })
    );
    const ans = vm.answers.find((a) => a.id === 'comparison-deferred')!;
    expect(ans.status).toBe('deferred');
    expect(
      ans.deferredReasons.some((r) => r.reason.includes('capTotalDelta'))
    ).toBe(true);
    expect(
      ans.deferredReasons.some((r) => r.reason.includes('draftAssetDelta'))
    ).toBe(true);
    // Exception deferral is always included.
    expect(
      ans.deferredReasons.some((r) => r.reason.includes('exceptionDelta'))
    ).toBe(true);
  });

  it('sandbox mode marks all scenario answers unavailable with reason', () => {
    const vm = deriveGuidedAnswers(
      baseInput({
        workspaceContext: makeSandboxWorkspaceContext(),
        comparisonStatus: 'sandbox',
        comparisonViewModel: null,
      })
    );
    for (const id of ['world-changes-summary', 'comparison-available', 'comparison-deferred']) {
      const ans = vm.answers.find((a) => a.id === id)!;
      expect(ans.status).toBe('unavailable');
      expect(ans.authorityLabels).toContain('sandbox');
      expect(ans.deferredReasons[0].reason).toMatch(/active world/);
    }
  });
});

// ---------------------------------------------------------------------------
// Post-action answers
// ---------------------------------------------------------------------------

describe('post-action answers', () => {
  it('last-action-summary uses receipt when present', () => {
    const vm = deriveGuidedAnswers(
      baseInput({ postActionReceipt: makeReceipt() })
    );
    const ans = vm.answers.find((a) => a.id === 'last-action-summary')!;
    expect(ans.status).toBe('available');
    expect(ans.shortAnswer).toMatch(/Trade applied/);
    expect(ans.evidence.some((c) => c.label.includes('Teams: LAL, BOS'))).toBe(true);
  });

  it('last-action-summary is unavailable when no receipt', () => {
    const vm = deriveGuidedAnswers(baseInput({ postActionReceipt: null }));
    const ans = vm.answers.find((a) => a.id === 'last-action-summary')!;
    expect(ans.status).toBe('unavailable');
    expect(ans.deferredReasons.length).toBeGreaterThan(0);
  });

  it('last-action-summary is unavailable in sandbox mode', () => {
    const vm = deriveGuidedAnswers(
      baseInput({
        workspaceContext: makeSandboxWorkspaceContext(),
        comparisonStatus: 'sandbox',
        comparisonViewModel: null,
        postActionReceipt: makeReceipt(),
      })
    );
    const ans = vm.answers.find((a) => a.id === 'last-action-summary')!;
    expect(ans.status).toBe('unavailable');
    expect(ans.authorityLabels).toContain('sandbox');
  });

  it('last-action-inspect maps to cap+roster+history when receipt present', () => {
    const vm = deriveGuidedAnswers(
      baseInput({ postActionReceipt: makeReceipt() })
    );
    const ans = vm.answers.find((a) => a.id === 'last-action-inspect')!;
    expect(ans.status).toBe('available');
    const ids = ans.navigationTargets.map((t) => t.id).sort();
    expect(ids).toEqual(['cap', 'history', 'roster']);
  });

  it('recent-committed-event uses comparison event refs when present', () => {
    const compVm = makeComparisonViewModel({
      committedEventCount: 1,
      committedEventReferences: [
        {
          eventId: 'event_xyz98765',
          mutationType: 'executeTrade',
          occurredAt: '2025-07-02T12:00:00Z',
          authority: 'committed-world',
        },
      ],
    });
    const vm = deriveGuidedAnswers(
      baseInput({ comparisonViewModel: compVm })
    );
    const ans = vm.answers.find((a) => a.id === 'recent-committed-event')!;
    expect(ans.status).toBe('available');
    expect(ans.shortAnswer).toMatch(/executeTrade/);
  });

  it('recent-committed-event falls back to receipt event id when no refs', () => {
    const vm = deriveGuidedAnswers(
      baseInput({ postActionReceipt: makeReceipt() })
    );
    const ans = vm.answers.find((a) => a.id === 'recent-committed-event')!;
    expect(ans.status).toBe('partial');
    expect(ans.evidence.some((c) => c.label.startsWith('Event'))).toBe(true);
  });

  it('recent-committed-event is unavailable when nothing is available', () => {
    const vm = deriveGuidedAnswers(baseInput({ postActionReceipt: null }));
    const ans = vm.answers.find((a) => a.id === 'recent-committed-event')!;
    expect(ans.status).toBe('unavailable');
  });
});

// ---------------------------------------------------------------------------
// Navigation answers
// ---------------------------------------------------------------------------

describe('navigation answers', () => {
  it('all four navigation answers are always available', () => {
    const vm = deriveGuidedAnswers(
      baseInput({
        workspaceContext: makeSandboxWorkspaceContext(),
        comparisonStatus: 'sandbox',
        comparisonViewModel: null,
        postActionReceipt: null,
      })
    );
    for (const id of [
      'navigation-cap',
      'navigation-roster',
      'navigation-history',
      'navigation-comparison',
    ]) {
      const ans = vm.answers.find((a) => a.id === id)!;
      expect(ans.status).toBe('available');
      expect(ans.authorityLabels).toEqual(['navigation-only']);
      expect(ans.navigationTargets[0].intent).toBe('navigate');
    }
  });
});

// ---------------------------------------------------------------------------
// GuideSection UI
// ---------------------------------------------------------------------------

describe('GuideSection UI', () => {
  const vm: Stage4GuidedAnswersViewModel = deriveGuidedAnswers(baseInput());

  it('renders one card per answer (15 total)', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    for (const id of STAGE4_QUESTION_IDS) {
      expect(screen.getByTestId(`guide-answer-${id}`)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^guide-answer-/).length).toBe(15);
  });

  it('renders family groups', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    expect(screen.getByTestId('guide-family-team-status')).toBeInTheDocument();
    expect(screen.getByTestId('guide-family-constraints')).toBeInTheDocument();
    expect(screen.getByTestId('guide-family-scenario')).toBeInTheDocument();
    expect(screen.getByTestId('guide-family-post-action')).toBeInTheDocument();
    expect(screen.getByTestId('guide-family-navigation')).toBeInTheDocument();
  });

  it('shows authority labels on evidence chips', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    const chips = screen.getAllByTestId('guide-evidence-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(
      chips.some((c) =>
        /Navigation only|Saved world|current season/i.test(c.textContent ?? '')
      )
    ).toBe(true);
  });

  it('renders deferred reasons when present', () => {
    const sandboxVm = deriveGuidedAnswers(
      baseInput({
        workspaceContext: makeSandboxWorkspaceContext(),
        comparisonStatus: 'sandbox',
        comparisonViewModel: null,
      })
    );
    render(<GuideSection viewModel={sandboxVm} onNavigate={() => undefined} />);
    const reasons = screen.getAllByTestId('guide-deferred-reason');
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('renders status chip per answer card', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    expect(screen.getAllByTestId('guide-status-chip').length).toBe(15);
  });

  it('clicking a navigation button calls onNavigate with the target id', () => {
    const onNavigate = vi.fn();
    render(<GuideSection viewModel={vm} onNavigate={onNavigate} />);
    const button = screen.getAllByTestId('guide-nav-cap')[0];
    fireEvent.click(button);
    expect(onNavigate).toHaveBeenCalledWith('cap');
  });

  it('navigation-history card triggers history navigation', () => {
    const onNavigate = vi.fn();
    render(<GuideSection viewModel={vm} onNavigate={onNavigate} />);
    const card = screen.getByTestId('guide-answer-navigation-history');
    const button = card.querySelector('[data-testid="guide-nav-history"]') as HTMLElement;
    fireEvent.click(button);
    expect(onNavigate).toHaveBeenCalledWith('history');
  });

  it('renders unavailable state when scope has no team', () => {
    const noTeamVm: Stage4GuidedAnswersViewModel = {
      ...vm,
      scope: { ...vm.scope, teamCode: null },
    };
    render(<GuideSection viewModel={noTeamVm} onNavigate={() => undefined} />);
    expect(screen.getByTestId('guide-unavailable-state')).toBeInTheDocument();
  });

  it('does not render any text input or freeform prompt UI', () => {
    const { container } = render(
      <GuideSection viewModel={vm} onNavigate={() => undefined} />
    );
    expect(container.querySelectorAll('input').length).toBe(0);
    expect(container.querySelectorAll('textarea').length).toBe(0);
  });

  it('GuideSection props expose no mutation callback fields', () => {
    // Static assertion via runtime inspection of the rendered tree's props.
    // The component only accepts viewModel + onNavigate. We assert by passing
    // an object with the right shape — the type system would already catch
    // extra fields, but we confirm at runtime that interactions only fire
    // onNavigate.
    const onNavigate = vi.fn();
    render(<GuideSection viewModel={vm} onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    for (const b of buttons) {
      fireEvent.click(b);
    }
    // Every click should have been a navigation event.
    for (const call of onNavigate.mock.calls) {
      expect(typeof call[0]).toBe('string');
    }
  });
});
