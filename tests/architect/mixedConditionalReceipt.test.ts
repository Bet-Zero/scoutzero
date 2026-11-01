import { describe, expect, it } from 'vitest';
import { combineMixedConditionalReceipts } from '../e2e/helpers/mixedConditionalReceipt';

const candidate = 'a'.repeat(40);
const packageSha256 = 'b'.repeat(64);
const journeys = () =>
  [10, 11].map((position) => ({
    candidate,
    packageSha256,
    position,
    scope: 'governed-simulation-only',
    bothTeamsReloadedAtEveryStage: true,
  }));

describe('mixed conditional certification receipt lineage', () => {
  it('publishes the release identity required by the existing wrapper', () => {
    const input = journeys();
    const proof = combineMixedConditionalReceipts(candidate, input);
    expect(proof.packageSha256).toBe(packageSha256);
    expect(proof.candidate).toBe(candidate);
    expect(proof.journeys).toEqual(input);
  });

  it.each([
    { packageSha256: 'c'.repeat(64) },
    { packageSha256: '' },
    { candidate: 'd'.repeat(40) },
    { scope: 'production' },
    { position: 10 },
  ])('rejects a conflicting journey %j', (change) => {
    const input = journeys();
    Object.assign(input[1], change);
    expect(() => combineMixedConditionalReceipts(candidate, input)).toThrow();
  });

  it('requires both outcomes and a frozen candidate', () => {
    expect(() =>
      combineMixedConditionalReceipts(candidate, journeys().slice(0, 1))
    ).toThrow();
    expect(() =>
      combineMixedConditionalReceipts(undefined, journeys())
    ).toThrow();
  });
});
