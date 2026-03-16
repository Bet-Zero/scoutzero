import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as computeTradeDraftKeyModule from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';
import * as devSntInjectorModule from '@/features/architect/tradeMachine/utils/devSntInjector';
import * as tradeExportUtilsModule from '@/features/architect/utils/tradeMachine/utils/tradeExportUtils';

describe('E77 Trade Machine hook-support helper compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const computeTradeDraftKeyDeletedPath = path.join(
    srcRoot,
    'tradeMachine/utils/computeTradeDraftKey.js'
  );
  const computeTradeDraftKeyAuthorityPath = path.join(
    srcRoot,
    'tradeMachine/utils/computeTradeDraftKey.ts'
  );
  const devSntInjectorDeletedPath = path.join(
    srcRoot,
    'tradeMachine/utils/devSntInjector.js'
  );
  const devSntInjectorAuthorityPath = path.join(
    srcRoot,
    'tradeMachine/utils/devSntInjector.ts'
  );
  const tradeExportUtilsDeletedPath = path.join(
    srcRoot,
    'utils/tradeMachine/utils/tradeExportUtils.js'
  );
  const tradeExportUtilsAuthorityPath = path.join(
    srcRoot,
    'utils/tradeMachine/utils/tradeExportUtils.ts'
  );
  const expectedComputeTradeDraftKeyExports = [
    'computeTradeDraftKey',
    'isValidationCurrent',
  ] as const;
  const expectedComputeTradeDraftKeySourceOrder = [
    'computeTradeDraftKey',
    'isValidationCurrent',
  ] as const;
  const expectedDevSntInjectorExports = [
    'DEV_SNT_INJECTOR_FLAG',
    'DEV_SNT_INJECTOR_MARKER',
    'buildSyntheticSntPlayers',
    'clearSyntheticSntPlayersFromTeams',
    'hasSyntheticSntPlayers',
    'injectSyntheticSntPlayersIntoTeams',
    'isSyntheticSntPlayer',
    'stripSyntheticSntPlayers',
  ] as const;
  const expectedDevSntInjectorSourceOrder = [
    'DEV_SNT_INJECTOR_MARKER',
    'DEV_SNT_INJECTOR_FLAG',
    'isSyntheticSntPlayer',
    'stripSyntheticSntPlayers',
    'buildSyntheticSntPlayers',
    'injectSyntheticSntPlayersIntoTeams',
    'clearSyntheticSntPlayersFromTeams',
    'hasSyntheticSntPlayers',
  ] as const;
  const expectedTradeExportUtilsExports = ['extractUsedTpeIds'] as const;
  const expectedTradeExportUtilsSourceOrder = ['extractUsedTpeIds'] as const;

  it('deleted helper shims are absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(computeTradeDraftKeyDeletedPath)).toBe(false);
    expect(fs.existsSync(devSntInjectorDeletedPath)).toBe(false);
    expect(fs.existsSync(tradeExportUtilsDeletedPath)).toBe(false);
  });

  it('extensionless helper imports still expose the expected APIs', () => {
    expect(Object.keys(computeTradeDraftKeyModule).sort()).toEqual(
      Array.from(expectedComputeTradeDraftKeyExports).sort()
    );
    expect(Object.keys(devSntInjectorModule).sort()).toEqual(
      Array.from(expectedDevSntInjectorExports).sort()
    );
    expect(Object.keys(tradeExportUtilsModule).sort()).toEqual(
      Array.from(expectedTradeExportUtilsExports).sort()
    );
    expect(computeTradeDraftKeyModule.computeTradeDraftKey).toBeDefined();
    expect(devSntInjectorModule.injectSyntheticSntPlayersIntoTeams).toBeDefined();
    expect(tradeExportUtilsModule.extractUsedTpeIds).toBeDefined();
  });

  it('computeTradeDraftKey.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(computeTradeDraftKeyAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedComputeTradeDraftKeySourceOrder));
    expect(source).not.toContain('export default');
  });

  it('devSntInjector.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(devSntInjectorAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedDevSntInjectorSourceOrder));
    expect(source).not.toContain('export default');
  });

  it('tradeExportUtils.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(tradeExportUtilsAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedTradeExportUtilsSourceOrder));
    expect(source).not.toContain('export default');
  });

  it('devSntInjector constants retain their current values', () => {
    expect(devSntInjectorModule.DEV_SNT_INJECTOR_MARKER).toBe(
      '__tmDevSyntheticSnt'
    );
    expect(devSntInjectorModule.DEV_SNT_INJECTOR_FLAG).toBe(
      'hz.dev.injectSntPlayers'
    );
  });
});
