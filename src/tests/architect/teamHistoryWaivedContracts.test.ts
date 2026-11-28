/**
 * FILE: src/tests/architect/teamHistoryWaivedContracts.test.ts
 * PURPOSE: Coverage for the Team History waived-contract reconciliation
 *          (BZE-218): the side panel must include committed waives recorded in
 *          the canonical team.deadCap[] ledger, not only legacy
 *          waivedContracts[], so it never contradicts the timeline.
 * OWNERSHIP: Feature: architect/history
 */
import { describe, expect, it } from 'vitest';
import { resolveWaivedContractDisplayEntries } from '@/features/architect/history/TeamHistoryTab/TeamHistoryTab.helpers';

describe('resolveWaivedContractDisplayEntries', () => {
  it('keeps unstated stretch status separate from documented yes or no', () => {
    const entries = resolveWaivedContractDisplayEntries({
      deadCap: [
        { playerId: 'undocumented', amountByYear: [{ season: '2026-27', amount: 250_000 }] },
        { playerId: 'unstretched', amountByYear: [{ season: '2026-27', amount: 275_000, isStretched: false }] },
        { playerId: 'stretched', amountByYear: { '2027': { amount: 300_000, isStretched: true } } },
        { playerId: 'incomplete', amountByYear: [
          { season: '2026-27', amount: 345_000, isStretched: false },
          { season: '2027-28', amount: 345_000 },
        ] },
      ],
    }, [{ mutationType: 'waivePlayer', playerIds: ['receipt-without-stretch'] }]);
    expect(entries.map(({ stretched, deadCap }) => [stretched, deadCap])).toEqual([
      [null, { '2027': 250_000 }],
      [false, { '2027': 275_000 }],
      [true, { '2027': 300_000 }],
      [null, { '2027': 345_000, '2028': 345_000 }],
      [null, {}],
    ]);
  });

  it('marks retained opening debt and preserves a later zero-dead-money waiver of the same player', () => {
    const opening = {
      playerId: 'p1',
      playerName: 'Example Player',
      amountByYear: [{ season: '2026-27', amount: 2_500_000 }],
      notes: 'Dead cap reason: previous contract',
    };
    const capSheet = { deadCap: [opening] };
    expect(resolveWaivedContractDisplayEntries(capSheet)).toMatchObject([
      { id: 'p1', openingObligation: true, deadCap: { '2027': 2_500_000 } },
    ]);

    const savedWaiver = {
      mutationType: 'waivePlayer',
      occurredAt: '2027-01-15T15:00:00.000Z',
      mutationMetadata: { playerId: 'p1', playerName: 'Example Player' },
    };
    const entries = resolveWaivedContractDisplayEntries(capSheet, [savedWaiver]);
    expect(entries).toHaveLength(2);
    expect(entries[1].openingObligation).toBeUndefined();
    expect(entries[1].deadCap).toEqual({});
    expect(resolveWaivedContractDisplayEntries({
      deadCap: [
        { ...opening, notes: 'Manual Adjustment' },
        { ...opening, waiveDate: '2027-01-15T15:00:00.000Z' },
      ],
    }).map((entry) => entry.openingObligation)).toEqual([undefined, undefined]);
  });

  it('returns an empty list when neither ledger has entries', () => {
    expect(resolveWaivedContractDisplayEntries({})).toEqual([]);
    expect(
      resolveWaivedContractDisplayEntries({
        deadCap: [],
        waivedContracts: [],
      })
    ).toEqual([]);
  });

  it('adapts canonical deadCap entries written by committed waives', () => {
    const entries = resolveWaivedContractDisplayEntries({
      deadCap: [
        {
          playerId: 'mia_tobias_lund',
          playerName: 'Tobias Lund',
          originalSalary: 12_000_000,
          amountByYear: [
            { season: '2026-27', amount: 12_000_000, isStretched: false },
          ],
          waiveDate: '2026-07-05T10:00:00.000Z',
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Tobias Lund');
    expect(entries[0].stretched).toBe(false);
    expect(entries[0].deadCap).toEqual({ '2027': 12_000_000 });
    expect(entries[0].waivedOn).toContain('2026');
  });

  it('marks stretched waives and accumulates multi-year schedules', () => {
    const entries = resolveWaivedContractDisplayEntries({
      deadCap: [
        {
          playerId: 'mia_owen_frost',
          playerName: 'Owen Frost',
          amountByYear: [
            { season: '2026-27', amount: 4_000_000, isStretched: true },
            { season: '2027-28', amount: 4_000_000, isStretched: true },
            { season: '2028-29', amount: 4_000_000, isStretched: true },
          ],
          waiveDate: '2026-07-05T10:00:00.000Z',
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].stretched).toBe(true);
    expect(entries[0].deadCap).toEqual({
      '2027': 4_000_000,
      '2028': 4_000_000,
      '2029': 4_000_000,
    });
  });

  it('supports legacy amountByYear map shapes', () => {
    const entries = resolveWaivedContractDisplayEntries({
      deadCap: [
        {
          playerId: 'p1',
          playerName: 'Legacy Map Player',
          amountByYear: {
            '2027': 1_500_000,
            '2028': { amount: 1_500_000, isStretched: true },
          },
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].deadCap).toEqual({
      '2027': 1_500_000,
      '2028': 1_500_000,
    });
    expect(entries[0].stretched).toBe(true);
  });

  it('keeps legacy waivedContracts entries and prefers canonical duplicates', () => {
    const entries = resolveWaivedContractDisplayEntries({
      deadCap: [
        {
          playerId: 'mia_tobias_lund',
          playerName: 'Tobias Lund',
          amountByYear: [{ season: '2026-27', amount: 2_000_000 }],
          waiveDate: '2026-07-05T10:00:00.000Z',
        },
      ],
      waivedContracts: [
        // Duplicate of the canonical entry (matched by name) — dropped.
        {
          name: 'Tobias Lund',
          waivedOn: '2025-07-01',
          stretched: false,
          deadCap: { '2026': 999 },
        },
        // Unrelated legacy record — kept.
        {
          name: 'Legacy Only Player',
          waivedOn: '2024-07-01',
          stretched: true,
          deadCap: { '2025': 500_000 },
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('Tobias Lund');
    expect(entries[0].deadCap).toEqual({ '2027': 2_000_000 });
    expect(entries[1].name).toBe('Legacy Only Player');
  });

  it('ignores malformed deadCap rows instead of rendering empty entries', () => {
    const entries = resolveWaivedContractDisplayEntries({
      deadCap: [null, 42, 'nope', {}],
    });
    expect(entries).toEqual([]);
  });

  it('back-fills zero-dead-money waives from committed world events', () => {
    // A two-way / non-guaranteed waive writes no deadCap ledger entry, but
    // the committed event still exists — the panel must show it (BZE-218).
    const entries = resolveWaivedContractDisplayEntries({}, [
      {
        mutationType: 'waivePlayer',
        occurredAt: '2026-07-05T10:00:00.000Z',
        playerIds: ['mia_tobias_lund'],
        mutationMetadata: {
          playerId: 'mia_tobias_lund',
          playerName: 'Tobias Lund',
          stretched: false,
          deadCapAmount: 0,
        },
      },
      // Non-waive events are ignored.
      {
        mutationType: 'signFreeAgent',
        playerIds: ['mia_tobias_lund'],
        mutationMetadata: { playerName: 'Tobias Lund' },
      },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Tobias Lund');
    expect(entries[0].stretched).toBe(false);
    expect(entries[0].deadCap).toEqual({});
    expect(entries[0].waivedOn).toContain('2026');
  });

  it('prefers the canonical ledger entry over the matching waive event', () => {
    const entries = resolveWaivedContractDisplayEntries(
      {
        deadCap: [
          {
            playerId: 'mia_quentin_diaz',
            playerName: 'Quentin Diaz',
            amountByYear: [{ season: '2026-27', amount: 3_000_000 }],
            waiveDate: '2026-07-05T10:00:00.000Z',
          },
        ],
      },
      [
        {
          mutationType: 'waivePlayer',
          occurredAt: '2026-07-05T10:00:00.000Z',
          playerIds: ['mia_quentin_diaz'],
          mutationMetadata: {
            playerId: 'mia_quentin_diaz',
            playerName: 'Quentin Diaz',
          },
        },
      ]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].deadCap).toEqual({ '2027': 3_000_000 });
  });
});
