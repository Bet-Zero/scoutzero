/**
 * FILE: tests/architect/reviewSeedHardCapApron.coverage.test.ts
 * PURPOSE: Deterministic coverage probe for the hard-cap / second-apron Full Cap
 *          Table review fixtures (BZE-91). Asserts the two focused fixtures expose
 *          the apron/hard-cap states the cockpit posture band renders, WITHOUT
 *          faking contradictory CBA state:
 *
 *            - PHX  — a real, triggered FIRST-apron hard cap (the team used its
 *                     Non-Taxpayer MLE, which records `hardCapTriggeredBy`). Its
 *                     roster salary stays below the first apron so it does not
 *                     exceed its own hard-cap ceiling.
 *            - MIN  — a team genuinely OVER the second apron, derived purely from
 *                     real salary (like MIA's first-apron band, one tier up). It
 *                     carries NO triggered hard cap and NO usable exceptions,
 *                     because second-apron teams have their exceptions frozen.
 *
 * This is a data-shape probe, not a render test. It reads the same JSON the review
 * seeder (scripts/emu/seedReviewData.ts) writes to Firestore, then asserts the
 * states a reviewer should be able to see at /gm/PHX and /gm/MIN in review mode.
 * The browser proof lives in tests/e2e/full-cap-table-hard-cap-apron.spec.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { capProjections } from '@/features/architect/utils/capProjections';

const SEED_DIR = path.resolve('scripts/emu/review_seed');
const TEAMS_DIR = path.join(SEED_DIR, 'baseTeams');
const PLAYERS_DIR = path.join(SEED_DIR, 'basePlayers');

const REVIEW_SEASON = '2026-27';

type ContractYear = {
  season: string;
  salary?: number;
  capHit?: number;
};

type PlayerFixture = {
  playerId: string;
  contract: { salariesByYear?: ContractYear[] };
};

type TeamTotals = {
  isOverTax?: boolean;
  isFirstApron?: boolean;
  isSecondApron?: boolean;
  isHardCapped?: boolean;
  hardCapLevel?: string | null;
  hardCapTriggeredBy?: string | null;
  hardCapReason?: string | null;
};

type TeamFixture = {
  teamCode: string;
  season: string;
  roster: string[];
  exceptions?: Record<string, unknown>;
  hardCapLevel?: string | null;
  hardCapTriggeredBy?: string | null;
  hardCapReason?: string | null;
  totals?: TeamTotals;
};

const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as T;

const loadTeam = (teamCode: string): TeamFixture =>
  readJson<TeamFixture>(path.join(TEAMS_DIR, `${teamCode}.json`));

const loadPlayer = (playerId: string): PlayerFixture | null => {
  const file = path.join(PLAYERS_DIR, `${playerId}.json`);
  return fs.existsSync(file) ? readJson<PlayerFixture>(file) : null;
};

const rosterSalaryForSeason = (team: TeamFixture, season: string): number =>
  team.roster.reduce((sum, id) => {
    const player = loadPlayer(id);
    const slice = (player?.contract.salariesByYear ?? []).find(
      (y) => y.season === season
    );
    return sum + (slice?.capHit ?? slice?.salary ?? 0);
  }, 0);

describe('Full Cap Table hard-cap / second-apron review fixtures (BZE-91)', () => {
  const lines = capProjections[REVIEW_SEASON];

  it('has apron projection lines for the review season', () => {
    expect(lines).toBeDefined();
    expect(lines.firstApron).toBeGreaterThan(0);
    expect(lines.secondApron).toBeGreaterThan(lines.firstApron);
  });

  describe('PHX — triggered first-apron hard cap', () => {
    const phx = loadTeam('PHX');

    it('targets the review season', () => {
      expect(phx.season).toBe(REVIEW_SEASON);
    });

    it('records a real hard-cap trigger (not a bare band flag)', () => {
      // A team is hard-capped ONLY when it actually triggered one (NT-MLE, BAE,
      // or sign-and-trade), which records `hardCapTriggeredBy`. The fixture
      // mirrors the trigger metadata at the top level (read by hydrateBaseTeam)
      // and inside totals (read by getHardCapStatus).
      expect(phx.hardCapTriggeredBy).toBeTruthy();
      expect(phx.totals?.hardCapTriggeredBy).toBeTruthy();
      expect(phx.totals?.isHardCapped).toBe(true);
    });

    it('is hard-capped at the FIRST apron with a user-facing reason', () => {
      expect(phx.hardCapLevel).toBe('firstApron');
      expect(phx.totals?.hardCapLevel).toBe('firstApron');
      const reason = phx.hardCapReason ?? phx.totals?.hardCapReason ?? '';
      expect(reason.length).toBeGreaterThan(0);
      expect(reason).toMatch(/MLE|apron/i);
    });

    it('keeps roster salary below the first apron so it does not exceed its own ceiling', () => {
      // Incomplete-roster charges only add to this, but the fixture leaves a wide
      // margin so the team stays comfortably under its hard-cap ceiling.
      const salary = rosterSalaryForSeason(phx, REVIEW_SEASON);
      expect(salary).toBeGreaterThan(0);
      expect(salary).toBeLessThan(lines.firstApron);
    });
  });

  describe('MIN — genuinely over the second apron (salary-derived)', () => {
    const min = loadTeam('MIN');

    it('targets the review season', () => {
      expect(min.season).toBe(REVIEW_SEASON);
    });

    it('roster salary actually crosses the second apron line', () => {
      // Apron posture is derived from real salary, so the fixture must actually
      // exceed the second apron rather than assert it via a flag.
      const salary = rosterSalaryForSeason(min, REVIEW_SEASON);
      expect(salary).toBeGreaterThan(lines.secondApron);
    });

    it('is NOT a triggered hard cap — second apron is a salary-derived band', () => {
      expect(min.hardCapTriggeredBy ?? null).toBeNull();
      expect(min.totals?.isHardCapped).toBe(false);
      expect(min.totals?.hardCapLevel ?? null).toBeNull();
      expect(min.totals?.isSecondApron).toBe(true);
    });

    it('carries no usable exceptions (second-apron teams have them frozen)', () => {
      expect(Object.keys(min.exceptions ?? {}).length).toBe(0);
    });
  });
});
