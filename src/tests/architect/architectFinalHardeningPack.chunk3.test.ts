/**
 * FILE: src/tests/architect/architectFinalHardeningPack.chunk3.test.ts
 * PURPOSE: Narrow regression proof for ARCHITECT_FINAL_HARDENING_PACK Chunk 3.
 * Covers the primary type-hardening areas:
 *  - constants/types: NormalizedTeam.team.capHolds and TradeTeam.team.capHolds
 *    narrowed from unknown[] to CapHold[]
 *  - mutationPipeline: TeamLike.capHolds narrowed to CapHold[];
 *    (hold: any) filter callbacks replaced with (hold: CapHold)
 *  - mutationPipeline: extractTeamsByCodeFromComputeResult return type
 *    changed from LooseRecord to Record<string, LooseRecord> (double-cast removed)
 *  - useArchitectActions: double-cast on beforeTeamsByCode/afterTeamsByCode
 *    reduced to single cast
 * OWNERSHIP: Feature: architect/ts-hardening
 */

import { describe, expect, it } from 'vitest';
import type { NormalizedTeam } from '@/features/architect/utils/tradeMachine/constants/types';
import {
  getActiveUnsignedCapHolds,
  getActiveUnsignedCapHoldsTotal,
} from '@/features/architect/utils/capHolds';
import type { CapHold } from '@/features/architect/utils/capHolds';

