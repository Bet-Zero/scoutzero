/**
 * FILE: src/tests/architect/grouped33FileScope.ui.behavior.test.tsx
 * PURPOSE: Focused UI behavior proof for the grouped 33-file TS migration surfaces.
 * OWNERSHIP: Feature: architect/trade-machine
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ValidationWarnings } from '@/features/architect/shared/ValidationWarnings/ValidationWarnings';
import { ContractEditor } from '@/features/architect/contract/ContractEditor/ContractEditor';
import { ContractEditorModal } from '@/features/architect/contract/ContractEditorModal/ContractEditorModal';
import { RosterVisual } from '@/features/architect/shared/RosterVisual/RosterVisual';
import { LeagueView } from '@/features/architect/shared/LeagueView/LeagueView';
import { useArchitectPlayerData } from '@/features/architect/hooks/useArchitectPlayerData';

type TestRosterPlayer = Record<string, unknown> & {
  id?: string;
  name?: string;
  displayName?: string;
  contract?: {
    contractType?: string;
  };
};

type TestRosterSectionPlayer = TestRosterPlayer | null;

type TestRosterShape = {
  starters?: TestRosterSectionPlayer[];
  rotation?: TestRosterSectionPlayer[];
  bench?: TestRosterSectionPlayer[];
};

const contractUtilsMocks = vi.hoisted(() => ({
  generateContract: vi.fn(),
  createMaxContract: vi.fn(),
  generateRookieContract: vi.fn(),
  getMinimumSalary: vi.fn(),
}));

const rosterUtilsMocks = vi.hoisted(() => {
  const normalizeSection = (
    section: TestRosterSectionPlayer[] | undefined,
    size: number
  ) => {
    const safeSection = Array.isArray(section) ? section.slice(0, size) : [];
    while (safeSection.length < size) safeSection.push(null);
    return safeSection;
  };

  return {
    buildInitialRoster: vi.fn(),
    normalizePlayer: vi.fn((player: TestRosterPlayer) => ({
      ...player,
      normalized: true,
    })),
    normalizeRosterShape: vi.fn((roster: TestRosterShape = {}) => ({
      starters: normalizeSection(roster.starters, 5),
      rotation: normalizeSection(roster.rotation, 4),
      bench: normalizeSection(roster.bench, 6),
    })),
    isTwoWayContract: vi.fn(
      (player: TestRosterPlayer) =>
        String(player?.contract?.contractType || '')
          .toLowerCase()
          .trim() === 'two-way'
    ),
  };
});

const firebaseTeamPlanHelperMocks = vi.hoisted(() => ({
  loadTeamCapSheet: vi.fn(),
}));

const capTotalsMocks = vi.hoisted(() => ({
  computeTeamCapTotals: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const subscribeArchitectPlayerDataMocks = vi.hoisted(() => ({
  subscribeArchitectPlayerData: vi.fn(),
}));

vi.mock('@/features/architect/utils/contractUtils', () => ({
  generateContract: contractUtilsMocks.generateContract,
  createMaxContract: contractUtilsMocks.createMaxContract,
  generateRookieContract: contractUtilsMocks.generateRookieContract,
  getMinimumSalary: contractUtilsMocks.getMinimumSalary,
}));

vi.mock('@/shared/components/ui/Dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open?: boolean;
    children?: React.ReactNode;
  }) => (open ? <div data-testid="mock-dialog">{children}</div> : null),
  DialogContent: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
}));

vi.mock('@/features/roster/RosterSection', () => {
  const RosterSection = ({
    players,
    section,
  }: {
    players?: TestRosterSectionPlayer[];
    section?: string;
  }) => {
    const renderedPlayers = (players || []).filter(
      (player): player is TestRosterPlayer => Boolean(player)
    );

    return (
      <div data-testid={`roster-section-${section}`}>
        {section}:{renderedPlayers.length}
        <span>
          {renderedPlayers
            .map((player) => player.displayName || player.name)
            .join(',')}
        </span>
      </div>
    );
  };
  return { __esModule: true, default: RosterSection, RosterSection };
});

vi.mock('@/features/roster/utils', () => ({
  buildInitialRoster: rosterUtilsMocks.buildInitialRoster,
  normalizePlayer: rosterUtilsMocks.normalizePlayer,
  normalizeRosterShape: rosterUtilsMocks.normalizeRosterShape,
  isTwoWayContract: rosterUtilsMocks.isTwoWayContract,
}));

vi.mock('@/features/architect/utils/firebaseTeamPlanHelpers', () => ({
  loadTeamCapSheet: firebaseTeamPlanHelperMocks.loadTeamCapSheet,
}));

vi.mock('@/features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  computeTeamCapTotals: capTotalsMocks.computeTeamCapTotals,
  createCanonicalTeamTotalsSnapshot: (...args: unknown[]) => {
    const totals = capTotalsMocks.computeTeamCapTotals(...args);
    return {
      ...totals,
      teamSalary: totals?.teamSalary ?? totals?.totalCapAllocations ?? null,
      apronTeamSalary:
        totals?.apronTeamSalary ?? totals?.totalCapAllocations ?? null,
      taxSalary: totals?.taxSalary ?? totals?.totalCapAllocations ?? null,
    };
  },
}));

vi.mock('@/shared/components/TeamLogo', () => {
  const TeamLogo = ({ teamId }: { teamId?: string }) => (
    <div data-testid={`team-logo-${teamId || 'unknown'}`} />
  );
  return { __esModule: true, default: TeamLogo, TeamLogo };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );

  return {
    ...actual,
    useNavigate: () => navigationMocks.navigate,
    useParams: () => ({ teamId: 'lakers' }),
  };
});

vi.mock('@/features/architect/utils/subscribeArchitectPlayerData', () => ({
  subscribeArchitectPlayerData:
    subscribeArchitectPlayerDataMocks.subscribeArchitectPlayerData,
}));

const PLAYER = {
  id: 'p1',
  player_id: 'p1',
  name: 'Test Player',
  displayName: 'Test Player',
  yearsOfService: 4,
  draftPick: 10,
  contract: {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
      },
    ],
  },
};

describe('Grouped 33-file scope UI behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    contractUtilsMocks.generateContract.mockImplementation(
      ({
        baseSalary,
        years,
        raisePct,
      }: {
        baseSalary: number;
        years: number;
        raisePct: number;
      }) => ({
        salariesByYear: Array.from({ length: years }, (_, index) => ({
          season: `${2025 + index}-${String(26 + index).padStart(2, '0')}`,
          salary: Math.round(baseSalary * (1 + raisePct * index)),
          option: null,
        })),
        totalValue: 42_000_000,
      })
    );
    contractUtilsMocks.createMaxContract.mockReturnValue({
      salariesByYear: [{ season: '2025-26', salary: 50_000_000 }],
      totalValue: 50_000_000,
    });
    contractUtilsMocks.generateRookieContract.mockReturnValue({
      salariesByYear: [{ season: '2025-26', salary: 8_000_000 }],
      totalValue: 8_000_000,
    });
    contractUtilsMocks.getMinimumSalary.mockReturnValue(2_500_000);

    rosterUtilsMocks.buildInitialRoster.mockImplementation(
      (players: TestRosterPlayer[]) => ({
        starters: players.slice(0, 5),
        rotation: players.slice(5, 9),
        bench: players.slice(9, 15),
      })
    );

    firebaseTeamPlanHelperMocks.loadTeamCapSheet.mockResolvedValue({
      players: [],
      capHolds: [],
      deadCap: [],
    });
    capTotalsMocks.computeTeamCapTotals.mockReturnValue({
      totalCapAllocations: 123_456_789,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders ValidationWarnings with advisory warnings and hidden blocking-error count', () => {
    render(
      <ValidationWarnings
        warnings={[{ severity: 'warning', message: 'Cap warning' }]}
        errors={[{ severity: 'error', message: 'Hard cap error' }]}
        showErrors={false}
      />
    );

    expect(screen.getByText('Cap warning')).toBeInTheDocument();
    expect(screen.queryByText('Hard cap error')).not.toBeInTheDocument();
    expect(screen.getByText('1 issue will block confirmation')).toBeInTheDocument();
  });

  it('renders ContractEditor fallback copy when no player is selected', () => {
    render(
      <ContractEditor
        player={null}
        capProjections={{}}
        onSign={vi.fn()}
      />
    );

    expect(screen.getByText('No player selected.')).toBeInTheDocument();
  });

  it('renders ContractEditor custom previews and forwards the sign payload', () => {
    const onSign = vi.fn();

    render(
      <ContractEditor
        player={PLAYER}
        capProjections={{}}
        onSign={onSign}
      />
    );

    fireEvent.click(screen.getByText('Preview Contract'));
    expect(screen.getByText('Contract Preview:')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sign Player'));

    expect(onSign).toHaveBeenCalledWith(
      PLAYER,
      expect.objectContaining({
        type: 'Custom',
        totalValue: 42_000_000,
        yearsOfService: 4,
      })
    );
  });

  it('renders ContractEditorModal only when open and preserves the embedded ContractEditor surface', () => {
    const { rerender } = render(
      <ContractEditorModal
        player={PLAYER}
        isOpen={false}
        onClose={vi.fn()}
        capProjections={{}}
        onSign={vi.fn()}
        playersMap={{}}
      />
    );

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();

    rerender(
      <ContractEditorModal
        player={PLAYER}
        isOpen
        onClose={vi.fn()}
        capProjections={{}}
        onSign={vi.fn()}
        playersMap={{}}
      />
    );

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Create Contract for/i)).toHaveTextContent(
      'Create Contract for Test Player'
    );
  });

  it('renders RosterVisual with starters, rotation, and bench sections', () => {
    const teamCapSheet = {
      teamName: 'Los Angeles Lakers',
      players: Array.from({ length: 13 }, (_, index) => ({
        id: `std-${index}`,
        name: `Standard ${index}`,
        displayName: `Standard ${index}`,
        MIN: 30 - index,
        contract: {
          contractType: 'Standard',
        },
      })).concat([
        {
          id: 'tw-1',
          name: 'Two Way 1',
          displayName: 'Two Way 1',
          MIN: 0,
          contract: { contractType: 'Two-Way' },
        },
        {
          id: 'tw-2',
          name: 'Two Way 2',
          displayName: 'Two Way 2',
          MIN: 0,
          contract: { contractType: 'Two-Way' },
        },
      ]),
    };

    render(
      <RosterVisual
        teamCapSheet={teamCapSheet}
        playersMap={{}}
        teamId="LAL"
      />
    );

    expect(screen.getByText('Team Roster')).toBeInTheDocument();
    expect(screen.getByTestId('roster-section-starters')).toHaveTextContent(
      'starters:5'
    );
    expect(screen.getByTestId('roster-section-rotation')).toHaveTextContent(
      'rotation:4'
    );

    // Standard bench holds the remaining standard depth only — the 2 two-way
    // players are no longer folded in (BZE-241). The dedicated Two-Way group
    // also renders through a Bench-family RosterSection, so scope to the first
    // (standard) bench section for this assertion.
    const [standardBench] = screen.getAllByTestId('roster-section-bench');
    expect(standardBench).toHaveTextContent('bench:4');
    expect(standardBench).not.toHaveTextContent('Two Way 1');

    // Every two-way player is carded in the dedicated Two-Way group.
    const twoWayGroup = screen.getByTestId('roster-two-way-group');
    expect(twoWayGroup).toHaveTextContent('Two Way 1');
    expect(twoWayGroup).toHaveTextContent('Two Way 2');
  });

  it('renders LeagueView from SSOT team totals and routes Manage Team clicks', async () => {
    render(<LeagueView />);

    await waitFor(() => {
      expect(screen.getByText('Eastern Conference')).toBeInTheDocument();
    });

    expect(screen.getByText('Atlanta Hawks')).toBeInTheDocument();
    const hawksRow = screen.getByTestId('league-view-team-row-hawks');
    expect(hawksRow).toHaveTextContent('Team: $123,456,789');
    expect(hawksRow).toHaveTextContent('Apron: $123,456,789');
    expect(hawksRow).toHaveTextContent('Tax: $123,456,789');

    fireEvent.click(screen.getAllByText('Manage Team')[0]);
    expect(navigationMocks.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/gm\//));
  });

  it('preserves useArchitectPlayerData subscription success and error fallbacks', async () => {
    const unsubscribe = vi.fn();

    subscribeArchitectPlayerDataMocks.subscribeArchitectPlayerData.mockImplementationOnce(
      ({ onData }: { onData: (players: TestRosterPlayer[]) => void }) => {
        onData([PLAYER]);
        return unsubscribe;
      }
    );

    const { result, unmount } = renderHook(() => useArchitectPlayerData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.players).toEqual([PLAYER]);
    expect(result.current.error).toBeNull();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    subscribeArchitectPlayerDataMocks.subscribeArchitectPlayerData.mockImplementationOnce(
      ({ onError }: { onError: (error: Error) => void }) => {
        onError(new Error('subscription failed'));
        return vi.fn();
      }
    );

    const errorHook = renderHook(() => useArchitectPlayerData());

    await waitFor(() => {
      expect(errorHook.result.current.loading).toBe(false);
    });

    expect(errorHook.result.current.players).toEqual([]);
    expect(errorHook.result.current.error).toBe('subscription failed');
  });
});
