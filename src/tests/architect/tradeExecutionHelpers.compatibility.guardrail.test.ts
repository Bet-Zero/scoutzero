import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as schemaAdapterModule from '@/features/architect/utils/schemaAdapter';
import * as tradeManagerModule from '@/features/architect/utils/tradeManager';

describe('E75 trade execution helper compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const schemaAdapterDeletedPath = path.join(srcRoot, 'utils/schemaAdapter.js');
  const schemaAdapterAuthorityPath = path.join(srcRoot, 'utils/schemaAdapter.ts');
  const tradeManagerDeletedPath = path.join(srcRoot, 'utils/tradeManager.js');
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

  it('deleted execution-helper shims are absent after the E113 shim deletion batch', () => {
    expect(fs.existsSync(schemaAdapterDeletedPath)).toBe(false);
    expect(fs.existsSync(tradeManagerDeletedPath)).toBe(false);
  });

  it('extensionless imports expose the same schemaAdapter API as the surviving authority', () => {
    expect(Object.keys(schemaAdapterModule).sort()).toEqual(
      Array.from(expectedSchemaAdapterExports)
    );
    expect(schemaAdapterModule.buildTradeInput).toBeDefined();
    expect(schemaAdapterModule.buildTradeTeamInput).toBeDefined();
  });

  it('extensionless imports expose the same tradeManager API as the surviving authority', () => {
    expect(Object.keys(tradeManagerModule).sort()).toEqual(
      Array.from(expectedTradeManagerExports)
    );
    expect(tradeManagerModule.executeTrade).toBeDefined();
    expect(tradeManagerModule.extendPlayer).toBeDefined();
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
