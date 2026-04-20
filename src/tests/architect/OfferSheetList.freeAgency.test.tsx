import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OfferSheetList from '@/features/architect/GMDashboard/components/OfferSheetList';
import { FreeAgencySection } from '@/features/architect/GMDashboard/sections/FreeAgencySection';

vi.mock('@/features/architect/freeAgency/FreeAgentPool', () => ({
  default: () => <div data-testid="mock-free-agent-pool">FreeAgentPool</div>,
}));

const baseOfferSheet = {
  id: 'os_1',
  playerName: 'Test Player',
  offeringTeamCode: 'LAL',
  homeTeamCode: 'BOS',
  dedupKey: 'os:world_1:LAL:player_1:2025-26',
  playerId: 'player_1',
  seasonKey: '2025-26',
  contractYears: 4,
  totalValue: 120_000_000,
  createdAt: '2026-02-12T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
});

describe('OfferSheetList Free Agency wiring', () => {
  it('renders the exact incoming header order and formatted terms, status, and date', () => {
    const offerSheet = { ...baseOfferSheet, status: 'PENDING_MATCH' };

    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[offerSheet]}
        surfaceRole="incoming"
        onLifecycleAction={vi.fn()}
      />
    );

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent)
    ).toEqual([
      'Player',
      'Offering Team',
      'Terms',
      'Status',
      'Date',
      'Actions',
    ]);
    expect(screen.getByText('4y / $120,000,000')).toBeInTheDocument();
    expect(screen.getByText('PENDING MATCH')).toBeInTheDocument();
    expect(
      screen.getByText(new Date(offerSheet.createdAt).toLocaleDateString())
    ).toBeInTheDocument();
  });

  it('emits match lifecycle action for incoming PENDING_MATCH rows', () => {
    const onLifecycleAction = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'PENDING_MATCH' };

    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[offerSheet]}
        surfaceRole="incoming"
        onLifecycleAction={onLifecycleAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Match$/i }));
    expect(onLifecycleAction).toHaveBeenCalledTimes(1);
    expect(onLifecycleAction).toHaveBeenCalledWith({
      action: 'match',
      offerSheet,
      surfaceRole: 'incoming',
    });
  });

  it('emits decline lifecycle action for incoming PENDING_MATCH rows', () => {
    const onLifecycleAction = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'PENDING_MATCH' };

    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[offerSheet]}
        surfaceRole="incoming"
        onLifecycleAction={onLifecycleAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Decline$/i }));
    expect(onLifecycleAction).toHaveBeenCalledTimes(1);
    expect(onLifecycleAction).toHaveBeenCalledWith({
      action: 'decline',
      offerSheet,
      surfaceRole: 'incoming',
    });
  });

  it('emits finalizeMatched lifecycle action for incoming MATCHED rows', () => {
    const onLifecycleAction = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'MATCHED' };

    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[offerSheet]}
        surfaceRole="incoming"
        onLifecycleAction={onLifecycleAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Finalize Match/i }));
    expect(onLifecycleAction).toHaveBeenCalledTimes(1);
    expect(onLifecycleAction).toHaveBeenCalledWith({
      action: 'finalizeMatched',
      offerSheet,
      surfaceRole: 'incoming',
    });
  });

  it('emits finalizeDeclined lifecycle action for outgoing DECLINED rows', () => {
    const onLifecycleAction = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'DECLINED' };

    render(
      <OfferSheetList
        title="Outgoing"
        offerSheets={[offerSheet]}
        surfaceRole="outgoing"
        onLifecycleAction={onLifecycleAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Finalize Signing/i }));
    expect(onLifecycleAction).toHaveBeenCalledTimes(1);
    expect(onLifecycleAction).toHaveBeenCalledWith({
      action: 'finalizeDeclined',
      offerSheet,
      surfaceRole: 'outgoing',
    });
  });

  it('renders the exact outgoing MATCHED and PENDING_MATCH text branches', () => {
    render(
      <>
        <OfferSheetList
          title="Outgoing Matched"
          offerSheets={[{ ...baseOfferSheet, id: 'os_2', status: 'MATCHED' }]}
          surfaceRole="outgoing"
          onLifecycleAction={vi.fn()}
        />
        <OfferSheetList
          title="Outgoing Pending"
          offerSheets={[
            { ...baseOfferSheet, id: 'os_3', status: 'PENDING_MATCH' },
          ]}
          surfaceRole="outgoing"
          onLifecycleAction={vi.fn()}
        />
      </>
    );

    expect(screen.getByText('Matched by Home Team')).toBeInTheDocument();
    expect(screen.getByText('Waiting for home team...')).toBeInTheDocument();
  });

  it('disables world-required actions with a clear reason in vacuum mode', () => {
    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[{ ...baseOfferSheet, status: 'PENDING_MATCH' }]}
        surfaceRole="incoming"
        onLifecycleAction={vi.fn()}
        actionsDisabled
        actionsDisabledReason="Requires an active world to commit."
      />
    );

    expect(
      screen.getByText(/Requires an active world to commit\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Match$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Decline$/i })).toBeDisabled();
  });

  it('returns null for empty offer sheet arrays', () => {
    const { container } = render(
      <OfferSheetList
        title="Empty"
        offerSheets={[]}
        surfaceRole="incoming"
        onLifecycleAction={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('FreeAgencySection offer-sheet lifecycle routing', () => {
  it('routes incoming and outgoing lifecycle surfaces through the grouped world-only owner', () => {
    const matchOfferSheet = vi.fn();
    const declineOfferSheet = vi.fn();
    const finalizeOfferSheet = vi.fn();
    const incomingPendingOfferSheet = {
      ...baseOfferSheet,
      id: 'os_match',
      status: 'PENDING_MATCH',
      offeringTeamCode: 'NYK',
    };
    const incomingMatchedOfferSheet = {
      ...baseOfferSheet,
      id: 'os_finalize_match',
      status: 'MATCHED',
      offeringTeamCode: 'MIA',
    };
    const outgoingDeclinedOfferSheet = {
      ...baseOfferSheet,
      id: 'os_finalize_decline',
      status: 'DECLINED',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
    };

    render(
      <FreeAgencySection
        freeAgents={[]}
        currentYear={2026}
        actionOwner={{
          dualPathSigning: {
            signFreeAgent: vi.fn(),
          },
          worldOnly: {
            signAndTrade: vi.fn(),
            getSignAndTradePreflight: vi.fn(),
            getOfferSheetPreflight: vi.fn(),
            storeOfferSheet: vi.fn(),
            matchOfferSheet,
            declineOfferSheet,
            finalizeOfferSheet,
          },
          freeAgentModalAvailability: {
            visibleActions: ['signNew', 'signAndTrade'],
            actionLabelsOverride: {
              signNew: 'Sign Free Agent',
            },
            showOfferSheetToggle: true,
            signAndTradeInitiation: {
              onSignAndTrade: vi.fn(),
              getSignAndTradePreflight: vi.fn(),
            },
            offerSheetInitiation: {
              getOfferSheetPreflight: vi.fn(),
              storeOfferSheet: vi.fn(),
            },
          },
          offerSheetSectionAvailability: {
            lifecycleActionOwner: {
              matchOfferSheet,
              declineOfferSheet,
              finalizeOfferSheet,
            },
            actionsDisabled: false,
            actionsDisabledReason: null,
          },
        }}
        playersMap={{}}
        incomingOfferSheets={[
          incomingPendingOfferSheet,
          incomingMatchedOfferSheet,
        ]}
        outgoingOfferSheets={[outgoingDeclinedOfferSheet]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Match$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Decline$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Finalize Match/i }));
    fireEvent.click(screen.getByRole('button', { name: /Finalize Signing/i }));

    expect(matchOfferSheet).toHaveBeenCalledWith('NYK', 'os_match');
    expect(declineOfferSheet).toHaveBeenCalledWith('NYK', 'os_match');
    expect(finalizeOfferSheet).toHaveBeenCalledTimes(2);
    expect(finalizeOfferSheet).toHaveBeenNthCalledWith(
      1,
      incomingMatchedOfferSheet
    );
    expect(finalizeOfferSheet).toHaveBeenNthCalledWith(
      2,
      outgoingDeclinedOfferSheet
    );
  });

  it('uses published offer-sheet section availability for lifecycle gating instead of coarse worldOnly presence', () => {
    const matchOfferSheet = vi.fn();

    render(
      <FreeAgencySection
        freeAgents={[]}
        currentYear={2026}
        actionOwner={{
          dualPathSigning: {
            signFreeAgent: vi.fn(),
          },
          worldOnly: {
            signAndTrade: vi.fn(),
            getSignAndTradePreflight: vi.fn(),
            getOfferSheetPreflight: vi.fn(),
            storeOfferSheet: vi.fn(),
            matchOfferSheet,
            declineOfferSheet: vi.fn(),
            finalizeOfferSheet: vi.fn(),
          },
          freeAgentModalAvailability: {
            visibleActions: ['signNew', 'signAndTrade'],
            actionLabelsOverride: {
              signNew: 'Sign Free Agent',
            },
            showOfferSheetToggle: true,
            signAndTradeInitiation: {
              onSignAndTrade: vi.fn(),
              getSignAndTradePreflight: vi.fn(),
            },
            offerSheetInitiation: {
              getOfferSheetPreflight: vi.fn(),
              storeOfferSheet: vi.fn(),
            },
          },
          offerSheetSectionAvailability: {
            lifecycleActionOwner: null,
            actionsDisabled: true,
            actionsDisabledReason:
              'Offer-sheet lifecycle actions require an active world to commit.',
          },
        }}
        playersMap={{}}
        incomingOfferSheets={[
          {
            ...baseOfferSheet,
            id: 'os_disabled',
            status: 'PENDING_MATCH',
            offeringTeamCode: 'NYK',
          },
        ]}
        outgoingOfferSheets={[]}
      />
    );

    expect(
      screen.getAllByText(
        /Offer-sheet lifecycle actions require an active world to commit\./i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Match$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^Match$/i }));

    expect(matchOfferSheet).not.toHaveBeenCalled();
  });
});
