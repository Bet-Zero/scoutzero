import assert from 'node:assert/strict';
import test from 'node:test';
import { rankerScoreFromSnapshot } from '../../scripts/dev/rankerScore.js';
import {
  earlierSeasonCodes,
  RANKER_SCORE_FORMULA_VERSION,
  rankerScoreFromSeasons,
} from '../../src/features/ranker/utils/playerImpact.js';

const docs = (entries: Record<string, Record<string, unknown>>) => (path: string) => entries[path] ?? null;

test('stores the app formula: this season blended with last, or a better earlier season', () => {
  const read = docs({
    'players_v2/star/seasons/2025-26': { stats: { PTS: 30, GP: 70 } },
    'players_v2/star/seasons/2023-24': { stats: { PTS: 34, GP: 60 } },
  });
  const staged = { doc: {}, seasons: { '2026-27': { stats: { PTS: 20, GP: 20 } } } };
  const score = rankerScoreFromSnapshot(read, 'star', staged, '2026-27');
  const expected = rankerScoreFromSeasons(
    { PTS: 20, GP: 20 },
    [{ PTS: 30, GP: 70 }, null, { PTS: 34, GP: 60 }],
    { isCurrentSeason: true }
  );
  assert.equal(score.value, expected);
  // Best of: the blend (25), last season's 30 at -5%, and 34 three seasons back at -5% per season
  assert.equal(score.value, Math.max(25, 30 * 0.95, 34 * 0.95 ** 3));
  assert.equal(score.season, '2026-27');
  assert.equal(score.formulaVersion, RANKER_SCORE_FORMULA_VERSION);
});

test("this run's staged season wins over the database copy", () => {
  const read = docs({ 'players_v2/p/seasons/2026-27': { stats: { PTS: 5, GP: 40 } } });
  const score = rankerScoreFromSnapshot(read, 'p', { seasons: { '2026-27': { stats: { PTS: 25, GP: 40 } } } }, '2026-27');
  assert.equal(score.value, 25);
});

test('falls back to the main record current stats, and stores null when nothing scores', () => {
  const fromMain = rankerScoreFromSnapshot(
    docs({ 'players_v2/p': { currentSeasonStats: { PTS: 12, GP: 10 } } }),
    'p',
    { doc: {} },
    '2026-27'
  );
  assert.equal(fromMain.value, 12);
  const none = rankerScoreFromSnapshot(docs({}), 'rookie', { doc: {}, seasons: {} }, '2026-27');
  assert.equal(none.value, null);
});

test('earlier season codes count back from the refreshed season', () => {
  assert.deepEqual(earlierSeasonCodes('2026-27'), ['2025-26', '2024-25', '2023-24']);
  assert.deepEqual(earlierSeasonCodes('1999-00', 2), ['1998-99', '1997-98']);
});
