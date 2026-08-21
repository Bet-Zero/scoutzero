/**
 * FILE: src/tests/architect/phase86_oste_offseason_transition_engine.test.ts
 * PURPOSE: Validation coverage for Offseason Transition Engine (OSTE).
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-02-03: Created by plan `plans/_archive/offseason-transition-engine-phase1/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/offseason-transition-engine-phase1/plan.md
 *  - Latest Chunk: N/A
 */

import { describe, it, expect } from 'vitest';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
import { runOffseason } from '@/features/architect/utils/runOffseason';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import type { OffseasonTeamCapSheet } from '@/features/architect/utils/offseason/resolveOffseasonTransition';

type SeasonRow = ReturnType<typeof makeSeasonRow>;

type OstePlayer = {
  player_id: string;
  name: string;
  contract: {
    salariesByYear: SeasonRow[];
    yearsRemaining: number;
    birdRights: { status: string };
    [key: string]: unknown;
  };
};

type OsteTeam = {
  teamCode: string;
  teamName: string;
  players: OstePlayer[];
  roster: string[];
  capHolds: NonNullable<OffseasonTeamCapSheet['capHolds']>;
  exceptions: Record<string, unknown>;
  totals: Record<string, unknown>;
  [key: string]: unknown;
};

const makeSeasonRow = (endYear: number, salary: number, option?: string | null) => ({
  season: toSeasonCode(endYear),
  salary,
  capHit: salary,
  option: option ?? null,
  optionUsed: false,
});

const makePlayer = (
  id: string,
  name: string,
  rows: SeasonRow[],
  extra: Partial<OstePlayer['contract']> = {}
): OstePlayer => ({
  player_id: id,
  name,
  contract: {
    salariesByYear: rows,
    yearsRemaining: rows.length,
    birdRights: { status: 'Full Bird' },
    ...extra,
  },
});

const makeStandardRoster = (
  count: number,
  fromYear: number,
  toYear: number,
  startIndex = 0
) =>
  Array.from({ length: count }).map((_, idx) =>
    makePlayer(
      `fill-${startIndex + idx}`,
      `Filler ${startIndex + idx}`,
      [makeSeasonRow(fromYear, 1_200_000), makeSeasonRow(toYear, 1_250_000)]
    )
  );

const makeTeam = (
  players: OstePlayer[],
  overrides: Partial<OsteTeam> & Record<string, unknown> = {}
): OsteTeam => ({
  teamCode: 'TST',
  teamName: 'Test Team',
  players,
  roster: players.map((p) => p.player_id),
  capHolds: [],
  exceptions: {},
  totals: {},
  ...overrides,
});

type OffseasonTransitionResult = ReturnType<typeof resolveOffseasonTransition>;
type NextTeamCapSheet = NonNullable<OffseasonTransitionResult['nextTeamCapSheet']>;

function requireNextTeamCapSheet(
  result: OffseasonTransitionResult
): NextTeamCapSheet {
  expect(result.nextTeamCapSheet).toBeDefined();
  if (!result.nextTeamCapSheet) {
    throw new Error('Expected next team cap sheet');
  }
  return result.nextTeamCapSheet;
}

function requireFirstItem<T>(items: T[] | null | undefined, label: string): T {
  expect(items?.[0]).toBeDefined();
  const item = items?.[0];
  if (!item) {
    throw new Error(`Expected ${label}`);
  }
  return item;
}

