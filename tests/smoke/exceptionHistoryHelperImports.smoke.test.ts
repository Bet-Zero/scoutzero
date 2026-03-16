import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const deletedHelperPath = path.resolve(
  __dirname,
  '../../src/features/architect/utils/exceptionHistory/historyHelpers.js'
);
const authorityPath = path.resolve(
  __dirname,
  '../../src/features/architect/utils/exceptionHistory/historyHelpers.ts'
);

describe('exception-history helper import compatibility', () => {
  it('resolves helper via extensionless imports after the E113 shim deletion batch', async () => {
    const extensionless = await import(
      '@/features/architect/utils/exceptionHistory/historyHelpers'
    );

    expect(extensionless.createTpeCreationHistoryEntry).toBeTypeOf('function');
    expect(extensionless.createTpeConsumptionHistoryEntry).toBeTypeOf(
      'function'
    );
    expect(extensionless.createTpeExpiryHistoryEntry).toBeTypeOf('function');
    expect(extensionless.buildExpiryHistoryKey).toBeTypeOf('function');
    expect(extensionless.appendExceptionHistory).toBeTypeOf('function');
    expect(extensionless.exceptionHistoryHelpers).toBeDefined();
  });

  it('historyHelpers.js stays absent while the TS authority remains in place', () => {
    const authorityContent = fs.readFileSync(authorityPath, 'utf8');

    expect(fs.existsSync(deletedHelperPath)).toBe(false);
    expect(authorityContent.length).toBeGreaterThan(0);
  });
});
