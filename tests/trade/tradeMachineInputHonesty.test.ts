import { describe, expect, it } from 'vitest';
import { augmentTeamWithExceptions } from '@/features/architect/hooks/useTradeMachine.helpers';
import { worldViewingSeasonEndYear } from '@/features/architect/GMDashboard/hooks/useArchitectState.helpers';
import { capProjections } from '@/features/architect/utils/capProjections';
import { attachGovernedTradeSalaryBasisLoadErrorToRoster } from '@/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis';
import {
  computeMatchingValues,
  type MatchingValuePlayer,
} from '@/features/architect/utils/tradeMachine/utils/matchingValues';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';

describe('Trade Machine exception inputs', () => {
  it('leaves a team with no Traded Player Exceptions with none', () => {
    const team = augmentTeamWithExceptions(
      { id: 'BOS', tradeExceptions: [] },
      2027,
      capProjections
    );

    expect(getTeamTpeList(team)).toEqual([]);
  });

  it('keeps a recorded Traded Player Exception unchanged', () => {
    const recorded = {
      id: 'bos-tpe-1',
      name: 'Recorded TPE',
      amount: 4_000_000,
      expiresOn: '2027-02-01',
    };
    const team = augmentTeamWithExceptions(
      { id: 'BOS', tradeExceptions: [recorded] },
      2027,
      capProjections
    );

    expect(getTeamTpeList(team)).toEqual([
      expect.objectContaining({ id: 'bos-tpe-1', amount: 4_000_000 }),
    ]);
  });
});

describe('saved-world viewing season', () => {
  it("opens a world on its own season's Salary Cap Year", () => {
    expect(worldViewingSeasonEndYear(capProjections, null, '2025-26')).toBe(
      2026
    );
    expect(worldViewingSeasonEndYear(capProjections, null, '2026-27')).toBe(
      2027
    );
  });

  it('changes nothing when the world season is unknown or not viewable', () => {
    expect(worldViewingSeasonEndYear(capProjections, null, null)).toBeNull();
    expect(worldViewingSeasonEndYear(capProjections, null, '2026')).toBeNull();
    expect(
      worldViewingSeasonEndYear(capProjections, null, '2090-91')
    ).toBeNull();
  });
});

describe('salary authority load failures', () => {
  const failure =
    'The requested date and Salary Cap Year do not reconcile: as-of date 2026-06-05T23:59:59Z falls outside Salary Cap Year 2027.';

  it('records the load failure on each roster player without supplying a salary', () => {
    const [player] = attachGovernedTradeSalaryBasisLoadErrorToRoster(
      [{ id: 'player-0001', salary: 10_000_000 }],
      failure
    );

    expect(player.governedTradeSalaryBasisLoadError).toBe(failure);
    expect(player).not.toHaveProperty('governedTradeSalaryBasis');
  });

  it('blocks the player and states the real cause', () => {
    const player: MatchingValuePlayer = {
      id: 'player-0001',
      salary: 10_000_000,
      governedTradeSalaryBasisLoadError: failure,
    };
    const result = computeMatchingValues({
      teams: [{ teamId: 'BOS', sends: [player] }],
      yearKey: 2027,
      worldId: 'world-1',
      asOfDate: '2026-06-05',
      requireGovernedSalaryBasis: true,
    });

    expect(result.salaryBasisIssues).toHaveLength(1);
    expect(result.salaryBasisIssues[0]?.reason).toContain(
      'could not be loaded'
    );
    expect(result.salaryBasisIssues[0]?.reason).toContain(failure);
    expect(player.matchOutgoing).toBe(0);
    expect(player.matchIncoming).toBe(0);
  });

  it('keeps the generic reason when no load failure was recorded', () => {
    const player: MatchingValuePlayer = { id: 'player-0001', salary: 1 };
    const result = computeMatchingValues({
      teams: [{ teamId: 'BOS', sends: [player] }],
      yearKey: 2027,
      worldId: 'world-1',
      asOfDate: '2027-01-08',
      requireGovernedSalaryBasis: true,
    });

    expect(result.salaryBasisIssues[0]?.reason).toContain(
      'missing or malformed'
    );
  });
});
