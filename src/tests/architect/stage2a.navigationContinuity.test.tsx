/**
 * FILE: src/tests/architect/stage2a.navigationContinuity.test.tsx
 * PURPOSE: Targeted tests for Stage 2A navigation continuity callbacks.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Covers:
 * - ArchitectWorkspaceHeader: onNavigateToCapSheet / onNavigateToOffseason button wiring
 * - FreeAgencySection: onAfterSigningComplete fires only on success
 */

import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ArchitectWorkspaceHeader } from '@/features/architect/GMDashboard/components/ArchitectWorkspaceHeader';
import { FreeAgencySection } from '@/features/architect/GMDashboard/sections/FreeAgencySection';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import type { FreeAgencyActionOwner } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

// FreeAgentPool mock that exposes signFreeAgent via a test button so we can
// trigger it without rendering the full pool UI.
vi.mock('@/features/architect/freeAgency/FreeAgentPool', () => ({
  FreeAgentPool: ({ actionOwner }: { actionOwner: { dualPathSigning: { signFreeAgent: (...args: unknown[]) => unknown } } }) => (
    <button
      data-testid="mock-trigger-sign"
      onClick={() =>
        actionOwner.dualPathSigning.signFreeAgent(
          { id: 'player_1', name: 'Test Player' },
          { salary: 5_000_000 }
        )
      }
    >
      Sign
    </button>
  ),
}));

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Minimal context fixtures
// ---------------------------------------------------------------------------

const baseMode = {
  kind: 'committed-world' as const,
  worldId: 'world_1',
  label: 'Committed World',
  shortLabel: 'World',
  detail: 'Committed world mode',
  tone: 'success' as const,
  isCommittedWorldTruth: true,
};

const baseContext: ArchitectWorkspaceContext = {
  team: { status: 'available', id: 'LAL', label: 'LAL' },
  world: {
    status: 'available',
    id: 'world_1',
    label: 'My World',
    labelSource: 'provided',
  },
  seasons: {
    selectedViewingSeason: 2026,
    selectedViewingSeasonLabel: '2025-26',
    authoritativeWorldSeason: '2025-26',
    authoritativeWorldSeasonStatus: 'available',
    authoritativeWorldSeasonLabel: '2025-26',
    viewingSeasonDiffersFromWorldSeason: false,
  },
  worldDate: { status: 'unavailable', value: null, label: '' },
  mode: baseMode,
  status: {
    isLoading: false,
    isSaving: false,
    worldMetadataLoading: false,
    hasError: false,
    errorMessage: null,
  },
  roster: { status: 'unavailable', count: null, source: null },
  cap: { status: 'unavailable', reason: 'no data' },
  exceptions: { status: 'unavailable', deferralHint: 'see-cap-sheet', reason: 'no data' },
  draftAssets: { status: 'unavailable', deferralHint: 'see-trade-history', reason: 'no data' },
  recentActivity: { status: 'deferred', entryPoint: 'history-tab' },
};

const contextWithCap: ArchitectWorkspaceContext = {
  ...baseContext,
  cap: {
    status: 'available',
    season: 2026,
    seasonLabel: '2025-26',
    totalCapAllocations: 145_000_000,
    salaryCap: 140_588_000,
    capSpace: -4_412_000,
    luxuryTax: 170_814_000,
    taxSpace: 25_814_000,
    firstApron: 178_132_000,
    firstApronSpace: 33_132_000,
    secondApron: 188_931_000,
    secondApronSpace: 43_931_000,
    isOverCap: true,
    isOverTax: false,
    isAtOrAboveFirstApron: false,
    isAboveSecondApron: false,
    source: 'computeTeamCapTotals',
  },
};

const contextWithSeasonMismatch: ArchitectWorkspaceContext = {
  ...contextWithCap,
  seasons: {
    selectedViewingSeason: 2025,
    selectedViewingSeasonLabel: '2024-25',
    authoritativeWorldSeason: '2025-26',
    authoritativeWorldSeasonStatus: 'available',
    authoritativeWorldSeasonLabel: '2025-26',
    viewingSeasonDiffersFromWorldSeason: true,
  },
};

const contextWithExceptions: ArchitectWorkspaceContext = {
  ...contextWithCap,
  exceptions: {
    status: 'available',
    tpeCount: 1,
    hasAvailableMle: true,
    hasAvailableBae: false,
    hasAvailableRoom: false,
    hasAnyActive: true,
    worldSeasonBasis: false,
  },
};

// ---------------------------------------------------------------------------
// ArchitectWorkspaceHeader — cap posture navigation
// ---------------------------------------------------------------------------

