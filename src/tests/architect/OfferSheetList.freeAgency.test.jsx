import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('OfferSheetList Free Agency wiring', () => {
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
});
