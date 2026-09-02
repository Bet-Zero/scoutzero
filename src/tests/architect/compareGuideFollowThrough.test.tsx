/**
 * FILE: src/tests/architect/compareGuideFollowThrough.test.tsx
 * PURPOSE: Cover the Compare/Guide follow-through context receivers
 *          (interconnectivity Slice 5b): Compare focus banner + authority label,
 *          Guide objective banner + Open-Trade routing (Guide routes, never
 *          mutates).
 * OWNERSHIP: Feature: architect/GMDashboard
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ComparisonSection } from '@/features/architect/GMDashboard/sections/ComparisonSection';
import { GuideSection } from '@/features/architect/GMDashboard/sections/GuideSection';
import { buildFollowThroughContext } from '@/features/architect/cockpit';

const compareViewModel = {
  scope: { teamCode: 'LAL', worldName: 'Test World', currentSeason: '2025-26' },
  committedEventCount: 0,
  changedTeams: { teamCodes: [] },
  changedPlayers: { playerIds: [] },
  rosterAdditions: [],
  rosterRemovals: [],
  rosterChangedPlayers: [],
  capTotalDelta: null,
  taxApronPostureDelta: null,
  unavailableSummary: [],
  isMultiSeasonComparison: false,
} as unknown as Parameters<typeof ComparisonSection>[0]['viewModel'];

const guideViewModel = {
  scope: { teamCode: 'LAL', sandbox: false, season: '2025-26' },
  answers: [],
  status: {},
} as unknown as Parameters<typeof GuideSection>[0]['viewModel'];

afterEach(() => cleanup());

describe('ComparisonSection — follow-through focus banner', () => {
  it('shows a receipt-focused banner without an internal authority label', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={compareViewModel}
        followThroughContext={buildFollowThroughContext({
          origin: 'receipt',
          receiptKind: 'trade',
        })}
      />
    );
    expect(screen.getByTestId('comparison-focus-banner')).toBeInTheDocument();
    expect(screen.getByTestId('comparison-focus-banner')).toHaveTextContent(
      'Comparing the latest saved move'
    );
    expect(screen.queryByTestId('comparison-focus-authority')).toBeNull();
  });

  it('explains an unavailable player-focused comparison in product language', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={compareViewModel}
        followThroughContext={buildFollowThroughContext({
          origin: 'pinned-player',
          playerIds: ['p1'],
        })}
      />
    );
    expect(screen.getByTestId('comparison-focus-banner')).toHaveTextContent(
      'Player-level comparison is not available yet'
    );
    expect(screen.queryByTestId('comparison-focus-authority')).toBeNull();
  });

  it('renders no focus banner without context', () => {
    render(<ComparisonSection status="available" viewModel={compareViewModel} />);
    expect(screen.queryByTestId('comparison-focus-banner')).toBeNull();
  });
});

describe('GuideSection — follow-through objective banner', () => {
  it('shows a concrete objective and routes Open Trade without mutating', () => {
    const onOpenTradeWithRequest = vi.fn();
    render(
      <GuideSection
        viewModel={guideViewModel}
        onNavigate={vi.fn()}
        followThroughContext={buildFollowThroughContext({
          origin: 'warning',
          warningType: 'clear-second-apron',
        })}
        onOpenTradeWithRequest={onOpenTradeWithRequest}
      />
    );
    expect(screen.getByTestId('guide-objective-text')).toHaveTextContent(
      'Solve second-apron restrictions.'
    );
    fireEvent.click(screen.getByTestId('guide-objective-open-trade'));
    expect(onOpenTradeWithRequest).toHaveBeenCalledTimes(1);
    const req = onOpenTradeWithRequest.mock.calls[0][0];
    expect(req.source).toBe('guide');
    expect(req.objective).toBe('clear-second-apron');
  });

  it('shows no objective banner without context', () => {
    render(<GuideSection viewModel={guideViewModel} onNavigate={vi.fn()} />);
    expect(screen.queryByTestId('guide-objective-banner')).toBeNull();
  });
});
