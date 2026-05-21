/**
 * FILE: src/tests/architect/stage2b.postActionHandoff.test.tsx
 * PURPOSE: Targeted tests for Stage 2B post-action handoff: receipt derivation,
 *          handoff strip rendering, navigation buttons, dismiss, and the
 *          activity-rail refresh seam.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Stage 1 (deriveActivityRailState) and Stage 2A (navigation) tests live in
 * their own files; this file only covers Stage 2B surface area.
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  deriveReceiptFromMutationResult,
  deriveSeasonAdvanceReceipt,
  kindForMutationType,
} from '@/features/architect/GMDashboard/postActionHandoff/types';
import { useArchitectPostActionReceipt } from '@/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt';
import { ArchitectPostActionHandoff } from '@/features/architect/GMDashboard/components/ArchitectPostActionHandoff';
import { useScenarioActivityRail } from '@/features/architect/GMDashboard/hooks/useScenarioActivityRail';
import { useWorldTeamEvents } from '@/features/architect/history/hooks/useWorldTeamEvents';
import type { PersistMutationResult } from '@/features/architect/GMDashboard/hooks/useArchitectActions.types';
import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';

const firestoreGetDocsSpy = vi.hoisted(() => vi.fn());

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args: unknown[]) => ({ type: 'collection', args })),
  getDocs: firestoreGetDocsSpy,
  limit: vi.fn((count: number) => ({ type: 'limit', count })),
  orderBy: vi.fn((field: string, direction: string) => ({
    type: 'orderBy',
    field,
    direction,
  })),
  query: vi.fn((...args: unknown[]) => ({ type: 'query', args })),
  startAfter: vi.fn((doc: unknown) => ({ type: 'startAfter', doc })),
  where: vi.fn((field: string, operator: string, value: unknown) => ({
    type: 'where',
    field,
    operator,
    value,
  })),
}));

afterEach(() => {
  cleanup();
  firestoreGetDocsSpy.mockReset();
});

// ---------------------------------------------------------------------------
// deriveReceiptFromMutationResult — pure derivation
// ---------------------------------------------------------------------------

describe('Stage 2B — deriveReceiptFromMutationResult', () => {
  const baseSuccessResult: PersistMutationResult = {
    success: true,
    appliedToLocalState: true,
    persistedToWorld: true,
    changedTeams: [
      { teamCode: 'LAL', team: {} as never },
      { teamCode: 'BOS', team: {} as never },
    ],
    changedPlayers: [{ playerId: 'player_1', player: {} as never }],
    event: { eventId: 'evt_abc', id: 'evt_abc' },
  };

  it('derives a trade receipt from a successful executeTrade result', () => {
    const receipt = deriveReceiptFromMutationResult({
      mutationType: 'executeTrade',
      result: baseSuccessResult,
      primaryTeamCode: 'LAL',
    });

    expect(receipt).not.toBeNull();
    expect(receipt!.kind).toBe('trade');
    expect(receipt!.headline).toBe('Trade applied');
    expect(receipt!.eventId).toBe('evt_abc');
    expect(receipt!.changedTeamCodes).toEqual(['LAL', 'BOS']);
    expect(receipt!.primaryTeamCode).toBe('LAL');
    expect(receipt!.primaryPlayerIds).toEqual(['player_1']);
    expect(receipt!.authority).toBe('committed-world');
  });

  it('derives a signing receipt from a successful signFreeAgent result', () => {
    const receipt = deriveReceiptFromMutationResult({
      mutationType: 'signFreeAgent',
      result: baseSuccessResult,
      primaryTeamCode: 'LAL',
    });

    expect(receipt).not.toBeNull();
    expect(receipt!.kind).toBe('signing');
    expect(receipt!.headline).toBe('Free agent signed');
  });

  it('returns null when the result is not successful', () => {
    const failure: PersistMutationResult = {
      ...baseSuccessResult,
      success: false,
    };
    expect(
      deriveReceiptFromMutationResult({
        mutationType: 'executeTrade',
        result: failure,
        primaryTeamCode: 'LAL',
      })
    ).toBeNull();
  });

  it('returns null for explicitly skipped or non-persisted results', () => {
    expect(
      deriveReceiptFromMutationResult({
        mutationType: 'executeTrade',
        result: { ...baseSuccessResult, skipped: true },
        primaryTeamCode: 'LAL',
      })
    ).toBeNull();

    expect(
      deriveReceiptFromMutationResult({
        mutationType: 'executeTrade',
        result: { ...baseSuccessResult, persistedToWorld: false },
        primaryTeamCode: 'LAL',
      })
    ).toBeNull();
  });

  it('returns null when result is missing entirely', () => {
    expect(
      deriveReceiptFromMutationResult({
        mutationType: 'executeTrade',
        result: undefined as unknown as PersistMutationResult,
        primaryTeamCode: 'LAL',
      })
    ).toBeNull();
  });

  it('falls back to writesSummary.teamCodes when changedTeams is empty', () => {
    const result: PersistMutationResult = {
      success: true,
      appliedToLocalState: true,
      persistedToWorld: true,
      changedTeams: [],
      writesSummary: {
        teamsPatched: 1,
        teamsWritten: 1,
        teamCodes: ['LAL'],
        playersPatched: 0,
        playersWritten: 0,
        playerIds: [],
        entitlementsPatched: 0,
        entitlementsWritten: 0,
        entitlementIds: [],
        eventsWritten: 1,
        eventWritten: true,
        eventIds: ['evt_abc'],
        worldMetadataPatched: 0,
        worldStatsUpdated: false,
      },
      event: { eventId: 'evt_abc' },
    };
    const receipt = deriveReceiptFromMutationResult({
      mutationType: 'executeTrade',
      result,
      primaryTeamCode: 'LAL',
    });
    expect(receipt!.changedTeamCodes).toEqual(['LAL']);
  });

  it('maps unknown mutation type to contractAction kind', () => {
    expect(kindForMutationType('mysteryMutation')).toBe('contractAction');
  });

  it('preserves primaryTeamCode even if not present in changedTeams', () => {
    const receipt = deriveReceiptFromMutationResult({
      mutationType: 'executeTrade',
      result: baseSuccessResult,
      primaryTeamCode: 'MIA',
    });
    expect(receipt!.primaryTeamCode).toBe('MIA');
  });
});

// ---------------------------------------------------------------------------
// deriveSeasonAdvanceReceipt
// ---------------------------------------------------------------------------

describe('Stage 2B — deriveSeasonAdvanceReceipt', () => {
  it('derives a seasonAdvance receipt with the next season label', () => {
    const receipt = deriveSeasonAdvanceReceipt({
      aftermath: {
        nextWorldSeason: '2026-27',
        nextViewingYear: 2027,
        offseasonSummary: {},
        committedTeamCapSheet: {} as never,
      } as never,
      primaryTeamCode: 'LAL',
    });
    expect(receipt).not.toBeNull();
    expect(receipt!.kind).toBe('seasonAdvance');
    expect(receipt!.headline).toBe('Season advanced to 2026-27');
    expect(receipt!.changedTeamCodes).toEqual(['LAL']);
  });

  it('returns null when aftermath is missing nextWorldSeason', () => {
    expect(
      deriveSeasonAdvanceReceipt({
        aftermath: { nextWorldSeason: null } as never,
        primaryTeamCode: 'LAL',
      })
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useArchitectPostActionReceipt
// ---------------------------------------------------------------------------

describe('Stage 2B — useArchitectPostActionReceipt', () => {
  const makeReceipt = (
    overrides: Partial<ArchitectPostActionReceipt> = {}
  ): ArchitectPostActionReceipt => ({
    kind: 'trade',
    eventId: 'evt_1',
    occurredAt: null,
    headline: 'Trade applied',
    changedTeamCodes: ['LAL'],
    primaryTeamCode: 'LAL',
    primaryPlayerIds: [],
    authority: 'committed-world',
    ...overrides,
  });

  it('publishes a receipt and increments generation', () => {
    const { result } = renderHook(() => useArchitectPostActionReceipt());
    expect(result.current.receipt).toBeNull();
    expect(result.current.generation).toBe(0);

    act(() => {
      result.current.publish(makeReceipt());
    });

    expect(result.current.receipt?.headline).toBe('Trade applied');
    expect(result.current.generation).toBe(1);
  });

  it('replaces the prior receipt on a subsequent publish', () => {
    const { result } = renderHook(() => useArchitectPostActionReceipt());
    act(() => {
      result.current.publish(makeReceipt({ headline: 'Trade applied' }));
    });
    act(() => {
      result.current.publish(
        makeReceipt({ kind: 'signing', headline: 'Free agent signed' })
      );
    });

    expect(result.current.receipt?.headline).toBe('Free agent signed');
    expect(result.current.generation).toBe(2);
  });

  it('dismiss() clears the receipt but does not bump generation', () => {
    const { result } = renderHook(() => useArchitectPostActionReceipt());
    act(() => {
      result.current.publish(makeReceipt());
    });
    const generationAfterPublish = result.current.generation;

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.receipt).toBeNull();
    expect(result.current.generation).toBe(generationAfterPublish);
  });

  it('clears the active receipt when the world/team scope changes', () => {
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useArchitectPostActionReceipt(scopeKey),
      { initialProps: { scopeKey: 'world_1:LAL' } }
    );
    act(() => {
      result.current.publish(makeReceipt());
    });
    const generationAfterPublish = result.current.generation;

    rerender({ scopeKey: 'world_1:BOS' });

    expect(result.current.receipt).toBeNull();
    expect(result.current.generation).toBe(generationAfterPublish);
  });

  it('publishing null is a no-op', () => {
    const { result } = renderHook(() => useArchitectPostActionReceipt());
    act(() => {
      result.current.publish(null);
    });
    expect(result.current.receipt).toBeNull();
    expect(result.current.generation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ArchitectPostActionHandoff component
// ---------------------------------------------------------------------------

describe('Stage 2B — ArchitectPostActionHandoff', () => {
  const makeReceipt = (
    overrides: Partial<ArchitectPostActionReceipt> = {}
  ): ArchitectPostActionReceipt => ({
    kind: 'trade',
    eventId: 'evt_1',
    occurredAt: '2026-05-01T00:00:00.000Z',
    headline: 'Trade applied',
    changedTeamCodes: ['LAL', 'BOS'],
    primaryTeamCode: 'LAL',
    primaryPlayerIds: ['player_1'],
    authority: 'committed-world',
    ...overrides,
  });

  it('renders nothing when receipt is null', () => {
    const { container } = render(
      <ArchitectPostActionHandoff
        receipt={null}
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToHistory={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the committed receipt headline and chips', () => {
    render(
      <ArchitectPostActionHandoff
        receipt={makeReceipt()}
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToHistory={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByTestId('architect-post-action-handoff')).toBeInTheDocument();
    expect(screen.getByTestId('post-action-handoff-status-chip')).toHaveTextContent(
      'Committed world'
    );
    expect(screen.getByTestId('post-action-handoff-headline')).toHaveTextContent(
      'Trade applied'
    );
    expect(screen.getByTestId('post-action-handoff-team-chip-LAL')).toBeInTheDocument();
    expect(screen.getByTestId('post-action-handoff-team-chip-BOS')).toBeInTheDocument();
  });

  it('caps team chips at 3 and shows +N overflow', () => {
    render(
      <ArchitectPostActionHandoff
        receipt={makeReceipt({
          changedTeamCodes: ['LAL', 'BOS', 'MIA', 'GSW', 'NYK'],
        })}
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToHistory={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByTestId('post-action-handoff-team-chip-LAL')).toBeInTheDocument();
    expect(screen.getByTestId('post-action-handoff-team-chip-MIA')).toBeInTheDocument();
    expect(
      screen.queryByTestId('post-action-handoff-team-chip-GSW')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('post-action-handoff-team-chips-overflow')
    ).toHaveTextContent('+2');
  });

  it('navigation buttons call the matching callbacks', () => {
    const onNavigateToCapSheet = vi.fn();
    const onNavigateToRoster = vi.fn();
    const onNavigateToHistory = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ArchitectPostActionHandoff
        receipt={makeReceipt()}
        onNavigateToCapSheet={onNavigateToCapSheet}
        onNavigateToRoster={onNavigateToRoster}
        onNavigateToHistory={onNavigateToHistory}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByTestId('post-action-handoff-nav-cap'));
    expect(onNavigateToCapSheet).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('post-action-handoff-nav-roster'));
    expect(onNavigateToRoster).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('post-action-handoff-nav-history'));
    expect(onNavigateToHistory).toHaveBeenCalledTimes(1);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismiss button calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <ArchitectPostActionHandoff
        receipt={makeReceipt()}
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToHistory={vi.fn()}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByTestId('post-action-handoff-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders without timestamp when occurredAt is null', () => {
    render(
      <ArchitectPostActionHandoff
        receipt={makeReceipt({ occurredAt: null })}
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToHistory={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.queryByTestId('post-action-handoff-date')
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useScenarioActivityRail — refresh seam in sandbox/no-world mode
// ---------------------------------------------------------------------------

const makeWorldEventDoc = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  data: () => data,
});

const makeWorldEventsSnapshot = (
  docs: Array<ReturnType<typeof makeWorldEventDoc>>
) => ({ docs });

describe('Stage 2B — useScenarioActivityRail refresh seam', () => {
  it('does not fetch in sandbox/no-world mode regardless of refreshKey', async () => {
    const { result, rerender } = renderHook(
      ({ refreshKey }: { refreshKey: number }) =>
        useScenarioActivityRail({
          worldId: null,
          teamCode: 'LAL',
          refreshKey,
        }),
      { initialProps: { refreshKey: 0 } }
    );
    rerender({ refreshKey: 1 });
    rerender({ refreshKey: 2 });
    // Sandbox status — no fetch should ever be issued.
    expect(result.current.railState.status).toBe('sandbox');
    expect(firestoreGetDocsSpy).not.toHaveBeenCalled();
  });

  it('returns sandbox rail state when worldId is missing', () => {
    const { result } = renderHook(() =>
      useScenarioActivityRail({
        worldId: null,
        teamCode: 'LAL',
      })
    );
    expect(result.current.railState.status).toBe('sandbox');
    expect(typeof result.current.refetch).toBe('function');
  });

  it('preserves previous committed entries while refreshKey refetches', async () => {
    let resolveRefresh:
      | ((snapshot: ReturnType<typeof makeWorldEventsSnapshot>) => void)
      | null = null;
    firestoreGetDocsSpy
      .mockResolvedValueOnce(
        makeWorldEventsSnapshot([
          makeWorldEventDoc('evt_existing', {
            occurredAt: '2026-05-01T00:00:00.000Z',
            teamCodes: ['LAL'],
            summary: 'Existing committed event',
          }),
        ])
      )
      .mockResolvedValueOnce(makeWorldEventsSnapshot([]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          })
      )
      .mockResolvedValueOnce(makeWorldEventsSnapshot([]));

    const { result, rerender } = renderHook(
      ({ refreshKey }: { refreshKey: number }) =>
        useWorldTeamEvents({
          worldId: 'world_1',
          teamCode: 'LAL',
          limit: 1,
          refreshKey,
        }),
      { initialProps: { refreshKey: 0 } }
    );

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual([
        'evt_existing',
      ]);
    });

    rerender({ refreshKey: 1 });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
    expect(result.current.events.map((event) => event.id)).toEqual([
      'evt_existing',
    ]);

    act(() => {
      resolveRefresh?.(
        makeWorldEventsSnapshot([
          makeWorldEventDoc('evt_refreshed', {
            occurredAt: '2026-05-02T00:00:00.000Z',
            teamCodes: ['LAL'],
            summary: 'Refreshed committed event',
          }),
        ])
      );
    });

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual([
        'evt_refreshed',
      ]);
      expect(result.current.loading).toBe(false);
    });
  });
});
