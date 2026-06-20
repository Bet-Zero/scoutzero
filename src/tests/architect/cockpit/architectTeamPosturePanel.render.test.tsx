/**
 * FILE: src/tests/architect/cockpit/architectTeamPosturePanel.render.test.tsx
 * PURPOSE: Render coverage for the permanent, canonical cap-posture panel.
 *          Posture moved out of the on-demand activity rail into this always-on
 *          panel; these assertions migrated with it.
 * OWNERSHIP: Feature: architect/cockpit
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  deriveArchitectWorkspaceContext,
  type ArchitectWorkspaceContext,
} from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { TeamPosturePanel } from '@/features/architect/cockpit/TeamPosturePanel';

/** Sandbox workspace with no cap sheet → cap posture is `unavailable`. */
function makeSandboxWorkspace(): ArchitectWorkspaceContext {
  return deriveArchitectWorkspaceContext({
    teamId: 'LAL',
    currentYear: 2025,
    worldId: null,
    isLoading: false,
    isSaving: false,
    error: null,
    worldModeBoundary: null,
  });
}

/** Override the cap summary to an available posture above the 2nd apron. */
function withAboveSecondApron(
  workspace: ArchitectWorkspaceContext
): ArchitectWorkspaceContext {
  return {
    ...workspace,
    cap: {
      status: 'available',
      season: 2025,
      seasonLabel: '2025-26',
      totalCapAllocations: 250_000_000,
      salaryCap: 140_000_000,
      capSpace: -110_000_000,
      luxuryTax: 170_000_000,
      taxSpace: -80_000_000,
      firstApron: 178_000_000,
      firstApronSpace: -72_000_000,
      secondApron: 188_000_000,
      secondApronSpace: -62_000_000,
      isOverCap: true,
      isOverTax: true,
      isAtOrAboveFirstApron: true,
      isAboveSecondApron: true,
      source: 'computeTeamCapTotals',
    } as ArchitectWorkspaceContext['cap'],
  };
}

describe('TeamPosturePanel', () => {
  afterEach(cleanup);

  it('shows the cap-posture-unavailable state with a Cap Sheet link', () => {
    const onNavigateToCapSheet = vi.fn();
    render(
      <TeamPosturePanel
        workspace={makeSandboxWorkspace()}
        onNavigateToCapSheet={onNavigateToCapSheet}
      />
    );

    expect(
      screen.getByTestId('cockpit-team-posture-unavailable')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Cap Sheet/i }));
    expect(onNavigateToCapSheet).toHaveBeenCalledTimes(1);
  });

  it('summarizes posture, roster count, and hard cap when available', () => {
    const workspace: ArchitectWorkspaceContext = {
      ...withAboveSecondApron(makeSandboxWorkspace()),
      roster: {
        status: 'available',
        count: 16,
        source: 'players',
      } as ArchitectWorkspaceContext['roster'],
    };

    render(
      <TeamPosturePanel
        workspace={workspace}
        hardCapStatus={{
          isHardCapped: true,
          hardCapCeilingType: 'SECOND_APRON',
          hardCapCeilingLabel: '2nd Apron',
          reason: 'Used restricted transaction path',
        }}
      />
    );

    const summary = screen.getByTestId('cockpit-team-posture-summary');
    expect(summary).toHaveTextContent('Hard capped at 2nd Apron');
    expect(summary).toHaveTextContent('16 / 15 roster spots shown');
    expect(summary).toHaveTextContent('Used restricted transaction path');
  });
});
