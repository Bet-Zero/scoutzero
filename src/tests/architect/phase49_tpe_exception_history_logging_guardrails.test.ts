/**
 * FILE: src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.js
 * PURPOSE: Guardrail coverage for Phase 49 TPE exception history logging helpers.
 * OWNERSHIP: Feature: architect/capSheet
 *
 * HISTORY:
 *  - 2026-01-29: Created for Phase 49 execution (plans/phase49-tpe-history/chunk_01)
 *
 * LINKS:
 *  - Plan: plans/phase49-tpe-history/plan.md
 *  - Latest Chunk: plans/phase49-tpe-history/chunks/chunk_01.md
 */

import { describe, test, expect } from 'vitest';
import {
  appendExceptionHistory,
  createTpeConsumptionHistoryEntry,
  createTpeCreationHistoryEntry,
} from '@/features/architect/utils/exceptionHistory/historyHelpers';

type CreationHistoryEntry = NonNullable<
  ReturnType<typeof createTpeCreationHistoryEntry>
>;
type ExceptionHistoryTeam = {
  exceptionHistory?: Array<Partial<CreationHistoryEntry>>;
};

const baseContext = {
  teamCode: 'BOS',
  seasonId: '2024-25',
  seasonYear: 2025,
  timestampISO: '2026-01-29T00:00:00.000Z',
  worldId: 'world_mock',
  mutationType: 'executeTrade',
};

