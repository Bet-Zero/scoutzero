/**
 * FILE: tests/architect/extension_voidedByExtension.test.js
 * PURPOSE: T-3 guard — verifies computeExtensionResult marks overlapping
 *          original contract years as voidedByExtension when an extension
 *          is applied.
 */
import { describe, it, expect } from 'vitest';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import type { NormalizedMutationSalaryRow } from '@/features/architect/utils/mutationPipeline';

const TEAM_CODE = 'LAL';
const PLAYER_ID = 'player-42';

type ComputeMutationArgs = Parameters<typeof computeWorldMutation>[0];
type ExtendPlayerArgs = Extract<
  ComputeMutationArgs,
  { mutationType: 'extendPlayer' }
>;
type ExtensionCurrentState = ExtendPlayerArgs['currentState'];
type MutationResult = ReturnType<typeof computeWorldMutation>;

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function getUpdatedSalaries(
  result: MutationResult,
  message: string
): NormalizedMutationSalaryRow[] {
  const playerUpdate = requireValue(result.playerUpdates?.[0], message);
  const player = requireValue(playerUpdate.player, `${message}: player`);
  const futureContract = requireValue(
    player.futureContract,
    `${message}: futureContract`
  );

  return requireValue(
    futureContract.salariesByYear,
    `${message}: salariesByYear`
  );
}

function makePlayer(salariesByYear: NormalizedMutationSalaryRow[] = []) {
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

describe('computeExtensionResult — voidedByExtension marking', () => {
  it('marks overlapping original years as voidedByExtension', () => {
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

    expect(result.success).toBe(true);

    const salaries = getUpdatedSalaries(
      result,
      'Expected future-contract salary rows after overlapping extension mutation'
    );

    // Year 2026 is not overlapping — should NOT be voided
    const y2026 = salaries.find((r) => r.year === 2026);
    expect(y2026).toBeDefined();
    expect(requireValue(y2026, 'Expected 2026 salary row').voidedByExtension).toBeFalsy();

    // Years 2027 and 2028 overlap — original rows should be voided
    const originalRows = salaries.filter((r) => !r.isExtensionSeason);
    const voided2027 = originalRows.find((r) => r.year === 2027);
    const voided2028 = originalRows.find((r) => r.year === 2028);
    expect(requireValue(voided2027, 'Expected original 2027 salary row').voidedByExtension).toBe(true);
    expect(requireValue(voided2028, 'Expected original 2028 salary row').voidedByExtension).toBe(true);

    // Extension rows for 2027-2029 should be present and NOT voided
    const extRows = salaries.filter((r) => r.isExtensionSeason);
    expect(extRows).toHaveLength(3);
    expect(extRows.every((r) => !r.voidedByExtension)).toBe(true);
  });

  it('does not mark any year as voided when there is no overlap', () => {
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

    expect(result.success).toBe(true);

    const salaries = getUpdatedSalaries(
      result,
      'Expected future-contract salary rows after non-overlapping extension mutation'
    );
    const originalRows = salaries.filter((r) => !r.isExtensionSeason);
    expect(originalRows.every((r) => !r.voidedByExtension)).toBe(true);
  });

  it('handles season-string format years correctly for overlap detection', () => {
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

    expect(result.success).toBe(true);

    const salaries = getUpdatedSalaries(
      result,
      'Expected future-contract salary rows after season-string extension mutation'
    );
    const originalRows = salaries.filter((r) => !r.isExtensionSeason);

    // The row corresponding to 2026-27 should be voided
    const voided = originalRows.find(
      (r) => r.season === '2026-27' || r.year === 2027
    );
    expect(voided?.voidedByExtension).toBe(true);
  });
});
