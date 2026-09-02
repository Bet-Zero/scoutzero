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
import { TradeSummaryPanel } from '@/features/architect/tradeMachine/TradeSummaryPanel';
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
              message: 'Second apron team cannot receive more salary than sent',
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
    const items = buildVerdictItems(
      blockedDetails.teamResults,
      blockedAuthority
    );
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

  it('keeps an empty-team top-level Needs input reason as a trade-wide verdict', () => {
    const reason =
      'austin_reaves: This Contract has a trade bonus whose allocation is outside this governed tranche.';
    const items = buildVerdictItems(
      [],
      {
        legal: false,
        error: 'TRADE_SALARY_BASIS_AUTHORITY_ERROR',
        reason,
        violations: [
          {
            message: reason,
            rule: 'governedTradeSalaryBasis',
          },
        ],
        warnings: [],
      },
      {
        resolvePlayerName: (playerId) =>
          playerId === 'austin_reaves' ? 'Austin Reaves' : null,
      }
    );

    expect(items).toEqual([
      {
        teamName: null,
        kind: 'needsInput',
        text: 'Austin Reaves: Available contract information is insufficient to determine the trade-bonus allocation.',
      },
    ]);
  });

  it('presents accumulated bonus-compensation and trade-kicker reasons without internal wording', () => {
    const reason =
      'austin_reaves: 2026-27 has bonus compensation whose trade treatment is outside this governed tranche. This Contract has a trade bonus whose allocation is outside this governed tranche. Post-season salary basis requires governed 2027-28 terms.';
    const items = buildVerdictItems(
      [],
      {
        legal: false,
        error: 'TRADE_SALARY_BASIS_AUTHORITY_ERROR',
        reason,
        violations: [
          {
            message: reason,
            rule: 'governedTradeSalaryBasis',
          },
        ],
        warnings: [],
      },
      {
        resolvePlayerName: (playerId) =>
          playerId === 'austin_reaves' ? 'Austin Reaves' : null,
      }
    );

    expect(items).toEqual([
      {
        teamName: null,
        kind: 'needsInput',
        text: 'Austin Reaves: Available contract information is insufficient to determine the trade-bonus allocation.',
      },
    ]);
    expect(JSON.stringify(items)).not.toContain('austin_reaves');
    expect(JSON.stringify(items)).not.toContain('governed tranche');
    expect(JSON.stringify(items)).not.toContain('Post-season salary basis');
  });

  it('keeps an empty-team generic top-level rejection visibly blocked', () => {
    const items = buildVerdictItems([], {
      legal: false,
      error: 'ENTITLEMENT_ROUTING_ERROR',
      reason: 'Entitlement routing is incomplete.',
      violations: [{ message: 'Entitlement routing is incomplete.' }],
      warnings: [],
    });

    expect(items).toEqual([
      {
        teamName: null,
        kind: 'violation',
        text: 'Entitlement routing is incomplete.',
      },
    ]);
  });

  it('classifies mixed top-level issues independently', () => {
    const items = buildVerdictItems([], {
      legal: false,
      error: 'VALIDATION_BLOCKED',
      reason: 'Trade is blocked.',
      violations: [
        {
          message: 'Missing governed salary record.',
          rule: 'governedTradeSalaryBasis',
          meta: { status: 'NEEDS_INPUT' },
        },
        { message: 'Hard cap exceeded.', rule: 'hardCap' },
      ],
      warnings: [],
    });

    expect(items).toEqual([
      {
        teamName: null,
        kind: 'needsInput',
        text: 'Missing governed salary record.',
      },
      { teamName: null, kind: 'violation', text: 'Hard cap exceeded.' },
    ]);
  });

  it('renders a reason-only top-level fallback in the validation summary', () => {
    render(
      <TradeSummaryPanel
        previewAuthority={{
          legal: false,
          error: 'NEEDS_INPUT',
          reason: 'Missing governed draft record.',
          violations: [],
          warnings: [],
        }}
        snapshotValidationDetails={{ teamResults: [] }}
      />
    );

    expect(screen.getByText('⚪ Needs input — trade not ready')).toBeVisible();
    expect(screen.getByText('Missing governed draft record.')).toBeVisible();
  });

  it('resolves a staged player name from bio.displayName in the summary', () => {
    render(
      <TradeSummaryPanel
        teams={[
          {
            team: { id: 'LAL' },
            sends: [
              {
                id: 'player_bio_only',
                name: 'player_bio_only',
                bio: { displayName: 'Bio Display Player' },
              } as never,
            ],
          },
        ]}
        previewAuthority={{
          legal: false,
          error: 'NEEDS_INPUT',
          reason:
            'player_bio_only: This Contract has a trade bonus whose allocation is outside this governed tranche.',
          violations: [],
          warnings: [],
        }}
        snapshotValidationDetails={{ teamResults: [] }}
      />
    );

    expect(
      screen.getByText(
        'Bio Display Player: Available contract information is insufficient to determine the trade-bonus allocation.'
      )
    ).toBeVisible();
    expect(document.body.textContent).not.toContain('player_bio_only');
  });
});

