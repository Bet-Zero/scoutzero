/**
 * FILE: tests/architect/reviewSeedFullCapTable.coverage.test.ts
 * PURPOSE: Deterministic coverage probe for the MIA Full Cap Table review
 *          fixture (BZE-85). Asserts the seed exposes the cap/table states the
 *          Full Cap Table renders (cap holds, dead money, exceptions/TPE,
 *          Player/Team options, non-guaranteed years, two-way, apron band) so
 *          future Full Cap Table review sessions exercise real data instead of
 *          the thin 0-/3-player seeds.
 *
 * This is a data-shape probe, not a render test. It reads the same JSON the
 * review seeder (scripts/emu/seedReviewData.ts) writes to Firestore, then
 * asserts the states a reviewer should be able to see at /gm/MIA in review mode.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { capProjections } from '@/features/architect/utils/capProjections';

const SEED_DIR = path.resolve('scripts/emu/review_seed');
const TEAM_FILE = path.join(SEED_DIR, 'baseTeams', 'MIA.json');
const PLAYERS_DIR = path.join(SEED_DIR, 'basePlayers');

const REVIEW_SEASON = '2026-27';
const REVIEW_SEASON_START_YEAR = 2026;

type ContractYear = {
  season: string;
  salary?: number;
  capHit?: number;
  guaranteed?: boolean;
  option?: string | null;
};

type PlayerFixture = {
  playerId: string;
  displayName: string;
  contract: {
    contractType?: string;
    isRookieScale?: boolean;
    endSeason?: string;
    salariesByYear?: ContractYear[];
    freeAgency?: { type?: string | null; year?: number; capHold?: number };
  };
};

type CapHold = {
  playerId: string;
  playerName?: string;
  amount: number;
  type?: string;
  season?: string;
};

type DeadCapItem = {
  playerId: string;
  amountByYear: Array<{ season: string; amount: number }>;
};

type TeamFixture = {
  teamCode: string;
  season: string;
  roster: string[];
  deadCap: DeadCapItem[];
  capHolds: CapHold[];
  exceptions: {
    taxpayerMle?: Record<string, unknown>;
    tpe?: Array<Record<string, unknown>>;
  };
};

const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as T;

const loadRosterPlayer = (playerId: string): PlayerFixture | null => {
  const file = path.join(PLAYERS_DIR, `${playerId}.json`);
  return fs.existsSync(file) ? readJson<PlayerFixture>(file) : null;
};

const yearSlice = (player: PlayerFixture, season: string) =>
  (player.contract.salariesByYear ?? []).find((y) => y.season === season);

describe('Full Cap Table review fixture coverage (MIA / BZE-85)', () => {
  const team = readJson<TeamFixture>(TEAM_FILE);
  const rosterPlayers = team.roster
    .map(loadRosterPlayer)
    .filter((p): p is PlayerFixture => p !== null);

  it('targets the review season at a fuller-roster size (12–15)', () => {
    expect(team.season).toBe(REVIEW_SEASON);
    expect(team.roster.length).toBeGreaterThanOrEqual(12);
    expect(team.roster.length).toBeLessThanOrEqual(15);
  });

  it('every rostered player resolves to a seeded basePlayer fixture', () => {
    expect(rosterPlayers.length).toBe(team.roster.length);
  });

  it('exposes both a Player Option and a Team Option year', () => {
    const options = rosterPlayers.flatMap((p) =>
      (p.contract.salariesByYear ?? []).map((y) => y.option)
    );
    expect(options).toContain('Player Option');
    expect(options).toContain('Team Option');
  });

  it('includes a rookie-scale and a two-way contract', () => {
    expect(rosterPlayers.some((p) => p.contract.isRookieScale === true)).toBe(
      true
    );
    expect(
      rosterPlayers.some(
        (p) => (p.contract.contractType ?? '').toLowerCase() === 'two-way'
      )
    ).toBe(true);
  });

  it('includes a non-guaranteed future contract year', () => {
    const hasNonGuaranteedFutureYear = rosterPlayers.some((p) =>
      (p.contract.salariesByYear ?? []).some(
        (y) => y.season !== REVIEW_SEASON && y.guaranteed === false
      )
    );
    expect(hasNonGuaranteedFutureYear).toBe(true);
  });

  it('carries a dead-money schedule spanning multiple seasons', () => {
    const multiSeason = team.deadCap.find(
      (d) =>
        new Set(d.amountByYear.map((a) => a.season)).size >= 2 &&
        d.amountByYear.every((a) => a.amount > 0)
    );
    expect(multiSeason).toBeDefined();
  });

  it('exposes a live own-FA cap hold that renders as a renounce-able row', () => {
    // A main own-FA hold: player is on the roster (so isOnRoster=true), the
    // contract has expired (no review-season salary, so no visible roster row),
    // and the player becomes a free agent for the season being planned.
    const ownFaHold = team.capHolds.find((hold) => {
      if ((hold.type ?? '').toLowerCase().includes('fa cap hold')) return false;
      const player = loadRosterPlayer(hold.playerId);
      if (!player) return false;
      const hasReviewSeasonSalary = Boolean(yearSlice(player, REVIEW_SEASON));
      const becomesFaThisOffseason =
        player.contract.freeAgency?.year === REVIEW_SEASON_START_YEAR;
      return !hasReviewSeasonSalary && becomesFaThisOffseason;
    });
    expect(ownFaHold).toBeDefined();
    expect(ownFaHold?.amount).toBeGreaterThan(0);
  });

  it('includes a legacy/dead off-roster hold for the holds drawer', () => {
    const legacyHold = team.capHolds.find(
      (hold) =>
        (hold.type ?? '').toLowerCase().includes('fa cap hold') &&
        !team.roster.includes(hold.playerId)
    );
    expect(legacyHold).toBeDefined();
  });

  it('carries an exception and a TPE', () => {
    expect(team.exceptions.taxpayerMle).toBeDefined();
    expect(Array.isArray(team.exceptions.tpe)).toBe(true);
    expect((team.exceptions.tpe ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('sits in the first-apron band for the review season', () => {
    const lines = capProjections[REVIEW_SEASON];
    expect(lines).toBeDefined();

    const rosterSalary = rosterPlayers.reduce((sum, p) => {
      const slice = yearSlice(p, REVIEW_SEASON);
      return sum + (slice?.capHit ?? slice?.salary ?? 0);
    }, 0);

    const ownFaHoldTotal = team.capHolds
      .filter(
        (h) =>
          h.season === REVIEW_SEASON &&
          !(h.type ?? '').toLowerCase().includes('fa cap hold')
      )
      .reduce((sum, h) => sum + (h.amount ?? 0), 0);

    const deadMoneyThisSeason = team.deadCap.reduce((sum, d) => {
      const entry = d.amountByYear.find((a) => a.season === REVIEW_SEASON);
      return sum + (entry?.amount ?? 0);
    }, 0);

    const totalCapAllocations =
      rosterSalary + ownFaHoldTotal + deadMoneyThisSeason;

    // Apron states are derived from real salary, so the fixture must actually
    // cross the first apron without tipping over the second (which would freeze
    // the exceptions above and contradict the carried-exception coverage).
    expect(totalCapAllocations).toBeGreaterThanOrEqual(lines.firstApron);
    expect(totalCapAllocations).toBeLessThan(lines.secondApron);
  });
});
