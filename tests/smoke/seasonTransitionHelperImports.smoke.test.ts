import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const utilsRoot = path.resolve(__dirname, '../../src/features/architect/utils');

describe('season-transition helper import compatibility', () => {
  it('resolves tpeLifecycle via extensionless and TS authority imports', async () => {
    const extensionless = await import('@/features/architect/utils/tpeLifecycle');
    const authority = await import('../../src/features/architect/utils/tpeLifecycle.ts');

    expect(extensionless.processTradeExceptions).toBeTypeOf('function');
    expect(extensionless.getTpeExpiryISO).toBeTypeOf('function');
    expect(authority.processTradeExceptions).toBe(
      extensionless.processTradeExceptions
    );
    expect(authority.getTpeExpiryISO).toBe(extensionless.getTpeExpiryISO);
  });

  it('resolves exception lifecycle via barrel, extensionless, and explicit .js imports', async () => {
    const barrel = await import('@/features/architect/utils/exceptions');
    const extensionless = await import(
      '@/features/architect/utils/exceptions/exceptionLifecycle'
    );
    const withJs = await import(
      '@/features/architect/utils/exceptions/exceptionLifecycle.js'
    );

    expect(barrel.resetTeamNonTpeExceptionsForNewSeason).toBeTypeOf('function');
    expect(barrel.validateNonTpeExceptionsForYear).toBeTypeOf('function');
    expect(Array.isArray(barrel.NON_TPE_EXCEPTION_TYPES)).toBe(true);

    expect(extensionless.resetTeamNonTpeExceptionsForNewSeason).toBe(
      barrel.resetTeamNonTpeExceptionsForNewSeason
    );
    expect(withJs.validateNonTpeExceptionsForYear).toBe(
      extensionless.validateNonTpeExceptionsForYear
    );
    expect(withJs.NON_TPE_EXCEPTION_TYPES).toBe(
      extensionless.NON_TPE_EXCEPTION_TYPES
    );
  });

  it('resolves seasonManagerProjection via extensionless and explicit .js imports', async () => {
    const extensionless = await import(
      '@/features/architect/utils/entitlements/seasonManagerProjection'
    );

    expect(extensionless.projectEntitlementsToSeasonManagerView).toBeTypeOf(
      'function'
    );
    expect(extensionless.__test__selectDraftPicksSource).toBeTypeOf('function');
    expect(extensionless.logDerivedPicksCreation).toBeTypeOf('function');
  });

  it('retained helper shims stay intentional and seasonManagerProjection.js stays absent', () => {
    const exceptionShim = fs.readFileSync(
      path.join(utilsRoot, 'exceptions/exceptionLifecycle.js'),
      'utf8'
    );
    const projectionAuthority = fs.readFileSync(
      path.join(utilsRoot, 'entitlements/seasonManagerProjection.ts'),
      'utf8'
    );

    expect(fs.existsSync(path.join(utilsRoot, 'tpeLifecycle.js'))).toBe(false);

    expect(exceptionShim).toContain("export * from './exceptionLifecycle.ts';");
    expect(exceptionShim).not.toContain('getCapRulesForYear');
    expect(exceptionShim).not.toContain('Object.freeze([');

    expect(fs.existsSync(path.join(utilsRoot, 'entitlements/seasonManagerProjection.js'))).toBe(
      false
    );
    expect(projectionAuthority.length).toBeGreaterThan(0);
  });
});
