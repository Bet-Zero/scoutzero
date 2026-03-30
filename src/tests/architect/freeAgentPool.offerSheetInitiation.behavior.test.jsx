// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FreeAgentPool from '@/features/architect/freeAgency/FreeAgentPool/FreeAgentPool';

vi.mock('@/features/architect/hooks/useCapValidation', () => ({
  __esModule: true,
  default: () => ({
    warnings: [],
    errors: [],
    isValid: true,
  }),
  buildSigningGuardrails: () => null,
}));

const PLAYER = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  yearsOfService: 6,
  contract: {
    salariesByYear: [
      {
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
      },
    ],
  },
  bio: {
    displayName: 'Test Player',
    position: 'SF',
  },
};

const FREE_AGENT = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  freeAgentType: 'RFA',
  previousSalary: 12_000_000,
  birdRights: 'Full Bird',
};

const playersMap = {
  [PLAYER.id]: PLAYER,
  [PLAYER.player_id]: PLAYER,
  [PLAYER.name]: PLAYER,
};

const buildWorldOnlyActionOwner = (overrides = {}) => ({
  signAndTrade: vi.fn().mockResolvedValue({ success: true }),
  getSignAndTradePreflight: vi.fn().mockResolvedValue({
    status: 'legal',
    reasons: [],
    warnings: [],
    source: 'authoritative-preflight',
  }),
  getOfferSheetPreflight: vi.fn().mockResolvedValue({
    status: 'legal',
    reasons: [],
    warnings: [],
    source: 'authoritative-preflight',
  }),
  storeOfferSheet: vi.fn().mockResolvedValue({ success: true }),
  matchOfferSheet: vi.fn(),
  declineOfferSheet: vi.fn(),
  finalizeOfferSheet: vi.fn(),
  ...overrides,
});

const buildFreeAgentModalAvailability = ({
  worldOnlyActionOwner,
  overrides = {},
} = {}) => ({
  visibleActions:
    worldOnlyActionOwner?.signAndTrade &&
    worldOnlyActionOwner?.getSignAndTradePreflight
      ? ['signNew', 'signAndTrade']
      : ['signNew'],
  actionLabelsOverride: {
    signNew: 'Sign Free Agent',
  },
  showOfferSheetToggle: Boolean(
    worldOnlyActionOwner?.storeOfferSheet &&
      worldOnlyActionOwner?.getOfferSheetPreflight
  ),
  ...overrides,
});

const buildActionOwner = ({
  dualPathSigning = {},
  worldOnly = {},
  freeAgentModalAvailability = {},
} = {}) => {
  const resolvedWorldOnlyActionOwner = worldOnly
    ? buildWorldOnlyActionOwner(worldOnly)
    : null;

  return {
    dualPathSigning: {
      signFreeAgent: vi.fn().mockResolvedValue({ success: true }),
      ...dualPathSigning,
    },
    worldOnly: resolvedWorldOnlyActionOwner,
    freeAgentModalAvailability: buildFreeAgentModalAvailability({
      worldOnlyActionOwner: resolvedWorldOnlyActionOwner,
      overrides: freeAgentModalAvailability,
    }),
  };
};

const openFreeAgencySigningModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: '•••' }));
  const signMenuButton = screen
    .getAllByRole('button', { name: /Sign Free Agent/i })
    .find((node) => node.tagName.toLowerCase() === 'button');
  if (!signMenuButton) {
    throw new Error('Sign Free Agent menu button not found');
  }
  fireEvent.click(signMenuButton);
  await screen.findByText(/Available Actions/i);
};

describe('FreeAgentPool offer-sheet initiation wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('world mode exposes offer-sheet toggle and keeps modal open on failed store until success', async () => {
    const signFreeAgent = vi.fn().mockResolvedValue({ success: true });
    const storeOfferSheet = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        message: 'Offer sheet validation failed.',
      })
      .mockResolvedValueOnce({ success: true });
    const actionOwner = buildActionOwner({
      dualPathSigning: { signFreeAgent },
      worldOnly: { storeOfferSheet },
    });

    render(
      <FreeAgentPool
        freeAgents={[FREE_AGENT]}
        currentYear={2026}
        actionOwner={actionOwner}
        playersMap={playersMap}
      />
    );

    await openFreeAgencySigningModal();

    fireEvent.click(screen.getByLabelText(/Sign Free Agent/i));
    const offerSheetToggle = screen.getByRole('checkbox', {
      name: /Offer Sheet/i,
    });
    fireEvent.click(offerSheetToggle);

    fireEvent.click(screen.getByRole('button', { name: /Confirm Action/i }));

    await waitFor(() => {
      expect(storeOfferSheet).toHaveBeenCalledTimes(1);
    });
    expect(signFreeAgent).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /offer sheet validation failed/i
    );
    expect(
      screen.getByRole('button', { name: /Confirm Action/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Action/i }));

    await waitFor(() => {
      expect(storeOfferSheet).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Confirm Action/i })
      ).not.toBeInTheDocument();
    });
  });

  it('base mode hides offer-sheet initiation and signs directly without store calls', async () => {
    const signFreeAgent = vi.fn().mockResolvedValue({ success: true });
    const storeOfferSheet = vi.fn();
    const actionOwner = buildActionOwner({
      dualPathSigning: { signFreeAgent },
      worldOnly: null,
    });

    render(
      <FreeAgentPool
        freeAgents={[FREE_AGENT]}
        currentYear={2026}
        actionOwner={actionOwner}
        playersMap={playersMap}
      />
    );

    await openFreeAgencySigningModal();

    fireEvent.click(screen.getByLabelText(/Sign Free Agent/i));
    expect(
      screen.queryByRole('checkbox', { name: /Offer Sheet/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Action/i }));

    await waitFor(() => {
      expect(signFreeAgent).toHaveBeenCalledTimes(1);
    });
    expect(storeOfferSheet).not.toHaveBeenCalled();
  });

  it('keeps the Offer Sheet toggle hidden when grouped-owner modal availability suppresses it', async () => {
    const signFreeAgent = vi.fn().mockResolvedValue({ success: true });
    const storeOfferSheet = vi.fn().mockResolvedValue({ success: true });
    const actionOwner = buildActionOwner({
      dualPathSigning: { signFreeAgent },
      worldOnly: { storeOfferSheet },
      freeAgentModalAvailability: {
        showOfferSheetToggle: false,
      },
    });

    render(
      <FreeAgentPool
        freeAgents={[FREE_AGENT]}
        currentYear={2026}
        actionOwner={actionOwner}
        playersMap={playersMap}
      />
    );

    await openFreeAgencySigningModal();

    fireEvent.click(screen.getByLabelText(/Sign Free Agent/i));
    expect(
      screen.queryByRole('checkbox', { name: /Offer Sheet/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Action/i }));

    await waitFor(() => {
      expect(signFreeAgent).toHaveBeenCalledTimes(1);
    });
    expect(storeOfferSheet).not.toHaveBeenCalled();
  });
});
