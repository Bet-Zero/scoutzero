import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

describe('Base-state trade apply authoritative gate guardrail', () => {
  it('routes applyTradeToCapSheet through computeWorldMutation + validated context before setTeamCapSheet', () => {
    const source = readSource(
      'src/features/architect/GMDashboard/hooks/useArchitectActions.ts'
    );

    const regionStart = source.indexOf('const applyTradeToCapSheet = useCallback(');
    const regionEnd = source.indexOf('const handleSign = useCallback(');
    expect(regionStart).toBeGreaterThan(-1);
    expect(regionEnd).toBeGreaterThan(regionStart);

    const region = source.slice(regionStart, regionEnd);

    expect(region).toContain("runAuthoritativeFAMutation('executeTrade'");
    expect(region).toContain('loadWorldTeamData(');
    expect(region).toContain('computeWorldMutation({');
    expect(region).toContain("mutationType: 'executeTrade'");
    expect(region).toContain('_validatedTradeContext');
    expect(region).toContain('validatedContext.legal');
    expect(region).toContain('setTeamCapSheet(updatedTeam as CapSheet)');

    // Ensure we no longer use the old direct-local mutation path.
    expect(region).not.toContain('const targetTrade = tradeData.find');
    expect(region).not.toContain('updated.activeContracts?.push');

    const computeIdx = region.indexOf('computeWorldMutation({');
    const validatedContextIdx = region.indexOf('_validatedTradeContext');
    const legalIdx = region.indexOf('validatedContext.legal');
    const setTeamIdx = region.indexOf('setTeamCapSheet(updatedTeam as CapSheet)');

    expect(computeIdx).toBeGreaterThan(-1);
    expect(validatedContextIdx).toBeGreaterThan(-1);
    expect(legalIdx).toBeGreaterThan(-1);
    expect(setTeamIdx).toBeGreaterThan(-1);

    expect(computeIdx).toBeLessThan(validatedContextIdx);
    expect(validatedContextIdx).toBeLessThan(legalIdx);
    expect(legalIdx).toBeLessThan(setTeamIdx);
  });
});
