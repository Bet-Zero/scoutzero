import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

describe('Base-state trade apply authoritative gate guardrail', () => {
  it('keeps the trade handoff on explicit normalize/commit/base-apply helpers before setTeamCapSheet', () => {
    const source =
      readSource('src/features/architect/GMDashboard/hooks/useArchitectActions.ts') +
      readSource('src/features/architect/GMDashboard/hooks/useArchitectActions.types.ts');

    expect(source).toContain('type TradeExecutionHandoff = {');

    const regionStart = source.indexOf(
      'const buildTradeExecutionHandoff = useCallback('
    );
    const regionEnd = source.indexOf('const handleSign = useCallback(');
    expect(regionStart).toBeGreaterThan(-1);
    expect(regionEnd).toBeGreaterThan(regionStart);

    const region = source.slice(regionStart, regionEnd);

    expect(region).toContain('const buildTradeExecutionHandoff = useCallback(');
    expect(region).toContain('const commitTradeExecutionHandoff = useCallback(');
    expect(region).toContain(
      'const applyTradeExecutionHandoffToBaseState = useCallback('
    );
    expect(region).toContain(
      'runAuthoritativeWorldMutationWithDashboardSync('
    );
    expect(region).toContain('loadWorldTeamData(');
    expect(region).toContain('computeWorldMutation({');
    expect(region).toContain("mutationType: 'executeTrade'");
    expect(region).toContain('_validatedTradeContext');
    expect(region).toContain('validatedContext.legal');
    expect(region).toContain('setTeamCapSheetSafe(updatedTeam as CapSheet)');
    expect(region).toContain(
      'const tradeExecutionHandoff = buildTradeExecutionHandoff(tradeData);'
    );
    expect(region).toContain(
      'await commitTradeExecutionHandoff(tradeExecutionHandoff);'
    );
    expect(region).toContain(
      'await applyTradeExecutionHandoffToBaseState(tradeExecutionHandoff);'
    );

    // Ensure we no longer use the old direct-local mutation path.
    expect(region).not.toContain('const targetTrade = tradeData.find');
    expect(region).not.toContain('updated.activeContracts?.push');

    const buildIdx = region.indexOf('const buildTradeExecutionHandoff = useCallback(');
    const commitIdx = region.indexOf('const commitTradeExecutionHandoff = useCallback(');
    const baseApplyIdx = region.indexOf(
      'const applyTradeExecutionHandoffToBaseState = useCallback('
    );
    const computeIdx = region.indexOf('computeWorldMutation({');
    const validatedContextIdx = region.indexOf('_validatedTradeContext');
    const legalIdx = region.indexOf('validatedContext.legal');
    const setTeamIdx = region.indexOf('setTeamCapSheetSafe(updatedTeam as CapSheet)');
    const applyIdx = region.indexOf('const applyTradeToCapSheet = useCallback(');

    expect(buildIdx).toBeGreaterThan(-1);
    expect(commitIdx).toBeGreaterThan(-1);
    expect(baseApplyIdx).toBeGreaterThan(-1);
    expect(computeIdx).toBeGreaterThan(-1);
    expect(validatedContextIdx).toBeGreaterThan(-1);
    expect(legalIdx).toBeGreaterThan(-1);
    expect(setTeamIdx).toBeGreaterThan(-1);
    expect(applyIdx).toBeGreaterThan(-1);

    expect(buildIdx).toBeLessThan(commitIdx);
    expect(commitIdx).toBeLessThan(baseApplyIdx);
    expect(baseApplyIdx).toBeLessThan(computeIdx);
    expect(computeIdx).toBeLessThan(validatedContextIdx);
    expect(validatedContextIdx).toBeLessThan(legalIdx);
    expect(legalIdx).toBeLessThan(setTeamIdx);
    expect(setTeamIdx).toBeLessThan(applyIdx);
  });
});
