/**
 * FILE: tests/architect/extension_voidedByExtension.test.js
 * PURPOSE: T-3 guard — verifies computeExtensionResult marks overlapping
 *          original contract years as voidedByExtension when an extension
 *          is applied.
 */
import { describe, it, expect } from 'vitest';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';

const TEAM_CODE = 'LAL';
const PLAYER_ID = 'player-42';

type ComputeMutationArgs = Parameters<typeof computeWorldMutation>[0];
type ExtendPlayerArgs = Extract<
  ComputeMutationArgs,
  { mutationType: 'extendPlayer' }
>;
type ExtensionCurrentState = ExtendPlayerArgs['currentState'];

function makePlayer(salariesByYear: Array<Record<string, unknown>> = []) {
  return {
    player_id: PLAYER_ID,
    name: 'Test Player',
    displayName: 'Test Player',
    futureContract: {
      salariesByYear,
    },
  };
}

function makeTeam(player: ReturnType<typeof makePlayer>) {
  return {
    teamCode: TEAM_CODE,
    players: [player],
  };
}

describe('computeExtensionResult — governed extension boundary', () => {
  it('rejects an overlapping legacy extension before any salary is voided', () => {
    const player = makePlayer([
        { season: '2025-26', year: 2026, salary: 10_000_000 },
        { season: '2026-27', year: 2027, salary: 11_000_000 },
        { season: '2027-28', year: 2028, salary: 12_000_000 },
    ]);
    const team = makeTeam(player);

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        playerId: PLAYER_ID,
        extension: {
          salariesByYear: [
            { season: '2026-27', year: 2027, salary: 14_000_000 },
            { season: '2027-28', year: 2028, salary: 15_000_000 },
            { season: '2028-29', year: 2029, salary: 16_000_000 },
          ],
        },
      },
      currentState: { team, player, teamCode: TEAM_CODE } as ExtensionCurrentState,
      seasonId: '2025-2026',
      timestamp: Date.now(),
    } as ExtendPlayerArgs);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Governed extension requires');
    expect(result.teamUpdates).toBeUndefined();
    expect(result.playerUpdates).toBeUndefined();
  });

  it('rejects a non-overlapping legacy extension before mutation', () => {
    const player = makePlayer([
        { season: '2025-26', year: 2026, salary: 10_000_000 },
        { season: '2026-27', year: 2027, salary: 11_000_000 },
    ]);
    const team = makeTeam(player);

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        playerId: PLAYER_ID,
        extension: {
          salariesByYear: [
            { season: '2027-28', year: 2028, salary: 14_000_000 },
            { season: '2028-29', year: 2029, salary: 15_000_000 },
          ],
        },
      },
      currentState: { team, player, teamCode: TEAM_CODE } as ExtensionCurrentState,
      seasonId: '2025-2026',
      timestamp: Date.now(),
    } as ExtendPlayerArgs);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Governed extension requires');
    expect(result.teamUpdates).toBeUndefined();
    expect(result.playerUpdates).toBeUndefined();
  });

  it('rejects season-string legacy terms before overlap inference', () => {
    const player = makePlayer([
      { season: '2025-26', salary: 10_000_000 }, // resolves to year 2026
      { season: '2026-27', salary: 11_000_000 }, // resolves to year 2027
    ]);
    const team = makeTeam(player);

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        playerId: PLAYER_ID,
        extension: {
          salariesByYear: [
            { season: '2026-27', salary: 14_000_000 }, // overlaps year 2027
          ],
        },
      },
      currentState: { team, player, teamCode: TEAM_CODE } as ExtensionCurrentState,
      seasonId: '2025-2026',
      timestamp: Date.now(),
    } as ExtendPlayerArgs);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Governed extension requires');
    expect(result.teamUpdates).toBeUndefined();
    expect(result.playerUpdates).toBeUndefined();
  });
});
