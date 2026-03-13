import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as computeTradeDraftKeyModule from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';
import * as devSntInjectorModule from '@/features/architect/tradeMachine/utils/devSntInjector';
import * as tradeExportUtilsModule from '@/features/architect/utils/tradeMachine/utils/tradeExportUtils';

describe('E77 Trade Machine hook-support helper compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const computeTradeDraftKeyShimPath = path.join(
    srcRoot,
    'tradeMachine/utils/computeTradeDraftKey.js'
  );
  const computeTradeDraftKeyAuthorityPath = path.join(
    srcRoot,
    'tradeMachine/utils/computeTradeDraftKey.ts'
  );
  const devSntInjectorShimPath = path.join(
    srcRoot,
    'tradeMachine/utils/devSntInjector.js'
  );
  const devSntInjectorAuthorityPath = path.join(
    srcRoot,
    'tradeMachine/utils/devSntInjector.ts'
  );
  const tradeExportUtilsShimPath = path.join(
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

  it('computeTradeDraftKey.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(computeTradeDraftKeyShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './computeTradeDraftKey.ts';");
  });

  it('devSntInjector.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(devSntInjectorShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './devSntInjector.ts';");
  });

  it('tradeExportUtils.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(tradeExportUtilsShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './tradeExportUtils.ts';");
  });

  it('computeTradeDraftKey explicit .js import matches extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/tradeMachine/utils/computeTradeDraftKey.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedComputeTradeDraftKeyExports).sort()
    );
    expect(Object.keys(computeTradeDraftKeyModule).sort()).toEqual(
      Array.from(expectedComputeTradeDraftKeyExports).sort()
    );
    expect('default' in explicitJsModule).toBe(false);

    for (const exportName of expectedComputeTradeDraftKeyExports) {
      expect(explicitJsModule[exportName]).toBe(
        computeTradeDraftKeyModule[exportName]
      );
    }
  });

  it('devSntInjector explicit .js import matches extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/tradeMachine/utils/devSntInjector.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedDevSntInjectorExports).sort()
    );
    expect(Object.keys(devSntInjectorModule).sort()).toEqual(
      Array.from(expectedDevSntInjectorExports).sort()
    );
    expect('default' in explicitJsModule).toBe(false);

    for (const exportName of expectedDevSntInjectorExports) {
      expect(explicitJsModule[exportName]).toBe(devSntInjectorModule[exportName]);
    }
  });

  it('tradeExportUtils explicit .js import matches extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/tradeMachine/utils/tradeExportUtils.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedTradeExportUtilsExports).sort()
    );
    expect(Object.keys(tradeExportUtilsModule).sort()).toEqual(
      Array.from(expectedTradeExportUtilsExports).sort()
    );
    expect('default' in explicitJsModule).toBe(false);

    for (const exportName of expectedTradeExportUtilsExports) {
      expect(explicitJsModule[exportName]).toBe(tradeExportUtilsModule[exportName]);
    }
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