describe('Phase 49: TPE exception history logging guardrails', () => {
  test('creates TPE_CREATED entry with expected payload', () => {
    const entry = createTpeCreationHistoryEntry({
      ...baseContext,
      tpeId: 'tpe_created_1',
      amountCreated: 8_000_000,
      createdFrom: 'Marcus Smart',
      createdSeason: 2025,
      expiresOn: '2026-07-01T00:00:00.000Z',
      mutationId: 'mutation_001',
    });

    expect(entry).toBeTruthy();
    expect(entry.type).toBe('TPE_CREATED');
    expect(entry.amountCreated).toBe(8_000_000);
    expect(entry.createdFrom).toBe('Marcus Smart');
    expect(entry.historyKey).toContain('created');
    expect(entry.mutationId).toBe('mutation_001');
  });

  test('creation entry preserves exact field order and omits optional context fields by default', () => {
    const entry = createTpeCreationHistoryEntry({
      teamCode: 'BOS',
      tpeId: 'tpe_created_default',
      amountCreated: 4_500_000,
      seasonYear: 2025,
      timestampISO: '2026-01-29T00:00:00.000Z',
    });

    expect(Object.keys(entry)).toEqual([
      'historyKey',
      'type',
      'teamCode',
      'tpeId',
      'amountCreated',
      'createdFrom',
      'createdSeason',
      'expiresOn',
      'seasonId',
      'seasonYear',
      'timestamp',
    ]);
    expect(entry).toEqual({
      historyKey:
        'executeTrade:global:BOS:tpe_created_default:created:2025||4500000|Trade',
      type: 'TPE_CREATED',
      teamCode: 'BOS',
      tpeId: 'tpe_created_default',
      amountCreated: 4_500_000,
      createdFrom: 'Trade',
      createdSeason: 2025,
      expiresOn: null,
      seasonId: undefined,
      seasonYear: 2025,
      timestamp: '2026-01-29T00:00:00.000Z',
    });
    expect(entry.worldId).toBeUndefined();
    expect(entry.mutationId).toBeUndefined();
  });

  test('creates TPE_CONSUMED entry for partial usage', () => {
    const entry = createTpeConsumptionHistoryEntry({
      ...baseContext,
      tpeId: 'tpe_consume_partial',
      amountConsumed: 3_500_000,
      remainingAmountAfter: 1_000_000,
      absorbedPlayers: [
        {
          playerId: 'player_a',
          name: 'Player A',
          amountAbsorbed: 3_500_000,
        },
      ],
    });

    expect(entry).toBeTruthy();
    expect(entry.type).toBe('TPE_CONSUMED');
    expect(entry.amountConsumed).toBe(3_500_000);
    expect(entry.remainingAmountAfter).toBe(1_000_000);
    expect(entry.fullyConsumed).toBe(false);
    expect(entry.absorbedPlayers).toHaveLength(1);
  });

  test('consumption entry preserves exact field order and sanitized absorbed player shape', () => {
    const entry = createTpeConsumptionHistoryEntry({
      teamCode: 'BOS',
      tpeId: 'tpe_consume_shape',
      amountConsumed: 2_750_000,
      remainingAmountAfter: 500_000,
      absorbedPlayers: [
        null,
        {
          id: 'player_legacy',
          displayName: 'Legacy Player',
          amountAbsorbed: '2750000',
        },
      ],
      seasonYear: 2025,
      timestampISO: '2026-01-29T00:00:00.000Z',
    });

    expect(Object.keys(entry)).toEqual([
      'historyKey',
      'type',
      'teamCode',
      'tpeId',
      'amountConsumed',
      'remainingAmountAfter',
      'fullyConsumed',
      'absorbedPlayers',
      'seasonId',
      'seasonYear',
      'timestamp',
    ]);
    expect(entry.absorbedPlayers).toEqual([
      {
        playerId: 'player_legacy',
        name: 'Legacy Player',
        amountAbsorbed: 2_750_000,
      },
    ]);
    expect(Object.keys(entry.absorbedPlayers[0])).toEqual([
      'playerId',
      'name',
      'amountAbsorbed',
    ]);
    expect(entry.worldId).toBeUndefined();
    expect(entry.mutationId).toBeUndefined();
  });

  test('flags fullyConsumed when remaining hits zero', () => {
    const entry = createTpeConsumptionHistoryEntry({
      ...baseContext,
      tpeId: 'tpe_consume_full',
      amountConsumed: 7_500_000,
      remainingAmountAfter: 0,
      fullyConsumed: true,
      absorbedPlayers: [
        {
          playerId: 'player_b',
          name: 'Player B',
          amountAbsorbed: 7_500_000,
        },
      ],
    });

    expect(entry).toBeTruthy();
    expect(entry.fullyConsumed).toBe(true);
    expect(entry.remainingAmountAfter).toBe(0);
    expect(entry.historyKey).toContain('consumed');
  });

  test('returns null for invalid creation or consumption inputs', () => {
    expect(
      createTpeCreationHistoryEntry({
        ...baseContext,
        teamCode: null,
        tpeId: 'tpe_invalid_create',
      })
    ).toBeNull();

    expect(
      createTpeConsumptionHistoryEntry({
        ...baseContext,
        tpeId: 'tpe_invalid_consume',
        amountConsumed: 0,
      })
    ).toBeNull();
  });

  test('appendExceptionHistory dedupes entries by historyKey', () => {
    const team = { exceptionHistory: [] };
    const entry = createTpeCreationHistoryEntry({
      ...baseContext,
      tpeId: 'tpe_dup_guard',
      amountCreated: 5_000_000,
      createdFrom: 'Test Player',
    });

    appendExceptionHistory(team, [entry]);
    appendExceptionHistory(team, [entry]);

    expect(team.exceptionHistory).toHaveLength(1);
    expect(team.exceptionHistory[0].tpeId).toBe('tpe_dup_guard');
  });

  test('appendExceptionHistory mutates the same team object and initializes history in place', () => {
    const team: ExceptionHistoryTeam = {};
    const result = appendExceptionHistory(team, []);

    expect(result).toBe(team);
    expect(team.exceptionHistory).toEqual([]);
  });

  test('appendExceptionHistory tolerates existing legacy entries without historyKey', () => {
    const team: ExceptionHistoryTeam = {
      exceptionHistory: [
        {
          type: 'TPE_CREATED',
          teamCode: 'BOS',
          tpeId: 'legacy_entry',
          timestamp: '2026-01-29T00:00:00.000Z',
        },
      ],
    };
    const entry = createTpeCreationHistoryEntry({
      ...baseContext,
      tpeId: 'tpe_after_legacy',
      amountCreated: 1_500_000,
      createdFrom: 'Legacy Followup',
    });

    const result = appendExceptionHistory(team, [entry]);

    expect(result).toBe(team);
    expect(team.exceptionHistory).toHaveLength(2);
    expect(team.exceptionHistory[0].historyKey).toBeUndefined();
    expect(team.exceptionHistory[1].historyKey).toBe(entry.historyKey);
  });

  test('appendExceptionHistory leaves history untouched when no new entries', () => {
    const initialEntry = createTpeCreationHistoryEntry({
      ...baseContext,
      tpeId: 'tpe_existing',
      amountCreated: 2_000_000,
      createdFrom: 'Existing',
    });
    const team = { exceptionHistory: [initialEntry] };

    appendExceptionHistory(team, []);

    expect(team.exceptionHistory).toHaveLength(1);
    expect(team.exceptionHistory[0].tpeId).toBe('tpe_existing');
  });
});
