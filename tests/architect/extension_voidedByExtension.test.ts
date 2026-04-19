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

function makePlayer(salariesByYear = []) {
  return {
    player_id: PLAYER_ID,
    name: 'Test Player',
    displayName: 'Test Player',
    futureContract: {
      salariesByYear,
    },
  };
}

function makeTeam(player) {
  return {
    teamCode: TEAM_CODE,
    players: [player],
  };
}

describe('computeExtensionResult — voidedByExtension marking', () => {
  it('marks overlapping original years as voidedByExtension', () => {
    const player = makePlayer([
      { year: 2026, salary: 10_000_000 },
      { year: 2027, salary: 11_000_000 },
      { year: 2028, salary: 12_000_000 },
    ]);
    const team = makeTeam(player);

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        playerId: PLAYER_ID,
        extension: {
          salariesByYear: [
            { year: 2027, salary: 14_000_000 },
            { year: 2028, salary: 15_000_000 },
            { year: 2029, salary: 16_000_000 },
          ],
        },
      },
      currentState: { team, player, teamCode: TEAM_CODE },
      seasonId: '2025-2026',
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(true);

    const salaries = result.playerUpdates[0].player.futureContract.salariesByYear;

    // Year 2026 is not overlapping — should NOT be voided
    const y2026 = salaries.find((r) => r.year === 2026);
    expect(y2026).toBeDefined();
    expect(y2026.voidedByExtension).toBeFalsy();

    // Years 2027 and 2028 overlap — original rows should be voided
    const originalRows = salaries.filter((r) => !r.isExtensionSeason);
    const voided2027 = originalRows.find((r) => r.year === 2027);
    const voided2028 = originalRows.find((r) => r.year === 2028);
    expect(voided2027.voidedByExtension).toBe(true);
    expect(voided2028.voidedByExtension).toBe(true);

    // Extension rows for 2027-2029 should be present and NOT voided
    const extRows = salaries.filter((r) => r.isExtensionSeason);
    expect(extRows).toHaveLength(3);
    expect(extRows.every((r) => !r.voidedByExtension)).toBe(true);
  });

  it('does not mark any year as voided when there is no overlap', () => {
    const player = makePlayer([
      { year: 2026, salary: 10_000_000 },
      { year: 2027, salary: 11_000_000 },
    ]);
    const team = makeTeam(player);

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        playerId: PLAYER_ID,
        extension: {
          salariesByYear: [
            { year: 2028, salary: 14_000_000 },
            { year: 2029, salary: 15_000_000 },
          ],
        },
      },
      currentState: { team, player, teamCode: TEAM_CODE },
      seasonId: '2025-2026',
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(true);

    const salaries = result.playerUpdates[0].player.futureContract.salariesByYear;
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
      currentState: { team, player, teamCode: TEAM_CODE },
      seasonId: '2025-2026',
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(true);

    const salaries = result.playerUpdates[0].player.futureContract.salariesByYear;
    const originalRows = salaries.filter((r) => !r.isExtensionSeason);

    // The row corresponding to 2026-27 should be voided
    const voided = originalRows.find(
      (r) => r.season === '2026-27' || r.year === 2027
    );
    expect(voided?.voidedByExtension).toBe(true);
  });
});
