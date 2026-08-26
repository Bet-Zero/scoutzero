// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GovernedWaiverLifecycle } from '@/schemas/governedWaiver';
import { useTradeMachineInit } from '@/features/architect/hooks/useTradeMachineInit';
import { useTradeMachineTeamOps } from '@/features/architect/hooks/useTradeMachineTeamOps';
import { useTradeMachineValidation } from '@/features/architect/hooks/useTradeMachineValidation';
import { resolveTradeSalaryBasisTeamId } from '@/features/architect/hooks/useTradeMachine.helpers';
import type {
  TradeMachineTeam,
  TradeMachineTeamSlot,
} from '@/features/architect/hooks/useTradeMachine.types';
import { useTradeTeamCardSalaries } from '@/features/architect/tradeMachine/useTradeTeamCardSalaries';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';

const harness = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  resolveEntitlementsForTeam: vi.fn(),
  buildTradeApplyPreparation: vi.fn(),
  getTradePreviewAuthority: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: harness.loadWorldTeamData,
}));

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: harness.resolveEntitlementsForTeam,
}));

vi.mock('@/features/architect/utils/tradeContext/tradeContext', () => ({
  buildTradeApplyPreparation: harness.buildTradeApplyPreparation,
  getTradePreviewAuthority: harness.getTradePreviewAuthority,
}));

const BEFORE_EXPIRY = '2026-07-01T11:59:59.999-04:00';
const EXACT_EXPIRY = '2026-07-01T12:00:00.000-04:00';
const PENDING_TEAM_SALARY = 10_000_000;
const TERMINATED_TEAM_SALARY = 6_000_000;

function buildBuyoutLifecycle(teamCode: string): GovernedWaiverLifecycle {
  const allocation = {
    season: '2026-27',
    protectedBaseCompensation: PENDING_TEAM_SALARY,
    buyoutReduction: 4_000_000,
    playerPayment: TERMINATED_TEAM_SALARY,
    teamSalary: TERMINATED_TEAM_SALARY,
    setOffReduction: null,
    isTeamSalaryStretched: false,
  };
  const event = (
    eventVersion: number,
    eventKind: GovernedWaiverLifecycle['events'][number]['eventKind'],
    effectiveAt: string,
    predecessorEventId: string | null
  ) => ({
    eventId: `${teamCode}-waiver-event-${eventVersion}`,
    eventVersion,
    eventKind,
    effectiveAt,
    recordedAt: '2026-06-29T12:01:00-04:00',
    predecessorEventId,
    authoringIdentity: 'test-user',
    canonLeafIds: ['CBA2-R01.1'],
  });

  return {
    lifecycleVersion: 1,
    lifecycleId: `${teamCode}-waiver-lifecycle`,
    worldId: 'world-date-forwarding',
    teamId: teamCode,
    playerId: `${teamCode}-waived-player`,
    playerName: `${teamCode} Waived Player`,
    contractId: `${teamCode}-waived-contract`,
    path: 'buyout',
    leagueReceivedAt: '2026-06-29T12:00:00-04:00',
    expiresAt: EXACT_EXPIRY,
    terminationAt: EXACT_EXPIRY,
    requestIrrevocable: true,
    outcome: 'ordinary-unclaimed',
    events: [
      event(1, 'waiver-request', '2026-06-29T12:00:00-04:00', null),
      event(
        2,
        'buyout-agreement',
        '2026-06-29T12:00:00-04:00',
        `${teamCode}-waiver-event-1`
      ),
      event(3, 'waiver-expiry', EXACT_EXPIRY, `${teamCode}-waiver-event-2`),
      event(
        4,
        'contract-termination',
        EXACT_EXPIRY,
        `${teamCode}-waiver-event-3`
      ),
      event(5, 'set-off-authority', EXACT_EXPIRY, `${teamCode}-waiver-event-4`),
    ],
    originalContractSeasons: ['2026-27'],
    protectedBaseCompensation: PENDING_TEAM_SALARY,
    buyoutReduction: 4_000_000,
    buyoutAgreementAt: '2026-06-29T12:00:00-04:00',
    playerSignatureRecorded: true,
    teamSignatureRecorded: true,
    stretchElectionAt: null,
    stretchBranch: null,
    stretchYears: null,
    salaryCapAtElection: null,
    formerPlayerCeilingAtElection: null,
    allocationsBeforeStretch: [allocation],
    allocations: [allocation],
    paymentAllocations: [allocation],
    setOffStatus: 'needs-authenticated-earnings',
    setOffFormula: 'Authenticated earnings required.',
    setOffApplication: null,
    originalContractEndsAt: '2027-06-30T23:59:59-04:00',
    reacquisitionRestrictedUntil: '2027-06-29T12:00:00-04:00',
    contractAuthority: {
      ledgerId: `${teamCode}-contract-ledger`,
      ledgerVersion: 1,
      stateDigest: 'fnv1a64:0123456789abcdef',
    },
    canonLeafIds: ['CBA2-R01.1'],
  };
}