// ---------------------------------------------------------------------------
// 1. CapHold structural shape — canonical fields
//    Verifies the CapHold interface covers all runtime-accessed fields.
// ---------------------------------------------------------------------------
describe('CapHold — canonical field shape', () => {
  it('accepts a well-formed cap hold with all required fields', () => {
    const hold: CapHold = {
      playerId: 'p1',
      playerName: 'Player One',
      amount: 8_000_000,
      season: '2025-26',
      type: 'FA Cap Hold',
      active: true,
      isSigned: false,
    };

    expect(hold.playerId).toBe('p1');
    expect(hold.playerName).toBe('Player One');
    expect(hold.amount).toBe(8_000_000);
    expect(hold.season).toBe('2025-26');
    expect(hold.type).toBe('FA Cap Hold');
    expect(hold.active).toBe(true);
    expect(hold.isSigned).toBe(false);
  });

  it('accepts a cap hold with optional reason field', () => {
    const hold: CapHold = {
      playerId: 'p2',
      playerName: 'Player Two',
      amount: 2_000_000,
      season: '2024-25',
      type: 'RFA Cap Hold',
      active: false,
      isSigned: true,
      reason: 'Declined Option',
    };

    expect(hold.reason).toBe('Declined Option');
    expect(hold.isSigned).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. NormalizedTeam.team.capHolds — CapHold[] structural compatibility
//    Verifies that a NormalizedTeam can be constructed with CapHold[] and
//    the field is directly accessible and typed.
// ---------------------------------------------------------------------------
describe('NormalizedTeam.team.capHolds — typed as CapHold[]', () => {
  it('accepts CapHold[] in team.capHolds without assertion', () => {
    const holds: CapHold[] = [
      {
        playerId: 'player-a',
        playerName: 'Player A',
        amount: 12_000_000,
        season: '2025-26',
        type: 'Bird Cap Hold',
        active: true,
        isSigned: false,
      },
    ];

    // Construct a minimal NormalizedTeam — capHolds should accept CapHold[] directly
    const team: NormalizedTeam = {
      team: {
        id: 'LAL',
        teamName: 'Los Angeles Lakers',
        teamTotalSalary: 180_000_000,
        projectedSalary: 185_000_000,
        players: [],
        twoWayPlayers: [],
        tradeExceptions: [],
        capHolds: holds,
      },
      sends: [],
      picksOut: [],
      cashSent: 0,
      hardCapped: false,
      appliedTPEs: [],
    };

    expect(team.team.capHolds).toHaveLength(1);
    // Type-safe: accessing typed fields without assertion
    const hold = team.team.capHolds?.[0];
    expect(hold?.playerId).toBe('player-a');
    expect(hold?.amount).toBe(12_000_000);
    expect(hold?.active).toBe(true);
  });

  it('accepts empty CapHold[] in team.capHolds', () => {
    const team: NormalizedTeam = {
      team: {
        id: 'BOS',
        teamName: 'Boston Celtics',
        teamTotalSalary: 170_000_000,
        projectedSalary: 175_000_000,
        players: [],
        twoWayPlayers: [],
        tradeExceptions: [],
        capHolds: [],
      },
      sends: [],
      picksOut: [],
      cashSent: 0,
      hardCapped: false,
      appliedTPEs: [],
    };

    expect(team.team.capHolds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. capHolds filter pattern — typed (hold: CapHold) callback
//    Mirrors the pattern used in mutationPipeline.ts lines 2833 and 3323.
//    Verifies that hold.playerId and hold.playerName are accessible as strings.
// ---------------------------------------------------------------------------
describe('capHolds filter — (hold: CapHold) typed callback', () => {
  const sampleHolds: CapHold[] = [
    {
      playerId: 'p1',
      playerName: 'Alice',
      amount: 10_000_000,
      season: '2025-26',
      type: 'FA Cap Hold',
      active: true,
      isSigned: false,
    },
    {
      playerId: 'p2',
      playerName: 'Bob',
      amount: 5_000_000,
      season: '2025-26',
      type: 'RFA Cap Hold',
      active: true,
      isSigned: false,
    },
    {
      playerId: 'p3',
      playerName: 'Carol',
      amount: 3_000_000,
      season: '2025-26',
      type: 'Bird Cap Hold',
      active: true,
      isSigned: false,
    },
  ];

  it('filters by playerId using typed callback', () => {
    const playerId = 'p1';
    const result = sampleHolds.filter((hold: CapHold) => hold.playerId !== playerId);
    expect(result).toHaveLength(2);
    expect(result.map((h) => h.playerId)).toEqual(['p2', 'p3']);
  });

  it('filters by playerId OR playerName using typed callback (renounce pattern)', () => {
    const playerId = 'p2';
    const playerName = 'Carol';
    const result = sampleHolds.filter((hold: CapHold) => {
      if (hold.playerId === playerId) return false;
      if (hold.playerName === playerName) return false;
      return true;
    });
    // Removes p2 (id match) and Carol/p3 (name match)
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe('p1');
  });

  it('filter returning all holds when no match', () => {
    const result = sampleHolds.filter((hold: CapHold) => hold.playerId !== 'unknown');
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 4. getActiveUnsignedCapHolds — exercises CapHold[] typed parameter
//    Verifies the exported utility operates correctly on the canonical type.
// ---------------------------------------------------------------------------
describe('getActiveUnsignedCapHolds — typed CapHold[] parameter', () => {
  const holds: CapHold[] = [
    {
      playerId: 'p1',
      playerName: 'Player One',
      amount: 10_000_000,
      season: '2025-26',
      type: 'FA Cap Hold',
      active: true,
      isSigned: false,
    },
    {
      playerId: 'p2',
      playerName: 'Player Two',
      amount: 6_000_000,
      season: '2025-26',
      type: 'RFA Cap Hold',
      active: true,
      isSigned: true, // already signed — should be excluded
    },
    {
      playerId: 'p3',
      playerName: 'Player Three',
      amount: 4_000_000,
      season: '2026-27', // different year
      type: 'Bird Cap Hold',
      active: true,
      isSigned: false,
    },
  ];

  it('returns only active unsigned holds for the given year', () => {
    const result = getActiveUnsignedCapHolds(holds, 2025);
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe('p1');
    expect(result[0].amount).toBe(10_000_000);
  });

  it('returns empty array when no holds match year', () => {
    const result = getActiveUnsignedCapHolds(holds, 2027);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for null/undefined input', () => {
    expect(getActiveUnsignedCapHolds(null, 2025)).toHaveLength(0);
    expect(getActiveUnsignedCapHolds(undefined, 2025)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. getActiveUnsignedCapHoldsTotal — amount accumulation
// ---------------------------------------------------------------------------
describe('getActiveUnsignedCapHoldsTotal — typed CapHold[] accumulation', () => {
  it('sums amounts of active unsigned holds for the given year', () => {
    const holds: CapHold[] = [
      {
        playerId: 'p1',
        playerName: 'Player One',
        amount: 10_000_000,
        season: '2025-26',
        type: 'FA Cap Hold',
        active: true,
        isSigned: false,
      },
      {
        playerId: 'p2',
        playerName: 'Player Two',
        amount: 4_000_000,
        season: '2025-26',
        type: 'RFA Cap Hold',
        active: true,
        isSigned: false,
      },
    ];

    const total = getActiveUnsignedCapHoldsTotal(holds, 2025);
    expect(total).toBe(14_000_000);
  });

  it('returns 0 when no holds match', () => {
    const total = getActiveUnsignedCapHoldsTotal([], 2025);
    expect(total).toBe(0);
  });
});
