import { describe, it, expect } from 'vitest';
import {
  inventoryDigests,
  verifyOriginalWorld,
  type WorldInventory,
  type OriginalWorldExpectation,
} from '../helpers/worldPreservation';

function original() {
  const identity = {
    createdBy: 'synthetic-owner',
    currentSeason: '2025-26',
    asOfDate: '2026-06-05',
    contractSourceRelease: {
      releaseId: 'synthetic-release',
      releaseVersion: 1,
      releaseDigest: `sha256:${'a'.repeat(64)}`,
    },
    simulationFinancialBaseline: null,
    draftBaseline: { classification: 'simulation' },
  };
  const rows: WorldInventory = {
    '.': { worldId: 'original', ...identity },
    'contractBaselines/one': {
      worldId: 'original',
      ledgers: [{ synthetic: true }],
    },
    'draftBaselines/root': { synthetic: true },
    'entitlements/one': { synthetic: true },
    'teams/AAA/players/one/history/nested': { retained: true },
  };
  for (let n = 0; n < 30; n++) {
    const code = `A${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + (n % 26))}`;
    rows[`teams/${code}`] = { teamCode: code, players: [{ synthetic: true }] };
  }
  const expected: OriginalWorldExpectation = {
    worldId: 'original',
    identity,
    documents: inventoryDigests(rows),
  };
  return { expected, rows };
}
describe('nonvacuous saved-world preservation', () => {
  it('accepts populated originals and their unchanged recursive inventory', () => {
    const { expected, rows } = original();
    verifyOriginalWorld(expected, rows);
    verifyOriginalWorld(expected, structuredClone(rows));
  });
  it.each([
    'missing',
    'empty',
    'owner',
    'world',
    'release',
    'season',
    'roster',
    'contracts',
    'draft',
    'nested-change',
    'nested-missing',
    'extra',
  ])('rejects %s originals without reporting their contents', (kind) => {
    const { expected, rows } = original();
    if (kind === 'missing') delete rows['.'];
    if (kind === 'empty')
      for (const p of Object.keys(rows)) if (p !== '.') delete rows[p];
    if (kind === 'owner') rows['.'].createdBy = 'PRIVATE_SENTINEL';
    if (kind === 'world') rows['.'].worldId = 'incorrect';
    if (kind === 'release')
      rows['.'].contractSourceRelease = { releaseId: 'incorrect' };
    if (kind === 'season') rows['.'].currentSeason = '2026-27';
    if (kind === 'roster') rows['teams/AAA'].players = [];
    if (kind === 'contracts') rows['contractBaselines/one'].ledgers = [];
    if (kind === 'draft') delete rows['entitlements/one'];
    if (kind === 'nested-change')
      rows['teams/AAA/players/one/history/nested'].retained = false;
    if (kind === 'nested-missing')
      delete rows['teams/AAA/players/one/history/nested'];
    if (kind === 'extra') rows['events/new'] = { private: 'PRIVATE_SENTINEL' };
    expect(() => verifyOriginalWorld(expected, rows)).toThrow(
      'Original-world preservation failed'
    );
    try {
      verifyOriginalWorld(expected, rows);
    } catch (e) {
      expect(String(e)).not.toContain('PRIVATE_SENTINEL');
    }
  });
  it('does not accept empty ledgers/rosters even with matching digests', () => {
    const { expected, rows } = original();
    rows['teams/AAA'].players = [];
    expected.documents = inventoryDigests(rows);
    expect(() => verifyOriginalWorld(expected, rows)).toThrow(
      'empty or incomplete'
    );
  });
  it('requires a populated separately supplied expectation', () => {
    const { expected, rows } = original();
    expected.documents = {};
    expect(() => verifyOriginalWorld(expected, rows)).toThrow();
    expect(() =>
      verifyOriginalWorld({} as OriginalWorldExpectation, rows)
    ).toThrow();
  });
});
