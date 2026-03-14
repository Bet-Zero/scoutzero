import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OfferSheetList from '@/features/architect/GMDashboard/components/OfferSheetList';

const baseOfferSheet = {
  id: 'os_1',
  playerName: 'Test Player',
  offeringTeamCode: 'LAL',
  homeTeamCode: 'BOS',
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
        isIncoming
        onMatch={vi.fn()}
        onDecline={vi.fn()}
        onFinalize={vi.fn()}
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

  it('calls onMatch with offeringTeamCode and id for incoming PENDING_MATCH rows', () => {
    const onMatch = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'PENDING_MATCH' };

    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[offerSheet]}
        isIncoming
        onMatch={onMatch}
        onDecline={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Match$/i }));
    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenCalledWith('LAL', 'os_1');
  });

  it('calls onDecline with offeringTeamCode and id for incoming PENDING_MATCH rows', () => {
    const onDecline = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'PENDING_MATCH' };

    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[offerSheet]}
        isIncoming
        onMatch={vi.fn()}
        onDecline={onDecline}
        onFinalize={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Decline$/i }));
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledWith('LAL', 'os_1');
  });

  it('calls onFinalize with the offerSheet object for incoming MATCHED rows', () => {
    const onFinalize = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'MATCHED' };

    render(
      <OfferSheetList
        title="Incoming"
        offerSheets={[offerSheet]}
        isIncoming
        onMatch={vi.fn()}
        onDecline={vi.fn()}
        onFinalize={onFinalize}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Finalize Match/i }));
    expect(onFinalize).toHaveBeenCalledTimes(1);
    expect(onFinalize).toHaveBeenCalledWith(offerSheet);
  });

  it('calls onFinalize with the offerSheet object for outgoing DECLINED rows', () => {
    const onFinalize = vi.fn();
    const offerSheet = { ...baseOfferSheet, status: 'DECLINED' };

    render(
      <OfferSheetList
        title="Outgoing"
        offerSheets={[offerSheet]}
        isIncoming={false}
        onFinalize={onFinalize}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Finalize Signing/i }));
    expect(onFinalize).toHaveBeenCalledTimes(1);
    expect(onFinalize).toHaveBeenCalledWith(offerSheet);
  });

  it('renders the exact outgoing MATCHED and PENDING_MATCH text branches', () => {
    render(
      <>
        <OfferSheetList
          title="Outgoing Matched"
          offerSheets={[{ ...baseOfferSheet, id: 'os_2', status: 'MATCHED' }]}
          isIncoming={false}
          onFinalize={vi.fn()}
        />
        <OfferSheetList
          title="Outgoing Pending"
          offerSheets={[
            { ...baseOfferSheet, id: 'os_3', status: 'PENDING_MATCH' },
          ]}
          isIncoming={false}
          onFinalize={vi.fn()}
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
        isIncoming
        onMatch={vi.fn()}
        onDecline={vi.fn()}
        onFinalize={vi.fn()}
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
        isIncoming
        onMatch={vi.fn()}
        onDecline={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