describe('ArchitectWorkspaceHeader — onNavigateToCapSheet', () => {
  it('renders cap posture as a button when onNavigateToCapSheet is provided', () => {
    render(
      <ArchitectWorkspaceHeader
        context={contextWithCap}
        onNavigateToCapSheet={vi.fn()}
      />
    );
    expect(
      screen.getByTestId('cap-posture-nav-cap-sheet')
    ).toBeInTheDocument();
  });

  it('calls onNavigateToCapSheet when the cap posture button is clicked', () => {
    const onNavigateToCapSheet = vi.fn();
    render(
      <ArchitectWorkspaceHeader
        context={contextWithCap}
        onNavigateToCapSheet={onNavigateToCapSheet}
      />
    );
    fireEvent.click(screen.getByTestId('cap-posture-nav-cap-sheet'));
    expect(onNavigateToCapSheet).toHaveBeenCalledTimes(1);
  });

  it('renders cap posture as static text when onNavigateToCapSheet is not provided', () => {
    render(<ArchitectWorkspaceHeader context={contextWithCap} />);
    expect(
      screen.queryByTestId('cap-posture-nav-cap-sheet')
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ArchitectWorkspaceHeader — season mismatch navigation
// ---------------------------------------------------------------------------

describe('ArchitectWorkspaceHeader — onNavigateToOffseason', () => {
  it('renders season mismatch as a button when onNavigateToOffseason is provided', () => {
    render(
      <ArchitectWorkspaceHeader
        context={contextWithSeasonMismatch}
        onNavigateToOffseason={vi.fn()}
      />
    );
    expect(
      screen.getByTestId('season-mismatch-nav-offseason')
    ).toBeInTheDocument();
  });

  it('calls onNavigateToOffseason when the season mismatch button is clicked', () => {
    const onNavigateToOffseason = vi.fn();
    render(
      <ArchitectWorkspaceHeader
        context={contextWithSeasonMismatch}
        onNavigateToOffseason={onNavigateToOffseason}
      />
    );
    fireEvent.click(screen.getByTestId('season-mismatch-nav-offseason'));
    expect(onNavigateToOffseason).toHaveBeenCalledTimes(1);
  });

  it('renders season mismatch as static text when onNavigateToOffseason is not provided', () => {
    render(<ArchitectWorkspaceHeader context={contextWithSeasonMismatch} />);
    expect(
      screen.queryByTestId('season-mismatch-nav-offseason')
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ArchitectWorkspaceHeader — exceptions navigation
// ---------------------------------------------------------------------------

describe('ArchitectWorkspaceHeader — exceptions onNavigateToCapSheet', () => {
  it('renders exceptions as a button when onNavigateToCapSheet is provided and exceptions are active', () => {
    render(
      <ArchitectWorkspaceHeader
        context={contextWithExceptions}
        onNavigateToCapSheet={vi.fn()}
      />
    );
    expect(
      screen.getByTestId('exceptions-nav-cap-sheet')
    ).toBeInTheDocument();
  });

  it('calls onNavigateToCapSheet when the exceptions button is clicked', () => {
    const onNavigateToCapSheet = vi.fn();
    render(
      <ArchitectWorkspaceHeader
        context={contextWithExceptions}
        onNavigateToCapSheet={onNavigateToCapSheet}
      />
    );
    fireEvent.click(screen.getByTestId('exceptions-nav-cap-sheet'));
    expect(onNavigateToCapSheet).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// FreeAgencySection — onAfterSigningComplete callback
// ---------------------------------------------------------------------------

const mockDualPathSigning = (
  result: { success: boolean }
): FreeAgencyActionOwner['dualPathSigning'] => ({
  signFreeAgent: vi.fn().mockResolvedValue(result),
});

const buildFreeAgencyActionOwner = (
  signResult: { success: boolean }
): FreeAgencyActionOwner => ({
  dualPathSigning: mockDualPathSigning(signResult),
  worldOnly: null,
  freeAgentModalAvailability: {
    visibleActions: ['signNew'],
    actionLabelsOverride: {},
    showOfferSheetToggle: false,
    signAndTradeInitiation: null,
    offerSheetInitiation: null,
  },
  offerSheetSectionAvailability: {
    actionsDisabled: true,
    actionsDisabledReason: 'World required',
    lifecycleActionOwner: null,
  },
});

describe('FreeAgencySection — onAfterSigningComplete', () => {
  it('calls onAfterSigningComplete when signing succeeds', async () => {
    const onAfterSigningComplete = vi.fn();
    render(
      <FreeAgencySection
        freeAgents={[]}
        currentYear={2026}
        actionOwner={buildFreeAgencyActionOwner({ success: true })}
        onAfterSigningComplete={onAfterSigningComplete}
      />
    );

    fireEvent.click(screen.getByTestId('mock-trigger-sign'));

    await vi.waitFor(() => {
      expect(onAfterSigningComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call onAfterSigningComplete when signing fails', async () => {
    const onAfterSigningComplete = vi.fn();
    render(
      <FreeAgencySection
        freeAgents={[]}
        currentYear={2026}
        actionOwner={buildFreeAgencyActionOwner({ success: false })}
        onAfterSigningComplete={onAfterSigningComplete}
      />
    );

    fireEvent.click(screen.getByTestId('mock-trigger-sign'));

    await new Promise((r) => setTimeout(r, 50));
    expect(onAfterSigningComplete).not.toHaveBeenCalled();
  });

  it('does not throw when onAfterSigningComplete is not provided and signing succeeds', async () => {
    render(
      <FreeAgencySection
        freeAgents={[]}
        currentYear={2026}
        actionOwner={buildFreeAgencyActionOwner({ success: true })}
      />
    );

    expect(() =>
      fireEvent.click(screen.getByTestId('mock-trigger-sign'))
    ).not.toThrow();
  });
});
