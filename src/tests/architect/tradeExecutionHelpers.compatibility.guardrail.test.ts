import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as schemaAdapterModule from '@/features/architect/utils/schemaAdapter';
import * as tradeManagerModule from '@/features/architect/utils/tradeManager';

describe('E75 trade execution helper compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const schemaAdapterShimPath = path.join(srcRoot, 'utils/schemaAdapter.js');
  const schemaAdapterAuthorityPath = path.join(srcRoot, 'utils/schemaAdapter.ts');
  const tradeManagerShimPath = path.join(srcRoot, 'utils/tradeManager.js');
  const tradeManagerAuthorityPath = path.join(srcRoot, 'utils/tradeManager.ts');
  const expectedSchemaAdapterExports = [
    'adaptContractForValidator',
    'adaptPlayerForValidator',
    'adaptTeamForValidator',
    'adaptTradeInputForValidator',
    'buildTradeInput',
    'buildTradeTeamInput',
  ] as const;
  const expectedSchemaAdapterSourceOrder = [
    'buildTradeTeamInput',
    'adaptPlayerForValidator',
    'adaptContractForValidator',
    'buildTradeInput',
    'adaptTeamForValidator',
    'adaptTradeInputForValidator',
  ] as const;
  const expectedTradeManagerExports = [
    'executeTrade',
    'extendPlayer',
    'signFreeAgent',
    'waivePlayer',
  ] as const;
  const expectedTradeManagerSourceOrder = [
    'executeTrade',
    'signFreeAgent',
    'waivePlayer',
    'extendPlayer',
  ] as const;

  it('schemaAdapter.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(schemaAdapterShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './schemaAdapter.ts';");
  });

  it('tradeManager.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(tradeManagerShimPath, 'utf-8').trim();

    expect(source).toBe("export * from './tradeManager.ts';");
  });

  it('explicit .js imports expose the same schemaAdapter API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/schemaAdapter.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedSchemaAdapterExports)
    );
    expect(Object.keys(schemaAdapterModule).sort()).toEqual(
      Array.from(expectedSchemaAdapterExports)
    );
    expect('default' in explicitJsModule).toBe(false);

    for (const exportName of expectedSchemaAdapterExports) {
      expect(explicitJsModule[exportName]).toBe(schemaAdapterModule[exportName]);
    }
  });

  it('explicit .js imports expose the same tradeManager API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/tradeManager.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual(
      Array.from(expectedTradeManagerExports)
    );
    expect(Object.keys(tradeManagerModule).sort()).toEqual(
      Array.from(expectedTradeManagerExports)
    );
    expect('default' in explicitJsModule).toBe(false);

    for (const exportName of expectedTradeManagerExports) {
      expect(explicitJsModule[exportName]).toBe(tradeManagerModule[exportName]);
    }
  });

  it('schemaAdapter.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(schemaAdapterAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedSchemaAdapterSourceOrder));
    expect(source).not.toContain('export default');
  });

  it('tradeManager.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(tradeManagerAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedTradeManagerSourceOrder));
    expect(source).not.toContain('export default');
  });
});