function buildGovernedTeam(teamCode: 'LAL' | 'BOS'): TradeMachineTeam {
  return withGovernedSalaryBooks(
    {
      id: teamCode,
      teamCode,
      teamName: teamCode === 'LAL' ? 'Los Angeles Lakers' : 'Boston Celtics',
      abbreviation: teamCode,
      players: Array.from({ length: 15 }, (_, index) => ({
        id: `${teamCode}-player-${index}`,
        player_id: `${teamCode}-player-${index}`,
        name: `${teamCode} Player ${index}`,
        contract: {
          contractType: 'STANDARD',
          salariesByYear: [
            {
              season: '2026-27',
              salary: 0,
              capHit: 0,
              guaranteed: true,
            },
          ],
        },
      })),
      capHolds: [],
      deadCap: [
        {
          playerId: `${teamCode}-waived-player`,
          playerName: `${teamCode} Waived Player`,
          originalSalary: PENDING_TEAM_SALARY,
          amountByYear: [{ season: '2026-27', amount: 1 }],
          waiveDate: '2026-06-29T12:00:00-04:00',
          governedLifecycle: buildBuyoutLifecycle(teamCode),
        },
      ],
      entitlementIds: [],
      entitlements: [],
      totals: {},
    },
    {
      salaryCapYear: 2027,
      asOfDate: BEFORE_EXPIRY,
      teamSalary: PENDING_TEAM_SALARY,
    }
  ) as TradeMachineTeam;
}

const emptySlots = (): TradeMachineTeamSlot[] => [
  { team: null, sends: [], entitlementsOut: [] },
  { team: null, sends: [], entitlementsOut: [] },
];

