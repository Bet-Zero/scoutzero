// @vitest-environment jsdom
/**
 * FILE: src/tests/trade/tradeVerdictFirstClass.behavior.test.tsx
 * PURPOSE: Guard the BZE-247 first-class verdict behavior: team-attributed
 *          reasons and warnings render in the sticky band at the point of
 *          decision, a fully validated legal world-mode trade reaches the
 *          green "Ready to apply" state (with the apply-time disclosure),
 *          rule warnings surface before apply, and the shareable Trade
 *          Summary opens only from its own deliberate button.
 * OWNERSHIP: Test suite (Trade Machine integration)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const useTradeMachineMock = vi.fn();

vi.mock('@/features/architect/hooks/useTradeMachine', () => ({
  useTradeMachine: (...args: unknown[]) => useTradeMachineMock(...args),
}));
vi.mock('@/shared/hooks/useContainerDimensions', () => ({
  useContainerDimensions: () => ({ width: 1200, height: 700, ready: true }),
}));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
  auth: {},
  FIREBASE_TARGET_MODE: 'EMULATOR',
  isLikelyEmulatorConnectionError: () => false,
}));
vi.mock('@/features/architect/tradeMachine/TradeTeamCard', () => ({
  TradeTeamCard: () => null,
}));
vi.mock('@/features/architect/tradeMachine/TradePreviewModal', () => ({
  default: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="trade-preview-modal" /> : null,
}));
vi.mock('@/shared/components/EditContractModal', () => ({
  EditContractModal: () => null,
}));
vi.mock('@/features/architect/admin/PickRightWizardModal', () => ({
  PickRightWizardModal: () => null,
}));

import { TradeEditor } from '@/features/architect/tradeMachine/TradeEditor';
import { buildVerdictItems } from '@/features/architect/tradeMachine/verdictSummary';

function buildHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    teams: [
      {
        team: { id: 'LAL', players: [] },
        sends: [{ id: 'p1', name: 'Player One', tradeTo: 'BOS' }],
        entitlementsOut: [],
      },
      { team: { id: 'BOS', players: [] }, sends: [], entitlementsOut: [] },
    ],
    previewAuthority: null,
    snapshotValidationDetails: null,
    forceTrade: false,
    previewOpen: false,
    setPreviewOpen: vi.fn(),
    setForceTrade: vi.fn(),
    setPlayerTrade: vi.fn(),
    toggleEntitlement: vi.fn(),
    setEntitlementDestination: vi.fn(),
    selectTeam: vi.fn(),
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    handleValidate: vi.fn(),
    exportCurrentTrade: vi.fn(() => []),
    undoPlayerTrade: vi.fn(),
    resetTrade: vi.fn(),
    yearKey: 2025,
    incomingAssets: [
      { players: [], entitlements: [] },
      { players: [], entitlements: [] },
    ],
    salaryOut: [0, 0],
    activeTeamCount: 2,
    applyEntitlementOverrideUpdate: vi.fn(),
    refreshEntitlements: vi.fn(),
    isValidating: false,
    currentDraftKey: 'k',
    hasCurrentValidation: false,
    validatedAt: null,
    hasInjectedDevSntPlayers: false,
    injectDevSntPlayers: vi.fn(),
    clearInjectedDevSntPlayers: vi.fn(),
    getValidatedAt: () => null,
    initError: null,
    ...overrides,
  };
}

const baseProps = {
  primaryTeam: 'LAL',
  capProjections: {},
  currentYear: 2025,
  playersMap: {},
  onApplyTrade: vi.fn(),
  primaryTeamData: { id: 'LAL' } as never,
  worldId: null,
};

const blockedAuthority = {
  legal: false,
  reason: 'Second apron team cannot receive more salary than sent',
  violations: [
    { message: 'Second apron team cannot receive more salary than sent' },
  ],
  omittedStages: [],
};

const blockedDetails = {
  teamResults: [
    {
      teamName: 'Miami Heat',
      rules: {
        salaryMatching: {
          passed: false,
          violations: [
            {
              message:
                'Second apron team cannot receive more salary than sent',
            },
          ],
        },
      },
    },
  ],
  dataWarnings: [],
  hasDataIssues: false,
};

afterEach(cleanup);

describe('buildVerdictItems — team-attributed verdict flattening', () => {
  it('maps failed rules to team-attributed violations with rule labels', () => {
    const items = buildVerdictItems(blockedDetails.teamResults, blockedAuthority);
    expect(items).toEqual([
      {
        teamName: 'Miami Heat',
        kind: 'violation',
        text: 'Salary Matching: Second apron team cannot receive more salary than sent',
      },
    ]);
  });

  it('orders violations before warnings and keeps trade-wide authority warnings', () => {
    const items = buildVerdictItems(
      [
        {
          teamName: 'Boston Celtics',
          rules: {
            timingEnforcement: {
              passed: true,
              warnings: [{ message: 'July moratorium is in effect' }],
            },
            hardCap: { passed: false, message: 'Hard cap exceeded' },
          },
        },
      ],
      {
        legal: true,
        warnings: [
          { message: 'Trade-wide caution' },
          // Repeats the team-attributed timing warning → dropped, the
          // attributed rows already carry it.
          { message: 'July moratorium is in effect' },
        ],
      }
    );
    expect(items.map((item) => item.kind)).toEqual([
      'violation',
      'warning',
      'warning',
    ]);
    expect(items[0].text).toBe('Hard Cap: Hard cap exceeded');
    expect(items[1]).toEqual({
      teamName: 'Boston Celtics',
      kind: 'warning',
      text: 'Timing Restrictions: July moratorium is in effect',
    });
    expect(items[2]).toEqual({
      teamName: null,
      kind: 'warning',
      text: 'Trade-wide caution',
    });
  });

  it('dedupes identical team/kind/text entries', () => {
    const items = buildVerdictItems(
      [
        {
          teamName: 'Miami Heat',
          rules: {
            hardCap: { passed: false, message: 'Hard cap exceeded' },
            secondApronEnforcement: {
              passed: true,
              warnings: [
                { message: 'Near the apron' },
                { message: 'Near the apron' },
              ],
            },
          },
        },
      ],
      null
    );
    expect(items).toHaveLength(2);
  });
});

describe('TradeEditor — verdict at the point of decision (BZE-247)', () => {
  it('shows Needs input and blocks Apply for an unevaluated first-round rule', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        hasCurrentValidation: true,
        previewAuthority: {
          legal: false,
          reason:
            'Needs input — Stepien and complete draft-history records are unavailable for this first-round asset.',
          violations: [
            {
              message:
                'Needs input — Stepien and complete draft-history records are unavailable for this first-round asset.',
            },
          ],
          omittedStages: [],
        },
        snapshotValidationDetails: {
          teamResults: [
            {
              teamName: 'Los Angeles Lakers',
              rules: {
                stepienRule: {
                  passed: false,
                  status: 'NEEDS_INPUT',
                  evaluated: false,
                  message:
                    'Needs input — Stepien and complete draft-history records are unavailable for this first-round asset.',
                  violations: [
                    {
                      message:
                        'Needs input — Stepien and complete draft-history records are unavailable for this first-round asset.',
                    },
                  ],
                },
              },
            },
          ],
          dataWarnings: [],
          hasDataIssues: false,
        },
      })
    );

    render(<TradeEditor {...baseProps} worldId="world-1" />);

    expect(screen.getByTestId('trade-readiness-summary')).toHaveTextContent(
      'Needs input'
    );
    expect(screen.getByTestId('trade-verdict-strip')).toHaveTextContent(
      'Stepien Rule: Needs input'
    );
    expect(screen.getByRole('button', { name: /^Apply Trade$/i })).toBeDisabled();
    expect(screen.getByTestId('trade-summary-button')).toBeDisabled();
  });

  it('renders team-attributed blocked reasons in the sticky verdict strip', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        hasCurrentValidation: true,
        previewAuthority: blockedAuthority,
        snapshotValidationDetails: blockedDetails,
      })
    );

    render(<TradeEditor {...baseProps} />);

    expect(screen.getByTestId('trade-readiness-summary')).toHaveTextContent(
      'Trade blocked'
    );
    const strip = screen.getByTestId('trade-verdict-strip');
    expect(strip).toHaveTextContent('Miami Heat');
    expect(strip).toHaveTextContent(
      'Salary Matching: Second apron team cannot receive more salary than sent'
    );
  });

  it('reaches the green Ready to apply state in world mode with the apply-time disclosure', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        hasCurrentValidation: true,
        previewAuthority: {
          legal: true,
          reason: 'Preview authority passed',
          violations: [],
          omittedStages: ['worldState'],
        },
        snapshotValidationDetails: {
          teamResults: [],
          dataWarnings: [],
          hasDataIssues: false,
        },
      })
    );

    render(<TradeEditor {...baseProps} worldId="world-1" />);

    const summary = screen.getByTestId('trade-readiness-summary');
    expect(summary).toHaveTextContent('Ready to apply');
    expect(summary).toHaveTextContent(
      'the Team Plan runs duplicate-player, pick-conflict, and exclusivity checks at apply time'
    );
    expect(screen.queryByTestId('trade-verdict-strip')).not.toBeInTheDocument();
  });

  it('surfaces rule warnings on an allowed trade before apply', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        hasCurrentValidation: true,
        previewAuthority: {
          legal: true,
          reason: 'Preview authority passed',
          violations: [],
          omittedStages: ['worldState'],
        },
        snapshotValidationDetails: {
          teamResults: [
            {
              teamName: 'Los Angeles Lakers',
              rules: {
                timingEnforcement: {
                  passed: true,
                  warnings: [{ message: 'July moratorium is in effect' }],
                },
              },
            },
          ],
          dataWarnings: [],
          hasDataIssues: false,
        },
      })
    );

    render(<TradeEditor {...baseProps} worldId="world-1" />);

    const summary = screen.getByTestId('trade-readiness-summary');
    expect(summary).toHaveTextContent('Ready with warnings');
    const strip = screen.getByTestId('trade-verdict-strip');
    expect(strip).toHaveTextContent('Los Angeles Lakers');
    expect(strip).toHaveTextContent(
      'Timing Restrictions: July moratorium is in effect'
    );
  });

  it('opens the Trade Summary only from its own button, never from Validate', () => {
    const handleValidate = vi.fn(() => 'started');
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        handleValidate,
        hasCurrentValidation: true,
        previewAuthority: {
          legal: true,
          reason: 'Preview authority passed',
          violations: [],
          omittedStages: [],
        },
        snapshotValidationDetails: {
          teamResults: [],
          dataWarnings: [],
          hasDataIssues: false,
        },
      })
    );

    render(<TradeEditor {...baseProps} worldId="world-1" />);

    fireEvent.click(screen.getByRole('button', { name: /^Validate Trade$/i }));
    expect(handleValidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('trade-preview-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('trade-summary-button'));
    expect(screen.getByTestId('trade-preview-modal')).toBeInTheDocument();
  });

  it('keeps the Trade Summary button disabled until the trade is validated legal', () => {
    useTradeMachineMock.mockReturnValue(buildHookReturn({}));

    render(<TradeEditor {...baseProps} />);

    expect(screen.getByTestId('trade-summary-button')).toBeDisabled();
  });
});