describe('Phase 86: OSTE core validation', () => {
  it('TEST 1: Standard expiration creates cap hold', () => {
    const fromYear = 2026;
    const toYear = 2027;

    const expiringPlayer = makePlayer('p1', 'Expiring One', [
      makeSeasonRow(fromYear, 12_000_000),
    ]);

    const fillers = makeStandardRoster(13, fromYear, toYear);
    const team = makeTeam([expiringPlayer, ...fillers]);

    const result = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions: {},
    });

    expect(result.success).toBe(true);
    expect(result.nextTeamCapSheet?.capHolds?.length).toBe(1);
    const hold = requireFirstItem(
      result.nextTeamCapSheet?.capHolds,
      'cap hold'
    );
    expect(hold.playerId).toBe('p1');
    expect(hold.amount).toBeGreaterThan(0);
    expect(hold.season).toBe(toSeasonCode(toYear));
  });

  it('TEST 2: World vs single-team output equivalence', () => {
    const fromYear = 2026;
    const toYear = 2027;

    const optionPlayer = makePlayer('p2', 'Option Two', [
      makeSeasonRow(fromYear, 8_000_000),
      makeSeasonRow(toYear, 9_000_000, 'Player Option'),
    ]);
    const retainedPlayer = makePlayer('p3', 'Retained Three', [
      makeSeasonRow(fromYear, 5_000_000),
      makeSeasonRow(toYear, 5_500_000),
    ]);

    const fillers = makeStandardRoster(13, fromYear, toYear);
    const team = makeTeam([optionPlayer, retainedPlayer, ...fillers]);
    const optionDecisions = {
      p2: { decision: 'decline', optionType: 'Player Option', season: toSeasonCode(toYear) },
    };

    const osteResult = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions,
    });

    const runResult = runOffseason(team, fromYear, null, optionDecisions);

    expect(osteResult.success).toBe(true);
    expect(runResult.updatedCapSheet).toEqual(osteResult.nextTeamCapSheet);
  });

  it('TEST 3: Exception reset consistency (mle/tpmle/bae/room + dpe) and TPE expiry', () => {
    const fromYear = 2026;
    const toYear = 2027;
    const capRules = getCapRulesForYear(toYear);

    const fillers = makeStandardRoster(13, fromYear, toYear);
    const team = makeTeam([
      makePlayer('p4', 'Roster Four', [makeSeasonRow(fromYear, 3_000_000), makeSeasonRow(toYear, 3_000_000)]),
      ...fillers,
    ], {
      exceptions: {
        mle: { enabled: true, totalAmount: 10, usedAmount: 5, remainingAmount: 5, seasonKey: '2025-26' },
        tpmle: { enabled: true, totalAmount: 4, usedAmount: 2, remainingAmount: 2, seasonKey: '2025-26' },
        bae: { enabled: true, totalAmount: 3, usedAmount: 1, remainingAmount: 2, seasonKey: '2025-26' },
        room: { enabled: true, totalAmount: 2, usedAmount: 1, remainingAmount: 1, seasonKey: '2025-26' },
        dpe: { enabled: true, totalAmount: 1, usedAmount: 1, remainingAmount: 0, seasonKey: '2025-26' },
        tpe: [
          {
            id: 'tpe-expired',
            totalAmount: 1_000_000,
            remainingAmount: 1_000_000,
            expiresOn: '2026-06-01T00:00:00.000Z',
          },
          {
            id: 'tpe-active',
            totalAmount: 2_000_000,
            remainingAmount: 2_000_000,
            expiresOn: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
    });

    const result = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions: {},
    });

    expect(result.success).toBe(true);
    const updated = requireNextTeamCapSheet(result);
    const exceptions = updated.exceptions as Record<string, Record<string, unknown>>;

    expect(exceptions.mle.usedAmount).toBe(0);
    expect(exceptions.tpmle.usedAmount).toBe(0);
    expect(exceptions.bae.usedAmount).toBe(0);
    expect(exceptions.room.usedAmount).toBe(0);

    expect(exceptions.mle.totalAmount).toBe(capRules.exceptions.fullMLE);
    expect(exceptions.tpmle.totalAmount).toBe(capRules.exceptions.taxpayerMLE);
    expect(exceptions.bae.totalAmount).toBe(capRules.exceptions.bae);
    expect(exceptions.room.totalAmount).toBe(capRules.exceptions.roomMLE);

    expect(exceptions.dpe.enabled).toBe(false);
    expect(exceptions.dpe.totalAmount).toBe(0);

    const updatedExceptions = updated.exceptions;
    expect(updatedExceptions).toBeDefined();
    if (!updatedExceptions) {
      throw new Error('Expected updated exceptions');
    }
    const tpes = updatedExceptions.tpe as Array<{ id: string }>;
    expect(tpes).toHaveLength(1);
    expect(tpes[0]?.id).toBe('tpe-active');
  });

  it('TEST 4: Hard cap state resets on rollover', () => {
    const fromYear = 2026;
    const toYear = 2027;

    const fillers = makeStandardRoster(13, fromYear, toYear);
    const team = makeTeam([
      makePlayer('p5', 'Hard Cap Five', [makeSeasonRow(fromYear, 7_000_000), makeSeasonRow(toYear, 7_000_000)]),
      ...fillers,
    ], {
      hardCapTriggered: 'FirstApron',
      hardCapFirstApron: { active: true, reason: 'Test', season: '2025-26' },
      hardCapped: true,
      totals: {
        apronTeamSalary: 30_000_000,
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapDetail: 'Triggered by test',
      },
    });

    const result = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions: {},
    });

    expect(result.success).toBe(true);
    const updated = requireNextTeamCapSheet(result);

    expect(updated.hardCapTriggered).toBeUndefined();
    expect(updated.hardCapFirstApron).toBeUndefined();
    expect(updated.hardCapped).toBe(false);
    expect(updated.totals?.isHardCapped ?? false).toBe(false);
  });

  it('TEST 5: Illegal roster size blocks transition', () => {
    const fromYear = 2026;
    const toYear = 2027;

    const players = Array.from({ length: 16 }).map((_, idx) =>
      makePlayer(`p${idx}`, `Player ${idx}`, [
        makeSeasonRow(fromYear, 1_000_000 + idx * 10_000),
        makeSeasonRow(toYear, 1_000_000 + idx * 10_000),
      ])
    );

    const team = makeTeam(players);

    const result = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions: {},
    });

    expect(result.success).toBe(false);
    expect(result.violations?.some((v) => v.rule === 'roster_size')).toBe(true);
  });
});
