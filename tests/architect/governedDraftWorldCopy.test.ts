import { describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ fixture: true, live: false }));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  isGovernedDraftFixtureEnvironment: () => env.fixture,
  isSimulationDraftLiveEnabled: () => env.live,
}));

const { copiedLineageMatches, receiptWorldId, governedDraftWorldAvailable } =
  await import('@/features/architect/utils/governedDraftWorld.load');

describe('SIMULATION world copies (A6)', () => {
  const copy = {
    parentWorldId: 'parent',
    draftCopy: {
      parentWorldId: 'parent',
      receiptWorldIds: { op1: 'grandparent', op2: 'parent', bad: 7 },
    },
  };

  it('accepts only a root world or a server-recorded SIMULATION copy', () => {
    expect(copiedLineageMatches({}, 'software-fixture')).toBe(true);
    expect(copiedLineageMatches(copy, 'simulation')).toBe(true);
    // Software fixtures are never copyable.
    expect(copiedLineageMatches(copy, 'software-fixture')).toBe(false);
    // A rewritten parent or a removed parent does not match the record.
    expect(
      copiedLineageMatches({ ...copy, parentWorldId: 'other' }, 'simulation')
    ).toBe(false);
    expect(
      copiedLineageMatches({ ...copy, parentWorldId: null }, 'simulation')
    ).toBe(false);
    expect(
      copiedLineageMatches({ parentWorldId: 'parent' }, 'simulation')
    ).toBe(false);
  });

  it('binds each copied receipt to the world that committed it', () => {
    expect(receiptWorldId(copy, 'child', 'op1')).toBe('grandparent');
    expect(receiptWorldId(copy, 'child', 'op2')).toBe('parent');
    // Transfers made in the copy carry the copy's own receipts.
    expect(receiptWorldId(copy, 'child', 'op3')).toBe('child');
    expect(receiptWorldId(copy, 'child', 'bad')).toBeNull();
    expect(receiptWorldId(copy, 'child', 'toString')).toBe('child');
    expect(receiptWorldId({}, 'root', 'op1')).toBe('root');
  });

  it('runs SIMULATION worlds outside the emulator only behind the live switch', () => {
    env.fixture = false;
    env.live = false;
    expect(governedDraftWorldAvailable('simulation')).toBe(false);
    env.live = true;
    expect(governedDraftWorldAvailable('simulation')).toBe(true);
    // Software fixtures never run outside the local emulator.
    expect(governedDraftWorldAvailable('software-fixture')).toBe(false);
    env.fixture = true;
    env.live = false;
    expect(governedDraftWorldAvailable('software-fixture')).toBe(true);
  });
});