describe('TradeEditor — verdict at the point of decision (BZE-247)', () => {
  it('continues past an ID-valued display name to a friendly staged-player name', () => {
    const reason =
      'player_1: This Contract has a trade bonus whose allocation is outside this governed tranche.';
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        teams: [
          {
            team: { id: 'LAL', players: [] },
            sends: [
              {
                id: 'player_1',
                displayName: 'player_1',
                fullName: 'Austin Reaves',
                tradeTo: 'BOS',
              },
            ],
            entitlementsOut: [],
          },
          { team: { id: 'BOS', players: [] }, sends: [], entitlementsOut: [] },
        ],
        hasCurrentValidation: true,
        previewAuthority: {
          legal: false,
          error: 'TRADE_SALARY_BASIS_AUTHORITY_ERROR',
          reason,
          violations: [{ message: reason, rule: 'governedTradeSalaryBasis' }],
          warnings: [],
          omittedStages: [],
        },
        snapshotValidationDetails: { teamResults: [] },
      })
    );

    render(<TradeEditor {...baseProps} worldId="world-1" />);

    const readiness = screen.getByTestId('trade-readiness-summary');
    expect(readiness).toHaveTextContent('Austin Reaves');
    expect(readiness).not.toHaveTextContent('player_1');
  });

  it('shows the current top-level trade-bonus Needs input authority with no per-Team results', () => {
    const reason =
      'austin_reaves: This Contract has a trade bonus whose allocation is outside this governed tranche.';
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        teams: [
          {
            team: { id: 'LAL', players: [] },
            sends: [
              { id: 'austin_reaves', name: 'Austin Reaves', tradeTo: 'BOS' },
            ],
            entitlementsOut: [],
          },
          { team: { id: 'BOS', players: [] }, sends: [], entitlementsOut: [] },
        ],
        hasCurrentValidation: true,
        getValidatedAt: () => 1_787_961_600_000,
        previewAuthority: {
          legal: false,
          error: 'TRADE_SALARY_BASIS_AUTHORITY_ERROR',
          reason,
          violations: [
            {
              message: reason,
              rule: 'governedTradeSalaryBasis',
              code: 'GOVERNED_TRADE_SALARY_BASIS',
            },
          ],
          warnings: [],
          source: 'apply-preview',
          omittedStages: [],
        },
        snapshotValidationDetails: {
          teamResults: [],
          summaryByTeamIndex: [],
          dataWarnings: [],
          hasDataIssues: false,
        },
      })
    );

    render(<TradeEditor {...baseProps} worldId="world-1" />);

    const readiness = screen.getByTestId('trade-readiness-summary');
    expect(readiness).toHaveTextContent('Needs input');
    expect(readiness).toHaveTextContent('Austin Reaves');
    expect(readiness).toHaveTextContent('insufficient');
    expect(readiness).not.toHaveTextContent('austin_reaves');
    expect(readiness).not.toHaveTextContent('governed tranche');
    expect(readiness).toHaveTextContent('Validation:');
    expect(readiness).toHaveTextContent('Last checked');
    expect(readiness).not.toHaveTextContent('Not validated');
    expect(screen.queryByTestId('trade-verdict-strip')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeDisabled();
    expect(screen.getByTestId('trade-summary-button')).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: /^Validation Results/i })
    );
    const summary = screen.getByTestId('section-validation-summary');
    expect(summary).toHaveTextContent('Needs input — trade not ready');
    expect(summary).toHaveTextContent('Why it needs input');
    expect(summary).toHaveTextContent('Austin Reaves');
    expect(summary).toHaveTextContent('insufficient');
    expect(summary).not.toHaveTextContent('austin_reaves');
    expect(summary).not.toHaveTextContent('governed tranche');
  });

  it('keeps incomplete top-level payloads in the Not validated state', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        hasCurrentValidation: false,
        previewAuthority: {
          legal: false,
          reason: 'Incomplete preview authority',
        },
        snapshotValidationDetails: { teamResults: [] },
      })
    );

    render(<TradeEditor {...baseProps} />);

    const readiness = screen.getByTestId('trade-readiness-summary');
    expect(readiness).toHaveTextContent('Ready to validate');
    expect(readiness).toHaveTextContent('Not validated');
    expect(readiness).not.toHaveTextContent('Incomplete preview authority');
    expect(screen.queryByTestId('trade-verdict-strip')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeDisabled();
  });

  it('shows Needs input and blocks Apply for an unevaluated first-round rule', () => {
    useTradeMachineMock.mockReturnValue(
      buildHookReturn({
        hasCurrentValidation: true,
        previewAuthority: {
          legal: false,
          reason:
            'Needs input — Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable for this first-round asset.',
          violations: [
            {
              message:
                'Needs input — Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable for this first-round asset.',
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
                    'Needs input — Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable for this first-round asset.',
                  violations: [
                    {
                      message:
                        'Needs input — Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable for this first-round asset.',
                    },
                  ],
                },
              },
            },
            {
              teamName: 'Boston Celtics',
              rules: {
                stepienRule: {
                  passed: false,
                  status: 'NEEDS_INPUT',
                  evaluated: false,
                  message:
                    'Needs input — Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable for this first-round asset.',
                  violations: [
                    {
                      message:
                        'Needs input — Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable for this first-round asset.',
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
    expect(screen.getByTestId('trade-readiness-summary')).toHaveTextContent(
      'Stepien eligibility cannot be confirmed'
    );
    const strip = screen.getByTestId('trade-verdict-strip');
    expect(strip).toHaveTextContent('Los Angeles Lakers');
    expect(strip).toHaveTextContent('Boston Celtics');
    expect(strip).toHaveTextContent('Stepien eligibility cannot be confirmed');
    expect(
      screen.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeDisabled();
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
      'Final roster and draft-asset checks run when you apply it to the active Team Plan'
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

describe('TradeSummaryPanel — unevaluated authority presentation', () => {
  it('labels a team Needs input without presenting an affirmative rejection verdict', () => {
    render(
      <TradeSummaryPanel
        previewAuthority={{
          legal: false,
          violations: [
            'Needs input — Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable for this first-round asset.',
          ],
        }}
        snapshotValidationDetails={{
          summaryByTeamIndex: [
            { teamId: 'LAL', teamName: 'Los Angeles Lakers' },
          ],
          teamResults: [
            {
              teamId: 'LAL',
              teamName: 'Los Angeles Lakers',
              legal: false,
              rules: {
                stepienRule: {
                  passed: false,
                  status: 'NEEDS_INPUT',
                  evaluated: false,
                },
              },
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Why it needs input')).toBeInTheDocument();
    expect(screen.getByText('⚪ Needs input')).toBeInTheDocument();
    expect(screen.queryByText('❌ Rejected')).not.toBeInTheDocument();
  });
});
