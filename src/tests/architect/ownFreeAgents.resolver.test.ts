import { describe, it, expect } from 'vitest';
import { resolveOwnFreeAgents } from '@/features/architect/utils/ownFreeAgents';

// BZE-249: the Free Agency room's Sign & Trade start point must surface the
// SAME own free agents the Full Cap Table shows as FA decision rows. This
// fixture mirrors capSheetFull.signAndTradeOwnFa.behavior.test.tsx so the two
// surfaces are proven to resolve the identical player.
const CURRENT_YEAR = 2027; // end-year of the 2026-27 season being planned

const GRANT = {
  id: 'mia_grant_holloway',
  player_id: 'mia_grant_holloway',
  name: 'Grant Holloway',
  displayName: 'Grant Holloway',
  bio: { playerId: 'mia_grant_holloway', displayName: 'Grant Holloway' },
  contract: {
    salariesByYear: [
      {
        year: 2026,
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
      },
    ],
    birdRights: { status: 'Bird' },
    freeAgency: { type: 'UFA', year: 2026, capHold: 15_000_000 },
  },
};

const baseTeamCapSheet = {
  teamId: 'MIA',
  teamCode: 'MIA',
  players: [GRANT],
  capHolds: [
    {
      playerId: 'mia_grant_holloway',
      playerName: 'Grant Holloway',
      amount: 15_000_000,
      season: '2026-27',
      type: 'UFA',
      active: true,
      isSigned: false,
    },
  ],
};

const playersMap = { mia_grant_holloway: GRANT };

describe('resolveOwnFreeAgents (BZE-249)', () => {
  it('resolves an own free agent for the active season into one entry', () => {
    const entries = resolveOwnFreeAgents(
      baseTeamCapSheet,
      playersMap,
      CURRENT_YEAR
    );

    expect(entries).toHaveLength(1);
    const [grant] = entries;
    expect(grant.playerId).toBe('mia_grant_holloway');
    expect(grant.playerName).toBe('Grant Holloway');
    expect(grant.faType).toBe('UFA');
    expect(grant.capHoldAmount).toBe(15_000_000);
    // The full player record resolves so the Trade Machine seed carries a real
    // player, not just a name.
    expect(grant.player).toBe(GRANT);
    expect(grant.rights.placement).toBe('main');
  });

  it('excludes an already-signed cap hold', () => {
    const signed = {
      ...baseTeamCapSheet,
      capHolds: [{ ...baseTeamCapSheet.capHolds[0], isSigned: true }],
    };
    expect(resolveOwnFreeAgents(signed, playersMap, CURRENT_YEAR)).toHaveLength(
      0
    );
  });

  it('excludes a hold whose free agency is not the active season', () => {
    // Next season's free agent (2027 free agency) is not a decision for the
    // 2026-27 books → not surfaced as a current own free agent.
    const nextSeasonPlayer = {
      ...GRANT,
      contract: {
        ...GRANT.contract,
        freeAgency: { type: 'UFA', year: 2027, capHold: 15_000_000 },
      },
    };
    const nextSeason = {
      ...baseTeamCapSheet,
      players: [nextSeasonPlayer],
      capHolds: [{ ...baseTeamCapSheet.capHolds[0], season: '2027-28' }],
    };
    expect(
      resolveOwnFreeAgents(
        nextSeason,
        { mia_grant_holloway: nextSeasonPlayer },
        CURRENT_YEAR
      )
    ).toHaveLength(0);
  });

  it('returns an empty list for a missing or empty team cap sheet', () => {
    expect(resolveOwnFreeAgents(null, playersMap, CURRENT_YEAR)).toEqual([]);
    expect(
      resolveOwnFreeAgents(
        { players: [], capHolds: [] },
        playersMap,
        CURRENT_YEAR
      )
    ).toEqual([]);
  });
});
