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
import { FreeAgentPool } from '@/features/architect/freeAgency/FreeAgentPool/FreeAgentPool';
import type {
  FreeAgentOfferSheetInitiation,
  FreeAgentModalVisibleAction,
  FreeAgentSignAndTradeInitiation,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';

vi.mock('@/features/architect/hooks/useCapValidation', () => {
  const useCapValidation = () => ({
    warnings: [],
    errors: [],
    isValid: true,
  });
  return {
    __esModule: true,
    default: useCapValidation,
    useCapValidation,
    buildSigningGuardrails: () => null,
  };
});

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

const buildWorldOnlyActionOwner = (
  overrides: Partial<Record<string, unknown>> = {}
) => ({
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
}: {
  worldOnlyActionOwner: ReturnType<typeof buildWorldOnlyActionOwner> | null;
  overrides?: Partial<{
    visibleActions: FreeAgentModalVisibleAction[];
    actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
    showOfferSheetToggle: boolean;
    signAndTradeInitiation: FreeAgentSignAndTradeInitiation | null;
    offerSheetInitiation: FreeAgentOfferSheetInitiation | null;
  }>;
}): {
  visibleActions: FreeAgentModalVisibleAction[];
  actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
  showOfferSheetToggle: boolean;
  signAndTradeInitiation: FreeAgentSignAndTradeInitiation | null;
  offerSheetInitiation: FreeAgentOfferSheetInitiation | null;
} => {
  const signAndTradeInitiation =
    worldOnlyActionOwner?.signAndTrade &&
    worldOnlyActionOwner?.getSignAndTradePreflight
      ? {
          onSignAndTrade: worldOnlyActionOwner.signAndTrade,
          getSignAndTradePreflight: worldOnlyActionOwner.getSignAndTradePreflight,
        }
      : null;
  const offerSheetInitiation =
    worldOnlyActionOwner?.storeOfferSheet &&
    worldOnlyActionOwner?.getOfferSheetPreflight
      ? {
          getOfferSheetPreflight: worldOnlyActionOwner.getOfferSheetPreflight,
          storeOfferSheet: worldOnlyActionOwner.storeOfferSheet,
        }
      : null;

  return {
    visibleActions: ['signNew'],
    actionLabelsOverride: {
      signNew: 'Sign Free Agent',
    },
    showOfferSheetToggle: false,
    signAndTradeInitiation: null,
    offerSheetInitiation: null,
    ...overrides,
  };
};

const buildActionOwner = ({
  dualPathSigning,
  worldOnly = {},
  freeAgentModalAvailability,
}: {
  dualPathSigning?: Partial<Record<string, unknown>>;
  worldOnly?: Partial<Record<string, unknown>> | null;
  freeAgentModalAvailability?: Partial<{
    visibleActions: FreeAgentModalVisibleAction[];
    actionLabelsOverride: Partial<Record<FreeAgentModalVisibleAction, string>>;
    showOfferSheetToggle: boolean;
    signAndTradeInitiation: FreeAgentSignAndTradeInitiation | null;
    offerSheetInitiation: FreeAgentOfferSheetInitiation | null;
  }>;
} = {}): React.ComponentProps<typeof FreeAgentPool>['actionOwner'] => {
  const resolvedWorldOnlyActionOwner = worldOnly
    ? buildWorldOnlyActionOwner(worldOnly)
    : null;

  return {
    dualPathSigning: {
      signFreeAgent: vi.fn().mockResolvedValue({ success: true }),
      ...dualPathSigning,
    },
    freeAgentModalAvailability: buildFreeAgentModalAvailability({
      worldOnlyActionOwner: resolvedWorldOnlyActionOwner,
      overrides: freeAgentModalAvailability,
    }),
  };
};

const openFreeAgencySigningModalFromRowMenu = async () => {
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

const openFreeAgencySigningModalFromSelectedCard = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Test Player/i }));
  fireEvent.click(screen.getByRole('button', { name: /Sign Player/i }));
  await screen.findByText(/Available Actions/i);
};

const closeSigningModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  await waitFor(() => {
    expect(screen.queryByText(/Available Actions/i)).not.toBeInTheDocument();
  });
};

const expectV1SigningOnlyActions = () => {
  expect(screen.getByLabelText(/Sign Free Agent/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/Sign & Trade/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText(/Sign Free Agent/i));

  expect(
    screen.queryByRole('checkbox', { name: /Offer Sheet/i })
  ).not.toBeInTheDocument();
};

const expectOfferSheetSuppressedByOwnerProjection = () => {
  expect(screen.getByLabelText(/Sign Free Agent/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/Sign & Trade/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText(/Sign Free Agent/i));

  expect(
    screen.queryByRole('checkbox', { name: /Offer Sheet/i })
  ).not.toBeInTheDocument();
};

describe('FreeAgentPool offer-sheet initiation wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('explicitly exposed offer-sheet toggle keeps modal open on failed store until success', async () => {
    const signFreeAgent = vi.fn().mockResolvedValue({ success: true });
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });
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
      freeAgentModalAvailability: {
        showOfferSheetToggle: true,
        offerSheetInitiation: {
          getOfferSheetPreflight,
          storeOfferSheet,
        },
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

    await openFreeAgencySigningModalFromRowMenu();

    fireEvent.click(screen.getByLabelText(/Sign Free Agent/i));
    const offerSheetToggle = screen.getByRole('checkbox', {
      name: /Offer Sheet/i,
    });
    fireEvent.click(offerSheetToggle);

    const confirmButton = screen.getByTestId(
      'edit-contract-confirm-action-button'
    );
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
      expect(confirmButton).toHaveTextContent(/Confirm Action/i);
    });

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(storeOfferSheet).toHaveBeenCalledTimes(1);
    });
    expect(signFreeAgent).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /offer sheet validation failed/i
    );
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
      expect(confirmButton).toHaveTextContent(/Confirm Action/i);
    });

    fireEvent.click(confirmButton);

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

    await openFreeAgencySigningModalFromRowMenu();

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
        offerSheetInitiation: null,
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

    await openFreeAgencySigningModalFromRowMenu();

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

  it('keeps V1 signing-only modal visibility aligned across row-menu and selected-card launch surfaces', async () => {
    const actionOwner = buildActionOwner();

    render(
      <FreeAgentPool
        freeAgents={[FREE_AGENT]}
        currentYear={2026}
        actionOwner={actionOwner}
        playersMap={playersMap}
      />
    );

    await openFreeAgencySigningModalFromSelectedCard();
    expectV1SigningOnlyActions();
    await closeSigningModal();

    await openFreeAgencySigningModalFromRowMenu();
    expectV1SigningOnlyActions();
  });

  it('keeps real modal Offer Sheet suppression aligned across row-menu and selected-card launch surfaces when grouped-owner availability hides it', async () => {
    const actionOwner = buildActionOwner({
      freeAgentModalAvailability: {
        showOfferSheetToggle: false,
        offerSheetInitiation: null,
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

    await openFreeAgencySigningModalFromSelectedCard();
    expectOfferSheetSuppressedByOwnerProjection();
    await closeSigningModal();

    await openFreeAgencySigningModalFromRowMenu();
    expectOfferSheetSuppressedByOwnerProjection();
  });
});