describe('BZE-284 governed Trade Machine date forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.loadWorldTeamData.mockImplementation(
      async (_worldId: string | null, teamCode: string) =>
        buildGovernedTeam(teamCode === 'BOS' ? 'BOS' : 'LAL')
    );
    harness.resolveEntitlementsForTeam.mockResolvedValue([]);
    harness.buildTradeApplyPreparation.mockReturnValue({
      validatedContext: { teamResults: [], _rawValidation: {} },
    });
    harness.getTradePreviewAuthority.mockReturnValue({ legal: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('binds saved-world salary authority to the canonical Team code', () => {
    expect(
      resolveTradeSalaryBasisTeamId(
        { id: 'heat', code: 'MIA' },
        { id: 'heat', teamCode: 'MIA' }
      )
    ).toBe('MIA');
    expect(
      resolveTradeSalaryBasisTeamId(
        { id: 'nuggets', code: 'DEN' },
        { id: 'nuggets', teamCode: 'DEN' }
      )
    ).toBe('DEN');
  });

  it('reinitializes mounted Trade Machine totals when the governed date reaches exact expiry', async () => {
    const primaryTeamData = buildGovernedTeam('LAL');
    const { result, rerender } = renderHook(
      ({ worldAsOfDate }: { worldAsOfDate: string }) => {
        const [teams, setTeams] = useState<TradeMachineTeamSlot[]>(emptySlots);
        const [initError, setInitError] = useState<string | null>(null);
        const lastInitInputsRef = useRef<null | {
          primaryTeam: string | null | undefined;
          primaryTeamData: TradeMachineTeam | null;
          yearKey: string | number;
          worldId: string | null;
          worldAsOfDate: string | null;
        }>(null);

        useTradeMachineInit({
          primaryTeam: 'LAL',
          primaryTeamData,
          capProjections: null,
          yearKey: 2027,
          worldId: null,
          worldAsOfDate,
          setTeams,
          setInitError,
          lastInitInputsRef,
        });

        return { teams, initError };
      },
      { initialProps: { worldAsOfDate: BEFORE_EXPIRY } }
    );

    await waitFor(() => {
      expect(result.current.teams[0]?.team?.teamTotalSalary).toBe(
        PENDING_TEAM_SALARY
      );
    });

    rerender({ worldAsOfDate: EXACT_EXPIRY });

    await waitFor(() => {
      expect(result.current.teams[0]?.team?.teamTotalSalary).toBe(
        TERMINATED_TEAM_SALARY
      );
    });
    expect(result.current.initError).toBeNull();
  });

  it('ignores a stale initialization that finishes after the governed date changes', async () => {
    let finishPendingLoad: ((team: TradeMachineTeam) => void) | null = null;
    harness.loadWorldTeamData
      .mockImplementationOnce(
        () =>
          new Promise<TradeMachineTeam>((resolve) => {
            finishPendingLoad = resolve;
          })
      )
      .mockResolvedValueOnce(buildGovernedTeam('LAL'));

    const { result, rerender } = renderHook(
      ({ worldAsOfDate }: { worldAsOfDate: string }) => {
        const [teams, setTeams] = useState<TradeMachineTeamSlot[]>(emptySlots);
        const [initError, setInitError] = useState<string | null>(null);
        const lastInitInputsRef = useRef<null | {
          primaryTeam: string | null | undefined;
          primaryTeamData: TradeMachineTeam | null;
          yearKey: string | number;
          worldId: string | null;
          worldAsOfDate: string | null;
        }>(null);

        useTradeMachineInit({
          primaryTeam: 'LAL',
          primaryTeamData: null,
          capProjections: null,
          yearKey: 2027,
          worldId: null,
          worldAsOfDate,
          setTeams,
          setInitError,
          lastInitInputsRef,
        });

        return { teams, initError };
      },
      { initialProps: { worldAsOfDate: BEFORE_EXPIRY } }
    );

    await waitFor(() => expect(finishPendingLoad).not.toBeNull());
    rerender({ worldAsOfDate: EXACT_EXPIRY });

    await waitFor(() => {
      expect(result.current.teams[0]?.team?.teamTotalSalary).toBe(
        TERMINATED_TEAM_SALARY
      );
    });

    await act(async () => {
      finishPendingLoad?.(buildGovernedTeam('LAL'));
      await Promise.resolve();
    });

    expect(result.current.teams[0]?.team?.teamTotalSalary).toBe(
      TERMINATED_TEAM_SALARY
    );
    expect(result.current.initError).toBeNull();
  });

  it('retries the same Team inputs after a transient null world read', async () => {
    harness.loadWorldTeamData
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildGovernedTeam('LAL'));

    const { result, rerender } = renderHook(
      ({
        capProjections,
      }: {
        capProjections: Record<string, never> | null;
      }) => {
        const [teams, setTeams] = useState<TradeMachineTeamSlot[]>(emptySlots);
        const [initError, setInitError] = useState<string | null>(null);
        const lastInitInputsRef = useRef<null | {
          primaryTeam: string | null | undefined;
          primaryTeamData: TradeMachineTeam | null;
          yearKey: string | number;
          worldId: string | null;
          worldAsOfDate: string | null;
        }>(null);

        useTradeMachineInit({
          primaryTeam: 'LAL',
          primaryTeamData: null,
          capProjections,
          yearKey: 2027,
          worldId: null,
          worldAsOfDate: BEFORE_EXPIRY,
          setTeams,
          setInitError,
          lastInitInputsRef,
        });

        return { teams, initError };
      },
      {
        initialProps: {
          capProjections: null as Record<string, never> | null,
        },
      }
    );

    await waitFor(() =>
      expect(harness.loadWorldTeamData).toHaveBeenCalledTimes(1)
    );
    expect(result.current.teams[0]?.team).toBeNull();

    rerender({ capProjections: {} });

    await waitFor(() => {
      expect(result.current.teams[0]?.team?.teamCode).toBe('LAL');
    });
    expect(harness.loadWorldTeamData).toHaveBeenCalledTimes(2);
    expect(result.current.initError).toBeNull();
  });

  it('uses the governed date when a Team is selected after waiver expiry', async () => {
    const { result } = renderHook(() => {
      const [teams, setTeams] = useState<TradeMachineTeamSlot[]>(emptySlots);
      const operations = useTradeMachineTeamOps({
        teams,
        setTeams,
        capProjections: null,
        yearKey: 2027,
        worldId: null,
        worldAsOfDate: EXACT_EXPIRY,
      });
      return { teams, ...operations };
    });

    await act(async () => {
      await result.current.selectTeam(1, 'BOS');
    });

    expect(result.current.teams[1]?.team?.teamTotalSalary).toBe(
      TERMINATED_TEAM_SALARY
    );
  });

  it('uses the governed date when validation repairs missing Team Salary totals', () => {
    vi.useFakeTimers();
    const teams = (['LAL', 'BOS'] as const).map((teamCode) => ({
      team: {
        ...buildGovernedTeam(teamCode),
        teamTotalSalary: 0,
        projectedSalary: 0,
      },
      sends: [],
      entitlementsOut: [],
    }));
    const setSnapshotValidationDetails = vi.fn();
    const setPreviewAuthority = vi.fn();
    const setIsValidating = vi.fn();
    const lastValidatedDraftKeyRef = { current: null };
    const validatedAtRef = { current: null };

    const { result } = renderHook(() =>
      useTradeMachineValidation({
        teams,
        capProjections: null,
        yearKey: 2027,
        worldId: 'world-date-forwarding',
        worldAsOfDate: EXACT_EXPIRY,
        forceTrade: false,
        currentDraftKey: 'date-forwarding-draft',
        setSnapshotValidationDetails,
        setPreviewAuthority,
        setIsValidating,
        lastValidatedDraftKeyRef,
        validatedAtRef,
      })
    );

    expect(result.current.handleValidate()).toBe('started');

    const preparationInput =
      harness.buildTradeApplyPreparation.mock.calls[0]?.[0];
    expect(
      preparationInput.currentState.teams.map(
        (entry: { team: TradeMachineTeam }) => entry.team.teamTotalSalary
      )
    ).toEqual([TERMINATED_TEAM_SALARY, TERMINATED_TEAM_SALARY]);
    expect(preparationInput.payload.tradeCtx.asOfDate).toBe(EXACT_EXPIRY);
  });

  it('repairs missing independent Apron and Tax books even when Team Salary is populated', () => {
    vi.useFakeTimers();
    const teams = (['LAL', 'BOS'] as const).map((teamCode) => ({
      team: {
        ...buildGovernedTeam(teamCode),
        teamTotalSalary: PENDING_TEAM_SALARY,
        apronTeamSalary: null,
        taxSalary: null,
      } as TradeMachineTeam,
      sends: [],
      entitlementsOut: [],
    }));

    const { result } = renderHook(() =>
      useTradeMachineValidation({
        teams,
        capProjections: null,
        yearKey: 2027,
        worldId: 'world-date-forwarding',
        worldAsOfDate: EXACT_EXPIRY,
        forceTrade: false,
        currentDraftKey: 'independent-book-repair',
        setSnapshotValidationDetails: vi.fn(),
        setPreviewAuthority: vi.fn(),
        setIsValidating: vi.fn(),
        lastValidatedDraftKeyRef: { current: null },
        validatedAtRef: { current: null },
      })
    );

    expect(result.current.handleValidate()).toBe('started');
    const preparedTeams =
      harness.buildTradeApplyPreparation.mock.calls.at(-1)?.[0].currentState
        .teams;
    expect(preparedTeams).toHaveLength(2);
    preparedTeams.forEach((entry: { team: TradeMachineTeam }) => {
      expect(Number.isFinite(entry.team.apronTeamSalary)).toBe(true);
      expect(Number.isFinite(entry.team.taxSalary)).toBe(true);
    });
  });

  it('recomputes Trade Team Card salary totals from the governed date', () => {
    const team = buildGovernedTeam('LAL');
    const { result, rerender } = renderHook(
      ({ worldAsOfDate }: { worldAsOfDate: string }) =>
        useTradeTeamCardSalaries({
          team,
          sends: [],
          incomingPlayers: [],
          incomingEntitlements: [],
          entitlementsOut: [],
          otherTeams: [],
          yearKey: 2027,
          validationResult: null,
          selectedTeamId: 'LAL',
          teamTradeExceptions: [],
          hasTeam: true,
          worldAsOfDate,
        }),
      { initialProps: { worldAsOfDate: BEFORE_EXPIRY } }
    );

    expect(result.current.teamTotalSalary).toBe(PENDING_TEAM_SALARY);

    rerender({ worldAsOfDate: EXACT_EXPIRY });

    expect(result.current.teamTotalSalary).toBe(TERMINATED_TEAM_SALARY);
  });
});
