import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const helperPath = path.resolve(
  __dirname,
  '../../src/features/architect/utils/exceptionHistory/historyHelpers.js'
);

describe('exception-history helper import compatibility', () => {
  it('resolves helper via extensionless and explicit .js imports', async () => {
    const extensionless = await import(
      '@/features/architect/utils/exceptionHistory/historyHelpers'
    );
    const withJs = await import(
      '@/features/architect/utils/exceptionHistory/historyHelpers.js'
    );

    expect(extensionless.createTpeCreationHistoryEntry).toBeTypeOf('function');
    expect(extensionless.createTpeConsumptionHistoryEntry).toBeTypeOf(
      'function'
    );
    expect(extensionless.createTpeExpiryHistoryEntry).toBeTypeOf('function');
    expect(extensionless.buildExpiryHistoryKey).toBeTypeOf('function');
    expect(extensionless.appendExceptionHistory).toBeTypeOf('function');

    expect(withJs.createTpeCreationHistoryEntry).toBe(
      extensionless.createTpeCreationHistoryEntry
    );
    expect(withJs.createTpeConsumptionHistoryEntry).toBe(
      extensionless.createTpeConsumptionHistoryEntry
    );
    expect(withJs.createTpeExpiryHistoryEntry).toBe(
      extensionless.createTpeExpiryHistoryEntry
    );
    expect(withJs.buildExpiryHistoryKey).toBe(
      extensionless.buildExpiryHistoryKey
    );
    expect(withJs.appendExceptionHistory).toBe(
      extensionless.appendExceptionHistory
    );
    expect(withJs.exceptionHistoryHelpers).toBe(
      extensionless.exceptionHistoryHelpers
    );
  });

  it('kept js file remains a pure compatibility shim', () => {
    const shimContent = fs.readFileSync(helperPath, 'utf8');

    expect(shimContent).toContain("export * from './historyHelpers.ts';");
    expect(shimContent).not.toContain('const ENTRY_TYPES');
    expect(shimContent).not.toContain('function sanitizePlayers');
    expect(shimContent).not.toContain('appendExceptionHistory(team');
  });
});
